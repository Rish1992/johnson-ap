"""Pipeline & playground endpoints — async job-based execution."""

import asyncio
import json
import shutil
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from db import get_db, SessionLocal
from sqlalchemy.orm.attributes import flag_modified
from models import Email, PromptTemplate, Case, Job, new_id, utcnow
from agents.runner import (
    run_claude_step, create_workspace, prepare_step, write_master_data,
    RESUME_PROMPT_TEXT,
)
from agents.doc_splitter import split_merged_pdf
from agents.bbox_locator import find_invoice_pdf, locate_bboxes

router = APIRouter(prefix="/api", tags=["pipeline"])

STEPS_BACKEND = ["classify", "categorize", "verify_docs", "extract", "validate"]
STEPS_FRONTEND = ["classify", "categorize", "verify_docs", "extract", "validate"]
PROMPT_TEXT = (
    "Read PROMPT.md for your instructions and OUTPUT_SCHEMA.json for the expected output format. "
    "Follow the file-reading instructions in PROMPT.md exactly — read only the files it tells you to read. "
    "Return ONLY the JSON object, no other text."
)


def _new_job_id() -> str:
    return f"JOB-{new_id('')[:8]}"


def _init_steps(step_names: list[str]) -> list[dict]:
    return [{"name": s, "status": "pending", "duration_ms": None, "output": None, "error": None} for s in step_names]


def _update_step(steps: list[dict], name: str, status: str, output=None, error=None, duration_ms=None):
    """Mutate the step entry in-place and return the updated list."""
    for s in steps:
        if s["name"] == name:
            s["status"] = status
            if output is not None:
                s["output"] = output
            if error is not None:
                s["error"] = error
            if duration_ms is not None:
                s["duration_ms"] = duration_ms
            break
    return steps


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _enrich_bboxes(ws: Path, result: dict) -> dict:
    """Locate bounding boxes on the invoice PDF and enrich confidenceScores."""
    try:
        invoice_pdf = find_invoice_pdf(ws / "attachments")
        if invoice_pdf:
            enriched = locate_bboxes(str(invoice_pdf), result)
            if enriched:
                result["confidenceScores"] = enriched
    except Exception as e:
        import logging
        logging.getLogger("pipeline").warning(f"bbox locator failed: {e}")
    return result


async def _split_pdfs_in_workspace(ws: Path):
    """Split any multi-page PDFs in workspace attachments dir. Replaces originals with fragments."""
    import subprocess as _sp
    import re as _re
    attachments_dir = ws / "attachments"
    pdf_files = list(attachments_dir.glob("*.pdf")) + list(attachments_dir.glob("*.PDF"))
    for pdf_path in pdf_files:
        # Check page count
        try:
            proc = _sp.run(
                ["pdfinfo", str(pdf_path)], capture_output=True, text=True, timeout=10
            )
            match = _re.search(r"Pages:\s+(\d+)", proc.stdout)
            if not match or int(match.group(1)) <= 1:
                continue  # Single-page, skip
        except Exception:
            continue

        results = await split_merged_pdf(str(pdf_path), ws)
        # If split produced multiple fragments without errors, remove original
        has_errors = any(r.get("error") or r.get("flag") for r in results)
        if len(results) > 1 and not has_errors:
            pdf_path.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Background pipeline runners
# ---------------------------------------------------------------------------
async def _run_backend_job(job_id: str, ws: Path, case_id: str):
    """Background task for test-backend. Updates Job record after each step."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()

        # Split merged PDFs before pipeline starts
        await _split_pdfs_in_workspace(ws)

        pipeline_session_id = None  # Chain sessions across steps

        for step_name in STEPS_BACKEND:
            template = db.query(PromptTemplate).filter(
                PromptTemplate.step_name == step_name,
                PromptTemplate.is_active == True,
            ).first()
            if not template:
                job.steps = _update_step(job.steps, step_name, "failed", error=f"No active prompt for {step_name}")
                flag_modified(job, "steps")
                job.status = "FAILED"
                job.error = f"No active prompt for {step_name}"
                job.completed_at = utcnow()
                db.commit()
                return

            # Mark running
            job.current_step = step_name
            job.status = "RUNNING"
            job.steps = _update_step(job.steps, step_name, "running")
            flag_modified(job, "steps")
            db.commit()

            prepare_step(ws, template.assembled_prompt, template.output_schema)
            start = time.time()
            # First step: fresh session. Subsequent steps: resume session.
            prompt = PROMPT_TEXT if not pipeline_session_id else RESUME_PROMPT_TEXT
            success, result, error, pipeline_session_id = await run_claude_step(
                case_id, step_name, str(ws), prompt, session_id=pipeline_session_id,
            )
            duration = int((time.time() - start) * 1000)

            if success:
                job.steps = _update_step(job.steps, step_name, "success", output=result, duration_ms=duration)
                flag_modified(job, "steps")

                # Post-processing: locate bounding boxes after extract step
                if step_name == "extract" and result:
                    result = _enrich_bboxes(ws, result)
                    job.steps = _update_step(job.steps, step_name, "success", output=result, duration_ms=duration)
                    flag_modified(job, "steps")
            else:
                job.steps = _update_step(job.steps, step_name, "failed", error=error, duration_ms=duration)
                flag_modified(job, "steps")
                job.status = "FAILED"
                job.error = error
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return
            db.commit()

        job.status = "COMPLETED"
        job.current_step = None
        job.completed_at = utcnow()
        db.commit()
    finally:
        db.close()


async def _run_frontend_job(job_id: str, email_id: str, attachments: list[dict]):
    """Background task for test-frontend. Creates Email, runs pipeline, creates Case."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        email = db.query(Email).filter(Email.id == email_id).first()

        # Step 1: Classify
        template = db.query(PromptTemplate).filter(PromptTemplate.step_name == "classify", PromptTemplate.is_active == True).first()
        if not template:
            job.steps = _update_step(job.steps, "classify", "failed", error="No active prompt")
            job.status = "FAILED"
            job.error = "No active prompt for classify"
            job.completed_at = utcnow()
            db.commit()
            return

        # Create temp workspace for pre-case steps
        temp_ws = create_workspace(f"PRE-{email_id}")
        email_data = {
            "from": email.from_address, "fromName": email.from_name,
            "to": "ap@jhta.com.au", "subject": email.subject, "body": email.body,
            "attachments": [],
        }
        upload_dir = Path(__file__).parent.parent / "uploads"
        for att in attachments:
            src = upload_dir / Path(att["fileUrl"]).name
            if src.exists():
                shutil.copy2(str(src), str(temp_ws / "attachments" / src.name))
                email_data["attachments"].append(att)
        (temp_ws / "email.json").write_text(json.dumps(email_data, indent=2))
        write_master_data(temp_ws, db)

        # Split merged PDFs before pipeline starts
        await _split_pdfs_in_workspace(temp_ws)

        # Run classify
        job.current_step = "classify"
        job.status = "RUNNING"
        job.steps = _update_step(job.steps, "classify", "running")
        db.commit()

        prepare_step(temp_ws, template.assembled_prompt, template.output_schema)
        start = time.time()
        # Fresh session for classify (first step)
        success, result, error, pipeline_session_id = await run_claude_step(email_id, "classify", str(temp_ws), PROMPT_TEXT)
        duration = int((time.time() - start) * 1000)

        if not success:
            job.steps = _update_step(job.steps, "classify", "failed", error=error, duration_ms=duration)
            job.status = "FAILED"
            job.error = error
            job.current_step = None
            job.completed_at = utcnow()
            db.commit()
            return

        job.steps = _update_step(job.steps, "classify", "success", output=result, duration_ms=duration)
        email.classification = result.get("classification", "INVOICE")
        email.classification_confidence = result.get("confidence", 0)
        email.status = "CLASSIFIED"
        db.commit()

        if result.get("classification") != "INVOICE":
            job.status = "COMPLETED"
            job.current_step = None
            job.completed_at = utcnow()
            # Mark remaining steps skipped
            for s in ["categorize", "verify_docs", "extract", "validate"]:
                job.steps = _update_step(job.steps, s, "skipped")
            db.commit()
            return

        # Step 2: Categorize
        template = db.query(PromptTemplate).filter(PromptTemplate.step_name == "categorize", PromptTemplate.is_active == True).first()
        if template:
            job.current_step = "categorize"
            job.steps = _update_step(job.steps, "categorize", "running")
            db.commit()

            prepare_step(temp_ws, template.assembled_prompt, template.output_schema)
            start = time.time()
            # Resume session from classify
            success, result, error, pipeline_session_id = await run_claude_step(
                email_id, "categorize", str(temp_ws), RESUME_PROMPT_TEXT, session_id=pipeline_session_id,
            )
            duration = int((time.time() - start) * 1000)

            if not success:
                job.steps = _update_step(job.steps, "categorize", "failed", error=error, duration_ms=duration)
                job.status = "FAILED"
                job.error = error
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return

            job.steps = _update_step(job.steps, "categorize", "success", output=result, duration_ms=duration)
            email.invoice_category = result.get("category")
            email.entity = result.get("entity")
            email.po_type = result.get("poType")
            db.commit()

        # Step 3: Create case (code-only, not tracked as AI step)
        from agents.code_steps import create_case as do_create_case
        case_dict = do_create_case(email_id, db)
        case_id = case_dict["id"]
        job.case_id = case_id

        # Populate vendor info from categorize result
        cat_step = next((s for s in job.steps if s["name"] == "categorize"), None)
        cat_output = cat_step.get("output") if cat_step else None
        if cat_output and isinstance(cat_output, dict):
            vm = cat_output.get("vendorMatch") or {}
            if vm:
                case = db.query(Case).filter(Case.id == case_id).first()
                if case:
                    case.vendor_name = vm.get("vendorName", "") or vm.get("name", "")
                    case.vendor_id = vm.get("vendorId", "")
                    case.vendor_number = vm.get("vendorNumber", "")
                    case.contract_number = vm.get("contractNumber")
                    case.contract_status = vm.get("contractStatus")
        db.commit()

        # Copy pre-case results into case workspace
        case_ws = Path(__file__).parent.parent / "workspaces" / case_id
        for f in (temp_ws / "results").glob("*.json"):
            shutil.copy2(str(f), str(case_ws / "results" / f.name))

        # Steps 4-6: verify_docs, extract, validate
        remaining = [("verify_docs", case_id, case_ws), ("extract", case_id, case_ws), ("validate", case_id, case_ws)]
        for step_name, sid, ws in remaining:
            template = db.query(PromptTemplate).filter(
                PromptTemplate.step_name == step_name, PromptTemplate.is_active == True
            ).first()
            if not template:
                job.steps = _update_step(job.steps, step_name, "failed", error=f"No active prompt for {step_name}")
                flag_modified(job, "steps")
                job.status = "FAILED"
                job.error = f"No active prompt for {step_name}"
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return

            job.current_step = step_name
            job.steps = _update_step(job.steps, step_name, "running")
            flag_modified(job, "steps")
            db.commit()

            prepare_step(ws, template.assembled_prompt, template.output_schema)
            start = time.time()
            # Resume session — agent already has context from prior steps
            success, result, error, pipeline_session_id = await run_claude_step(
                sid, step_name, str(ws), RESUME_PROMPT_TEXT, session_id=pipeline_session_id,
            )
            duration = int((time.time() - start) * 1000)

            if not success:
                job.steps = _update_step(job.steps, step_name, "failed", error=error, duration_ms=duration)
                flag_modified(job, "steps")
                job.status = "FAILED"
                job.error = error
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return

            job.steps = _update_step(job.steps, step_name, "success", output=result, duration_ms=duration)
            db.commit()

            # Update case record with step results
            if step_name == "verify_docs" and result:
                case = db.query(Case).filter(Case.id == case_id).first()
                if case:
                    # Store verify_docs output alongside business_rule_results
                    existing_br = case.business_rule_results or []
                    verify_entry = {"step": "verify_docs", "output": result}
                    case.business_rule_results = existing_br + [verify_entry]
                    flag_modified(case, "business_rule_results")
                    case.updated_at = utcnow()
                db.commit()
            elif step_name == "extract" and result:
                case = db.query(Case).filter(Case.id == case_id).first()
                case.header_data = result.get("headerData", {})
                case.line_items = result.get("lineItems", [])
                case.confidence_scores = result.get("confidenceScores", {})
                case.status = "EXTRACTED"
                case.updated_at = utcnow()
                result = _enrich_bboxes(ws, result)
                case.confidence_scores = result.get("confidenceScores", {})
                flag_modified(case, "confidence_scores")
                db.commit()
            elif step_name == "validate" and result:
                case = db.query(Case).filter(Case.id == case_id).first()
                # Preserve verify_docs entry, append validate results
                existing_br = case.business_rule_results or []
                validate_entry = {"step": "validate", "output": result.get("results", [])}
                case.business_rule_results = existing_br + [validate_entry]
                flag_modified(case, "business_rule_results")
                case.status = "IN_REVIEW"
                case.updated_at = utcnow()
                db.commit()

        job.status = "COMPLETED"
        job.current_step = None
        job.completed_at = utcnow()
        db.commit()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# POST /api/playground/test-backend — returns job immediately
# ---------------------------------------------------------------------------
@router.post("/playground/test-backend")
async def test_backend(
    from_address: str = Form("vendor@example.com"),
    from_name: str = Form(""),
    subject: str = Form("Invoice submission"),
    body: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """Launch backend pipeline as background job. Returns jobId for polling."""
    case_id = f"TEST-{new_id('')[:8]}"
    ws = create_workspace(case_id)

    # Write email.json
    email_data = {
        "from": from_address, "fromName": from_name,
        "to": "ap@jhta.com.au", "subject": subject, "body": body,
        "attachments": [],
    }
    for f in files:
        dest = ws / "attachments" / f.filename
        content = await f.read()
        dest.write_bytes(content)
        email_data["attachments"].append({
            "fileName": f.filename, "fileSize": len(content),
            "fileUrl": f"attachments/{f.filename}",
        })
    (ws / "email.json").write_text(json.dumps(email_data, indent=2))
    write_master_data(ws, db)

    # Create job record
    job = Job(
        id=_new_job_id(),
        type="test_backend",
        status="PENDING",
        steps=_init_steps(STEPS_BACKEND),
    )
    db.add(job)
    db.commit()

    # Launch background task
    asyncio.create_task(_run_backend_job(job.id, ws, case_id))

    return {"jobId": job.id, "status": "PENDING"}


# ---------------------------------------------------------------------------
# POST /api/playground/test-frontend — returns job immediately
# ---------------------------------------------------------------------------
@router.post("/playground/test-frontend")
async def test_frontend(
    from_address: str = Form("vendor@example.com"),
    from_name: str = Form(""),
    subject: str = Form("Invoice submission"),
    body: str = Form(""),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
):
    """Create Email record + launch full pipeline as background job."""
    attachments = []
    upload_dir = Path(__file__).parent.parent / "uploads"
    upload_dir.mkdir(exist_ok=True)

    for f in files:
        content = await f.read()
        file_id = new_id("file-")
        dest = upload_dir / f"{file_id}_{f.filename}"
        dest.write_bytes(content)
        attachments.append({
            "fileName": f.filename,
            "fileType": f.content_type or "application/pdf",
            "fileSize": len(content),
            "fileUrl": f"/uploads/{dest.name}",
        })

    email = Email(
        from_address=from_address,
        from_name=from_name,
        subject=subject,
        body=body,
        attachments=attachments,
        status="UNCLASSIFIED",
    )
    db.add(email)
    db.commit()
    db.refresh(email)

    # Create job record
    job = Job(
        id=_new_job_id(),
        type="test_frontend",
        status="PENDING",
        email_id=email.id,
        steps=_init_steps(STEPS_FRONTEND),
    )
    db.add(job)
    db.commit()

    # Launch background task
    asyncio.create_task(_run_frontend_job(job.id, email.id, attachments))

    return {"jobId": job.id, "status": "PENDING", "emailId": email.id}


# ---------------------------------------------------------------------------
# GET /api/jobs/{jobId} — poll for status
# ---------------------------------------------------------------------------
@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db)):
    from fastapi.responses import JSONResponse
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(404, f"Job {job_id} not found")
    return JSONResponse(content=job.to_dict(), headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"})


# ---------------------------------------------------------------------------
# GET /api/jobs — list recent jobs
# ---------------------------------------------------------------------------
@router.get("/jobs")
def list_jobs(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    jobs = db.query(Job).order_by(Job.created_at.desc()).limit(limit).all()
    return [j.to_dict() for j in jobs]


# ---------------------------------------------------------------------------
# Playground: Run single step for a case (unchanged — still sync)
# ---------------------------------------------------------------------------
@router.post("/playground/run-step/{step_name}/{case_id}")
async def run_single_step(
    step_name: str,
    case_id: str,
    db: Session = Depends(get_db),
):
    """Re-run a single pipeline step for an existing case workspace."""
    ws = Path(__file__).parent.parent / "workspaces" / case_id
    if not ws.exists():
        raise HTTPException(404, f"Workspace for {case_id} not found")

    template = db.query(PromptTemplate).filter(
        PromptTemplate.step_name == step_name,
        PromptTemplate.is_active == True,
    ).first()
    if not template:
        raise HTTPException(404, f"No active prompt for step '{step_name}'")

    prepare_step(ws, template.assembled_prompt, template.output_schema)
    start = time.time()
    success, result, error, _ = await run_claude_step(case_id, step_name, str(ws), PROMPT_TEXT)
    duration = int((time.time() - start) * 1000)

    if not success:
        raise HTTPException(502, detail={"step": step_name, "error": error, "duration_ms": duration})

    return {"step": step_name, "output": result, "duration_ms": duration}

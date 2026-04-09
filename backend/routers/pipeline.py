"""Pipeline & playground endpoints — async job-based execution."""

import asyncio
import json
import logging
import shutil
import time
from pathlib import Path
from typing import Optional

log = logging.getLogger("pipeline")

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from db import get_db, SessionLocal
from sqlalchemy.orm.attributes import flag_modified
from models import (
    Email, PromptTemplate, Case, Job, InvoiceCategoryConfig, new_id, utcnow,
    Vendor, ServiceRateCard, FreightRateCard,
)
from agents.runner import (
    run_claude_step, create_workspace, prepare_step, write_master_data,
    RESUME_PROMPT_TEXT,
)
from agents.validators import validate_step_output
from agents.doc_splitter import split_merged_pdf, generate_document_text, extract_first_n_pages, split_pdf_by_pages
from agents.bbox_locator import find_invoice_pdf, locate_bboxes

router = APIRouter(prefix="/api", tags=["pipeline"])

STEPS_BACKEND = ["classify", "categorize", "extract", "validate"]


def _load_field_config(ws: Path, db) -> dict | None:
    """Load field config for the category identified in categorize.json."""
    cat_file = ws / "results" / "categorize.json"
    if not cat_file.exists():
        log.debug(f"[field_config] No categorize.json in {ws.name}")
        return None
    try:
        cat = json.loads(cat_file.read_text()).get("category")
    except (json.JSONDecodeError, KeyError):
        log.warning(f"[field_config] Failed to parse categorize.json in {ws.name}")
        return None
    if not cat:
        return None
    cfg = db.query(InvoiceCategoryConfig).filter(InvoiceCategoryConfig.name == cat).first()
    if not cfg:
        log.warning(f"[field_config] No InvoiceCategoryConfig for category={cat}")
        return None
    fc = {
        "invoiceFields": cfg.invoice_fields or [],
        "supportingFields": cfg.supporting_fields or {},
        "validationRules": cfg.validation_rules or [],
    }
    log.info(f"[field_config] Loaded config for {cat}: {len(fc['invoiceFields'])} invoice fields, {len(fc['validationRules'])} rules")
    return fc
STEPS_FRONTEND = ["classify", "categorize", "extract", "validate"]
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
    """Locate bounding boxes for fields in the extract result, grouped by file."""
    from collections import defaultdict
    try:
        fields = result.get("fields", [])
        if not fields:
            return result

        by_file = defaultdict(list)
        for f in fields:
            if f.get("file"):
                by_file[f["file"]].append(f)

        attachments_dir = ws / "attachments"
        for filename, file_fields in by_file.items():
            pdf_path = attachments_dir / filename
            if pdf_path.exists():
                locate_bboxes(str(pdf_path), file_fields)

        result["fields"] = fields
    except Exception as e:
        log.warning(f"bbox locator failed: {e}")
    return result


def _get_category_from_workspace(ws: Path) -> str | None:
    """Read category from categorize.json if it exists."""
    cat_file = ws / "results" / "categorize.json"
    if cat_file.exists():
        try:
            return json.loads(cat_file.read_text()).get("category")
        except (json.JSONDecodeError, KeyError):
            pass
    return None


async def _validate_and_retry(
    case_id: str, step_name: str, ws: Path, session_id: str,
    category: str | None, db,
) -> tuple[bool, str | None, str | None]:
    """Validate step output; retry once on failure. Returns (valid, session_id, error)."""
    valid, errors = validate_step_output(step_name, ws, category, db)
    if valid:
        return True, session_id, None

    log.warning(f"[{case_id}/{step_name}] Validation failed (attempt 1): {errors}")
    retry_prompt = (
        f"Your {step_name} output failed validation. Errors:\n"
        + "\n".join(f"- {e}" for e in errors)
        + "\n\nFix these errors and re-output the complete JSON."
    )
    retry_ok, retry_result, retry_error, session_id = await run_claude_step(
        case_id, step_name, str(ws), retry_prompt, session_id=session_id,
    )
    if not retry_ok:
        return False, session_id, f"Retry LLM call failed: {retry_error}"

    valid2, errors2 = validate_step_output(step_name, ws, category, db)
    if valid2:
        log.info(f"[{case_id}/{step_name}] Retry succeeded")
        return True, session_id, None

    return False, session_id, f"Retry validation failed: {errors2}"


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
# Master-data pre-filtering (vendor fuzzy match + rate card lookup)
# ---------------------------------------------------------------------------
def _lookup_vendor_candidates(ws: Path, db) -> list[dict]:
    """Read vendorHints from classify.json, fuzzy-match against vendors DB,
    write top candidates to master-data/vendors.json. Returns candidate list."""
    classify_file = ws / "results" / "classify.json"
    if not classify_file.exists():
        return []
    try:
        classify = json.loads(classify_file.read_text())
    except (json.JSONDecodeError, KeyError):
        return []

    hints = classify.get("vendorHints")
    if not hints:
        # No hints — leave the full dump from write_master_data untouched
        return []

    full_name = hints.get("fullName", "")
    short_name = hints.get("shortName", "")
    abn = hints.get("abn", "")
    search_terms = hints.get("searchTerms", [])

    candidates = {}  # vendor_number → dict

    # 1. ABN exact match (strongest signal)
    if abn:
        for v in db.query(Vendor).filter(Vendor.tax_id.ilike(f"%{abn}%")).all():
            candidates[v.vendor_number] = v.to_dict()

    # 2. Search terms — most specific first
    for term in search_terms:
        if len(candidates) >= 10:
            break
        for v in db.query(Vendor).filter(Vendor.name.ilike(f"%{term}%")).limit(5).all():
            candidates.setdefault(v.vendor_number, v.to_dict())

    # 3. fullName and shortName
    for name in [full_name, short_name]:
        if name and len(candidates) < 10:
            for v in db.query(Vendor).filter(Vendor.name.ilike(f"%{name}%")).limit(5).all():
                candidates.setdefault(v.vendor_number, v.to_dict())

    result = list(candidates.values())[:10]
    if result:
        md_dir = ws / "master-data"
        md_dir.mkdir(exist_ok=True)
        (md_dir / "vendors.json").write_text(json.dumps(result, indent=2))
        total = db.query(Vendor).count()
        log.info(f"[vendor_lookup] Reduced {total} vendors → {len(result)} candidates: {[c.get('name','') for c in result[:3]]}")
    return result


def _lookup_rate_cards(ws: Path, db, vendor_candidates: list[dict], category: str | None, categorize_result: dict | None):
    """Pull rate card rows for matched vendor candidates. Write to master-data/."""
    if not vendor_candidates:
        return

    md_dir = ws / "master-data"
    md_dir.mkdir(exist_ok=True)

    # Collect vendor identifiers for querying
    v_numbers = [c.get("vendorNumber", "") for c in vendor_candidates]
    v_names = [c.get("name", "") for c in vendor_candidates]
    v_ids = [c.get("id", "") for c in vendor_candidates]

    # Service rate cards: match by vendor_id or contractor_name
    svc_total = db.query(ServiceRateCard).filter(ServiceRateCard.is_active == True).count()
    if svc_total <= 50:
        svc_rows = [r.to_dict() for r in db.query(ServiceRateCard).filter(ServiceRateCard.is_active == True).all()]
    else:
        from sqlalchemy import or_
        # Use in_() for IDs to avoid huge OR chains (SQLite depth limit 1000)
        valid_ids = [vid for vid in v_ids if vid]
        valid_names = [vn for vn in v_names if vn]
        seen = set()
        svc_rows = []
        # Query by vendor_id using IN (single expression, no depth issue)
        if valid_ids:
            for r in db.query(ServiceRateCard).filter(
                ServiceRateCard.is_active == True,
                ServiceRateCard.vendor_id.in_(valid_ids)
            ).all():
                if r.id not in seen:
                    seen.add(r.id)
                    svc_rows.append(r.to_dict())
        # Query by contractor_name in batches of 50 to stay within limits
        for i in range(0, len(valid_names), 50):
            batch = valid_names[i:i+50]
            name_filters = [ServiceRateCard.contractor_name.ilike(f"%{vn}%") for vn in batch]
            for r in db.query(ServiceRateCard).filter(
                ServiceRateCard.is_active == True, or_(*name_filters)
            ).all():
                if r.id not in seen:
                    seen.add(r.id)
                    svc_rows.append(r.to_dict())
    (md_dir / "service-rate-cards.json").write_text(json.dumps(svc_rows, indent=2))

    # Freight rate cards: filter by origin/destination if category is freight-related
    frt_total = db.query(FreightRateCard).filter(FreightRateCard.is_active == True).count()
    if frt_total <= 50:
        frt_rows = [r.to_dict() for r in db.query(FreightRateCard).filter(FreightRateCard.is_active == True).all()]
    else:
        from sqlalchemy import or_, and_
        frt_filters = []
        is_freight = category and "FREIGHT" in category.upper() if category else False
        if is_freight and categorize_result:
            # Try to get origin/destination from categorize result
            origin = categorize_result.get("origin", "")
            dest = categorize_result.get("destination", "")
            if origin:
                frt_filters.append(FreightRateCard.origin_port.ilike(f"%{origin}%"))
            if dest:
                frt_filters.append(FreightRateCard.dest_port.ilike(f"%{dest}%"))
        if frt_filters:
            frt_rows = [r.to_dict() for r in db.query(FreightRateCard).filter(
                FreightRateCard.is_active == True, or_(*frt_filters)
            ).all()]
        else:
            # No useful filters — dump all (shouldn't be many per the threshold check)
            frt_rows = [r.to_dict() for r in db.query(FreightRateCard).filter(FreightRateCard.is_active == True).all()]
    (md_dir / "freight-rate-cards.json").write_text(json.dumps(frt_rows, indent=2))
    log.info(f"[rate_cards] Wrote {len(svc_rows)} service, {len(frt_rows)} freight rate cards")


# ---------------------------------------------------------------------------
# Background pipeline runners
# ---------------------------------------------------------------------------
async def _run_backend_job(job_id: str, ws: Path, case_id: str):
    """Background task for test-backend. Updates Job record after each step."""
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()

        # Large doc optimization: extract text + preview for classify/categorize
        import subprocess as _sp
        import re as _re
        is_large_doc = False
        original_pdf_path = None
        for pdf_path in list((ws / "attachments").glob("*.pdf")) + list((ws / "attachments").glob("*.PDF")):
            try:
                proc = _sp.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True, timeout=10)
                match = _re.search(r"Pages:\s+(\d+)", proc.stdout)
                if match and int(match.group(1)) > 10:
                    is_large, num_pages = generate_document_text(str(pdf_path), ws)
                    if is_large:
                        is_large_doc = True
                        original_pdf_path = str(pdf_path)
                        extract_first_n_pages(str(pdf_path), ws, n=2)
                        log.info(f"Large doc ({num_pages} pages): DOCUMENT_TEXT.md + preview created")
            except Exception as e:
                log.warning(f"Large doc detection failed: {e}")

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

            fc = _load_field_config(ws, db) if step_name in ("extract", "validate") else None
            prepare_step(ws, template.assembled_prompt, template.output_schema, field_config=fc)
            start = time.time()
            # First step: fresh session. Subsequent steps: resume session.
            prompt = PROMPT_TEXT if not pipeline_session_id else RESUME_PROMPT_TEXT
            success, result, error, pipeline_session_id = await run_claude_step(
                case_id, step_name, str(ws), prompt, session_id=pipeline_session_id,
            )
            duration = int((time.time() - start) * 1000)

            if success:
                # Validate output and retry once on failure
                category = _get_category_from_workspace(ws)
                v_ok, pipeline_session_id, v_err = await _validate_and_retry(
                    case_id, step_name, ws, pipeline_session_id, category, db,
                )
                if not v_ok:
                    job.steps = _update_step(job.steps, step_name, "failed", error=v_err, duration_ms=duration)
                    flag_modified(job, "steps")
                    job.status = "FAILED"
                    job.error = v_err
                    job.current_step = None
                    job.completed_at = utcnow()
                    db.commit()
                    return
                # Re-read result after possible retry
                result = json.loads((ws / "results" / f"{step_name}.json").read_text())

                job.steps = _update_step(job.steps, step_name, "success", output=result, duration_ms=duration)
                flag_modified(job, "steps")

                # Post-classify: vendor fuzzy match from vendorHints
                if step_name == "classify" and result:
                    _lookup_vendor_candidates(ws, db)

                # Post-categorize: rate card lookup for matched vendors
                if step_name == "categorize" and result:
                    # Read vendor candidates written by post-classify step
                    vendors_file = ws / "master-data" / "vendors.json"
                    v_cands = json.loads(vendors_file.read_text()) if vendors_file.exists() else []
                    try:
                        _lookup_rate_cards(ws, db, v_cands, result.get("category"), result)
                    except Exception as e:
                        log.warning(f"[{email.id}] rate_cards lookup failed (non-fatal): {e}")

                # Post-categorize: split PDF by LLM-identified page numbers
                if step_name == "categorize" and result:
                    cat_docs = result.get("documents", [])
                    page_map = [(d.get("type"), d.get("pages"), d.get("status")) for d in cat_docs]
                    log.info(f"[{case_id}] Categorize page mapping: {page_map}")
                    docs_with_pages = [d for d in cat_docs if d.get("pages") and d.get("status") == "PRESENT"]
                    if docs_with_pages:
                        pdf_to_split = original_pdf_path
                        if not pdf_to_split:
                            for f in (ws / "attachments").glob("*.pdf"):
                                if f.name.startswith("preview_"):
                                    continue
                                try:
                                    proc = _sp.run(["pdfinfo", str(f)], capture_output=True, text=True, timeout=10)
                                    m = _re.search(r"Pages:\s+(\d+)", proc.stdout)
                                    if m and int(m.group(1)) > 1:
                                        pdf_to_split = str(f)
                                        break
                                except Exception:
                                    continue
                        if pdf_to_split:
                            fragments = split_pdf_by_pages(pdf_to_split, docs_with_pages, ws)
                            if fragments:
                                Path(pdf_to_split).unlink(missing_ok=True)
                                for f in (ws / "attachments").glob("preview_*.pdf"):
                                    f.unlink(missing_ok=True)
                                dt = ws / "DOCUMENT_TEXT.md"
                                if dt.exists():
                                    dt.unlink()
                                log.info(f"Split into {len(fragments)} fragments: {[f['document_type'] for f in fragments]}")

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

        # Large doc optimization: extract text + preview for classify/categorize
        import subprocess as _sp
        import re as _re
        is_large_doc = False
        original_pdf_path = None
        for pdf_path in list((temp_ws / "attachments").glob("*.pdf")) + list((temp_ws / "attachments").glob("*.PDF")):
            try:
                proc = _sp.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True, timeout=10)
                match = _re.search(r"Pages:\s+(\d+)", proc.stdout)
                if match and int(match.group(1)) > 10:
                    is_large, num_pages = generate_document_text(str(pdf_path), temp_ws)
                    if is_large:
                        is_large_doc = True
                        original_pdf_path = str(pdf_path)
                        extract_first_n_pages(str(pdf_path), temp_ws, n=2)
                        log.info(f"Large doc ({num_pages} pages): DOCUMENT_TEXT.md + preview created")
            except Exception as e:
                log.warning(f"Large doc detection failed: {e}")

        # Log workspace state before classify
        ws_files = [f.name for f in (temp_ws / "attachments").iterdir()] if (temp_ws / "attachments").exists() else []
        has_doc_text = (temp_ws / "DOCUMENT_TEXT.md").exists()
        log.info(f"[{email_id}] Pre-classify workspace: attachments={ws_files}, DOCUMENT_TEXT.md={has_doc_text}, is_large_doc={is_large_doc}")

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

        # Validate classify output (retry once on failure)
        v_ok, pipeline_session_id, v_err = await _validate_and_retry(
            email_id, "classify", temp_ws, pipeline_session_id, None, db,
        )
        if not v_ok:
            job.steps = _update_step(job.steps, "classify", "failed", error=v_err, duration_ms=duration)
            job.status = "FAILED"
            job.error = v_err
            job.current_step = None
            job.completed_at = utcnow()
            db.commit()
            return
        result = json.loads((temp_ws / "results" / "classify.json").read_text())

        job.steps = _update_step(job.steps, "classify", "success", output=result, duration_ms=duration)
        email.classification = result.get("classification", "INVOICE")
        email.classification_confidence = 0  # confidence removed from classify schema
        email.status = "CLASSIFIED"
        db.commit()

        if result.get("classification") != "INVOICE":
            job.status = "COMPLETED"
            job.current_step = None
            job.completed_at = utcnow()
            # Mark remaining steps skipped
            for s in ["categorize", "extract", "validate"]:
                job.steps = _update_step(job.steps, s, "skipped")
            db.commit()
            return

        # Post-classify: vendor fuzzy match from vendorHints
        _lookup_vendor_candidates(temp_ws, db)

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

            # Validate categorize output (retry once on failure)
            v_ok, pipeline_session_id, v_err = await _validate_and_retry(
                email_id, "categorize", temp_ws, pipeline_session_id, None, db,
            )
            if not v_ok:
                job.steps = _update_step(job.steps, "categorize", "failed", error=v_err, duration_ms=duration)
                job.status = "FAILED"
                job.error = v_err
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return
            result = json.loads((temp_ws / "results" / "categorize.json").read_text())

            job.steps = _update_step(job.steps, "categorize", "success", output=result, duration_ms=duration)
            email.invoice_category = result.get("category")
            email.entity = result.get("entity")
            email.po_type = result.get("poType")
            # Check if all mandatory docs are present from categorize output
            cat_docs = result.get("documents", [])
            email.mandatory_docs_present = all(d.get("status") == "PRESENT" for d in cat_docs) if cat_docs else None
            db.commit()

            # Post-categorize: rate card lookup for matched vendors
            vendors_file = temp_ws / "master-data" / "vendors.json"
            v_cands = json.loads(vendors_file.read_text()) if vendors_file.exists() else []
            try:
                _lookup_rate_cards(temp_ws, db, v_cands, result.get("category"), result)
            except Exception as e:
                log.warning(f"[{email_id}] rate_cards lookup failed (non-fatal): {e}")

            # Post-categorize: split PDF by LLM-identified page numbers
            cat_docs = result.get("documents", [])
            docs_with_pages = [d for d in cat_docs if d.get("pages") and d.get("status") == "PRESENT"]
            page_map = [(d.get("type"), d.get("pages"), d.get("status")) for d in cat_docs]
            log.info(f"[{email_id}] Categorize page mapping: {page_map}")
            if docs_with_pages:
                pdf_to_split = original_pdf_path
                if not pdf_to_split:
                    for f in (temp_ws / "attachments").glob("*.pdf"):
                        if f.name.startswith("preview_"):
                            continue
                        try:
                            proc = _sp.run(["pdfinfo", str(f)], capture_output=True, text=True, timeout=10)
                            m = _re.search(r"Pages:\s+(\d+)", proc.stdout)
                            if m and int(m.group(1)) > 1:
                                pdf_to_split = str(f)
                                break
                        except Exception:
                            continue
                if pdf_to_split:
                    fragments = split_pdf_by_pages(pdf_to_split, docs_with_pages, temp_ws)
                    if fragments:
                        Path(pdf_to_split).unlink(missing_ok=True)
                        for f in (temp_ws / "attachments").glob("preview_*.pdf"):
                            f.unlink(missing_ok=True)
                        dt = temp_ws / "DOCUMENT_TEXT.md"
                        if dt.exists():
                            dt.unlink()
                        log.info(f"Split into {len(fragments)} fragments: {[f['document_type'] for f in fragments]}")

        # Log workspace state before extract
        post_split_files = [f.name for f in (temp_ws / "attachments").iterdir()] if (temp_ws / "attachments").exists() else []
        log.info(f"[{email_id}] Pre-extract workspace: attachments={post_split_files}")

        # Step 3: Create case (code-only, not tracked as AI step)
        from agents.code_steps import create_case as do_create_case
        case_dict = do_create_case(email_id, db)
        case_id = case_dict["id"]
        job.case_id = case_id

        # Populate vendor info and doc verification from categorize result
        cat_step = next((s for s in job.steps if s["name"] == "categorize"), None)
        cat_output = cat_step.get("output") if cat_step else None
        if cat_output and isinstance(cat_output, dict):
            case = db.query(Case).filter(Case.id == case_id).first()
            if case:
                vm = cat_output.get("vendorMatch") or {}
                if vm:
                    case.vendor_name = vm.get("vendorName", "") or vm.get("name", "")
                    case.vendor_id = vm.get("vendorId", "")
                    case.vendor_number = vm.get("vendorNumber", "")
                    case.contract_number = vm.get("contractNumber")
                    case.contract_status = vm.get("contractStatus")

                case.freight_type = cat_output.get("freightType")

                # Store missing docs in business_rule_results (backward compat: key="verify_docs" for frontend)
                docs = cat_output.get("documents", [])
                missing = [d["type"] for d in docs if d.get("status") == "MISSING"]
                if missing:
                    existing_br = case.business_rule_results or []
                    existing_br.append({"step": "verify_docs", "output": {"missingDocs": missing, "verified": False}})
                    case.business_rule_results = existing_br
                    flag_modified(case, "business_rule_results")

                # Build attachment list from actual files in workspace attachments/.
                # After the LLM-guided split, fragments are named {stem}_{DocType}.pdf.
                # For pre-split files, original filenames remain — use categorize's
                # file→type mapping to tag them correctly.
                new_atts = []
                uploads_dir = Path(__file__).parent.parent / "uploads"
                present_doc_types = {d["type"]: d for d in docs if d.get("status") == "PRESENT"}
                # Build file→type map from categorize output (handles non-split uploads)
                file_type_map = {}
                for d in docs:
                    if d.get("status") == "PRESENT" and d.get("file"):
                        dtype = d["type"]
                        file_type_map[d["file"]] = "INVOICE" if "invoice" in dtype.lower() else "JOB_SHEET"
                for fpath in sorted((temp_ws / "attachments").iterdir()):
                    if not fpath.suffix.lower() == ".pdf":
                        continue
                    fname = fpath.name
                    # 1. Direct match from categorize file→type mapping
                    normalized = file_type_map.get(fname)
                    # 2. Fallback: filename pattern match (for split files)
                    if not normalized:
                        normalized = "INVOICE"  # default
                        for doc_type in present_doc_types:
                            safe = doc_type.replace(" ", "_").replace("/", "_")
                            if safe in fname or doc_type.lower().replace(" ", "_") in fname.lower():
                                normalized = "INVOICE" if "invoice" in doc_type.lower() else "JOB_SHEET"
                                break
                    # Copy to uploads/ for serving
                    shutil.copy2(str(fpath), str(uploads_dir / fname))
                    new_atts.append({
                        "fileName": fname,
                        "fileUrl": f"/uploads/{fname}",
                        "documentType": normalized,
                    })
                if new_atts:
                    atts = new_atts

                case.attachments = atts
                flag_modified(case, "attachments")
                case.updated_at = utcnow()
        db.commit()

        # Copy pre-case results into case workspace
        case_ws = Path(__file__).parent.parent / "workspaces" / case_id
        for f in (temp_ws / "results").glob("*.json"):
            shutil.copy2(str(f), str(case_ws / "results" / f.name))
        # Sync split attachments (temp_ws has split fragments, case_ws has unsplit originals)
        for f in (temp_ws / "attachments").iterdir():
            shutil.copy2(str(f), str(case_ws / "attachments" / f.name))
        # Overwrite master-data with pre-filtered versions from temp_ws
        temp_md = temp_ws / "master-data"
        case_md = case_ws / "master-data"
        if temp_md.exists() and case_md.exists():
            for f in temp_md.glob("*.json"):
                shutil.copy2(str(f), str(case_md / f.name))

        # Steps 3-4: extract, validate
        remaining = [("extract", case_id, temp_ws), ("validate", case_id, temp_ws)]
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

            fc = _load_field_config(ws, db) if step_name in ("extract", "validate") else None
            prepare_step(ws, template.assembled_prompt, template.output_schema, field_config=fc)
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

            # Validate output and retry once on failure
            category = _get_category_from_workspace(ws)
            v_ok, pipeline_session_id, v_err = await _validate_and_retry(
                sid, step_name, ws, pipeline_session_id, category, db,
            )
            if not v_ok:
                job.steps = _update_step(job.steps, step_name, "failed", error=v_err, duration_ms=duration)
                flag_modified(job, "steps")
                job.status = "FAILED"
                job.error = v_err
                job.current_step = None
                job.completed_at = utcnow()
                db.commit()
                return
            result = json.loads((ws / "results" / f"{step_name}.json").read_text())

            job.steps = _update_step(job.steps, step_name, "success", output=result, duration_ms=duration)
            flag_modified(job, "steps")
            db.commit()

            # Update case record with step results
            if step_name == "extract" and result:
                case = db.query(Case).filter(Case.id == case_id).first()
                fields = result.get("fields", [])
                case.extracted_fields = fields
                case.line_items = result.get("lineItems", [])

                # Backward compat: populate header_data and supporting_data from flat fields
                case.header_data = {f["key"]: f["value"] for f in fields if f.get("doc") == "Invoice"}
                # Alias grandTotal -> totalAmount for frontend compat
                if "grandTotal" in case.header_data and "totalAmount" not in case.header_data:
                    case.header_data["totalAmount"] = case.header_data["grandTotal"]
                case.supporting_data = {}
                for f in fields:
                    if f.get("doc") and f["doc"] != "Invoice":
                        case.supporting_data.setdefault(f["doc"], {})[f["key"]] = f["value"]

                # overall_confidence: field completeness (deterministic confidence computed later)
                total_expected = len(fields)
                total_present = sum(1 for f in fields if f.get("value") is not None)
                if total_expected > 0:
                    case.overall_confidence = round(total_present / total_expected, 4)
                    case.overall_confidence_level = "HIGH" if case.overall_confidence >= 0.85 else "MEDIUM" if case.overall_confidence >= 0.6 else "LOW"

                case.status = "EXTRACTED"
                case.updated_at = utcnow()
                result = _enrich_bboxes(ws, result)
                # bboxes are now embedded in fields; update extracted_fields
                case.extracted_fields = result.get("fields", fields)
                case.confidence_scores = {
                    f["key"]: {"bbox": f["bbox"]} for f in result.get("fields", []) if f.get("bbox")
                }
                flag_modified(case, "extracted_fields")
                flag_modified(case, "supporting_data")
                flag_modified(case, "confidence_scores")
                db.commit()
            elif step_name == "validate" and result:
                case = db.query(Case).filter(Case.id == case_id).first()
                # Compute overallStatus from individual rule results
                results_list = result.get("results", [])
                has_fail = any(r.get("status") == "FAIL" for r in results_list)
                has_warning = any(r.get("status") == "WARNING" for r in results_list)
                overall = "FAIL" if has_fail else "WARNING" if has_warning else "PASS"
                # Append validate results to existing business_rule_results
                existing_br = case.business_rule_results or []
                validate_entry = {"step": "validate", "output": results_list, "overallStatus": overall}
                case.business_rule_results = existing_br + [validate_entry]
                flag_modified(case, "business_rule_results")
                case.status = "IN_REVIEW"
                case.updated_at = utcnow()
                db.commit()

            # Copy step results to case workspace (system of record)
            for suffix in (f"{step_name}.json", f"{step_name}_debug.json"):
                src = temp_ws / "results" / suffix
                if src.exists():
                    shutil.copy2(str(src), str(case_ws / "results" / suffix))

        job.status = "COMPLETED"
        job.current_step = None
        job.completed_at = utcnow()
        db.commit()
        # Cleanup temp workspace (session data no longer needed, results are in case_ws)
        shutil.rmtree(temp_ws, ignore_errors=True)
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

    fc = _load_field_config(ws, db) if step_name in ("extract", "validate") else None
    prepare_step(ws, template.assembled_prompt, template.output_schema, field_config=fc)
    start = time.time()
    success, result, error, _ = await run_claude_step(case_id, step_name, str(ws), PROMPT_TEXT)
    duration = int((time.time() - start) * 1000)

    if not success:
        raise HTTPException(502, detail={"step": step_name, "error": error, "duration_ms": duration})

    return {"step": step_name, "output": result, "duration_ms": duration}

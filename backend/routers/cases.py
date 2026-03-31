"""Case CRUD, comments, audit, emails, approval actions, SAP export."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from db import get_db
from models import Case, Email, Comment, AuditLog, Notification, User as UserModel, utcnow, new_id
from auth import get_current_user
from agents.code_steps import (
    create_case, process_approval, export_sap, assert_transition, _audit,
)

router = APIRouter(prefix="/api", tags=["cases"])


# ---------------------------------------------------------------------------
# Case CRUD
# ---------------------------------------------------------------------------
@router.get("/cases")
def list_cases(
    search: str = "",
    status: str = "",          # comma-separated
    category: str = "",        # comma-separated
    confidence_level: str = "",
    vendor_id: str = "",
    date_from: str = "",
    date_to: str = "",
    sort_by: str = "createdAt",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
):
    q = db.query(Case)

    if search:
        s = f"%{search}%"
        q = q.filter(
            Case.id.ilike(s) | Case.vendor_name.ilike(s)
        )
    if status:
        q = q.filter(Case.status.in_(status.split(",")))
    if category:
        q = q.filter(Case.category.in_(category.split(",")))
    if vendor_id:
        q = q.filter(Case.vendor_id == vendor_id)
    if date_from:
        q = q.filter(Case.created_at >= date_from)
    if date_to:
        q = q.filter(Case.created_at <= date_to)

    # Sort
    col = Case.created_at
    if sort_by == "updatedAt":
        col = Case.updated_at
    order = desc(col) if sort_order == "desc" else asc(col)
    q = q.order_by(order)

    # Paginate
    total = q.count()
    cases = q.offset((page - 1) * page_size).limit(page_size).all()
    return {"cases": [c.to_dict() for c in cases], "total": total, "page": page, "pageSize": page_size}


@router.get("/cases/all")
def list_all_cases(db: Session = Depends(get_db)):
    cases = db.query(Case).order_by(desc(Case.created_at)).all()
    return [c.to_dict() for c in cases]


@router.get("/cases/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    return case.to_dict()


@router.put("/cases/{case_id}/draft")
def save_draft(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    if "headerData" in body:
        case.header_data = body["headerData"]
    if "lineItems" in body:
        case.line_items = body["lineItems"]
    if case.status == "EXTRACTED":
        case.status = "IN_REVIEW"
    case.updated_at = utcnow()

    _audit(db, case_id, "DRAFT_SAVED", f"Draft saved by {user.first_name}",
           by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
    db.commit()
    db.refresh(case)
    return case.to_dict()


@router.post("/cases/{case_id}/confirm")
def save_and_confirm(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    if "headerData" in body:
        case.header_data = body["headerData"]
    if "lineItems" in body:
        case.line_items = body["lineItems"]

    case.status = "VALIDATED"
    case.updated_at = utcnow()

    _audit(db, case_id, "DATA_CONFIRMED", f"Data confirmed by {user.first_name}",
           by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
    db.commit()
    db.refresh(case)
    return case.to_dict()


@router.post("/cases/{case_id}/reject")
def reject_case(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    """Agent rejects/discards case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    reason = body.get("reason", "")
    case.status = "DISCARDED"
    case.rejection_reason = reason
    case.rejected_at = utcnow()
    case.updated_at = utcnow()

    _audit(db, case_id, "CASE_DISCARDED", f"Case discarded by {user.first_name}: {reason}",
           by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
    db.commit()
    db.refresh(case)
    return case.to_dict()


@router.post("/cases/{case_id}/discard")
def discard_case(case_id: str, body: dict = {}, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    case.status = "DISCARDED"
    case.updated_at = utcnow()
    _audit(db, case_id, "CASE_DISCARDED", f"Case discarded by {user.first_name}",
           by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
    db.commit()
    db.refresh(case)
    return case.to_dict()


@router.post("/cases/{case_id}/business-rules")
async def trigger_business_rules(case_id: str, db: Session = Depends(get_db)):
    """Trigger validation agent for a case. Re-runs the validate step."""
    from models import PromptTemplate
    from agents.runner import run_claude_step, prepare_step, WORKSPACE_ROOT
    from pathlib import Path
    import time

    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    ws = WORKSPACE_ROOT / case_id
    if not ws.exists():
        raise HTTPException(400, f"No workspace for {case_id}")

    template = db.query(PromptTemplate).filter(
        PromptTemplate.step_name == "validate", PromptTemplate.is_active == True
    ).first()
    if not template:
        raise HTTPException(500, "No active validate prompt")

    prepare_step(ws, template.system_prompt, template.output_schema)
    prompt = (
        "Read PROMPT.md for instructions. Read the input files in this workspace. "
        "Output your analysis as JSON matching the schema in OUTPUT_SCHEMA.json. "
        "Return ONLY the JSON object, no other text."
    )
    start = time.time()
    success, result, error, _ = await run_claude_step(case_id, "validate", str(ws), prompt)
    duration = int((time.time() - start) * 1000)

    if not success:
        raise HTTPException(502, detail={"step": "validate", "error": error})

    # Preserve verify_docs entry, replace only validate results
    existing_br = case.business_rule_results or []
    preserved = [e for e in existing_br if isinstance(e, dict) and e.get("step") == "verify_docs"]
    validate_entry = {"step": "validate", "output": result.get("results", [])}
    case.business_rule_results = preserved + [validate_entry]
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(case, "business_rule_results")
    case.updated_at = utcnow()
    _audit(db, case_id, "BUSINESS_RULE_RUN", f"Business rules executed ({duration}ms)", category="SYSTEM")
    db.commit()
    return result.get("results", [])


# ---------------------------------------------------------------------------
# Approval action endpoints
# ---------------------------------------------------------------------------
@router.post("/cases/{case_id}/submit-for-approval")
def submit_for_approval(case_id: str, body: dict = {}, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(
            case_id, "submit_for_approval", user, db,
            comment=body.get("comment"), approver_ids=body.get("approverIds"),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/cases/{case_id}/approve")
def approve_case(case_id: str, body: dict = {}, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(case_id, "approve", user, db, comment=body.get("comment"))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/cases/{case_id}/send-back")
def send_back_case(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(case_id, "send_back", user, db, reason=body.get("reason", ""))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/cases/{case_id}/reject-as-approver")
def reject_as_approver(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(case_id, "reject", user, db, reason=body.get("reason", ""))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/cases/{case_id}/resubmit")
def resubmit_case(case_id: str, body: dict = {}, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(
            case_id, "resubmit", user, db,
            comment=body.get("comment"), approver_ids=body.get("approverIds"),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/cases/{case_id}/approval-chain")
def edit_approval_chain(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return process_approval(
            case_id, "edit_chain", user, db,
            reason=body.get("reason", ""), new_steps=body.get("steps"),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/cases/{case_id}/export-sap")
def sap_export(case_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    try:
        return export_sap(case_id, db)
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------------------------------------------------------------------------
# Approver queue
# ---------------------------------------------------------------------------
@router.get("/approver/cases")
def approver_cases(db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    """List cases pending for current user's approval."""
    cases = db.query(Case).filter(Case.status == "APPROVAL_PENDING").all()
    if user.role == "SUPER_ADMIN":
        return [c.to_dict() for c in cases]
    # Filter to cases where this user is an approver
    result = []
    for c in cases:
        chain = c.approval_chain
        if chain and any(s["approverId"] == user.id for s in chain.get("steps", [])):
            result.append(c.to_dict())
    return result


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
@router.get("/cases/{case_id}/comments")
def list_comments(case_id: str, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.case_id == case_id).order_by(Comment.created_at).all()
    return [c.to_dict() for c in comments]


@router.post("/cases/{case_id}/comments")
def add_comment(case_id: str, body: dict, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")
    comment = Comment(
        case_id=case_id,
        step_number=body.get("stepNumber"),
        author_id=user.id,
        author_name=f"{user.first_name} {user.last_name}",
        author_role=user.role,
        content=body.get("content", ""),
    )
    db.add(comment)
    _audit(db, case_id, "COMMENT_ADDED", f"Comment by {user.first_name}: {body.get('content', '')[:50]}",
           by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
    db.commit()
    db.refresh(comment)
    return comment.to_dict()


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------
@router.get("/cases/{case_id}/audit-log")
def get_audit_log(case_id: str, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(AuditLog.case_id == case_id).order_by(AuditLog.timestamp).all()
    return [l.to_dict() for l in logs]


# ---------------------------------------------------------------------------
# Emails
# ---------------------------------------------------------------------------
@router.patch("/emails/{email_id}/override")
def override_email(email_id: str, body: dict, db: Session = Depends(get_db)):
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise HTTPException(404, "Email not found")
    if "classification" in body:
        email.classification = body["classification"]
    if "invoiceCategory" in body:
        email.invoice_category = body["invoiceCategory"]
    if "entity" in body:
        email.entity = body["entity"]
    if "poType" in body:
        email.po_type = body["poType"]
    db.commit()
    db.refresh(email)
    return email.to_dict()


@router.get("/emails")
def list_emails(
    status: str = "",
    search: str = "",
    db: Session = Depends(get_db),
):
    q = db.query(Email)
    if status:
        q = q.filter(Email.status.in_(status.split(",")))
    if search:
        s = f"%{search}%"
        q = q.filter(Email.subject.ilike(s) | Email.from_address.ilike(s))
    emails = q.order_by(desc(Email.received_at)).all()
    return [e.to_dict() for e in emails]

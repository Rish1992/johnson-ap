"""Pure code pipeline steps: case creation, approval workflow, SAP export."""

import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from models import (
    Case, Email, Attachment, AuditLog, Notification,
    ApprovalRule, ApprovalSequenceMaster, User, Comment, new_id, utcnow,
)
from agents.runner import create_workspace, write_master_data, WORKSPACE_ROOT

# ---------------------------------------------------------------------------
# Status state machine
# ---------------------------------------------------------------------------
VALID_TRANSITIONS: dict[str, set[str]] = {
    "RECEIVED": {"CLASSIFIED", "FAILED", "DISCARDED"},
    "CLASSIFIED": {"CATEGORIZED", "FAILED", "DISCARDED"},
    "CATEGORIZED": {"EXTRACTED", "FAILED", "DISCARDED"},
    "EXTRACTED": {"IN_REVIEW", "FAILED", "DISCARDED"},
    "IN_REVIEW": {"VALIDATED", "FAILED", "DISCARDED"},
    "VALIDATED": {"APPROVAL_PENDING", "FAILED", "DISCARDED"},
    "APPROVAL_PENDING": {"APPROVED", "RETURNED", "REJECTED", "FAILED", "DISCARDED"},
    "APPROVED": {"POSTED", "FAILED", "DISCARDED"},
    "RETURNED": {"APPROVAL_PENDING", "FAILED", "DISCARDED"},
    "POSTED": {"FAILED", "DISCARDED"},
    "REJECTED": {"DISCARDED"},
    "DISCARDED": set(),
    "FAILED": {"DISCARDED"},
}


def assert_transition(current: str, target: str):
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise ValueError(f"Invalid transition: {current} -> {target}")


def _audit(db: Session, case_id: str, action: str, desc: str,
           by_id: str = "SYSTEM", by_name: str = "System", by_role: str = "SYSTEM",
           category: str = "SYSTEM", **kw):
    db.add(AuditLog(
        case_id=case_id, action=action, category=category, description=desc,
        performed_by=by_id, performed_by_name=by_name, performed_by_role=by_role,
        old_value=kw.get("old_value"), new_value=kw.get("new_value"),
        field_name=kw.get("field_name"), metadata_=kw.get("metadata_"),
    ))


def _notify(db: Session, recipient_id: str, type_: str, title: str, message: str, case_id: str | None = None):
    db.add(Notification(type=type_, title=title, message=message, case_id=case_id, recipient_id=recipient_id))


# ---------------------------------------------------------------------------
# W2.3: Case creation (code only)
# ---------------------------------------------------------------------------
def _next_case_number(db: Session) -> str:
    last = db.query(Case).order_by(Case.id.desc()).first()
    if last and last.id.startswith("CASE-"):
        num = int(last.id.split("-")[1]) + 1
    else:
        num = 1
    return f"CASE-{num:04d}"


def create_case(email_id: str, db: Session) -> dict:
    """Create a Case from an Email record. Returns case dict."""
    email = db.query(Email).filter(Email.id == email_id).first()
    if not email:
        raise ValueError(f"Email not found: {email_id}")

    case_id = _next_case_number(db)

    # Build workspace
    ws = create_workspace(case_id)

    # Copy email data to workspace
    email_data = email.to_dict()
    (ws / "email.json").write_text(json.dumps(email_data, indent=2))

    # Copy attachments to workspace
    uploads_dir = Path(__file__).parent.parent / "uploads"
    for att in (email.attachments or []):
        src = uploads_dir / Path(att.get("fileUrl", "")).name
        if src.exists():
            shutil.copy2(str(src), str(ws / "attachments" / src.name))

    # Snapshot master data
    write_master_data(ws, db)

    # Create case record
    now = utcnow()
    case = Case(
        id=case_id,
        status="RECEIVED",
        category=email.invoice_category,
        email={
            "from": email.from_address,
            "to": email.to_address,
            "subject": email.subject,
            "receivedAt": email.received_at.isoformat() + "Z" if email.received_at else now.isoformat() + "Z",
            "body": email.body or "",
            "attachmentCount": len(email.attachments or []),
        },
        attachments=email.attachments or [],
        vendor_id="", vendor_name="", vendor_number="",
        po_type=email.po_type,
        entity=email.entity,
        email_id=email_id,
        created_at=now,
        updated_at=now,
        sla_deadline=now + timedelta(hours=48),
    )
    db.add(case)

    # Link email
    email.linked_case_id = case_id
    email.status = "LINKED"

    _audit(db, case_id, "EMAIL_RECEIVED", f"Case created from email {email_id}", category="SYSTEM")
    db.commit()
    db.refresh(case)
    return case.to_dict()


# ---------------------------------------------------------------------------
# W2.7: Approval workflow (code only)
# ---------------------------------------------------------------------------
def _build_chain_from_rules(case: Case, db: Session, override_ids: list[str] | None = None) -> dict:
    """Build approval chain JSON matching ApprovalChain TS type."""
    if override_ids:
        approver_ids = override_ids
    else:
        # Look up from ApprovalSequenceMaster first, then ApprovalRule
        seq = db.query(ApprovalSequenceMaster).filter(
            ApprovalSequenceMaster.invoice_type == case.category,
            ApprovalSequenceMaster.is_active == True,
        ).first()
        if seq and seq.steps:
            approver_ids = [s["approverId"] for s in seq.steps]
        else:
            rule = db.query(ApprovalRule).filter(
                ApprovalRule.category == case.category,
                ApprovalRule.is_active == True,
            ).first()
            approver_ids = rule.approver_ids if rule else []

    steps = []
    for i, aid in enumerate(approver_ids):
        user = db.query(User).filter(User.id == aid).first()
        steps.append({
            "stepNumber": i + 1,
            "approverId": aid,
            "approverName": f"{user.first_name} {user.last_name}".strip() if user else aid,
            "approverRole": user.role if user else "AP_REVIEWER",
            "status": "PENDING",
            "decision": None,
            "comment": None,
            "decidedAt": None,
        })

    return {
        "id": f"AC-{case.id}-{int(utcnow().timestamp())}",
        "caseId": case.id,
        "steps": steps,
        "currentStepIndex": 0,
        "status": "PENDING",
        "createdAt": utcnow().isoformat() + "Z",
        "completedAt": None,
    }


def process_approval(case_id: str, action: str, user: User, db: Session,
                     reason: str | None = None, comment: str | None = None,
                     approver_ids: list[str] | None = None,
                     new_steps: list[dict] | None = None) -> dict:
    """Handle all approval actions. Returns updated case dict."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case not found: {case_id}")

    now = utcnow()
    now_iso = now.isoformat() + "Z"

    if action == "submit_for_approval":
        assert_transition(case.status, "APPROVAL_PENDING")
        chain = _build_chain_from_rules(case, db, approver_ids)
        case.approval_chain = chain
        case.status = "APPROVAL_PENDING"
        case.updated_at = now
        # Notification to first approver
        if chain["steps"]:
            first = chain["steps"][0]
            _notify(db, first["approverId"], "APPROVAL_REQUEST",
                    f"Approval needed: {case_id}", f"Case {case_id} requires your approval.", case_id)
        if comment:
            db.add(Comment(case_id=case_id, author_id=user.id,
                           author_name=f"{user.first_name} {user.last_name}",
                           author_role=user.role, content=comment))
        _audit(db, case_id, "SUBMITTED_FOR_APPROVAL", f"Submitted for approval by {user.first_name}",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")
        _audit(db, case_id, "APPROVAL_CHAIN_CREATED",
               f"Approval chain created with {len(chain['steps'])} steps", category="SYSTEM")

    elif action == "approve":
        chain = case.approval_chain
        if not chain:
            raise ValueError("No approval chain")
        idx = chain["currentStepIndex"]
        steps = chain["steps"]
        if idx >= len(steps):
            raise ValueError("All steps already completed")

        steps[idx]["status"] = "APPROVED"
        steps[idx]["decision"] = "APPROVE"
        steps[idx]["comment"] = comment
        steps[idx]["decidedAt"] = now_iso

        next_idx = idx + 1
        all_done = next_idx >= len(steps)

        chain["currentStepIndex"] = next_idx
        chain["status"] = "APPROVED" if all_done else "PENDING"
        chain["completedAt"] = now_iso if all_done else None

        if all_done:
            assert_transition(case.status, "APPROVED")
            case.status = "APPROVED"
            # Notify agents
            for agent in db.query(User).filter(User.role == "AP_AGENT", User.is_active == True).all():
                _notify(db, agent.id, "CASE_APPROVED", f"Case {case_id} approved",
                        f"All approvals complete for {case_id}.", case_id)
        else:
            # Notify next approver
            nxt = steps[next_idx]
            _notify(db, nxt["approverId"], "APPROVAL_REQUEST",
                    f"Approval needed: {case_id}", f"Case {case_id} requires your approval (step {next_idx + 1}).", case_id)

        flag_modified(case, "approval_chain")
        case.updated_at = now
        _audit(db, case_id, "APPROVED", f"Approved by {user.first_name} {user.last_name} (step {idx + 1})",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="APPROVER")

    elif action == "send_back":
        chain = case.approval_chain
        if not chain:
            raise ValueError("No approval chain")
        idx = chain["currentStepIndex"]
        steps = chain["steps"]

        steps[idx]["status"] = "RETURNED"
        steps[idx]["decision"] = "SEND_BACK"
        steps[idx]["comment"] = reason
        steps[idx]["decidedAt"] = now_iso

        chain["status"] = "RETURNED"
        case.approval_chain = chain
        flag_modified(case, "approval_chain")
        assert_transition(case.status, "RETURNED")
        case.status = "RETURNED"
        case.returned_by = user.id
        case.returned_by_name = f"{user.first_name} {user.last_name}"
        case.return_reason = reason
        case.returned_at = now
        case.returned_from_step = steps[idx]["stepNumber"]
        case.updated_at = now

        # Notify agents
        for agent in db.query(User).filter(User.role == "AP_AGENT", User.is_active == True).all():
            _notify(db, agent.id, "CASE_RETURNED", f"Case {case_id} returned",
                    f"Returned by {user.first_name}: {reason}", case_id)
        _audit(db, case_id, "RETURNED", f"Returned by {user.first_name}: {reason}",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="APPROVER")

    elif action == "reject":
        chain = case.approval_chain
        if chain:
            idx = chain["currentStepIndex"]
            steps = chain["steps"]
            if idx < len(steps):
                steps[idx]["status"] = "REJECTED"
                steps[idx]["decision"] = "REJECT"
                steps[idx]["comment"] = reason
                steps[idx]["decidedAt"] = now_iso
            chain["status"] = "REJECTED"
            case.approval_chain = chain
            flag_modified(case, "approval_chain")

        assert_transition(case.status, "REJECTED")
        case.status = "REJECTED"
        case.rejected_by = user.id
        case.rejected_by_name = f"{user.first_name} {user.last_name}"
        case.rejection_reason = reason
        case.rejected_at = now
        case.updated_at = now
        _audit(db, case_id, "REJECTED", f"Rejected by {user.first_name}: {reason}",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="APPROVER")

    elif action == "resubmit":
        assert_transition(case.status, "APPROVAL_PENDING")
        old_chain = case.approval_chain or {"steps": [], "createdAt": now_iso}
        preserved = old_chain.get("steps", [])
        next_num = max((s["stepNumber"] for s in preserved), default=0) + 1

        # Build new steps
        ids = approver_ids or []
        new_s = []
        for i, aid in enumerate(ids):
            u = db.query(User).filter(User.id == aid).first()
            new_s.append({
                "stepNumber": next_num + i,
                "approverId": aid,
                "approverName": f"{u.first_name} {u.last_name}".strip() if u else aid,
                "approverRole": u.role if u else "AP_REVIEWER",
                "status": "PENDING", "decision": None, "comment": None, "decidedAt": None,
            })

        all_steps = preserved + new_s
        chain = {
            "id": old_chain.get("id", f"AC-{case_id}-{int(now.timestamp())}"),
            "caseId": case_id,
            "steps": all_steps,
            "currentStepIndex": len(preserved),
            "status": "PENDING",
            "createdAt": old_chain.get("createdAt", now_iso),
            "completedAt": None,
        }
        case.approval_chain = chain
        case.status = "APPROVAL_PENDING"
        case.returned_by = None
        case.returned_by_name = None
        case.return_reason = None
        case.returned_at = None
        case.returned_from_step = None
        case.updated_at = now
        if comment:
            db.add(Comment(case_id=case_id, author_id=user.id,
                           author_name=f"{user.first_name} {user.last_name}",
                           author_role=user.role, content=comment))
        if new_s:
            _notify(db, new_s[0]["approverId"], "APPROVAL_REQUEST",
                    f"Resubmitted: {case_id}", f"Case {case_id} resubmitted for approval.", case_id)
        _audit(db, case_id, "RESUBMITTED", f"Resubmitted by {user.first_name}",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")

    elif action == "edit_chain":
        chain = case.approval_chain
        if not chain:
            raise ValueError("No approval chain")
        completed = [s for s in chain["steps"] if s["status"] != "PENDING"]
        pending = []
        for i, step_data in enumerate(new_steps or []):
            pending.append({
                "stepNumber": len(completed) + i + 1,
                "approverId": step_data["approverId"],
                "approverName": step_data.get("approverName", ""),
                "approverRole": step_data.get("approverRole", "AP_REVIEWER"),
                "status": "PENDING", "decision": None, "comment": None, "decidedAt": None,
            })
        all_steps = completed + pending
        first_pending = next((i for i, s in enumerate(all_steps) if s["status"] == "PENDING"), len(all_steps))
        chain["steps"] = all_steps
        chain["currentStepIndex"] = first_pending
        case.approval_chain = chain
        flag_modified(case, "approval_chain")
        case.updated_at = now
        if reason:
            db.add(Comment(case_id=case_id, author_id=user.id,
                           author_name=f"{user.first_name} {user.last_name}",
                           author_role=user.role,
                           content=f"Approval sequence updated. Reason: {reason}"))
        _audit(db, case_id, "APPROVAL_SEQUENCE_EDITED", f"Approval chain edited by {user.first_name}: {reason}",
               by_id=user.id, by_name=f"{user.first_name} {user.last_name}", by_role=user.role, category="AGENT")

    else:
        raise ValueError(f"Unknown approval action: {action}")

    db.commit()
    db.refresh(case)
    return case.to_dict()


# ---------------------------------------------------------------------------
# W2.8: SAP Export (code only)
# ---------------------------------------------------------------------------
def export_sap(case_id: str, db: Session) -> dict:
    """Generate SAP-compatible data for an approved case. Returns {downloadUrl, sapDocumentNumber}."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise ValueError(f"Case not found: {case_id}")
    if case.status != "APPROVED":
        raise ValueError(f"Case must be APPROVED to export. Current: {case.status}")

    hdr = case.header_data or {}
    items = case.line_items or []
    now = utcnow()

    # Generate SAP document number
    sap_doc = f"SAP-{9000000 + hash(case_id) % 1000000}"

    # Build SAP payload
    sap_data = {
        "headerData": {
            "documentType": "KR",  # Vendor invoice
            "companyCode": hdr.get("companyCode", "JHTA"),
            "vendorNumber": case.vendor_number,
            "invoiceDate": hdr.get("invoiceDate", ""),
            "postingDate": now.strftime("%Y-%m-%d"),
            "reference": hdr.get("invoiceNumber", ""),
            "amount": hdr.get("totalAmount", 0),
            "currency": hdr.get("currency", "AUD"),
            "taxAmount": hdr.get("taxAmount", 0),
            "taxCode": hdr.get("taxCode", "P1"),
            "paymentTerms": hdr.get("paymentTerms", "NET30"),
            "description": hdr.get("description", f"Invoice {case_id}"),
            "sapDocumentNumber": sap_doc,
        },
        "lineItems": [
            {
                "lineNumber": li.get("lineNumber", i + 1),
                "glAccount": li.get("glAccount", hdr.get("glAccount", "")),
                "costCenter": li.get("costCenter", hdr.get("costCenter", "")),
                "amount": li.get("totalAmount", 0),
                "taxCode": hdr.get("taxCode", "P1"),
                "description": li.get("description", ""),
            }
            for i, li in enumerate(items)
        ],
    }

    # Save to workspace
    ws = WORKSPACE_ROOT / case_id
    ws.mkdir(parents=True, exist_ok=True)
    sap_file = ws / f"sap_export_{sap_doc}.json"
    sap_file.write_text(json.dumps(sap_data, indent=2))

    # Update case
    assert_transition(case.status, "POSTED")
    case.status = "POSTED"
    case.sap_document_number = sap_doc
    case.posted_at = now
    case.updated_at = now
    _audit(db, case_id, "POSTED_TO_SAP",
           f"Invoice posted to SAP. Document number: {sap_doc}.",
           category="SYSTEM")

    db.commit()
    return {
        "downloadUrl": f"/workspaces/{case_id}/sap_export_{sap_doc}.json",
        "sapDocumentNumber": sap_doc,
        "sapData": sap_data,
    }

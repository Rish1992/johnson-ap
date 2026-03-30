"""Admin router: prompt template CRUD, user management, notifications."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models import PromptTemplate, User, Notification, new_id, utcnow
from auth import get_current_user, hash_password

router = APIRouter(prefix="/api", tags=["admin"])


# ---------------------------------------------------------------------------
# Prompt Templates
# ---------------------------------------------------------------------------
@router.get("/admin/prompts")
def list_prompts(db: Session = Depends(get_db)):
    """List all prompt templates (active ones first, grouped by step)."""
    templates = db.query(PromptTemplate).order_by(
        PromptTemplate.step_name, PromptTemplate.version.desc()
    ).all()
    return [t.to_dict() for t in templates]


@router.get("/admin/prompts/{step_name}")
def get_active_prompt(step_name: str, db: Session = Depends(get_db)):
    """Get the active prompt template for a step."""
    t = db.query(PromptTemplate).filter(
        PromptTemplate.step_name == step_name,
        PromptTemplate.is_active == True,
    ).first()
    if not t:
        raise HTTPException(404, f"No active prompt for step '{step_name}'")
    return t.to_dict()


@router.put("/admin/prompts/{prompt_id}")
def update_prompt(prompt_id: str, body: dict, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update prompt: deactivates old, creates new version."""
    old = db.query(PromptTemplate).filter(PromptTemplate.id == prompt_id).first()
    if not old:
        raise HTTPException(404, "Prompt template not found")

    # Deactivate old
    old.is_active = False

    # Create new version
    new = PromptTemplate(
        id=new_id("PT-"),
        step_name=old.step_name,
        display_name=body.get("displayName", old.display_name),
        technical_prompt=body.get("technicalPrompt", old.technical_prompt),
        business_rules=body.get("businessRules", old.business_rules),
        output_schema=body.get("outputSchema", old.output_schema),
        version=old.version + 1,
        is_active=True,
        created_by=user.id,
        created_at=utcnow(),
    )
    db.add(new)
    db.commit()
    db.refresh(new)
    return new.to_dict()


# ---------------------------------------------------------------------------
# User Management
# ---------------------------------------------------------------------------
@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    return [u.to_dict() for u in db.query(User).all()]


@router.post("/users")
def create_user(body: dict, db: Session = Depends(get_db)):
    user = User(
        id=new_id("user-"),
        email=body["email"].lower().strip(),
        password_hash=hash_password(body.get("password", "password123")),
        first_name=body["firstName"],
        last_name=body["lastName"],
        role=body["role"],
        department=body.get("department", ""),
        is_active=body.get("isActive", True),
        approval_limit=body.get("approvalLimit"),
    )
    db.add(user)
    db.commit()
    return user.to_dict()


@router.put("/users/{user_id}")
def update_user(user_id: str, body: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    for k, v in body.items():
        attr = {"firstName": "first_name", "lastName": "last_name",
                "isActive": "is_active", "approvalLimit": "approval_limit"}.get(k, k)
        if hasattr(user, attr):
            setattr(user, attr, v)
    db.commit()
    return user.to_dict()


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@router.get("/notifications")
def list_notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(Notification).filter(
        Notification.recipient_id == user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return [n.to_dict() for n in notes]


@router.put("/notifications/{notif_id}/read")
def mark_read(notif_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"success": True}


@router.put("/notifications/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(
        Notification.recipient_id == user.id, Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"success": True}

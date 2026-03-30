"""JWT auth: login endpoint + middleware dependency."""

import os
import hashlib
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from db import get_db
from models import User

SECRET_KEY = os.getenv("JWT_SECRET", "johnson-ap-dev-secret-change-in-prod")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(user_id: str) -> tuple[str, datetime]:
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expires}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token, expires


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency: decode JWT and return User. Raises 401 if invalid."""
    if not credentials:
        raise HTTPException(401, "Missing authorization header")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/login")
def login(request_body: dict, db: Session = Depends(get_db)):
    email = request_body.get("email", "").strip().lower()
    password = request_body.get("password", "")

    user = db.query(User).filter(User.email == email).first()
    if not user or user.password_hash != hash_password(password):
        raise HTTPException(401, "Invalid email or password")
    if not user.is_active:
        raise HTTPException(403, "Account is disabled")

    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token, expires = create_token(user.id)

    return {
        "user": user.to_dict(),
        "token": token,
        "expiresAt": expires.isoformat() + "Z",
    }

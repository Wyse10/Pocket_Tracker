from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserSession

SESSION_COOKIE_NAME = "pocket_tracker_session"
SESSION_DURATION_HOURS = 24


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, salt: str) -> str:
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 200000)
    return derived.hex()


def create_password_hash(password: str) -> str:
    salt = secrets.token_hex(16)
    return f"{salt}${hash_password(password, salt)}"


def verify_password(password: str, stored_password_hash: str) -> bool:
    if "$" not in stored_password_hash:
        return False

    salt, known_hash = stored_password_hash.split("$", 1)
    candidate_hash = hash_password(password, salt)
    return hmac.compare_digest(candidate_hash, known_hash)


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_expires_at() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=SESSION_DURATION_HOURS)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        raise HTTPException(status_code=401, detail="Authentication required.")

    token_hash = hash_session_token(session_token)
    session = db.query(UserSession).filter(UserSession.token_hash == token_hash).first()
    now = datetime.now(timezone.utc)

    if session is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")

    user = db.get(User, session.user_id)
    if user is None:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=401, detail="Authentication required.")

    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_token:
        return None

    token_hash = hash_session_token(session_token)
    session = db.query(UserSession).filter(UserSession.token_hash == token_hash).first()
    if session is None:
        return None

    now = datetime.now(timezone.utc)
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= now:
        db.delete(session)
        db.commit()
        return None

    return db.get(User, session.user_id)

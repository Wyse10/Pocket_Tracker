from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets
from collections import deque
from dataclasses import dataclass, field
from threading import Lock

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserSession

SESSION_COOKIE_NAME = "pocket_tracker_session"
SESSION_DURATION_HOURS = 24


def _env_int(name: str, default: int, *, minimum: int = 1) -> int:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    try:
        parsed = int(raw_value)
    except ValueError:
        return default

    return max(parsed, minimum)


@dataclass
class _AttemptWindow:
    failures: deque[datetime] = field(default_factory=deque)
    lockout_until: datetime | None = None


class LoginRateLimiter:
    def __init__(self, max_failures: int, failure_window: timedelta, lockout_duration: timedelta) -> None:
        self.max_failures = max_failures
        self.failure_window = failure_window
        self.lockout_duration = lockout_duration
        self._windows: dict[str, _AttemptWindow] = {}
        self._lock = Lock()

    def _key(self, email: str, client_ip: str) -> str:
        return f"{normalize_email(email)}|{client_ip.strip()}"

    def _trim_failures(self, window: _AttemptWindow, now: datetime) -> None:
        cutoff = now - self.failure_window
        while window.failures and window.failures[0] < cutoff:
            window.failures.popleft()

    def can_attempt(self, email: str, client_ip: str) -> tuple[bool, int]:
        now = datetime.now(timezone.utc)
        key = self._key(email, client_ip)

        with self._lock:
            window = self._windows.get(key)
            if window is None:
                return True, 0

            self._trim_failures(window, now)
            if window.lockout_until and window.lockout_until > now:
                retry_after = max(int((window.lockout_until - now).total_seconds()), 1)
                return False, retry_after

            if window.lockout_until and window.lockout_until <= now:
                window.lockout_until = None

            if not window.failures and window.lockout_until is None:
                self._windows.pop(key, None)

            return True, 0

    def register_failure(self, email: str, client_ip: str) -> None:
        now = datetime.now(timezone.utc)
        key = self._key(email, client_ip)

        with self._lock:
            window = self._windows.setdefault(key, _AttemptWindow())
            self._trim_failures(window, now)
            window.failures.append(now)

            if len(window.failures) >= self.max_failures:
                window.failures.clear()
                window.lockout_until = now + self.lockout_duration

    def register_success(self, email: str, client_ip: str) -> None:
        key = self._key(email, client_ip)
        with self._lock:
            self._windows.pop(key, None)


login_rate_limiter = LoginRateLimiter(
    max_failures=_env_int("AUTH_MAX_FAILED_ATTEMPTS", 5),
    failure_window=timedelta(minutes=_env_int("AUTH_FAILURE_WINDOW_MINUTES", 15)),
    lockout_duration=timedelta(minutes=_env_int("AUTH_LOCKOUT_MINUTES", 15)),
)


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

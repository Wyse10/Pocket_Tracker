import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from .ai_insights import generate_ai_insight
from . import crud, schemas
from .auth import (
    SESSION_COOKIE_NAME,
    SESSION_DURATION_HOURS,
    create_password_hash,
    create_session_token,
    get_current_user,
    get_current_user_optional,
    hash_session_token,
    login_rate_limiter,
    normalize_email,
    session_expires_at,
    verify_password,
)
from .constants import ALL_CATEGORY_OPTIONS, CATEGORY_OPTIONS_BY_TYPE
from .database import get_db
from .models import Transaction, User, UserSession


router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


def _should_use_secure_cookie(request: Request) -> bool:
    value = os.getenv("SESSION_COOKIE_SECURE", "auto").strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False

    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower()
    if forwarded_proto:
        return forwarded_proto == "https"

    return request.url.scheme == "https"


def _set_session_cookie(response: JSONResponse, request: Request, raw_token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=_should_use_secure_cookie(request),
        max_age=SESSION_DURATION_HOURS * 3600,
        path="/",
    )


@router.get("/")
def root(current_user: User | None = Depends(get_current_user_optional)) -> RedirectResponse:
    if current_user:
        return RedirectResponse(url="/add-transaction", status_code=303)
    return RedirectResponse(url="/login", status_code=303)


@router.get("/login")
def login_page(current_user: User | None = Depends(get_current_user_optional)):
    if current_user:
        return RedirectResponse(url="/add-transaction", status_code=303)

    html_path = STATIC_DIR / "login.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/add-transaction")
def add_transaction_page(current_user: User | None = Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=303)

    html_path = STATIC_DIR / "add-transaction.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/dashboard")
def dashboard_page(current_user: User | None = Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=303)

    html_path = STATIC_DIR / "dashboard.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/ai-insights")
def ai_insights_page(current_user: User | None = Depends(get_current_user_optional)):
    if not current_user:
        return RedirectResponse(url="/login", status_code=303)

    html_path = STATIC_DIR / "ai-insights.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.post("/auth/signup", response_model=schemas.AuthResponse)
def signup(payload: schemas.UserAuthRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    new_user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=create_password_hash(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    raw_token = create_session_token()
    session = UserSession(
        user_id=new_user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=session_expires_at(),
    )
    db.add(session)
    db.commit()

    response = JSONResponse(
        content={
            "message": "Account created successfully.",
            "user": {"id": new_user.id, "full_name": new_user.full_name, "email": new_user.email},
        }
    )
    _set_session_cookie(response, request, raw_token)
    return response


@router.post("/auth/login", response_model=schemas.AuthResponse)
def login(payload: schemas.UserLoginRequest, request: Request, db: Session = Depends(get_db)):
    email = normalize_email(payload.email)
    client_ip = request.client.host if request.client else "unknown"

    can_attempt, retry_after = login_rate_limiter.can_attempt(email, client_ip)
    if not can_attempt:
        raise HTTPException(
            status_code=429,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        login_rate_limiter.register_failure(email, client_ip)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    login_rate_limiter.register_success(email, client_ip)

    # Keep one active session per user for predictable behavior.
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    raw_token = create_session_token()
    session = UserSession(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        expires_at=session_expires_at(),
    )
    db.add(session)
    db.commit()

    response = JSONResponse(
        content={
            "message": "Signed in successfully.",
            "user": {"id": user.id, "full_name": user.full_name, "email": user.email},
        }
    )
    _set_session_cookie(response, request, raw_token)
    return response


@router.post("/auth/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    if current_user:
        db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
        db.commit()

    response = JSONResponse(content={"message": "Signed out."})
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return response


@router.get("/auth/me", response_model=schemas.UserRead)
def auth_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/add-transaction", response_model=schemas.TransactionRead)
def add_transaction(
    payload: schemas.TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return crud.create_transaction(db, payload, user_id=current_user.id)


@router.delete("/transactions/{transaction_id}", response_model=schemas.TransactionDeleteResponse)
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = crud.delete_transaction(db, transaction_id, user_id=current_user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {"message": "Transaction deleted.", "deleted_id": transaction_id}


@router.post("/categories", response_model=schemas.CategoryOptionsResponse)
def get_categories(payload: schemas.CategoryOptionsRequest):
    if payload.transaction_type:
        return {"categories": CATEGORY_OPTIONS_BY_TYPE[payload.transaction_type]}

    return {"categories": ALL_CATEGORY_OPTIONS}


@router.get("/transactions", response_model=schemas.TransactionPageResponse)
def get_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    transaction_type: str | None = Query(default=None, alias="type"),
    category: str | None = Query(default=None),
):
    return crud.get_transactions_page(
        db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
        transaction_type=transaction_type.strip() if transaction_type else None,
        category=category.strip() if category else None,
    )


@router.get("/dashboard-summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return crud.get_dashboard_summary(db, user_id=current_user.id)


@router.get("/ai-suggestions", response_model=schemas.AIInsightResponse)
def get_ai_suggestions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    aggregated_data = crud.get_ai_aggregation_data(db, user_id=current_user.id)
    return generate_ai_insight(aggregated_data)


@router.post("/ai-suggestions", response_model=schemas.AIInsightResponse)
def create_ai_suggestion(
    payload: schemas.AIInsightRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    aggregated_data = crud.get_ai_aggregation_data(db, user_id=current_user.id)
    return generate_ai_insight(aggregated_data, focus=payload.focus)
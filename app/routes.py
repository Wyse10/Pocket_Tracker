from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from .ai_insights import generate_ai_insight
from . import crud, schemas
from .constants import ALL_CATEGORY_OPTIONS, CATEGORY_OPTIONS_BY_TYPE
from .database import get_db


router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


@router.get("/")
def root() -> HTMLResponse:
    html_path = STATIC_DIR / "add-transaction.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/add-transaction")
def add_transaction_page() -> HTMLResponse:
    html_path = STATIC_DIR / "add-transaction.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/dashboard")
def dashboard_page() -> HTMLResponse:
    html_path = STATIC_DIR / "dashboard.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.get("/ai-insights")
def ai_insights_page() -> HTMLResponse:
    html_path = STATIC_DIR / "ai-insights.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@router.post("/add-transaction", response_model=schemas.TransactionRead)
def add_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    return crud.create_transaction(db, payload)


@router.delete("/transactions/{transaction_id}", response_model=schemas.TransactionDeleteResponse)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_transaction(db, transaction_id)
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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    transaction_type: str | None = Query(default=None, alias="type"),
    category: str | None = Query(default=None),
):
    return crud.get_transactions_page(
        db,
        page=page,
        page_size=page_size,
        transaction_type=transaction_type.strip() if transaction_type else None,
        category=category.strip() if category else None,
    )


@router.get("/dashboard-summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return crud.get_dashboard_summary(db)


@router.get("/ai-suggestions", response_model=schemas.AIInsightResponse)
def get_ai_suggestions(db: Session = Depends(get_db)):
    aggregated_data = crud.get_ai_aggregation_data(db)
    return generate_ai_insight(aggregated_data)


@router.post("/ai-suggestions", response_model=schemas.AIInsightResponse)
def create_ai_suggestion(payload: schemas.AIInsightRequest, db: Session = Depends(get_db)):
    aggregated_data = crud.get_ai_aggregation_data(db)
    return generate_ai_insight(aggregated_data, focus=payload.focus)
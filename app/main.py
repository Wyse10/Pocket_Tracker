from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .ai_insights import generate_ai_insight
from . import crud, models, schemas
from .database import Base, engine, get_db

app = FastAPI(title="SmartSpend AI")

CATEGORY_OPTIONS_BY_TYPE: dict[str, list[str]] = {
    "income": [
        "Salary",
        "Freelance",
        "Business",
        "Investment Returns",
        "Gift Received",
        "Others",
    ],
    "expense": [
        "Food & Drink",
        "Transport",
        "Entertainment",
        "Shopping",
        "Health",
        "Utility",
        "Housing",
        "Others",
    ],
}

ALL_CATEGORY_OPTIONS: list[str] = list(
    dict.fromkeys(
        CATEGORY_OPTIONS_BY_TYPE["income"] + CATEGORY_OPTIONS_BY_TYPE["expense"]
    )
)


def ensure_schema_updates() -> None:
    inspector = inspect(engine)
    if "transactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("transactions")}
    if "description" not in existing_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN description VARCHAR"))

Base.metadata.create_all(bind=engine)
ensure_schema_updates()

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def root() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "add-transaction.html"))


@app.get("/add-transaction")
def add_transaction_page() -> FileResponse:
    return FileResponse(str(STATIC_DIR / "add-transaction.html"))


@app.post("/add-transaction", response_model=schemas.TransactionRead)
def add_transaction(payload: schemas.TransactionCreate, db: Session = Depends(get_db)):
    return crud.create_transaction(db, payload)


@app.delete("/transactions/{transaction_id}", response_model=schemas.TransactionDeleteResponse)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_transaction(db, transaction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {"message": "Transaction deleted.", "deleted_id": transaction_id}


@app.post("/categories", response_model=schemas.CategoryOptionsResponse)
def get_categories(payload: schemas.CategoryOptionsRequest):
    if payload.transaction_type:
        return {"categories": CATEGORY_OPTIONS_BY_TYPE[payload.transaction_type]}

    return {"categories": ALL_CATEGORY_OPTIONS}


@app.get("/transactions", response_model=schemas.TransactionPageResponse)
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


@app.get("/dashboard-summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    return crud.get_dashboard_summary(db)


@app.get("/ai-suggestions", response_model=schemas.AIInsightResponse)
def get_ai_suggestions(db: Session = Depends(get_db)):
    transactions = crud.list_transactions(db)
    tx_payload = [
        {
            "amount": tx.amount,
            "type": tx.type,
            "category": tx.category,
            "description": tx.description,
            "date": tx.date,
        }
        for tx in transactions
    ]
    return generate_ai_insight(tx_payload)


@app.post("/ai-suggestions", response_model=schemas.AIInsightResponse)
def create_ai_suggestion(payload: schemas.AIInsightRequest, db: Session = Depends(get_db)):
    transactions = crud.list_transactions(db)
    tx_payload = [
        {
            "amount": tx.amount,
            "type": tx.type,
            "category": tx.category,
            "description": tx.description,
            "date": tx.date,
        }
        for tx in transactions
    ]
    return generate_ai_insight(tx_payload, focus=payload.focus)

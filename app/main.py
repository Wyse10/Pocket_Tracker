from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .ai_insights import generate_ai_insight
from . import crud, models, schemas
from .database import Base, engine, get_db

app = FastAPI(title="SmartSpend AI")

CATEGORY_OPTIONS: list[str] = [
    "Food & Drink",
    "Transport",
    "Entertainment",
    "Shopping",
    "Health",
    "Salary",
    "Utility",
    "Housing",
    "Others",
]


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


@app.post("/categories", response_model=schemas.CategoryOptionsResponse)
def get_categories(payload: schemas.CategoryOptionsRequest):
    return {"categories": CATEGORY_OPTIONS}


@app.get("/transactions", response_model=list[schemas.TransactionRead])
def get_transactions(db: Session = Depends(get_db)):
    return crud.list_transactions(db)


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

from pathlib import Path
import json
import logging
import time
import uuid

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .ai_insights import generate_ai_insight
from . import crud, models, schemas
from .database import Base, engine, get_db


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        extra_data = getattr(record, "extra_data", None)
        if isinstance(extra_data, dict):
            payload.update(extra_data)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


def configure_structured_logging() -> logging.Logger:
    logger = logging.getLogger("pocket_tracker")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)

    logger.propagate = False
    return logger


app_logger = configure_structured_logging()

app = FastAPI(title="Pocket Tracker")

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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    start_time = time.perf_counter()

    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        app_logger.info(
            "request.completed",
            extra={
                "extra_data": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "status_code": response.status_code,
                    "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "client_ip": request.client.host if request.client else None,
                }
            },
        )
        return response
    except Exception:
        app_logger.exception(
            "request.failed",
            extra={
                "extra_data": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "duration_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "client_ip": request.client.host if request.client else None,
                }
            },
        )
        raise


@app.get("/")
def root() -> HTMLResponse:
    html_path = STATIC_DIR / "add-transaction.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/add-transaction")
def add_transaction_page() -> HTMLResponse:
    html_path = STATIC_DIR / "add-transaction.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/dashboard")
def dashboard_page() -> HTMLResponse:
    html_path = STATIC_DIR / "dashboard.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


@app.get("/ai-insights")
def ai_insights_page() -> HTMLResponse:
    html_path = STATIC_DIR / "ai-insights.html"
    return HTMLResponse(content=html_path.read_text(encoding="utf-8"))


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
    aggregated_data = crud.get_ai_aggregation_data(db)
    return generate_ai_insight(aggregated_data)


@app.post("/ai-suggestions", response_model=schemas.AIInsightResponse)
def create_ai_suggestion(payload: schemas.AIInsightRequest, db: Session = Depends(get_db)):
    aggregated_data = crud.get_ai_aggregation_data(db)
    return generate_ai_insight(aggregated_data, focus=payload.focus)

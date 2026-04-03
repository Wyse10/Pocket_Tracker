from datetime import date
from math import ceil

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


def normalize_transaction_type(raw_type: str) -> str:
    normalized = raw_type.strip().lower()
    if normalized in {"income", "incomes", "earning", "earnings"}:
        return "income"
    if normalized in {"expense", "expenses", "spending", "spend"}:
        return "expense"
    return normalized


def normalize_category(raw_category: str) -> str:
    normalized = raw_category.strip()
    lookup = normalized.lower()
    if lookup in {"food", "food & drink", "food and drink"}:
        return "Food & Drink"
    if lookup in {"gift recieved", "gift received", "gift"}:
        return "Gift Received"
    if lookup in {"enterianment", "entertainment"}:
        return "Entertainment"
    if lookup in {"healt", "health"}:
        return "Health"
    return normalized


def create_transaction(db: Session, payload: schemas.TransactionCreate) -> models.Transaction:
    transaction_type = normalize_transaction_type(payload.type)
    tx = models.Transaction(
        amount=payload.amount,
        type=transaction_type,
        category=normalize_category(payload.category),
        description=payload.description.strip() if payload.description and payload.description.strip() else None,
        date=payload.date,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(db: Session, transaction_id: int) -> bool:
    tx = db.get(models.Transaction, transaction_id)
    if tx is None:
        return False

    db.delete(tx)
    db.commit()
    return True


def list_transactions(db: Session) -> list[models.Transaction]:
    return db.query(models.Transaction).order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).all()


def get_transactions_page(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    transaction_type: str | None = None,
    category: str | None = None,
) -> dict[str, object]:
    query = db.query(models.Transaction)

    if transaction_type:
        query = query.filter(models.Transaction.type == transaction_type)

    if category:
        query = query.filter(models.Transaction.category == category)

    total = query.order_by(None).count()
    total_pages = ceil(total / page_size) if total else 0
    current_page = min(page, total_pages) if total_pages else 1
    offset = max(current_page - 1, 0) * page_size

    items = (
        query.order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": current_page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_dashboard_summary(db: Session) -> dict[str, float]:
    income_total = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(models.Transaction.type == "income")
        .scalar()
    )
    expense_total = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(models.Transaction.type == "expense")
        .scalar()
    )

    today = date.today()
    month_start = date(today.year, today.month, 1)
    if today.month == 12:
        next_month_start = date(today.year + 1, 1, 1)
    else:
        next_month_start = date(today.year, today.month + 1, 1)

    monthly_spending = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(models.Transaction.type == "expense")
        .filter(models.Transaction.date >= month_start)
        .filter(models.Transaction.date < next_month_start)
        .scalar()
    )

    return {
        "income_total": float(income_total),
        "expense_total": float(expense_total),
        "total_balance": float(income_total) - float(expense_total),
    }

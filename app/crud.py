from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from . import models, schemas


def create_transaction(db: Session, payload: schemas.TransactionCreate) -> models.Transaction:
    tx = models.Transaction(
        amount=payload.amount,
        type=payload.type,
        category=payload.category.strip(),
        description=payload.description.strip() if payload.description and payload.description.strip() else None,
        date=payload.date,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def list_transactions(db: Session) -> list[models.Transaction]:
    return db.query(models.Transaction).order_by(models.Transaction.date.desc(), models.Transaction.id.desc()).all()


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
        "total_balance": float(income_total) - float(expense_total),
        "monthly_spending": float(monthly_spending),
    }

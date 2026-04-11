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


def get_dashboard_summary(db: Session) -> dict[str, object]:
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

    category_rows = (
        db.query(
            models.Transaction.category,
            func.coalesce(func.sum(models.Transaction.amount), 0.0).label("total"),
        )
        .filter(models.Transaction.type == "expense")
        .filter(models.Transaction.date >= month_start)
        .filter(models.Transaction.date < next_month_start)
        .group_by(models.Transaction.category)
        .order_by(func.sum(models.Transaction.amount).desc())
        .all()
    )

    spending_rows = (
        db.query(
            models.Transaction.date,
            func.coalesce(func.sum(models.Transaction.amount), 0.0).label("total"),
        )
        .filter(models.Transaction.type == "expense")
        .group_by(models.Transaction.date)
        .order_by(models.Transaction.date.asc())
        .all()
    )

    category_breakdown = {
        str(category): float(total)
        for category, total in category_rows
    }
    spending_over_time = [
        {"date": tx_date.isoformat(), "total": float(total)}
        for tx_date, total in spending_rows
    ]

    return {
        "income_total": float(income_total),
        "expense_total": float(expense_total),
        "total_balance": float(income_total) - float(expense_total),
        "monthly_spending": float(monthly_spending),
        "category_breakdown": category_breakdown,
        "spending_over_time": spending_over_time,
    }


def get_ai_aggregation_data(db: Session) -> dict:
    """
    Compute aggregated data for AI insights.
    Uses optimized SQLAlchemy queries to avoid N+1 problems.
    Returns meaningful summary metrics instead of raw transaction rows.
    """
    today = date.today()
    month_start = date(today.year, today.month, 1)
    if today.month == 12:
        next_month_start = date(today.year + 1, 1, 1)
        prev_month_end_date = date(today.year, 12, 31)
    else:
        next_month_start = date(today.year, today.month + 1, 1)
        prev_month_end_date = date(today.year, today.month, 1) - date.resolution
    
    # Calculate prev month start
    if today.month == 1:
        prev_month_start = date(today.year - 1, 12, 1)
    else:
        prev_month_start = date(today.year, today.month - 1, 1)

    # Overall totals
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

    # Current month spending
    current_month_spending = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(models.Transaction.type == "expense")
        .filter(models.Transaction.date >= month_start)
        .filter(models.Transaction.date < next_month_start)
        .scalar()
    )

    # Previous month spending
    prev_month_spending = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0.0))
        .filter(models.Transaction.type == "expense")
        .filter(models.Transaction.date >= prev_month_start)
        .filter(models.Transaction.date < month_start)
        .scalar()
    )

    # Expense by category (single optimized query)
    category_expenses = (
        db.query(
            models.Transaction.category,
            func.sum(models.Transaction.amount).label("total"),
            func.count(models.Transaction.id).label("count")
        )
        .filter(models.Transaction.type == "expense")
        .filter(models.Transaction.date >= month_start)
        .filter(models.Transaction.date < next_month_start)
        .group_by(models.Transaction.category)
        .order_by(func.sum(models.Transaction.amount).desc())
        .all()
    )

    # Calculate percentages and format category breakdown
    expense_total_val = float(current_month_spending) if float(current_month_spending) > 0 else 1
    category_breakdown = {}
    top_categories = []
    
    for category, total, count in category_expenses:
        percentage = round((float(total) / expense_total_val) * 100, 1)
        category_breakdown[category] = {
            "total": float(total),
            "percentage": percentage,
            "count": int(count),
        }
        top_categories.append(category)

    # Transaction count and averages
    expense_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.type == "expense")
        .scalar()
    )
    income_count = (
        db.query(func.count(models.Transaction.id))
        .filter(models.Transaction.type == "income")
        .scalar()
    )

    avg_expense = float(expense_total) / max(int(expense_count), 1) if float(expense_total) > 0 else 0
    avg_income = float(income_total) / max(int(income_count), 1) if float(income_total) > 0 else 0

    # Month-over-month change
    current_month_val = float(current_month_spending)
    prev_month_val = float(prev_month_spending)
    mom_change_pct = 0.0
    if prev_month_val > 0:
        mom_change_pct = round(((current_month_val - prev_month_val) / prev_month_val) * 100, 1)

    return {
        "income_total": float(income_total),
        "expense_total": float(expense_total),
        "net_balance": float(income_total) - float(expense_total),
        "current_month_spending": current_month_val,
        "previous_month_spending": prev_month_val,
        "month_over_month_change_pct": mom_change_pct,
        "category_breakdown": category_breakdown,
        "top_categories": top_categories[:3],
        "total_transactions": int(expense_count) + int(income_count),
        "expense_count": int(expense_count),
        "income_count": int(income_count),
        "average_expense": round(avg_expense, 2),
        "average_income": round(avg_income, 2),
    }

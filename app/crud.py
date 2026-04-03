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

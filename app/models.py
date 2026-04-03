from sqlalchemy import CheckConstraint, Column, Date, Float, Integer, String

from .database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, nullable=False)
    type = Column(String, nullable=False, index=True)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(Date, nullable=False, index=True)

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense')", name="ck_transaction_type"),
    )

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    type: Literal["income", "expense"]
    category: str = Field(..., min_length=1, max_length=100)
    date: date


class TransactionRead(BaseModel):
    id: int
    amount: float
    type: Literal["income", "expense"]
    category: str
    date: date

    class Config:
        from_attributes = True

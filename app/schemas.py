from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    type: Literal["income", "expense"]
    category: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    date: date


class TransactionRead(BaseModel):
    id: int
    amount: float
    type: Literal["income", "expense"]
    category: str
    description: str | None
    date: date

    class Config:
        from_attributes = True


class AIInsightResponse(BaseModel):
    provider: str
    model: str
    insight: str


class AIInsightRequest(BaseModel):
    focus: str | None = Field(
        default=None,
        min_length=2,
        max_length=120,
        description="Optional focus area like food, transport, or saving.",
    )


class AIChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=400)


class AIChatResponse(BaseModel):
    provider: str
    model: str
    answer: str


class CategoryOptionsRequest(BaseModel):
    transaction_type: Literal["income", "expense"] | None = None


class CategoryOptionsResponse(BaseModel):
    categories: list[str]


class DashboardSummaryResponse(BaseModel):
    total_balance: float
    monthly_spending: float

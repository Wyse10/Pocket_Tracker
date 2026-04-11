from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    type: str = Field(..., min_length=1, max_length=20)
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


class CategoryOptionsRequest(BaseModel):
    transaction_type: Literal["income", "expense"] | None = None


class CategoryOptionsResponse(BaseModel):
    categories: list[str]


class DashboardSummaryResponse(BaseModel):
    income_total: float
    expense_total: float
    total_balance: float
    monthly_spending: float
    category_breakdown: dict[str, float]
    spending_over_time: list[dict[str, float | str]]


class TransactionPageResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionDeleteResponse(BaseModel):
    message: str
    deleted_id: int

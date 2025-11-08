from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ReceiptFetchRequest(BaseModel):
    receipt_id: Optional[str] = Field(default=None, description="FS receiptId")
    qr_code: Optional[str] = Field(default=None, description="Obsah QR kódu z bločku")
    payload: Optional[dict] = Field(
        default=None, description="Priame vloženie JSON z FS API (na testovanie)"
    )

    @model_validator(mode="after")
    def ensure_one_source(self) -> "ReceiptFetchRequest":
        if not any([self.receipt_id, self.qr_code, self.payload]):
            raise ValueError("Musíš poskytnúť receipt_id, qr_code alebo payload")
        return self


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    quantity: float
    unit_price: Optional[float]
    total_price: Optional[float]
    category: Optional[str]
    suggested_category: Optional[str]


class ReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    receipt_id: str
    issue_date: Optional[datetime]
    merchant_name: Optional[str]
    total_amount: Optional[float]


class ReceiptDetail(ReceiptOut):
    items: list[ItemOut]


class StatsRow(BaseModel):
    category: str
    total: float


class StatsResponse(BaseModel):
    month: int
    year: int
    totals: list[StatsRow]

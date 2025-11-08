import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    receipt_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    issue_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    merchant_name: Mapped[Optional[str]] = mapped_column(String(255))
    merchant_address = Column(JSON, nullable=True)
    total_amount: Mapped[Optional[float]] = mapped_column(Float)
    source_payload = Column(JSON, nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="fs")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow
    )

    items: Mapped[list["Item"]] = relationship(
        "Item", back_populates="receipt", cascade="all, delete-orphan"
    )


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    rules: Mapped[list["CategoryRule"]] = relationship(
        "CategoryRule", back_populates="category", cascade="all, delete-orphan"
    )
    items: Mapped[list["Item"]] = relationship("Item", back_populates="category")


class CategoryRule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    pattern: Mapped[str] = mapped_column(String(120), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)

    category: Mapped[Category] = relationship("Category", back_populates="rules")

    __table_args__ = (UniqueConstraint("pattern", name="uq_rule_pattern"),)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("receipts.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[float] = mapped_column(Float, default=1)
    unit_price: Mapped[Optional[float]] = mapped_column(Float)
    total_price: Mapped[Optional[float]] = mapped_column(Float)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    suggested_category: Mapped[Optional[str]] = mapped_column(String(100))

    receipt: Mapped[Receipt] = relationship("Receipt", back_populates="items")
    category: Mapped[Optional[Category]] = relationship("Category", back_populates="items")

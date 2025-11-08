import json
from datetime import datetime
from typing import Any, Optional

import httpx
from dateutil import parser
from sqlalchemy import extract, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

import models

FS_API_URL = "https://ekasa.financnasprava.sk/mdu/api/v1/opd/receipt/find"


class ReceiptAlreadyExists(Exception):
    def __init__(self, receipt: models.Receipt):
        super().__init__("Receipt already exists")
        self.receipt = receipt


class ReceiptFetchError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


async def fetch_receipt_from_fs(
    receipt_id: Optional[str] = None, qr_code: Optional[str] = None
) -> dict[str, Any]:
    if not receipt_id and not qr_code:
        raise ValueError("receipt_id alebo qr_code je povinné")

    payload = {}
    if receipt_id:
        payload["receiptId"] = receipt_id.strip()
    if qr_code:
        payload["qrCode"] = qr_code.strip()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(FS_API_URL, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or exc.response.reason_phrase or "FS API error"
        status_code = exc.response.status_code
        if not (100 <= status_code <= 599):
            status_code = 502
        raise ReceiptFetchError(status_code=status_code, detail=detail) from exc
    except httpx.RequestError as exc:
        raise ReceiptFetchError(
            status_code=503, detail="FS API je momentálne nedostupné"
        ) from exc

    data = response.json()
    return data


def _normalize_receipt(raw_payload: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    receipt = raw_payload.get("receipt") or raw_payload

    receipt_id = receipt.get("receiptId") or receipt.get("id") or receipt.get("receiptNumber")
    issue_date_raw = (
        receipt.get("issueDate")
        or receipt.get("created")
        or receipt.get("transactionDate")
    )
    issue_date = None
    if issue_date_raw:
        try:
            issue_date = parser.isoparse(issue_date_raw)
        except (ValueError, TypeError):
            issue_date = None

    merchant_info = receipt.get("merchant") or receipt.get("merchantProfile") or {}
    base_merchant = (
        receipt.get("businessName")
        or receipt.get("merchantName")
        or receipt.get("organization")
    )
    if not base_merchant and isinstance(merchant_info, dict):
        base_merchant = (
            merchant_info.get("businessName")
            or merchant_info.get("name")
            or merchant_info.get("companyName")
        )
    merchant = base_merchant
    merchant_address = merchant_info if isinstance(merchant_info, dict) else None
    if isinstance(merchant, dict):
        merchant_address = merchant
        merchant = (
            merchant.get("businessName")
            or merchant.get("name")
            or merchant.get("companyName")
        )
    if merchant is not None and not isinstance(merchant, str):
        merchant = str(merchant)
    total = receipt.get("totalPrice") or receipt.get("totalAmount")

    items = receipt.get("items") or receipt.get("receiptItems") or []
    normalized_items: list[dict[str, Any]] = []
    for entry in items:
        name = entry.get("name") or entry.get("description") or "Neznáma položka"
        quantity = float(entry.get("quantity") or entry.get("qty") or 1)
        unit_price = entry.get("unitPrice") or entry.get("pricePerUnit")
        total_price = entry.get("price") or entry.get("totalPrice")
        if total_price is None and unit_price is not None:
            total_price = unit_price * quantity
        normalized_items.append(
            {
                "name": name,
                "quantity": quantity,
                "unit_price": float(unit_price) if unit_price is not None else None,
                "total_price": float(total_price) if total_price is not None else None,
            }
        )

    normalized_receipt = {
        "receipt_id": receipt_id or "",
        "issue_date": issue_date,
        "merchant_name": merchant,
        "total_amount": float(total) if total is not None else None,
        "merchant_address": merchant_address,
    }
    return normalized_receipt, normalized_items


def _match_category(session: Session, item_name: str, merchant: Optional[str]) -> tuple[Optional[models.Category], Optional[str]]:
    lowered = f"{item_name} {merchant or ''}".lower()
    rules = session.scalars(
        select(models.CategoryRule).options(joinedload(models.CategoryRule.category))
    ).all()
    for rule in rules:
        if rule.pattern in lowered:
            return rule.category, rule.category.name if rule.category else None
    return None, None


def persist_receipt(session: Session, payload: dict[str, Any], source: str = "fs") -> models.Receipt:
    normalized_receipt, normalized_items = _normalize_receipt(payload)
    if not normalized_receipt["receipt_id"]:
        raise ValueError("V odpovedi FS chýba receiptId")

    existing = session.execute(
        select(models.Receipt).where(
            models.Receipt.receipt_id == normalized_receipt["receipt_id"]
        )
    ).scalar_one_or_none()
    if existing:
        raise ReceiptAlreadyExists(existing)

    receipt = models.Receipt(
        **normalized_receipt,
        source_payload=payload,
        source=source,
    )
    session.add(receipt)
    session.flush()

    for item in normalized_items:
        category, suggested = _match_category(session, item["name"], receipt.merchant_name)
        session.add(
            models.Item(
                receipt_id=receipt.id,
                name=item["name"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                total_price=item["total_price"],
                category=category,
                suggested_category=suggested,
            )
        )

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise
    return receipt


def list_receipts(session: Session, limit: int = 50) -> list[models.Receipt]:
    stmt = select(models.Receipt).order_by(models.Receipt.issue_date.desc()).limit(limit)
    return session.execute(stmt).scalars().all()


def get_receipt(session: Session, receipt_id: str) -> Optional[models.Receipt]:
    return session.execute(
        select(models.Receipt).where(models.Receipt.receipt_id == receipt_id)
    ).scalar_one_or_none()


def monthly_stats(session: Session, year: int, month: int) -> list[tuple[str, float]]:
    category_label = func.coalesce(
        models.Category.name,
        func.coalesce(models.Item.suggested_category, "Nezaradené"),
    )
    stmt = (
        select(category_label.label("category"), func.sum(models.Item.total_price))
        .join(models.Receipt, models.Item.receipt_id == models.Receipt.id)
        .outerjoin(models.Category, models.Item.category_id == models.Category.id)
        .where(extract("year", models.Receipt.issue_date) == year)
        .where(extract("month", models.Receipt.issue_date) == month)
        .group_by(category_label)
    )
    results = session.execute(stmt).all()
    return [(row[0], float(row[1] or 0)) for row in results]

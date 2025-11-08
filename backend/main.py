import os
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

import schemas
import services
from database import engine, get_db, init_db

app = FastAPI(title="Receipt Analyzer API")

default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
custom_origins = os.getenv("ALLOWED_ORIGINS")
if custom_origins:
    allowed_origins = [origin.strip() for origin in custom_origins.split(",") if origin.strip()]
else:
    allowed_origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        return {"status": "error", "db": str(exc)}


@app.post("/receipts/fetch", response_model=schemas.ReceiptDetail)
async def fetch_receipt_endpoint(
    request: schemas.ReceiptFetchRequest, db: Session = Depends(get_db)
):
    payload = request.payload
    source = "manual"
    if not payload:
        try:
            payload = await services.fetch_receipt_from_fs(
                receipt_id=request.receipt_id, qr_code=request.qr_code
            )
        except services.ReceiptFetchError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail)
        source = "fs"
    try:
        receipt = services.persist_receipt(db, payload=payload, source=source)
    except services.ReceiptAlreadyExists as exc:
        receipt = exc.receipt
    return schemas.ReceiptDetail.model_validate(receipt)


@app.get("/receipts", response_model=list[schemas.ReceiptOut])
def list_receipts_endpoint(limit: int = Query(50, le=200), db: Session = Depends(get_db)):
    receipts = services.list_receipts(db, limit=limit)
    return [schemas.ReceiptOut.model_validate(r) for r in receipts]


@app.get("/receipts/{receipt_id}", response_model=schemas.ReceiptDetail)
def get_receipt_endpoint(receipt_id: str, db: Session = Depends(get_db)):
    receipt = services.get_receipt(db, receipt_id=receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return schemas.ReceiptDetail.model_validate(receipt)


@app.get("/stats", response_model=schemas.StatsResponse)
def monthly_stats_endpoint(
    year: int = Query(default_factory=lambda: datetime.utcnow().year),
    month: int = Query(default_factory=lambda: datetime.utcnow().month),
    db: Session = Depends(get_db),
):
    totals = services.monthly_stats(db, year=year, month=month)
    rows = [schemas.StatsRow(category=cat, total=total) for cat, total in totals]
    return schemas.StatsResponse(month=month, year=year, totals=rows)

"""Account ledger API. AI suggestions are reviewed before entering the ledger."""
import csv
import io
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlmodel import Session, select

from .database import get_session
from .models import AppSetting, Budget, Transaction, Wallet, Category

router = APIRouter(prefix="/api")
DHAKA = timezone(timedelta(hours=6))
CATEGORIES = ["Food", "Transport", "Shopping", "Utilities", "Health", "Education", "Entertainment", "Rent", "Gifts", "Travel", "Salary", "Business", "Savings", "Other"]
logger = logging.getLogger(__name__)


def canonical_category(value):
    aliases = {"medical": "Health", "clothing": "Shopping", "academic": "Education", "gift": "Gifts", "others": "Other", "freelance/job": "Salary", "tuition": "Education", "scholarship": "Education", "family": "Other"}
    value = str(value).strip()
    return aliases.get(value.lower(), next((c for c in CATEGORIES if c.lower() == value.lower()), "Other"))


def now():
    return datetime.now(DHAKA)


def local_date(value):
    return (value.replace(tzinfo=DHAKA) if value.tzinfo is None else value.astimezone(DHAKA))


def money(value, positive=True):
    if isinstance(value, bool):
        raise ValueError("Enter a valid amount.")
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or abs(amount) > Decimal("1000000000000"):
            raise ValueError("Amount must be finite and no more than 1 trillion taka.")
        if positive and amount <= 0:
            raise ValueError("Amount must be positive.")
        if amount != amount.quantize(Decimal("0.01")):
            raise ValueError("Use at most two decimal places.")
        return float(amount)
    except (InvalidOperation, TypeError):
        raise ValueError("Enter a valid amount.") from None


def total(values):
    return float(sum((Decimal(str(v)) for v in values), Decimal(0)))


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TransactionInput(Input):
    description: str = Field(min_length=1, max_length=240)
    amount: float
    category: str
    type: Literal["income", "expense"]
    wallet_id: int = Field(gt=0, strict=True)
    date: datetime = Field(default_factory=now)
    quantity: float | None = Field(default=None, gt=0, le=1000000, allow_inf_nan=False)
    unit: str = Field(default="", max_length=20)

    @field_validator("description")
    @classmethod
    def clean_description(cls, value):
        if not value.strip():
            raise ValueError("Description cannot be blank.")
        return value.strip()

    @field_validator("amount", mode="before")
    @classmethod
    def check_money(cls, value):
        return money(value)

    @field_validator("category")
    @classmethod
    def check_category(cls, value):
        if not value.strip() or len(value) > 60:
            raise ValueError("Choose a valid category.")
        return value

    @field_validator("date")
    @classmethod
    def check_date(cls, value):
        return local_date(value)


class Batch(Input):
    transactions: list[TransactionInput] = Field(min_length=1, max_length=100)


class WalletInput(Input):
    name: str = Field(min_length=1, max_length=40)
    opening_balance: float = 0

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        if not value.strip():
            raise ValueError("Wallet name cannot be blank.")
        return value.strip()

    @field_validator("opening_balance", mode="before")
    @classmethod
    def check_balance(cls, value):
        return money(value, positive=False)


class BudgetInput(Input):
    category: str
    amount: float

    @field_validator("category")
    @classmethod
    def check_category(cls, value):
        if not value.strip() or len(value) > 60:
            raise ValueError("Choose a valid category.")
        return value

    @field_validator("amount", mode="before")
    @classmethod
    def check_money(cls, value):
        return money(value)


class SettingsInput(Input):
    name: str | None = Field(default=None, max_length=60)
    theme: Literal["light", "dark", "system", "glass"] | None = None
    language: Literal["en", "bn"] | None = None
    review_before_saving: bool | None = None
    tutorial_seen: bool | None = None
    ai_enabled: bool | None = None
    currency: Literal["BDT", "USD", "EUR", "GBP", "INR", "PKR", "AED", "SAR", "QAR", "KWD", "CAD", "AUD", "SGD", "MYR", "JPY", "CNY"] | None = None
    bottom_nav: Literal["wallets", "budgets", "goals", "regulars", "loans", "more", "hub"] | None = None


class ExtractionInput(Input):
    text: str = Field(min_length=1, max_length=10000)


def transaction_dict(row):
    return {"id": row.id, "description": row.description, "amount": row.amount,
            "category": row.category, "type": row.type, "wallet_id": row.wallet_id,
            "date": local_date(row.date).isoformat(), "quantity": row.quantity, "unit": row.unit}


def ensure_wallet(session, wallet_id):
    if session.get(Wallet, wallet_id) is None:
        raise HTTPException(422, "Choose an existing wallet.")


def ensure_category(session, name):
    category = session.exec(select(Category).where(Category.name == name)).first()
    if category is None or category.archived:
        raise HTTPException(422, "Choose an active category.")


def require_row(session, model, row_id):
    row = session.get(model, row_id)
    if row is None:
        raise HTTPException(404, "Entry not found.")
    return row


@router.get("/state")
def get_state(session: Session = Depends(get_session)):
    from .ai import public_status
    from .finance import finance_state, wallet_balance
    entries = session.exec(select(Transaction).order_by(Transaction.date.desc(), Transaction.id.desc())).all()
    wallets = session.exec(select(Wallet).order_by(Wallet.id)).all()
    settings = session.get(AppSetting, 1) or AppSetting()
    month = now().strftime("%Y-%m")
    budgets = []
    for budget in session.exec(select(Budget).order_by(Budget.id)).all():
        spent = total(t.amount for t in entries if t.type == "expense" and t.category == budget.category and local_date(t.date).strftime("%Y-%m") == month)
        budgets.append({"id": budget.id, "category": budget.category, "amount": budget.amount, "spent": spent})
    return {
        "transactions": [transaction_dict(t) for t in entries],
        "wallets": [{"id": w.id, "name": w.name, "opening_balance": w.opening_balance,
                     "balance": wallet_balance(session, w.id)} for w in wallets],
        "budgets": budgets,
        "settings": settings.model_dump(exclude={"id"}),
        "categories": [c.name for c in session.exec(select(Category)).all() if not c.archived],
        **finance_state(session),
        "configured": any(p["configured"] and p["enabled"] for p in public_status()["providers"]),
        "cloud_mode": hasattr(session, "revision"), "revision": getattr(session, "revision", None),
    }


@router.post("/transactions", status_code=201)
def add_transactions(body: Batch, session: Session = Depends(get_session)):
    for item in body.transactions:
        ensure_wallet(session, item.wallet_id)
        ensure_category(session, item.category)
    rows = [Transaction(**item.model_dump()) for item in body.transactions]
    for row in rows:
        session.add(row)
    session.commit()
    for row in rows:
        session.refresh(row)
    return {"transactions": [transaction_dict(row) for row in rows]}


@router.patch("/transactions/{entry_id}")
def edit_transaction(entry_id: int, body: dict, session: Session = Depends(get_session)):
    from pydantic import ValidationError
    row = require_row(session, Transaction, entry_id)
    # Revalidate the complete result, including fields not present in a partial edit.
    original = transaction_dict(row)
    original.pop("id")
    try:
        data = TransactionInput.model_validate({**original, **body})
    except ValidationError:
        raise HTTPException(422, "Check the transaction fields, amount, category and date.") from None
    ensure_wallet(session, data.wallet_id)
    if data.category != row.category:
        ensure_category(session, data.category)
    for key, value in data.model_dump().items():
        setattr(row, key, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return transaction_dict(row)


@router.delete("/transactions/{entry_id}", status_code=204)
def delete_transaction(entry_id: int, session: Session = Depends(get_session)):
    session.delete(require_row(session, Transaction, entry_id))
    session.commit()
    return Response(status_code=204)


@router.post("/wallets", status_code=201)
def add_wallet(body: WalletInput, session: Session = Depends(get_session)):
    if any(w.name.casefold() == body.name.casefold() for w in session.exec(select(Wallet)).all()):
        raise HTTPException(409, "A wallet with that name already exists.")
    row = Wallet(**body.model_dump(), created_at=now())
    session.add(row)
    session.commit()
    session.refresh(row)
    return {"id": row.id, "name": row.name, "opening_balance": row.opening_balance, "balance": row.opening_balance}


@router.patch("/wallets/{wallet_id}")
def edit_wallet(wallet_id: int, body: dict, session: Session = Depends(get_session)):
    from pydantic import ValidationError
    row = require_row(session, Wallet, wallet_id)
    try:
        data = WalletInput.model_validate({"name": row.name, "opening_balance": row.opening_balance, **body})
    except ValidationError:
        raise HTTPException(422, "Check the wallet name and opening balance.") from None
    if any(w.id != row.id and w.name.casefold() == data.name.casefold()
           for w in session.exec(select(Wallet)).all()):
        raise HTTPException(409, "A wallet with that name already exists.")
    row.name = data.name
    row.opening_balance = data.opening_balance
    session.add(row)
    session.commit()
    session.refresh(row)
    entries = session.exec(select(Transaction).where(Transaction.wallet_id == row.id)).all()
    from .finance import wallet_balance
    balance = wallet_balance(session, row.id)
    return {"id": row.id, "name": row.name, "opening_balance": row.opening_balance, "balance": balance}


@router.put("/budgets")
def set_budget(body: BudgetInput, session: Session = Depends(get_session)):
    ensure_category(session, body.category)
    category = session.exec(select(Category).where(Category.name == body.category)).first()
    if category.bucket not in ("needs", "wants"):
        raise HTTPException(422, "Choose an expense category for a spending budget.")
    row = session.exec(select(Budget).where(Budget.category == body.category)).first()
    if row is None:
        row = Budget(**body.model_dump())
    else:
        row.amount = body.amount
    session.add(row)
    session.commit()
    session.refresh(row)
    return {"id": row.id, "category": row.category, "amount": row.amount}


@router.delete("/budgets/{budget_id}", status_code=204)
def delete_budget(budget_id: int, session: Session = Depends(get_session)):
    session.delete(require_row(session, Budget, budget_id))
    session.commit()
    return Response(status_code=204)


@router.patch("/settings")
def edit_settings(body: SettingsInput, session: Session = Depends(get_session)):
    row = session.get(AppSetting, 1) or AppSetting()
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is None:
            raise HTTPException(422, "Settings cannot be null.")
        setattr(row, key, value.strip() if key == "name" else value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row.model_dump(exclude={"id"})


@router.get("/export.csv")
def export_csv(session: Session = Depends(get_session)):
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Date", "Description", "Type", "Category", "Amount (BDT)", "Wallet"])
    wallets = {w.id: w.name for w in session.exec(select(Wallet)).all()}
    def safe(value):
        value = str(value)
        return "'" + value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value
    for row in session.exec(select(Transaction).order_by(Transaction.date.desc())).all():
        writer.writerow([local_date(row.date).isoformat(), safe(row.description), row.type, safe(row.category), f"{row.amount:.2f}", safe(wallets.get(row.wallet_id, ""))])
    return Response("\ufeff" + output.getvalue(), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="hishab-transactions.csv"'})

"""iOS Shortcuts / automation API tokens and quick one-step logging webhook."""
import hashlib
import secrets
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlmodel import Session, select

from . import cloud, database
from .api import Input, ensure_category, ensure_wallet, money, now
from .bd_parser import parse_quick_text, suggest_category
from .database import ScopedSession, get_session
from .finance import find_category, require_funds, rows, total, wallet_balance
from .models import Category, Movement, ShortcutToken, Transaction, Wallet

router = APIRouter(prefix="/api/shortcuts")


def hash_shortcut_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def extract_shortcut_token(request) -> str | None:
    header = request.headers.get("x-shortcut-token", "").strip()
    if header.startswith("hishab_sc_"):
        return header
    bearer = request.headers.get("authorization", "").strip()
    if bearer.startswith("Bearer hishab_sc_"):
        return bearer[7:].strip()
    return None


def authenticate_shortcut_token(raw_token: str) -> dict | None:
    if not raw_token or not raw_token.startswith("hishab_sc_") or len(raw_token) < 20:
        return None
    if not database.is_relational():
        return None
    eng = database.get_engine()
    digest = hash_shortcut_token(raw_token)
    with Session(eng) as session:
        row = session.exec(select(ShortcutToken).where(ShortcutToken.token_hash == digest)).first()
        if not row:
            return None
        row.last_used_at = now()
        session.add(row)
        session.commit()
        return {
            "user": {"id": row.user_id, "email": "", "factors": []},
            "shortcut_token": True,
            "default_wallet_id": row.default_wallet_id,
        }


class ShortcutTokenCreate(Input):
    label: str = Field(default="iPhone Shortcut", min_length=1, max_length=60)
    default_wallet_id: int | None = Field(default=None, gt=0, strict=True)

    @field_validator("label")
    @classmethod
    def clean_label(cls, value):
        if not value.strip():
            raise ValueError("Enter a label for the shortcut.")
        return value.strip()


class ShortcutLogInput(Input):
    text: str | None = Field(default=None, max_length=2000)
    amount: float | None = None
    description: str | None = Field(default=None, max_length=240)
    category: str | None = Field(default=None, max_length=60)
    type: Literal["expense", "income"] | None = None
    wallet_id: int | None = Field(default=None, gt=0, strict=True)

    @field_validator("amount", mode="before")
    @classmethod
    def valid_amount(cls, value):
        if value in (None, ""):
            return None
        return money(value)


def _match_wallet(wallets: list[Wallet], hint: str | None, preferred_id: int | None) -> Wallet:
    if preferred_id is not None:
        found = next((w for w in wallets if w.id == preferred_id), None)
        if found:
            return found
        raise HTTPException(422, "Choose an existing wallet.")
    if hint:
        h = hint.casefold()
        found = next((w for w in wallets if h in w.name.casefold()), None)
        if found:
            return found
    identity = cloud.CURRENT_USER.get() or {}
    default_id = identity.get("default_wallet_id")
    if default_id:
        found = next((w for w in wallets if w.id == default_id), None)
        if found:
            return found
    if not wallets:
        raise HTTPException(422, "Create a wallet first.")
    return wallets[0]


@router.get("/tokens")
def list_shortcut_tokens(session: Session = Depends(get_session)):
    items = rows(session, ShortcutToken)
    return {
        "tokens": [
            {
                "id": t.id,
                "label": t.label,
                "token_prefix": t.token_prefix,
                "default_wallet_id": t.default_wallet_id,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
            }
            for t in items
        ]
    }


@router.post("/tokens", status_code=201)
def create_shortcut_token(body: ShortcutTokenCreate, session: Session = Depends(get_session)):
    if not database.is_relational():
        raise HTTPException(503, "Shortcut tokens require cloud relational database mode.")
    existing = rows(session, ShortcutToken)
    if len(existing) >= 20:
        raise HTTPException(409, "Remove an unused shortcut token before creating another.")
    if body.default_wallet_id is not None:
        ensure_wallet(session, body.default_wallet_id)
    raw = "hishab_sc_" + secrets.token_urlsafe(24)
    row = ShortcutToken(
        user_id=getattr(session, "user_id", "local"),
        label=body.label,
        token_hash=hash_shortcut_token(raw),
        token_prefix=raw[:16] + "...",
        default_wallet_id=body.default_wallet_id,
        created_at=now(),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return {
        "token": raw,
        "item": {
            "id": row.id,
            "label": row.label,
            "token_prefix": row.token_prefix,
            "default_wallet_id": row.default_wallet_id,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "last_used_at": None,
        },
    }


@router.delete("/tokens/{token_id}", status_code=204)
def delete_shortcut_token(token_id: int, session: Session = Depends(get_session)):
    from .api import require_row
    session.delete(require_row(session, ShortcutToken, token_id))
    session.commit()


@router.post("/log", status_code=201)
def shortcut_log(body: ShortcutLogInput, session: Session = Depends(get_session)):
    wallets = rows(session, Wallet)
    active_cats = [c.name for c in rows(session, Category) if not c.archived]
    user_id = getattr(session, "user_id", "local")
    ts = now()

    if body.amount is not None:
        wallet = _match_wallet(wallets, None, body.wallet_id)
        entry_type = body.type or "expense"
        desc = (body.description or "").strip()
        if body.category:
            ensure_category(session, body.category)
            cat = body.category
        else:
            cat = suggest_category(desc, active_cats, entry_type)
        tx = Transaction(
            user_id=user_id,
            description=(desc or cat)[:240],
            amount=body.amount,
            category=cat,
            type=entry_type,
            wallet_id=wallet.id,
            date=ts,
        )
        session.add(tx)
        session.commit()
        return {
            "saved": True,
            "kind": "transaction",
            "description": tx.description,
            "amount": tx.amount,
            "category": tx.category,
            "type": tx.type,
            "wallet": wallet.name,
            "balance": wallet_balance(session, wallet.id),
        }

    if not body.text or not body.text.strip():
        raise HTTPException(422, "Provide either an amount or text/SMS to log.")

    parsed = parse_quick_text(body.text, active_cats)
    if not parsed:
        raise HTTPException(422, "Could not detect an amount in that text. Example: 'Tea 20' or paste a bKash SMS.")

    if parsed["kind"] == "transfer":
        from_wallet = _match_wallet(wallets, parsed.get("from_wallet_hint"), body.wallet_id)
        to_wallet = _match_wallet(wallets, parsed.get("to_wallet_hint") or "cash", None)
        if from_wallet.id == to_wallet.id and len(wallets) > 1:
            to_wallet = next(w for w in wallets if w.id != from_wallet.id)
        if from_wallet.id == to_wallet.id:
            raise HTTPException(422, "Need at least two wallets for a transfer.")
        fee = parsed.get("fee", 0.0)
        require_funds(session, from_wallet.id, total([parsed["amount"], fee]))
        session.add(Movement(
            user_id=user_id,
            description=parsed["description"],
            amount=parsed["amount"],
            from_wallet_id=from_wallet.id,
            to_wallet_id=to_wallet.id,
            kind="transfer",
            date=ts,
        ))
        if fee > 0:
            fee_cat = "Utilities" if "Utilities" in active_cats else ("Other" if "Other" in active_cats else active_cats[0])
            session.add(Transaction(
                user_id=user_id,
                description=f"{parsed['description']} (Fee)"[:240],
                amount=fee,
                category=fee_cat,
                type="expense",
                wallet_id=from_wallet.id,
                date=ts,
            ))
        session.commit()
        return {
            "saved": True,
            "kind": "transfer",
            "description": parsed["description"],
            "amount": parsed["amount"],
            "fee": fee,
            "wallet": f"{from_wallet.name} -> {to_wallet.name}",
            "balance": wallet_balance(session, from_wallet.id),
        }

    wallet = _match_wallet(wallets, parsed.get("wallet_hint"), body.wallet_id)
    cat = parsed["category"]
    if cat not in active_cats:
        cat = suggest_category(parsed["description"], active_cats, parsed["type"])
    ensure_category(session, cat)
    tx = Transaction(
        user_id=user_id,
        description=parsed["description"],
        amount=parsed["amount"],
        category=cat,
        type=parsed["type"],
        wallet_id=wallet.id,
        date=ts,
    )
    session.add(tx)
    session.commit()
    return {
        "saved": True,
        "kind": "transaction",
        "description": tx.description,
        "amount": tx.amount,
        "category": tx.category,
        "type": tx.type,
        "wallet": wallet.name,
        "balance": wallet_balance(session, wallet.id),
    }

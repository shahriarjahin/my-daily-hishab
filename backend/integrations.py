"""Account sync, AI failover configuration and reviewed wallet balance imports."""
import json
import base64
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import Field, SecretStr, field_validator
from sqlmodel import Session, select

from . import ai, cloud
from .api import Input, WalletInput, TransactionInput, canonical_category, money, total, now, ensure_wallet, ensure_category
from .database import get_session
from .models import Transaction, Wallet, Category, AppSetting
from .workspace import export_workspace, import_workspace, validate_workspace

router = APIRouter(prefix="/api")


class ProviderInput(Input):
    api_key: SecretStr | None = None
    model: str = Field(min_length=1, max_length=160)
    enabled: bool = True
    priority: int = Field(ge=1, le=99)
    base_url: str = Field(default="", max_length=500)


class ExtractInput(Input):
    text: str = Field(min_length=1, max_length=10000)
    mode: Literal["auto", "transactions", "wallets"] = "auto"
    wallet_id: int | None = Field(default=None, gt=0)
    image: str | None = Field(default=None, max_length=2800000)
    mime_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"

    @field_validator("image")
    @classmethod
    def valid_image(cls, value):
        if value is None:
            return value
        try:
            raw = base64.b64decode(value, validate=True)
        except Exception:
            raise ValueError("Choose a valid receipt image.") from None
        if not 16 <= len(raw) <= 2000000 or not (raw.startswith(b"\xff\xd8\xff") or raw.startswith(b"\x89PNG\r\n\x1a\n") or raw.startswith(b"RIFF") and raw[8:12] == b"WEBP"):
            raise ValueError("Choose a JPEG, PNG or WebP image under 2 MB.")
        return value


class BalanceInput(Input):
    name: str = Field(min_length=1, max_length=40)
    balance: float
    expected_balance: float | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        return WalletInput(name=value).name

    @field_validator("balance", "expected_balance", mode="before")
    @classmethod
    def valid_balance(cls, value):
        return None if value is None else money(value, positive=False)


class BalanceBatch(Input):
    wallets: list[BalanceInput] = Field(min_length=1, max_length=100)


@router.get("/ai/providers")
def provider_status():
    return ai.public_status()


@router.put("/ai/providers/{provider_id}")
def save_provider(provider_id: str, body: ProviderInput):
    values = body.model_dump(exclude={"api_key"})
    if body.api_key:
        values["api_key"] = body.api_key.get_secret_value()
        if len(values["api_key"]) > 10000:
            raise HTTPException(422, "API key is too long.")
    try:
        ai.save_config(provider_id, values)
    except ValueError:
        raise HTTPException(422, "Check the provider and HTTPS API base URL.") from None
    return ai.public_status()


@router.post("/ai/retry")
def retry_providers():
    ai.reset_health()
    return ai.public_status()


def balance_preview(session, item):
    wallet = next((w for w in session.exec(select(Wallet)).all() if w.name.casefold() == item.name.casefold()), None)
    current = None
    if wallet:
        from .finance import wallet_balance
        current = wallet_balance(session, wallet.id)
    return {"name": wallet.name if wallet else item.name, "balance": item.balance,
            "expected_balance": current, "existing": wallet is not None}


@router.post("/extract")
def extract_entries(body: ExtractInput, session: Session = Depends(get_session)):
    ai.require_enabled(session)
    if not body.text.strip():
        raise HTTPException(422, "Describe a transaction or wallet balance first.")
    wallets = session.exec(select(Wallet).order_by(Wallet.id)).all()
    chosen = next((w for w in wallets if w.id == body.wallet_id), None)
    if body.wallet_id and chosen is None:
        raise HTTPException(422, "Choose an existing wallet.")
    default_id = chosen.id if chosen else wallets[0].id if wallets else None
    categories = [c.name for c in session.exec(select(Category)).all() if not c.archived and c.bucket != "savings"]
    prompt = (
        "You are Hishab, a Bangladeshi finance extractor. Read English, Bangla and Banglish. "
        "Return ONLY a JSON object with arrays wallets and transactions. "
        "wallets items: {name: string, balance: number}. These are explicitly stated CURRENT account balances, "
        "not income. Example: 'amar kache cash 1000 tk, bank e 2500tk ache' means "
        "wallets [{name:Cash,balance:1000},{name:Bank,balance:2500}], transactions []. "
        "Never mistake a balance statement for receiving or spending money. "
        "transactions items: {description:string,amount:number,category:string,type:income|expense,wallet_id:integer}. "
        f"Use {'Bangla' if (session.get(AppSetting, 1) or AppSetting()).language == 'bn' else 'English'} descriptions. Expand 5k, hajar, lakh and Bangla numbers to numbers in the selected account currency. "
        "Never invent transactions, double-count totals or repeat a wallet. "
        "If an expense explicitly states quantity and unit, include quantity:number and unit:string. Never guess quantities. "
        "If there is no actual financial fact, return both arrays empty. "
        f"Choose categories from: {json.dumps(categories)}. "
        f"Today in Dhaka: {now().date().isoformat()}. Include explicit receipt date as ISO date with +06:00, otherwise omit date. "
        f"Existing wallets (id/name): {json.dumps([{'id':w.id,'name':w.name} for w in wallets])}. "
        f"Default wallet_id for transactions is {default_id}; use a different existing id ONLY if explicitly named. "
        f"Mode: {body.mode}. "
        + ("Extract wallet balances only; transactions must be empty." if body.mode == "wallets" else
           "Extract income/expense events only; wallets must be empty. A current balance is not an event." if body.mode == "transactions" else "Detect balances or transactions automatically.")
    )

    def validate(result):
        if not isinstance(result, dict) or not isinstance(result.get("wallets"), list) or not isinstance(result.get("transactions"), list):
            raise ValueError("Expected wallet and transaction arrays.")
        if len(result["wallets"]) + len(result["transactions"]) > 100:
            raise ValueError("Too many suggestions.")
        balances = [BalanceInput.model_validate(row) for row in result["wallets"]]
        if len({b.name.casefold() for b in balances}) != len(balances):
            raise ValueError("Duplicate wallets.")
        transactions = []
        for raw in result["transactions"]:
            raw = dict(raw)
            raw["category"] = next((c for c in categories if c.casefold() == str(raw.get("category", "")).casefold()), canonical_category(raw.get("category")))
            if raw["category"] not in categories:
                raise ValueError("Unknown category.")
            raw["wallet_id"] = raw.get("wallet_id") or default_id
            item = TransactionInput.model_validate(raw)
            if item.wallet_id not in {w.id for w in wallets}:
                raise ValueError("Unknown wallet.")
            transactions.append(item.model_dump(mode="json"))
        if body.mode == "wallets" and transactions or body.mode == "transactions" and balances:
            raise ValueError("Unexpected entry type.")
        return {"wallets": [balance_preview(session, b) for b in balances], "transactions": transactions}

    try:
        content = {"text": body.text, "image": body.image, "mime_type": body.mime_type} if body.image else body.text
        return ai.extract(prompt, content, validate)
    except ai.ProviderError as error:
        raise HTTPException(503, str(error)) from None


@router.post("/wallets/balances")
def apply_wallet_balances(body: BalanceBatch, session: Session = Depends(get_session)):
    previews = update_wallet_balances(body.wallets, session)
    session.commit()
    return {"wallets": previews}


def update_wallet_balances(wallets, session):
    if len({w.name.casefold() for w in wallets}) != len(wallets):
        raise HTTPException(422, "Each wallet must appear only once.")
    previews = [balance_preview(session, item) for item in wallets]
    for item, preview in zip(wallets, previews):
        if preview["existing"] and item.expected_balance is None:
            raise HTTPException(409, "An existing wallet needs a fresh balance preview before it can be updated.")
        if item.expected_balance is not None and item.expected_balance != preview["expected_balance"]:
            raise HTTPException(409, "A wallet changed since the preview. Extract again before applying balances.")
    for item in wallets:
        wallet = next((w for w in session.exec(select(Wallet)).all() if w.name.casefold() == item.name.casefold()), None)
        if wallet:
            from .finance import wallet_balance
            net = total([wallet_balance(session, wallet.id), -wallet.opening_balance])
            try:
                wallet.opening_balance = money(total([item.balance, -net]), positive=False)
            except ValueError:
                raise HTTPException(422, "This balance and the wallet's history exceed the supported amount range.") from None
        else:
            wallet = Wallet(name=item.name, opening_balance=item.balance, created_at=now())
        session.add(wallet)
    return previews


class ReviewedImport(Input):
    wallets: list[BalanceInput] = Field(default_factory=list, max_length=100)
    transactions: list[TransactionInput] = Field(default_factory=list, max_length=100)


@router.post("/imports/reviewed")
def save_reviewed_import(body: ReviewedImport, session: Session = Depends(get_session)):
    if not body.wallets and not body.transactions:
        raise HTTPException(422, "No financial entries found.")
    for item in body.transactions:
        ensure_wallet(session, item.wallet_id)
        ensure_category(session, item.category)
    update_wallet_balances(body.wallets, session)
    for item in body.transactions:
        session.add(Transaction(**item.model_dump()))
    session.commit()
    return {"saved": True}


class AuthInput(Input):
    email: str = Field(min_length=3, max_length=254)
    password: SecretStr = Field(min_length=6, max_length=1024)
    name: str = Field(default="", max_length=60)


@router.post("/auth/login")
def login(body: AuthInput, response: Response):
    data = cloud.call("POST", "/auth/v1/token?grant_type=password", body={"email": body.email.strip(), "password": body.password.get_secret_value()})
    cloud.set_cookie(response, cloud.token_data(data))
    return {"signed_in": True, "email": data.get("user", {}).get("email", body.email)}


@router.post("/auth/signup")
def signup(body: AuthInput, response: Response, request: Request):
    from .auth import app_origin
    from urllib.parse import urlencode
    data = cloud.call("POST", "/auth/v1/signup?" + urlencode({"redirect_to": app_origin(request) + "/auth/callback"}), body={"email": body.email.strip(), "password": body.password.get_secret_value(), "data":{"name":body.name.strip(),"hishab_name":body.name.strip()}})
    if data.get("access_token"):
        cloud.set_cookie(response, cloud.token_data(data))
    return {"signed_in": bool(data.get("access_token")), "message": "You can sign in now." if data.get("access_token") else "Check your email to confirm your account, then sign in."}


@router.post("/auth/logout")
def logout(response: Response):
    identity = cloud.CURRENT_USER.get()
    if identity:
        try:
            cloud.call("POST", "/auth/v1/logout?scope=local", identity["access_token"])
        except HTTPException:
            pass
    response.delete_cookie(cloud.COOKIE, path="/")
    return {"signed_in": False}


@router.get("/cloud/status")
def cloud_status():
    url, key = cloud.settings()
    identity = cloud.CURRENT_USER.get()
    status = {"configured": bool(url and key), "cloud_mode": cloud.cloud_mode(), "signed_in": bool(identity),
              "email": identity["user"].get("email") if identity else None,
              "name": identity["user"].get("name","") if identity else "", "project_url": url, "revision": 0, "has_backup": False, "setup_required": False}
    if identity and identity.get("mfa_required"):
        status.update(mfa_required=True, factors=[f for f in identity["user"].get("factors",[]) if f.get("status")=="verified"])
        return status
    if identity:
        try:
            row = cloud.read_workspace()
            status.update(revision=row["revision"], has_backup=row["data"] is not None, updated_at=row["updated_at"])
        except HTTPException as error:
            status.update(setup_required=True, message=error.detail)
    return status


@router.get("/cloud/setup.sql")
def setup_sql():
    return FileResponse(Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "001_hishab.sql", media_type="text/plain", filename="hishab-setup.sql")


class SyncInput(Input):
    expected_revision: int = Field(ge=0)


class ImportInput(Input):
    data: dict
    expected_revision: int = Field(ge=0)


@router.post("/cloud/import")
def import_previous_records(body: ImportInput, session: Session = Depends(get_session)):
    if session.revision != body.expected_revision:
        raise HTTPException(409, "Your cloud workspace changed. Reload before importing.")
    existing = export_workspace(session)
    if any(existing[key] for key in ("transactions", "budgets", "movements", "loans", "savings", "goals", "regulars", "advisor_messages")) or any(w["opening_balance"] for w in existing["wallets"]):
        raise HTTPException(409, "Import is only available for an empty account. Existing cloud data will not be replaced.")
    try:
        data = validate_workspace(body.data)
    except ValueError:
        raise HTTPException(422, "The import file is invalid. Your cloud data is unchanged.") from None
    data["settings"] = existing["settings"]
    import_workspace(session, data)
    session.commit()
    return {"imported": True, "revision": session.revision}


@router.get("/health")
def health():
    return {"status": "ok", "cloud_mode": cloud.cloud_mode()}


@router.get("/cloud/workspace")
def pull_workspace():
    return cloud.read_workspace()


@router.post("/cloud/workspace")
def push_workspace(body: ImportInput):
    current = cloud.read_workspace()
    if current["revision"] != body.expected_revision:
        raise HTTPException(409, "Your cloud workspace changed. Reload before importing.")
    try:
        data = validate_workspace(body.data)
    except ValueError:
        raise HTTPException(422, "Invalid workspace. Cloud records were not changed.") from None
    return {"revision": cloud.save_workspace(data, body.expected_revision)}

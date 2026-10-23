"""Portable workspace format shared by local sync and stateless cloud requests."""
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete
from sqlmodel import Session, select

from .models import AppSetting, Budget, LedgerMigration, Transaction, Wallet, Category, default_categories


class Workspace(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int = 1
    wallets: list[dict] = Field(min_length=1, max_length=100)
    transactions: list[dict] = Field(default_factory=list, max_length=50000)
    budgets: list[dict] = Field(default_factory=list, max_length=100)
    settings: dict = Field(default_factory=dict)
    category_details: list[dict] | None = Field(default=None, max_length=100)
    movements: list[dict] = Field(default_factory=list, max_length=50000)
    goals: list[dict] = Field(default_factory=list, max_length=200)
    savings: list[dict] = Field(default_factory=list, max_length=50000)
    loans: list[dict] = Field(default_factory=list, max_length=1000)
    advisor_messages: list[dict] = Field(default_factory=list, max_length=50)
    regulars: list[dict] = Field(default_factory=list, max_length=100)

    @field_validator("schema_version")
    @classmethod
    def version(cls, value):
        if value != 1:
            raise ValueError("Unsupported workspace format.")
        return value


def export_workspace(session):
    from .api import transaction_dict
    from .finance import COLLECTIONS
    settings = session.get(AppSetting, 1) or AppSetting()
    return {"schema_version": 1,
        "wallets": [w.model_dump(mode="json") for w in session.exec(select(Wallet)).all()],
        "transactions": [transaction_dict(t) for t in session.exec(select(Transaction)).all()],
        "budgets": [{"id": b.id, "category": b.category, "amount": b.amount} for b in session.exec(select(Budget)).all()],
        "settings": settings.model_dump(exclude={"id"}),
        **{key: [r.model_dump(mode="json") for r in session.exec(select(model)).all()] for key, model in COLLECTIONS.items()}}


def validate_workspace(data):
    from .api import WalletInput, TransactionInput, BudgetInput, SettingsInput
    from .finance import CategoryInput, PlanInput, COLLECTIONS, GoalInput, RegularInput, money
    parsed = Workspace.model_validate(data)
    if parsed.category_details is None:
        parsed.category_details = default_categories()
    cat_names, cat_ids, exact_names = set(), set(), set()
    for row in parsed.category_details:
        valid = CategoryInput.model_validate({k: v for k, v in row.items() if k != "id"})
        if type(row.get("id")) is not int or row["id"] <= 0 or row["id"] in cat_ids or valid.name.casefold() in cat_names:
            raise ValueError("Invalid or duplicate category.")
        cat_ids.add(row["id"])
        cat_names.add(valid.name.casefold())
        exact_names.add(valid.name)
    wallet_ids, names = set(), set()
    for row in parsed.wallets:
        row_id = row.get("id")
        if type(row_id) is not int or row_id <= 0 or row_id in wallet_ids:
            raise ValueError("Invalid or duplicate wallet id.")
        valid = WalletInput.model_validate({k: v for k, v in row.items() if k not in ("id", "created_at")})
        if row.get("created_at"):
            from datetime import datetime
            datetime.fromisoformat(row["created_at"])
        if valid.name.casefold() in names:
            raise ValueError("Duplicate wallet name.")
        names.add(valid.name.casefold())
        wallet_ids.add(row_id)
    entry_ids = set()
    for row in parsed.transactions:
        entry_id = row.get("id")
        if type(entry_id) is not int or entry_id <= 0 or entry_id in entry_ids:
            raise ValueError("Invalid or duplicate transaction id.")
        entry_ids.add(entry_id)
        valid = TransactionInput.model_validate({k: v for k, v in row.items() if k != "id"})
        if valid.wallet_id not in wallet_ids:
            raise ValueError("Transaction references a missing wallet.")
        if valid.category not in exact_names:
            raise ValueError("Transaction references a missing category.")
    budget_ids, categories = set(), set()
    for row in parsed.budgets:
        bid = row.get("id")
        if type(bid) is not int or bid <= 0 or bid in budget_ids:
            raise ValueError("Invalid budget id.")
        valid = BudgetInput.model_validate({k: v for k, v in row.items() if k != "id"})
        if valid.category not in exact_names:
            raise ValueError("Budget references a missing category.")
        if valid.category in categories:
            raise ValueError("Duplicate budget category.")
        budget_ids.add(bid)
        categories.add(valid.category)
    plan_fields = set(PlanInput.model_fields) - {"allocations"}
    SettingsInput.model_validate({k: v for k, v in parsed.settings.items() if k not in plan_fields})
    PlanInput.model_validate({k: v for k, v in parsed.settings.items() if k in plan_fields})
    if any(value is None for value in parsed.settings.values()):
        raise ValueError("Settings cannot be null.")
    goal_ids = {r.get("id") for r in parsed.goals}
    loan_ids = {r.get("id") for r in parsed.loans}
    regular_categories = set()
    for key in ("movements", "goals", "savings", "loans", "advisor_messages", "regulars"):
        ids = set()
        for row in getattr(parsed, key):
            rid = row.get("id")
            if type(rid) is not int or rid <= 0 or rid in ids:
                raise ValueError("Invalid or duplicate record id.")
            ids.add(rid)
            # Table model validation parses dates; explicit checks cover financial invariants.
            COLLECTIONS[key].model_validate(row)
            if "amount" in row:
                money(row["amount"])
            if key == "goals":
                GoalInput.model_validate({k: v for k, v in row.items() if k != "id"})
            if key == "regulars":
                valid = RegularInput.model_validate({k: v for k, v in row.items() if k != "id"})
                if valid.category in regular_categories:
                    raise ValueError("Duplicate regular category.")
                regular_categories.add(valid.category)
                if valid.category not in exact_names:
                    raise ValueError("Regular references a missing category.")
            if key == "savings":
                if row.get("wallet_id") not in wallet_ids or row.get("goal_id") is not None and row["goal_id"] not in goal_ids or row.get("category") not in exact_names:
                    raise ValueError("Savings reference a missing wallet, goal or category.")
            if key == "loans":
                if row.get("direction") not in ("borrowed", "lent") or not 0 <= money(row.get("repaid", 0), positive=False) <= row["amount"]:
                    raise ValueError("Invalid loan balance.")
            if key == "movements":
                source, target = row.get("from_wallet_id"), row.get("to_wallet_id")
                if source is None and target is None or source == target or any(w is not None and w not in wallet_ids for w in (source, target)):
                    raise ValueError("Invalid movement wallets.")
                if row.get("kind") not in ("transfer", "loan", "repayment") or row.get("kind") == "transfer" and (source is None or target is None):
                    raise ValueError("Invalid money movement.")
                if row.get("loan_id") is not None and row["loan_id"] not in loan_ids:
                    raise ValueError("Movement references a missing loan.")
            if key == "advisor_messages" and (row.get("role") not in ("user", "assistant") or len(row.get("content", "")) > 6000):
                raise ValueError("Invalid advisor message.")
    return parsed.model_dump()


def import_workspace(session, raw):
    from .api import TransactionInput
    from .finance import COLLECTIONS
    data = validate_workspace(raw)
    # Validation is complete before any row is replaced. This operation is one transaction.
    for model in (Transaction, Budget, AppSetting, Wallet, *COLLECTIONS.values()):
        session.exec(delete(model))
    for row in data["wallets"]:
        session.add(Wallet.model_validate(row))
    session.flush()
    for row in data["transactions"]:
        fields = TransactionInput.model_validate({k: v for k, v in row.items() if k != "id"}).model_dump()
        session.add(Transaction(id=row["id"], **fields))
    for row in data["budgets"]:
        session.add(Budget(**row))
    session.add(AppSetting(id=1, **data["settings"]))
    for key, model in COLLECTIONS.items():
        for row in data[key]:
            session.add(model.model_validate(row))


class CloudSession(Session):
    """A per-request workspace; no ledger data is persisted on the server filesystem."""
    def __init__(self, bind, revision):
        super().__init__(bind)
        self.revision = revision

    def commit(self):
        from .cloud import save_workspace
        self.flush()
        try:
            snapshot = validate_workspace(export_workspace(self))
        except ValueError:
            raise HTTPException(422, "Workspace limits or validation failed. Your cloud records were not changed.") from None
        self.revision = save_workspace(snapshot, self.revision)
        from .cloud import CURRENT_USER
        identity = CURRENT_USER.get()
        if identity:
            identity["workspace_revision"] = self.revision
        super().commit()

import sqlalchemy as sa
from sqlmodel import SQLModel, Field, select, func
from sqlalchemy import event
from typing import Optional
from datetime import datetime, timezone

class UserID(sa.types.TypeDecorator):
    impl = sa.types.String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            from sqlalchemy.dialects.postgresql import UUID as PG_UUID
            return dialect.type_descriptor(PG_UUID(as_uuid=False))
        return dialect.type_descriptor(sa.types.String())

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return str(value)

class Income(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source: str
    amount: float
    description: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Expense(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str
    item: str
    amount: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Wallet(SQLModel, table=True):
    __tablename__ = "wallets"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    opening_balance: float = 0
    created_at: Optional[datetime] = None


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    amount: float
    category: str
    type: str
    wallet_id: int
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    legacy_key: Optional[str] = None
    quantity: Optional[float] = None
    unit: str = ""


class Budget(SQLModel, table=True):
    __tablename__ = "budgets"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    category: str
    amount: float


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: int = Field(default=1, primary_key=True)
    revision: int = Field(default=1)
    name: str = ""
    theme: str = "dark"
    language: str = "en"
    review_before_saving: bool = True
    tutorial_seen: bool = False
    ai_enabled: bool = False
    currency: str = "BDT"
    bottom_nav: str = "wallets"
    monthly_budget: float = 0
    planned_income: float = 0
    savings_target: float = 0
    needs_percent: int = 50
    wants_percent: int = 30
    savings_percent: int = 20


class LedgerMigration(SQLModel, table=True):
    """Keep import history even when the corresponding ledger row is deleted."""
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    source_key: str = Field(primary_key=True)


class Category(SQLModel, table=True):
    __tablename__ = "categories"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    kind: str = "expense"
    bucket: str = "needs"
    color: str = "#93b4a0"
    icon: str = "other"
    archived: bool = False


class Movement(SQLModel, table=True):
    __tablename__ = "movements"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    amount: float
    from_wallet_id: Optional[int] = None
    to_wallet_id: Optional[int] = None
    kind: str = "transfer"
    loan_id: Optional[int] = None
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Goal(SQLModel, table=True):
    __tablename__ = "goals"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    target: float
    due_date: Optional[str] = None
    color: str = "#93ddba"


class Saving(SQLModel, table=True):
    __tablename__ = "savings"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    amount: float
    category: str
    wallet_id: int
    goal_id: Optional[int] = None
    note: str = ""
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Loan(SQLModel, table=True):
    __tablename__ = "loans"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    party: str
    direction: str
    amount: float
    repaid: float = 0
    due_date: Optional[str] = None
    note: str = ""
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AdvisorMessage(SQLModel, table=True):
    __tablename__ = "advisor_messages"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    role: str
    content: str
    provider: str = ""
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Regular(SQLModel, table=True):
    __tablename__ = "regulars"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    category: str
    daily_limit: float = 0
    unit: str = "pcs"


class RecurringBill(SQLModel, table=True):
    __tablename__ = "recurring_bills"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    amount: float
    type: str = "expense"
    category: str
    wallet_id: int
    frequency: str = "monthly"
    next_due_date: str
    note: str = ""
    active: bool = True
    last_paid_date: Optional[str] = None


class ShortcutToken(SQLModel, table=True):
    __tablename__ = "shortcut_tokens"
    user_id: str = Field(default="local", primary_key=True, sa_type=UserID)
    id: Optional[int] = Field(default=None, primary_key=True)
    label: str
    token_hash: str
    token_prefix: str
    default_wallet_id: Optional[int] = None
    allow_transfers: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None


def default_categories(user_id="local"):
    names = ["Food", "Transport", "Shopping", "Utilities", "Health", "Education", "Entertainment", "Rent", "Gifts", "Travel", "Salary", "Business", "Savings", "Other",
             "Freelance", "Investment", "Allowance", "Other Income", "DPS / FDR", "Bank Deposit", "Provident Fund", "Gold & Assets", "Other Savings"]
    wants = {"Shopping", "Entertainment", "Gifts", "Travel"}
    income = {"Salary", "Business", "Freelance", "Investment", "Allowance", "Other Income"}
    savings = {"Savings", "DPS / FDR", "Bank Deposit", "Provident Fund", "Gold & Assets", "Other Savings"}
    colors = ["#d5ad78", "#88afdb", "#c59ed8", "#c8cc88", "#d59399", "#a09bd5", "#d0aa86", "#86b5a8"]
    icons = {"Food": "food", "Transport": "transport", "Shopping": "shopping", "Utilities": "utilities", "Health": "health", "Education": "education", "Entertainment": "entertainment", "Rent": "rent", "Gifts": "gifts", "Travel": "travel", "Salary": "salary", "Business": "business"}
    return [{"user_id": user_id, "id": index + 1, "name": name, "kind": "both" if index < 14 else "income" if name in income else "savings",
        "bucket": "income" if name in income else "savings" if name in savings else "wants" if name in wants else "needs",
        "color": colors[index % len(colors)], "icon": icons.get(name, "savings" if name in savings else "salary" if name in income else "other"), "archived": False}
        for index, name in enumerate(names)]

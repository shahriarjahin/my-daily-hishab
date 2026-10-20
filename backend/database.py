from pathlib import Path
from datetime import timezone
from sqlmodel import create_engine, Session, SQLModel, select
from .models import Income, Expense, Wallet, Transaction, AppSetting, LedgerMigration, Category, default_categories
from fastapi import Request, HTTPException

DATABASE_URL = "sqlite://"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

def init_db(bind=None):
    """Add tables and copy old entries once, without changing the legacy data."""
    bind = bind or engine
    SQLModel.metadata.create_all(bind)
    with Session(bind) as session:
        cash = session.exec(select(Wallet).order_by(Wallet.id)).first()
        if not cash:
            cash = Wallet(name="Cash")
            session.add(cash)
            session.flush()
            session.add(Wallet(name="bKash"))
        if not session.get(AppSetting, 1):
            session.add(AppSetting())
        if not session.exec(select(Category)).first():
            for category in default_categories():
                session.add(Category(**category))
        existing = set(session.exec(select(LedgerMigration.source_key)).all())
        from .api import canonical_category, DHAKA
        for model, kind in ((Income, "income"), (Expense, "expense")):
            for entry in session.exec(select(model)).all():
                key = f"{kind}:{entry.id}"
                if key in existing:
                    continue
                session.add(LedgerMigration(source_key=key))
                if session.exec(select(Transaction).where(Transaction.legacy_key == key)).first():
                    continue
                category = entry.source if kind == "income" else entry.category
                description = entry.description if kind == "income" else entry.item
                timestamp = entry.timestamp
                if timestamp.tzinfo is None:
                    timestamp = timestamp.replace(tzinfo=timezone.utc)
                session.add(Transaction(description=description, amount=entry.amount,
                    category=canonical_category(category), type=kind, wallet_id=cash.id,
                    date=timestamp.astimezone(DHAKA), legacy_key=key))
        session.commit()

def get_session(request: Request):
    """Hydrate one authenticated cloud workspace into a disposable request-local engine."""
    from .cloud import read_workspace
    from sqlalchemy.pool import StaticPool
    from .workspace import CloudSession, import_workspace
    workspace = read_workspace()
    expected = request.headers.get("x-workspace-revision")
    if request.method not in ("GET", "HEAD") and expected is not None and expected != str(workspace["revision"]):
        raise HTTPException(409, "Your workspace changed. Reload before saving this change.")
    memory = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        init_db(memory)
        if workspace["data"] is None:
            from .cloud import user
            chosen = str(user()["user"].get("chosen_name", "")).strip()[:60]
            if chosen:
                with Session(memory) as seed:
                    setting = seed.get(AppSetting, 1)
                    setting.name = chosen
                    seed.add(setting)
                    seed.commit()
        if workspace["data"] is not None:
            with Session(memory) as seed:
                import_workspace(seed, workspace["data"])
                seed.commit()
        with CloudSession(memory, workspace["revision"]) as session:
            yield session
    finally:
        memory.dispose()

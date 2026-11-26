import os
from pathlib import Path
from datetime import timezone
from dotenv import load_dotenv
import sqlalchemy.orm
from sqlalchemy import event, text
from sqlmodel import create_engine, Session, SQLModel, select, func
from fastapi import Request, HTTPException

from .models import Income, Expense, Wallet, Transaction, AppSetting, LedgerMigration, Category, default_categories

ROOT = Path(__file__).resolve().parent.parent

# Monkey patch Session.get to automatically handle composite PKs (user_id, id)
_orig_session_get = sqlalchemy.orm.Session.get

def _scoped_session_get(self, entity, ident, **kwargs):
    if hasattr(entity, "user_id") and not isinstance(ident, (tuple, dict)):
        user_id = getattr(self, "user_id", "local")
        ident = (user_id, ident)
    return _orig_session_get(self, entity, ident, **kwargs)

sqlalchemy.orm.Session.get = _scoped_session_get
Session.get = _scoped_session_get

def get_database_url():
    load_dotenv(ROOT / ".env", override=True, encoding="utf-8-sig")
    url = (os.getenv("DATABASE_URL") or "").strip()
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[11:]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[13:]
    return url or "sqlite://"

def is_uuid(value):
    try:
        from uuid import UUID
        UUID(str(value))
        return True
    except (ValueError, TypeError):
        return False

def is_relational():
    url = get_database_url()
    return bool(url and not url.startswith("sqlite://"))

def create_db_engine(url=None):
    target = url or get_database_url()
    if target.startswith("postgresql"):
        return create_engine(
            target,
            echo=False,
            pool_size=10,
            max_overflow=20,
            pool_pre_ping=True,
            pool_recycle=300,
            connect_args={"prepare_threshold": None}
        )
    return create_engine("sqlite://", echo=False, connect_args={"check_same_thread": False})

engine = create_db_engine()

def get_engine():
    global engine
    url = get_database_url()
    if (is_relational() and engine.dialect.name == "sqlite") or (not is_relational() and engine.dialect.name != "sqlite"):
        engine = create_db_engine(url)
    return engine

@event.listens_for(Session, "before_flush")
def assign_composite_ids(session, flush_context, instances):
    allocated = {}
    with session.no_autoflush:
        for obj in list(session.new):
            if hasattr(obj, "user_id"):
                if getattr(obj, "user_id", None) in (None, "local"):
                    sess_uid = getattr(session, "user_id", "local")
                    if sess_uid != "local":
                        obj.user_id = sess_uid
            if hasattr(obj, "user_id") and hasattr(obj, "id") and getattr(obj, "id", None) is None:
                cls = type(obj)
                user_id = getattr(obj, "user_id", "local")
                key = (cls, user_id)
                if key not in allocated:
                    current_max = session.exec(select(func.max(cls.id)).where(cls.user_id == user_id)).one() or 0
                    allocated[key] = current_max
                allocated[key] += 1
                obj.id = allocated[key]

class ScopedSession(Session):
    def __init__(self, bind, user_id="local", **kwargs):
        super().__init__(bind, **kwargs)
        self.user_id = user_id

    def add(self, instance, _warn=True):
        if hasattr(instance, "user_id") and (getattr(instance, "user_id", None) in (None, "local") or not getattr(instance, "user_id", None)):
            instance.user_id = self.user_id
        super().add(instance, _warn=_warn)

class RelationalSession(ScopedSession):
    def __init__(self, bind, user_id="local", revision=1, **kwargs):
        super().__init__(bind, user_id=user_id, **kwargs)
        self.revision = revision

    def commit(self):
        # In relational mode, enforce atomic CAS and bump revision on mutating commits
        if self.new or self.dirty or self.deleted:
            expected = self.revision
            new_rev = expected + 1
            setting = self.get(AppSetting, 1)
            if setting and setting not in self.new:
                result = self.execute(
                    text("UPDATE app_settings SET revision = :new_rev WHERE user_id = :uid AND revision = :expected"),
                    {"new_rev": new_rev, "uid": self.user_id, "expected": expected},
                )
                if result.rowcount == 0:
                    self.rollback()
                    raise HTTPException(409, "Your workspace changed. Reload before saving this change.")
                self.expire(setting, ["revision"])
            elif setting:
                setting.revision = new_rev
                self.add(setting)
            self.revision = new_rev
            from .cloud import CURRENT_USER
            identity = CURRENT_USER.get()
            if identity:
                identity["workspace_revision"] = self.revision
        super().commit()

def init_db(bind=None, user_id="local"):
    """Add tables and copy old entries once, without changing the legacy data."""
    bind = bind or get_engine()
    SQLModel.metadata.create_all(bind)
    with ScopedSession(bind, user_id=user_id) as session:
        cash = session.exec(select(Wallet).where(Wallet.user_id == user_id).order_by(Wallet.id)).first()
        if not cash:
            cash = Wallet(user_id=user_id, id=1, name="Cash")
            session.add(cash)
            session.flush()
            session.add(Wallet(user_id=user_id, id=2, name="bKash"))
        if not session.get(AppSetting, 1):
            session.add(AppSetting(user_id=user_id, id=1))
        if not session.exec(select(Category).where(Category.user_id == user_id)).first():
            for category in default_categories(user_id=user_id):
                session.add(Category(**category))
        if user_id == "local":
            existing = set(session.exec(select(LedgerMigration.source_key).where(LedgerMigration.user_id == user_id)).all())
            from .api import canonical_category, DHAKA
            for model, kind in ((Income, "income"), (Expense, "expense")):
                for entry in session.exec(select(model)).all():
                    key = f"{kind}:{entry.id}"
                    if key in existing:
                        continue
                    session.add(LedgerMigration(user_id=user_id, source_key=key))
                    if session.exec(select(Transaction).where(Transaction.user_id == user_id, Transaction.legacy_key == key)).first():
                        continue
                    category = entry.source if kind == "income" else entry.category
                    description = entry.description if kind == "income" else entry.item
                    timestamp = entry.timestamp
                    if timestamp.tzinfo is None:
                        timestamp = timestamp.replace(tzinfo=timezone.utc)
                    session.add(Transaction(user_id=user_id, description=description, amount=entry.amount,
                        category=canonical_category(category), type=kind, wallet_id=cash.id,
                        date=timestamp.astimezone(DHAKA), legacy_key=key))
        session.commit()

def get_session(request: Request):
    """Yield a database session bound to the authenticated user."""
    from .cloud import read_workspace, user as cloud_user
    from sqlalchemy.pool import StaticPool
    from .workspace import CloudSession, import_workspace

    if is_relational():
        identity = cloud_user()
        user_id = identity["user"]["id"]
        if is_uuid(user_id):
            eng = get_engine()
            expected = request.headers.get("x-workspace-revision")

            with ScopedSession(eng, user_id=user_id) as check_s:
                setting = check_s.get(AppSetting, 1)
                if not setting:
                    # Seed defaults on first connect
                    init_db(eng, user_id=user_id)
                    setting = check_s.get(AppSetting, 1)
                rev = setting.revision if setting else 1
                if request.method not in ("GET", "HEAD") and expected is not None and expected != str(rev):
                    raise HTTPException(409, "Your workspace changed. Reload before saving this change.")

            session = RelationalSession(eng, user_id=user_id, revision=rev)
            try:
                yield session
            finally:
                session.close()
            return

    # Fallback SQLite mode (unit tests and offline local dev)
    workspace = read_workspace()
    expected = request.headers.get("x-workspace-revision")
    if request.method not in ("GET", "HEAD") and expected is not None and expected != str(workspace["revision"]):
        raise HTTPException(409, "Your workspace changed. Reload before saving this change.")
    memory = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        user_id = cloud_user()["user"].get("id", "local")
        init_db(memory, user_id=user_id)
        if workspace["data"] is None:
            chosen = str(cloud_user()["user"].get("chosen_name", "")).strip()[:60]
            if chosen:
                with ScopedSession(memory, user_id=user_id) as seed:
                    setting = seed.get(AppSetting, 1)
                    if setting:
                        setting.name = chosen
                        seed.add(setting)
                        seed.commit()
        if workspace["data"] is not None:
            with ScopedSession(memory, user_id=user_id) as seed:
                import_workspace(seed, workspace["data"])
                seed.commit()
        with CloudSession(memory, workspace["revision"], user_id=user_id) as session:
            yield session
    finally:
        memory.dispose()

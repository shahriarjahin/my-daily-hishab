"""Migrate existing hishab_workspaces JSON documents into normalized relational tables."""
import json
import os
import sys
from pathlib import Path
from cryptography.fernet import Fernet
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env", override=True, encoding="utf-8-sig")

def get_cipher():
    key = os.getenv("HISHAB_SECRET_KEY")
    if key:
        return Fernet(key.encode())
    return None

def migrate():
    from backend.database import get_engine, ScopedSession
    from backend.models import AppSetting
    from backend.workspace import import_workspace
    from sqlmodel import Session, text

    engine = get_engine()
    cipher = get_cipher()

    print("Beginning migration of hishab_workspaces to relational tables...")

    with Session(engine) as session:
        try:
            workspaces = session.exec(text("SELECT user_id, data, revision FROM public.hishab_workspaces")).all()
        except Exception as e:
            print(f"Could not read hishab_workspaces: {e}")
            return

    print(f"Found {len(workspaces)} workspace documents to migrate.")

    for row in workspaces:
        user_id = str(row[0])
        raw_data = row[1]
        revision = int(row[2])

        data = raw_data
        if isinstance(raw_data, str):
            try:
                data = json.loads(raw_data)
            except Exception:
                data = {}

        if isinstance(data, dict) and data.get("format") == "hishab-encrypted-v1":
            if not cipher:
                print(f"Skipping user {user_id}: encrypted workspace but HISHAB_SECRET_KEY is not set.")
                continue
            try:
                payload = json.loads(cipher.decrypt(data["ciphertext"].encode()))
                data = payload.get("workspace", {})
            except Exception as e:
                print(f"Error decrypting workspace for user {user_id}: {e}")
                continue

        if not isinstance(data, dict) or not data:
            print(f"Skipping user {user_id}: data is empty or not a dict.")
            continue

        print(f"Migrating user {user_id} (revision {revision})...")
        try:
            with ScopedSession(engine, user_id=user_id) as u_session:
                import_workspace(u_session, data)
                setting = u_session.get(AppSetting, 1)
                if setting:
                    setting.revision = revision
                    u_session.add(setting)
                u_session.commit()
            print(f"  Successfully migrated user {user_id}!")
        except Exception as e:
            print(f"  Error migrating user {user_id}: {e}")

    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()

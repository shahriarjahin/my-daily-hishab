import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, select

from backend import cloud
from backend.database import init_db
from backend.main import app
from backend.models import AppSetting, Category, Income, ShortcutToken, Transaction, Wallet
from backend.shortcuts import hash_shortcut_token
from mobile import bootstrap


class SecurityFixRegressionTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.user_a = "11111111-1111-1111-1111-111111111111"
        self.user_b = "22222222-2222-2222-2222-222222222222"
        self.identity = {"access_token": "tok-a", "user": {"id": self.user_a, "email": "a@example.test", "factors": []}}
        self.patches = [
            patch("backend.database.is_relational", return_value=True),
            patch("backend.database.get_engine", return_value=self.engine),
            patch("backend.cloud.read_session", side_effect=lambda req: (self.identity, None)),
        ]
        for p in self.patches:
            p.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches):
            p.stop()
        self.engine.dispose()

    def test_relational_export_csv_and_extract_isolate_tenants(self):
        init_db(self.engine, user_id=self.user_a)
        init_db(self.engine, user_id=self.user_b)
        with Session(self.engine) as s:
            w_b = Wallet(user_id=self.user_b, id=3, name="SecretVaultB", opening_balance=500)
            s.add(w_b)
            s.add(Category(user_id=self.user_b, id=99, name="SecretCatB", kind="expense", bucket="wants", color="#112233", icon="other"))
            s.add(Transaction(user_id=self.user_a, description="Tea", amount=20, category="Food", type="expense", wallet_id=1, date=datetime.now(timezone.utc)))
            s.commit()

        csv_res = self.client.get("/api/export.csv")
        self.assertEqual(csv_res.status_code, 200)
        self.assertNotIn("SecretVaultB", csv_res.text)

        self.client.patch("/api/settings", json={"ai_enabled": True})
        captured = {}
        def fake_extract(prompt, content, validate):
            captured["prompt"] = prompt
            return {"wallets": [{"name": "SecretVaultB", "balance": 100, "expected_balance": None, "existing": False}], "transactions": [], "provider": "Fake"}
        with patch("backend.ai.extract", side_effect=fake_extract):
            ext = self.client.post("/api/extract", json={"text": "SecretVaultB 100", "mode": "wallets"})
        self.assertEqual(ext.status_code, 200)
        self.assertNotIn("SecretVaultB", captured["prompt"])
        self.assertNotIn("SecretCatB", captured["prompt"])

        bal = self.client.post("/api/wallets/balances", json={"wallets": [{"name": "SecretVaultB", "balance": 100}]})
        self.assertEqual(bal.status_code, 200)
        self.assertFalse(bal.json()["wallets"][0]["existing"])

    def test_init_db_skips_legacy_import_for_uuid_tenants(self):
        init_db(self.engine, user_id="local")
        with Session(self.engine) as s:
            s.add(Income(source="Salary", description="LegacySecretIncome", amount=9999, timestamp=datetime.now(timezone.utc)))
            s.commit()
        init_db(self.engine, user_id=self.user_a)
        with Session(self.engine) as s:
            txs = s.exec(select(Transaction).where(Transaction.user_id == self.user_a)).all()
        self.assertEqual(txs, [])

    def test_pull_seeds_fresh_user_and_push_preserves_monotonic_revision(self):
        init_db(self.engine, user_id=self.user_b)
        pulled = self.client.get("/api/cloud/workspace")
        self.assertEqual(pulled.status_code, 200)
        self.assertTrue(len(pulled.json()["data"]["wallets"]) >= 2)
        self.assertEqual(pulled.json()["revision"], 1)

        with Session(self.engine) as s:
            setting = s.get(AppSetting, (self.user_a, 1))
            setting.revision = 5
            s.add(setting)
            s.commit()

        snapshot = pulled.json()["data"]
        pushed = self.client.post("/api/cloud/workspace", json={"data": snapshot, "expected_revision": 5})
        self.assertEqual(pushed.status_code, 200, pushed.text)
        self.assertEqual(pushed.json()["revision"], 6)

    def test_cloud_status_hides_raw_db_error_and_quick_sets_framing_headers(self):
        with patch("backend.database.get_engine", side_effect=RuntimeError("postgres://user:secret@host/db")):
            st = self.client.get("/api/cloud/status")
        self.assertEqual(st.status_code, 200)
        self.assertTrue(st.json()["setup_required"])
        self.assertNotIn("postgres://", st.json().get("message", ""))

        quick = self.client.get("/quick")
        self.assertEqual(quick.headers.get("x-frame-options"), "DENY")
        self.assertIn("frame-ancestors 'none'", quick.headers.get("content-security-policy", ""))

    def test_password_change_requires_current_password_and_revokes_shortcuts(self):
        init_db(self.engine, user_id=self.user_a)
        with Session(self.engine) as s:
            s.add(ShortcutToken(
                user_id=self.user_a,
                id=1,
                label="Phone",
                token_hash=hash_shortcut_token("hishab_sc_1234567890123456"),
                token_prefix="hishab_sc_123456...",
            ))
            s.commit()

        missing = self.client.put("/api/auth/password", json={"password": "new-password-123"})
        self.assertEqual(missing.status_code, 422)

        with patch("backend.cloud.call", return_value={}) as call:
            ok = self.client.put(
                "/api/auth/password",
                json={"password": "new-password-123", "current_password": "old-password-123"},
            )
        self.assertEqual(ok.status_code, 200)
        called_paths = [c.args[1] for c in call.call_args_list]
        self.assertIn("/auth/v1/token?grant_type=password", called_paths)
        self.assertIn("/auth/v1/user", called_paths)
        self.assertIn("/auth/v1/logout?scope=others", called_paths)
        with Session(self.engine) as s:
            self.assertEqual(s.exec(select(ShortcutToken).where(ShortcutToken.user_id == self.user_a)).all(), [])

    def test_bootstrap_requires_jdk21_checksum(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(bootstrap, "TOOLS", Path(tmp)), patch.dict(os.environ, {}, clear=True):
                with self.assertRaises(RuntimeError):
                    bootstrap.install(("jdk21", ("https://example.invalid/jdk.zip", None)))

"""Exercise the local API against a disposable in-memory database."""
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from backend.api import router
from backend.database import get_session, init_db
from backend.models import Expense, Income, Transaction


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        init_db(self.engine)
        self.app = FastAPI()
        self.app.include_router(router)
        from backend.integrations import router as integrations
        self.app.include_router(integrations)
        def session():
            with Session(self.engine) as db:
                yield db
        self.app.dependency_overrides[get_session] = session
        self.client = TestClient(self.app)
        self.key_patch = patch("backend.ai.public_status", return_value={"providers": [], "last_used": None})
        self.key_patch.start()

    def tearDown(self):
        self.key_patch.stop()
        self.client.close()
        self.engine.dispose()

    def item(self, **changes):
        data = {"description": "Lunch", "amount": 250, "category": "Food", "type": "expense", "wallet_id": 1}
        return {**data, **changes}

    def add(self, *entries):
        return self.client.post("/api/transactions", json={"transactions": list(entries)})

    def state(self):
        result = self.client.get("/api/state")
        self.assertEqual(result.status_code, 200)
        return result.json()

    def test_defaults_crud_and_balances(self):
        state = self.state()
        self.assertTrue({"Food", "Salary", "Other", "DPS / FDR"}.issubset(state["categories"]))
        self.assertEqual([w["name"] for w in state["wallets"]], ["Cash", "bKash"])
        self.assertFalse(state["configured"])
        self.assertTrue(state["settings"]["review_before_saving"])
        self.assertEqual(self.add(self.item(amount=1000, type="income", category="Salary"), self.item(amount=20.1), self.item(amount=30.2)).status_code, 201)
        state = self.state()
        self.assertEqual(state["wallets"][0]["balance"], 949.7)
        entry = next(t for t in state["transactions"] if t["amount"] == 20.1)
        self.assertTrue(entry["date"].endswith("+06:00"))
        self.assertEqual(self.client.patch(f'/api/transactions/{entry["id"]}', json={"amount": 40.1, "wallet_id": 2}).status_code, 200)
        self.assertEqual(self.state()["wallets"][1]["balance"], -40.1)
        self.assertEqual(self.client.delete(f'/api/transactions/{entry["id"]}').status_code, 204)
        self.assertEqual(self.state()["wallets"][1]["balance"], 0)

    def test_invalid_batches_are_atomic(self):
        for invalid in [self.item(amount=-1), self.item(amount="NaN"), self.item(amount=1.001), self.item(amount=1000000000001), self.item(wallet_id=999), self.item(category="oops"), self.item(date="bad"), self.item(description="  "), self.item(type="transfer")]:
            response = self.add(self.item(), invalid)
            self.assertEqual(response.status_code, 422, response.text)
            self.assertEqual(self.state()["transactions"], [])
        row_id = self.add(self.item()).json()["transactions"][0]["id"]
        self.assertEqual(self.client.patch(f"/api/transactions/{row_id}", json={"amount": "Infinity"}).status_code, 422)
        self.assertEqual(self.state()["transactions"][0]["amount"], 250)

    def test_budget_uses_dhaka_month_and_expenses_only(self):
        from backend.api import now
        current = now()
        # An equivalent UTC instant must be grouped by its Dhaka calendar month.
        start = datetime(current.year, current.month, 1, 0, 30, tzinfo=current.tzinfo).astimezone(timezone.utc)
        self.add(self.item(amount=100, date=start.isoformat()), self.item(amount=500, type="income"))
        result = self.client.put("/api/budgets", json={"category": "Food", "amount": 300})
        self.assertEqual(result.status_code, 200)
        self.client.put("/api/budgets", json={"category": "Food", "amount": 600})
        budgets = self.state()["budgets"]
        self.assertEqual(len(budgets), 1)
        self.assertEqual((budgets[0]["amount"], budgets[0]["spent"]), (600, 100))
        self.assertEqual(self.client.delete(f'/api/budgets/{budgets[0]["id"]}').status_code, 204)

    def test_wallet_settings_and_csv(self):
        result = self.client.post("/api/wallets", json={"name": "Bank", "opening_balance": 100.25})
        self.assertEqual(result.status_code, 201)
        self.assertEqual(self.client.post("/api/wallets", json={"name": "bank"}).status_code, 409)
        self.assertEqual(self.client.patch("/api/settings", json={"name": " Sam ", "theme": "light", "review_before_saving": False}).status_code, 200)
        settings = self.state()["settings"]
        self.assertEqual({k: settings[k] for k in ("name", "theme", "review_before_saving")}, {"name": "Sam", "theme": "light", "review_before_saving": False})
        self.assertEqual(self.client.patch("/api/settings", json={"theme": "invalid"}).status_code, 422)
        self.add(self.item(description="=SUM(A1:A2)"))
        csv = self.client.get("/api/export.csv")
        self.assertEqual(csv.status_code, 200)
        self.assertIn("'=SUM(A1:A2)", csv.text)
        self.assertIn("attachment", csv.headers["content-disposition"])

    def test_legacy_import_is_idempotent_and_deletion_is_permanent(self):
        with Session(self.engine) as session:
            session.add(Income(source="Freelance/Job", description="Work", amount=5000, timestamp=datetime(2026, 10, 1, 2, 0, tzinfo=timezone.utc)))
            session.add(Expense(category="Medical", item="Medicine", amount=80.5, timestamp=datetime(2026, 10, 1, 3, 0, tzinfo=timezone.utc)))
            session.commit()
        init_db(self.engine)
        init_db(self.engine)
        state = self.state()
        self.assertEqual(len(state["transactions"]), 2)
        self.assertEqual(state["wallets"][0]["balance"], 4919.5)
        medicine = next(t for t in state["transactions"] if t["description"] == "Medicine")
        self.assertEqual(medicine["category"], "Health")
        self.assertEqual(medicine["date"], "2026-10-01T09:00:00+06:00")
        self.client.delete(f'/api/transactions/{medicine["id"]}')
        init_db(self.engine)
        self.assertEqual(len(self.state()["transactions"]), 1)
        with Session(self.engine) as session:
            self.assertEqual(len(session.exec(select(Expense)).all()), 1)

    def test_edit_wallet_balance_and_restart_preserve_ledger(self):
        self.add(self.item(amount=125), self.item(amount=1000, type="income"))
        before = self.state()["transactions"]
        result = self.client.patch("/api/wallets/1", json={"name": "Pocket", "opening_balance": 100.25})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["balance"], 975.25)
        # The same name on this wallet is valid, but another wallet cannot claim it.
        self.assertEqual(self.client.patch("/api/wallets/1", json={"name": "Pocket"}).status_code, 200)
        self.assertEqual(self.client.patch("/api/wallets/2", json={"name": "pocket"}).status_code, 409)
        self.assertEqual(self.client.patch("/api/wallets/1", json={"opening_balance": 1.001}).status_code, 422)
        self.assertEqual(self.client.patch("/api/wallets/2", json={"name": "Mobile", "opening_balance": 200}).status_code, 200)
        init_db(self.engine)
        state = self.state()
        self.assertEqual(state["transactions"], before)
        self.assertEqual([w["name"] for w in state["wallets"]], ["Pocket", "Mobile"])
        self.assertEqual([w["balance"] for w in state["wallets"]], [975.25, 200])
        # A later legacy row is assigned to the first existing wallet after renaming.
        with Session(self.engine) as session:
            session.add(Expense(category="Food", item="Legacy tea", amount=20))
            session.commit()
        init_db(self.engine)
        state = self.state()
        self.assertEqual(len(state["wallets"]), 2)
        self.assertEqual(state["wallets"][0]["balance"], 955.25)
        self.assertEqual(next(t for t in state["transactions"] if t["description"] == "Legacy tea")["wallet_id"], 1)

    def test_extraction_does_not_persist_and_errors_hide_secrets(self):
        import json
        from backend.ai import ProviderError
        def success(prompt, text, validator):
            return validator({"wallets": [], "transactions": [{"category": "Health", "description": "Medicine", "amount": 100, "type": "expense", "wallet_id": 1}]}) | {"provider": "Google AI Studio"}
        with patch("backend.ai.extract", side_effect=success):
            result = self.client.post("/api/extract", json={"text": "medicine 100"})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["transactions"][0]["category"], "Health")
            self.assertEqual(self.state()["transactions"], [])
        with patch("backend.ai.extract", side_effect=ProviderError("No connected provider available.")):
            failure = self.client.post("/api/extract", json={"text": "medicine 100"})
            self.assertEqual(failure.status_code, 503)
            self.assertNotIn("api_key", failure.text)


if __name__ == "__main__":
    unittest.main()

"""Tests for Transfer fees, Split bills, Recurring bills, Windowed history, BD SMS parser, and iOS Shortcuts."""
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine

from backend import bd_parser, database
from backend import test_integrations as cloud_test
from backend.database import init_db
from backend.finance import advance_due_date
from backend.main import app


class NewFinanceFeatureTests(unittest.TestCase):
    setUp = cloud_test.CloudTests.setUp
    tearDown = cloud_test.CloudTests.tearDown
    read = cloud_test.CloudTests.read
    save = cloud_test.CloudTests.save
    get_state = cloud_test.CloudTests.get_state
    add = cloud_test.CloudTests.add

    def post(self, path, body):
        return self.client.post("/api" + path, headers=self.headers, json=body)

    def put(self, path, body):
        return self.client.put("/api" + path, headers=self.headers, json=body)

    def fund(self, amount=10000):
        res = self.client.patch("/api/wallets/1", headers=self.headers, json={"opening_balance": amount})
        self.assertEqual(res.status_code, 200, res.text)

    def test_transfer_with_optional_fee_debits_fee_as_expense(self):
        self.fund(5000)
        # Insufficient funds when amount + fee > available
        bad = self.post("/transfers", {"from_wallet_id": 1, "to_wallet_id": 2, "amount": 4950, "fee": 100})
        self.assertEqual(bad.status_code, 422)

        ok = self.post("/transfers", {
            "from_wallet_id": 1, "to_wallet_id": 2,
            "amount": 2000, "fee": 37.5, "description": "bKash Cash Out"
        })
        self.assertEqual(ok.status_code, 201, ok.text)
        state = self.get_state()
        w1, w2 = state["wallets"][0], state["wallets"][1]
        self.assertEqual(w1["balance"], 2962.5)
        self.assertEqual(w2["balance"], 2000.0)
        fee_tx = next(t for t in state["transactions"] if "(Fee)" in t["description"])
        self.assertEqual(fee_tx["amount"], 37.5)
        self.assertEqual(fee_tx["type"], "expense")

    def test_split_expense_records_my_share_and_lent_loans(self):
        self.fund(3000)
        res = self.post("/splits", {
            "description": "Kacchi Dinner",
            "category": "Food",
            "wallet_id": 1,
            "my_share": 300,
            "shares": [
                {"party": "Rahim", "amount": 300},
                {"party": "Karim", "amount": 300},
            ],
        })
        self.assertEqual(res.status_code, 201, res.text)
        self.assertEqual(res.json()["lent_total"], 600)
        state = self.get_state()
        self.assertEqual(state["wallets"][0]["balance"], 2100.0)
        self.assertEqual(state["planning"]["receivable"], 600.0)
        self.assertEqual(state["planning"]["spent"], 300.0)
        self.assertEqual(len(state["loans"]), 2)

    def test_recurring_bills_crud_pay_and_due_date_rollover(self):
        self.fund(20000)
        # Leap-year & month-end rollover checks
        self.assertEqual(advance_due_date("2024-01-31", "monthly"), "2024-02-29")
        self.assertEqual(advance_due_date("2026-01-31", "monthly"), "2026-02-28")
        self.assertEqual(advance_due_date("2026-11-25", "weekly"), "2026-12-02")
        self.assertEqual(advance_due_date("2024-02-29", "yearly"), "2025-02-28")

        created = self.post("/bills", {
            "name": "Home Wi-Fi",
            "amount": 1200,
            "type": "expense",
            "category": "Utilities",
            "wallet_id": 1,
            "frequency": "monthly",
            "next_due_date": "2026-11-25",
            "note": "Link3",
        })
        self.assertEqual(created.status_code, 201, created.text)
        bill_id = self.get_state()["recurring_bills"][0]["id"]

        paid = self.post(f"/bills/{bill_id}/pay", {})
        self.assertEqual(paid.status_code, 200, paid.text)
        self.assertEqual(paid.json()["next_due_date"], "2026-12-25")

        state = self.get_state()
        self.assertEqual(state["wallets"][0]["balance"], 18800.0)
        self.assertEqual(state["recurring_bills"][0]["next_due_date"], "2026-12-25")
        self.assertIsNotNone(state["recurring_bills"][0]["last_paid_date"])
        self.assertEqual(state["transactions"][0]["description"], "Home Wi-Fi (Link3)")

        self.assertEqual(self.put(f"/bills/{bill_id}", {
            "name": "Home Wi-Fi", "amount": 1500, "type": "expense",
            "category": "Utilities", "wallet_id": 1, "frequency": "monthly",
            "next_due_date": "2026-12-25", "note": "", "active": True,
        }).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/bills/{bill_id}", headers=self.headers).status_code, 200)
        self.assertEqual(len(self.get_state()["recurring_bills"]), 0)

    def test_windowed_state_preserves_totals_and_paginates_history(self):
        self.fund(50000)
        recent = [
            {"description": f"Recent {i}", "amount": 100, "category": "Food", "type": "expense",
             "wallet_id": 1, "date": f"2026-11-{i + 1:02d}T10:00:00+06:00"}
            for i in range(4)
        ]
        older = [
            {"description": f"Old {i}", "amount": 100, "category": "Food", "type": "expense",
             "wallet_id": 1, "date": f"2025-05-{i + 1:02d}T10:00:00+06:00"}
            for i in range(8)
        ]
        self.assertEqual(self.post("/transactions", {"transactions": recent + older}).status_code, 201)

        windowed = self.client.get("/api/state?tx_limit=5", headers=self.headers)
        self.assertEqual(windowed.status_code, 200)
        data = windowed.json()
        self.assertEqual(data["total_transaction_count"], 12)
        self.assertTrue(data["has_more_transactions"])
        self.assertEqual(len(data["transactions"]), 5)
        # Wallet balance remains exact across all 12 entries, and current month spent is 400
        self.assertEqual(data["wallets"][0]["balance"], 48800.0)
        self.assertEqual(data["planning"]["spent"], 400.0)
        self.assertEqual(len(data["planning"]["monthly_totals"]), 12)

        page2 = self.client.get("/api/transactions?offset=5&limit=5", headers=self.headers).json()
        self.assertEqual(len(page2["transactions"]), 5)
        self.assertTrue(page2["has_more"])
        page3 = self.client.get("/api/transactions?offset=10&limit=5", headers=self.headers).json()
        self.assertEqual(len(page3["transactions"]), 2)
        self.assertFalse(page3["has_more"])

    def test_bd_sms_and_quick_text_parser(self):
        cash_out = bd_parser.parse_bd_sms(
            "Cash Out Tk 5,000.00 to 01812345678 successful. Fee Tk 92.50. Balance Tk 1,200.00. TrxID ABC123"
        )
        self.assertIsNotNone(cash_out)
        self.assertEqual(cash_out["kind"], "transfer")
        self.assertEqual(cash_out["amount"], 5000.0)
        self.assertEqual(cash_out["fee"], 92.5)

        received = bd_parser.parse_bd_sms(
            "You have received Tk 2,500.00 from 01711000000. Fee Tk 0.00. Balance Tk 3,700.00. TrxID XYZ"
        )
        self.assertEqual(received["type"], "income")
        self.assertEqual(received["amount"], 2500.0)

        quick = bd_parser.parse_quick_text("rickshaw vara 50 tk")
        self.assertEqual(quick["category"], "Transport")
        self.assertEqual(quick["amount"], 50.0)

        bangla_digits = bd_parser.parse_quick_text("চা ৩০")
        self.assertEqual(bangla_digits["category"], "Food")
        self.assertEqual(bangla_digits["amount"], 30.0)


class ShortcutTokenTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        self.user_id = "11111111-1111-1111-1111-111111111111"
        init_db(self.engine, user_id=self.user_id)
        self.identity = {"access_token": "tok", "user": {"id": self.user_id, "email": "u@test", "factors": []}}
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

    def test_create_list_authenticate_and_revoke_shortcut_token(self):
        res = self.client.post("/api/shortcuts/tokens", json={"label": "iPhone Action", "default_wallet_id": 1})
        self.assertEqual(res.status_code, 201, res.text)
        raw_token = res.json()["token"]
        token_id = res.json()["item"]["id"]
        self.assertTrue(raw_token.startswith("hishab_sc_"))

        listed = self.client.get("/api/shortcuts/tokens")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.json()["tokens"]), 1)
        self.assertNotIn(raw_token, listed.text)

        # Unauthenticated session, authenticated ONLY via X-Shortcut-Token
        with patch("backend.cloud.read_session", return_value=(None, None)):
            log_res = self.client.post(
                "/api/shortcuts/log",
                headers={"X-Shortcut-Token": raw_token},
                json={"text": "bKash Cash Out Tk 500 to 01700000000 Fee Tk 9.25 Balance Tk 100"},
            )
            # Only Cash (wallet 1) has 0 balance -> cash out requires funds; test normal expense first!
            self.assertEqual(log_res.status_code, 422)

            exp_res = self.client.post(
                "/api/shortcuts/log",
                headers={"Authorization": f"Bearer {raw_token}"},
                json={"text": "rickshaw 60"},
            )
            self.assertEqual(exp_res.status_code, 201, exp_res.text)
            self.assertEqual(exp_res.json()["category"], "Transport")
            self.assertEqual(exp_res.json()["amount"], 60.0)

            bad_res = self.client.post(
                "/api/shortcuts/log",
                headers={"X-Shortcut-Token": "hishab_sc_invalid_token_value"},
                json={"text": "tea 20"},
            )
            self.assertEqual(bad_res.status_code, 401)

        # Revoke token and verify rejected afterwards
        self.assertEqual(self.client.delete(f"/api/shortcuts/tokens/{token_id}").status_code, 204)
        revoked_res = self.client.post(
            "/api/shortcuts/log",
            headers={"X-Shortcut-Token": raw_token},
            json={"text": "tea 20"},
        )
        self.assertEqual(revoked_res.status_code, 401)


if __name__ == "__main__":
    unittest.main()

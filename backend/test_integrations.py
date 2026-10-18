"""Exercise cloud persistence, account isolation, wallet balances and AI failover offline."""
import json
import unittest
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from cryptography.fernet import Fernet
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend import ai, cloud
from backend.main import app


IDENTITY = {"access_token": "test-access", "user": {"id": "account-a", "email": "a@example.test"}}


class CloudTests(unittest.TestCase):
    def setUp(self):
        self.records = {}
        self.patches = [
            patch("backend.cloud.read_session", side_effect=lambda req: ({**IDENTITY, "user": {"id": req.headers.get("x-test-user"), "email": "a@example.test"}}, None) if req.headers.get("x-test-user") else (None, None)),
            patch("backend.cloud.read_workspace", side_effect=self.read),
            patch("backend.cloud.save_workspace", side_effect=self.save),
            patch("backend.ai.public_status", return_value={"providers": [], "last_used": None}),
        ]
        for item in self.patches:
            item.start()
        self.client = TestClient(app)
        self.headers = {"x-test-user": "account-a"}

    def tearDown(self):
        self.client.close()
        for item in reversed(self.patches):
            item.stop()

    def read(self):
        uid = cloud.user()["user"]["id"]
        return deepcopy(self.records.get(uid, {"data": None, "revision": 0, "updated_at": None}))

    def save(self, data, expected):
        uid = cloud.user()["user"]["id"]
        old = self.records.get(uid, {"revision": 0})
        if old["revision"] != expected:
            raise HTTPException(409, "Cloud conflict")
        self.records[uid] = {"data": deepcopy(data), "revision": expected + 1, "updated_at": None}
        return expected + 1

    def get_state(self, user="account-a"):
        result = self.client.get("/api/state", headers={"x-test-user": user})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def add(self, **changes):
        item = {"description": "Tea", "amount": 125, "category": "Food", "type": "expense", "wallet_id": 1} | changes
        return self.client.post("/api/transactions", headers=self.headers, json={"transactions": [item]})

    def test_auth_required_for_all_finance_and_ai_endpoints(self):
        for path in ["/api/state", "/api/export.csv", "/api/ai/providers"]:
            self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/api/health").status_code, 200)

    def test_cloud_persists_across_requests_and_isolates_accounts(self):
        self.assertEqual(self.add().status_code, 201)
        first = self.get_state()
        self.assertEqual(first["revision"], 1)
        self.assertEqual(first["wallets"][0]["balance"], -125)
        self.assertTrue(first["cloud_mode"])
        self.assertEqual(self.get_state("account-b")["transactions"], [])
        self.assertEqual(self.get_state()["transactions"][0]["description"], "Tea")
        stale = self.client.patch("/api/settings", headers=self.headers | {"X-Workspace-Revision": "0"}, json={"name": "Stale"})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.get_state()["settings"]["name"], "")

    def test_wallet_balance_import_preserves_spending_and_is_idempotent(self):
        self.add()
        wallets = [{"name": name, "balance": amount} for name, amount in [("Cash", 1500), ("PrimeNOW", 4581), ("City Bank", 15985), ("Sonali Bank", 1523), ("Janata Bank", 651)]]
        wallets[0]["expected_balance"] = -125
        response = self.client.post("/api/wallets/balances", headers=self.headers, json={"wallets": wallets})
        self.assertEqual(response.status_code, 200, response.text)
        state = self.get_state()
        self.assertEqual({w["name"]: w["balance"] for w in state["wallets"]}, {"Cash": 1500, "bKash": 0, "PrimeNOW": 4581, "City Bank": 15985, "Sonali Bank": 1523, "Janata Bank": 651})
        self.assertEqual(state["wallets"][0]["opening_balance"], 1625)
        self.assertEqual(len(state["transactions"]), 1)
        for wallet in wallets:
            wallet["expected_balance"] = wallet["balance"]
        self.assertEqual(self.client.post("/api/wallets/balances", headers=self.headers, json={"wallets": wallets}).status_code, 200)
        self.assertEqual(len(self.get_state()["wallets"]), 6)
        stale = self.client.post("/api/wallets/balances", headers=self.headers, json={"wallets": [{"name": "Cash", "balance": 2000, "expected_balance": -125}]})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.get_state()["wallets"][0]["balance"], 1500)

    def test_selected_spending_wallet_and_balance_preview(self):
        def suggestions(prompt, text, validator):
            return validator({"wallets": [], "transactions": [{"description": "Lunch", "amount": 250, "type": "expense", "category": "Food"}]}) | {"provider": "Test", "fallback_used": False}
        with patch("backend.ai.extract", side_effect=suggestions):
            result = self.client.post("/api/extract", headers=self.headers, json={"text": "lunch 250", "wallet_id": 2})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()["transactions"][0]["wallet_id"], 2)
            self.assertEqual(self.get_state()["transactions"], [])
        def balances(prompt, text, validator):
            return validator({"wallets": [{"name": "Cash", "balance": 1500}], "transactions": []}) | {"provider": "Test"}
        with patch("backend.ai.extract", side_effect=balances):
            result = self.client.post("/api/extract", headers=self.headers, json={"text": "cash 1500 ache", "mode": "wallets"})
            self.assertEqual(result.json()["wallets"][0]["expected_balance"], 0)
            self.assertEqual(self.get_state()["wallets"][0]["balance"], 0)

    def test_cross_origin_write_is_rejected(self):
        response = self.client.post("/api/transactions", headers=self.headers | {"Origin": "https://unrelated.example"}, json={"transactions": []})
        self.assertEqual(response.status_code, 403)

    def test_empty_account_import_and_nonempty_account_protection(self):
        self.add()
        snapshot = self.records["account-a"]["data"]
        second = {"x-test-user": "account-b"}
        response = self.client.post("/api/cloud/import", headers=second, json={"data": snapshot, "expected_revision": 0})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.get_state("account-b")["wallets"][0]["balance"], -125)
        repeat = self.client.post("/api/cloud/import", headers=second, json={"data": snapshot, "expected_revision": 1})
        self.assertEqual(repeat.status_code, 409)
        self.assertEqual(len(self.get_state("account-b")["transactions"]), 1)


class FailoverTests(unittest.TestCase):
    def setUp(self):
        ai.HEALTH.clear()
        self.configs = [{"id": key, "name": key.title(), "key": "private-key", "model": "test", "enabled": True, "priority": i, "base_url": ""} for i, key in enumerate(("google", "openai"))]

    def test_credit_failure_automatically_uses_backup_then_cools_down(self):
        validator = lambda data: data
        with patch("backend.ai.load_configs", return_value=self.configs), patch("backend.ai.call_provider", side_effect=[ai.ProviderError("rate_or_credit_limit", 429), '{"wallets":[],"transactions":[]}']) as call:
            result = ai.extract("JSON", "tea 20", validator)
            self.assertEqual(result["provider"], "Openai")
            self.assertTrue(result["fallback_used"])
            self.assertEqual(call.call_count, 2)
        with patch("backend.ai.load_configs", return_value=self.configs), patch("backend.ai.call_provider", return_value='{"wallets":[],"transactions":[]}') as call:
            ai.extract("JSON", "tea 20", validator)
            self.assertEqual(call.call_count, 1)
            self.assertEqual(call.call_args.args[0]["id"], "openai")

    def test_invalid_output_fails_over_and_all_failure_hides_keys(self):
        with patch("backend.ai.load_configs", return_value=self.configs), patch("backend.ai.call_provider", side_effect=['bad json', '{"wallets":[],"transactions":[]}']):
            self.assertTrue(ai.extract("JSON", "tea 20", lambda data: data)["fallback_used"])
        ai.HEALTH.clear()
        with patch("backend.ai.load_configs", return_value=self.configs), patch("backend.ai.call_provider", side_effect=RuntimeError("private-key")):
            with self.assertRaises(ai.ProviderError) as caught:
                ai.extract("JSON", "tea 20", lambda data: data)
            self.assertNotIn("private-key", str(caught.exception))

    def test_encrypted_keys_are_not_returned_to_browser(self):
        saved = {}
        def save(data):
            saved.clear()
            saved.update(deepcopy(data))
        with patch("backend.cloud.read_ai_configs", side_effect=lambda: deepcopy(saved)), patch("backend.cloud.save_ai_configs", side_effect=save), patch("backend.cloud.cipher", return_value=Fernet(Fernet.generate_key())):
            ai.save_config("openai", {"api_key": "sensitive-provider-key", "model": "test", "enabled": True, "priority": 2})
            self.assertNotIn("sensitive-provider-key", json.dumps(saved))
            self.assertNotIn("sensitive-provider-key", json.dumps(ai.public_status()))
            self.assertEqual(next(c for c in ai.load_configs() if c["id"] == "openai")["key"], "sensitive-provider-key")

    def test_environment_keys_only_belong_to_configured_owner(self):
        import os
        with patch("backend.cloud.read_ai_configs", return_value={}), patch("backend.ai.load_dotenv"), patch.dict(os.environ, {"HISHAB_OWNER_EMAIL": "owner@example.test", "GOOGLE_API_KEY": "owner-secret"}):
            token = cloud.CURRENT_USER.set({"user": {"id": "owner", "email": "owner@example.test"}})
            try:
                self.assertEqual(next(c for c in ai.load_configs() if c["id"] == "google")["key"], "owner-secret")
                cloud.CURRENT_USER.set({"user": {"id": "other", "email": "other@example.test"}})
                self.assertEqual(next(c for c in ai.load_configs() if c["id"] == "google")["key"], "")
            finally:
                cloud.CURRENT_USER.reset(token)


class AuthTests(unittest.TestCase):
    def test_login_uses_httponly_cookie_not_json_tokens(self):
        client = TestClient(app)
        data = {"access_token": "access", "refresh_token": "refresh", "expires_in": 3600, "user": {"email": "test@example.test"}}
        with patch("backend.cloud.call", return_value=data), patch("backend.cloud.cipher", return_value=Fernet(Fernet.generate_key())):
            result = client.post("/api/auth/login", json={"email": "test@example.test", "password": "password123"})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertIn("HttpOnly", result.headers["set-cookie"])
            self.assertNotIn('"access"', result.text)
            self.assertNotIn('"refresh"', result.text)


class AdapterTests(unittest.TestCase):
    def test_provider_protocols_parse_their_native_response_shapes(self):
        text = '{"wallets":[],"transactions":[]}'
        fixtures = {
            "openai": ({"output": [{"content": [{"type": "output_text", "text": text}]}]}, "https://api.openai.com/v1/responses"),
            "anthropic": ({"content": [{"type": "text", "text": text}]}, "https://api.anthropic.com/v1/messages"),
            "cohere": ({"message": {"content": [{"type": "text", "text": text}]}}, "https://api.cohere.com/v2/chat"),
            "mistral": ({"choices": [{"message": {"content": text}}]}, "https://api.mistral.ai/v1/chat/completions"),
            "deepseek": ({"choices": [{"message": {"content": text}}]}, "https://api.deepseek.com/chat/completions"),
            "openrouter": ({"choices": [{"message": {"content": text}}]}, "https://openrouter.ai/api/v1/chat/completions"),
            "custom": ({"choices": [{"message": {"content": text}}]}, "https://example.test/v1/chat/completions"),
        }
        for provider, (response, endpoint) in fixtures.items():
            config = {"id": provider, "key": "key", "model": "model", "base_url": "https://example.test/v1"}
            with self.subTest(provider=provider), patch("backend.ai.post", return_value=response) as call:
                self.assertEqual(ai.call_provider(config, "Return JSON", "tea 20", 10), text)
                self.assertEqual(call.call_args.args[0], endpoint)
                if provider == "anthropic":
                    self.assertEqual(call.call_args.args[1]["anthropic-version"], "2023-06-01")
                if provider == "openai":
                    self.assertFalse(call.call_args.args[2]["store"])


if __name__ == "__main__":
    unittest.main()

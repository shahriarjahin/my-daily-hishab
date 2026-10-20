import json
import os
import unittest
from copy import deepcopy
from unittest.mock import patch
from cryptography.fernet import Fernet
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend import cloud
from backend.main import app
from backend.test_integrations import CloudTests

class EncryptionTests(unittest.TestCase):
    def setUp(self):
        self.identity = {"access_token":"test", "user":{"id":"account-a"}}
        self.token = cloud.CURRENT_USER.set(self.identity)
        self.cipher_patch = patch("backend.cloud.cipher", return_value=Fernet(Fernet.generate_key()))
        self.cipher_patch.start()
    def tearDown(self):
        self.cipher_patch.stop()
        cloud.CURRENT_USER.reset(self.token)
    def test_roundtrip_binds_account_and_preserves_revision(self):
        data = {"private":"salary 12345", "settings":{"language":"bn"}}
        with patch.dict(os.environ,{"HISHAB_ENCRYPT_WORKSPACES":"true"}), patch("backend.cloud.call",return_value=8) as call:
            self.assertEqual(cloud.save_workspace(data,7),8)
            envelope=call.call_args.args[3]["workspace_data"]
            self.assertEqual(call.call_args.args[3]["expected_revision"],7)
        self.assertNotIn("salary",json.dumps(envelope))
        with patch("backend.cloud.call",return_value=[{"data":envelope,"revision":8}]):
            self.assertEqual(cloud.read_workspace()["data"],data)
            with patch.dict(os.environ,{"HISHAB_ENCRYPT_WORKSPACES":"false"}), patch("backend.cloud.call") as save:
                cloud.save_workspace(data,8)
                self.assertEqual(save.call_args.args[3]["workspace_data"]["format"],"hishab-encrypted-v1")
        self.identity["user"]["id"]="account-b"
        with patch("backend.cloud.call",return_value=[{"data":envelope,"revision":8}]):
            with self.assertRaises(HTTPException):cloud.read_workspace()
    def test_legacy_read_and_tampered_ciphertext(self):
        with patch("backend.cloud.call",return_value=[{"data":{"private":"old"},"revision":1}]):
            self.assertEqual(cloud.read_workspace()["data"],{"private":"old"})
        with patch("backend.cloud.call",return_value=[{"data":{"format":"hishab-encrypted-v1","ciphertext":"broken"},"revision":1}]):
            with self.assertRaises(HTTPException):cloud.read_workspace()

class AccountFeatures(unittest.TestCase):
    setUp=CloudTests.setUp
    tearDown=CloudTests.tearDown
    read=CloudTests.read
    save=CloudTests.save
    get_state=CloudTests.get_state
    add=CloudTests.add
    def test_ai_defaults_off_and_optional_settings_persist(self):
        self.assertFalse(self.get_state()["settings"]["ai_enabled"])
        with patch("backend.ai.extract") as extract:
            response=self.client.post("/api/extract",headers=self.headers,json={"text":"tea 20"})
            self.assertEqual(response.status_code,403)
            extract.assert_not_called()
        response=self.client.patch("/api/settings",headers=self.headers,json={"ai_enabled":True,"currency":"USD","bottom_nav":"goals"})
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.get_state()["settings"]["currency"],"USD")
    def test_saving_edit_and_category_delete_preserve_balances(self):
        self.client.patch("/api/wallets/1",headers=self.headers,json={"opening_balance":1000})
        created=self.client.post("/api/savings",headers=self.headers,json={"amount":400,"wallet_id":1,"category":"Savings"})
        self.assertEqual(created.status_code,201,created.text)
        sid=self.get_state()["savings"][0]["id"]
        result=self.client.put(f"/api/savings/{sid}",headers=self.headers,json={"amount":700,"wallet_id":1,"category":"Savings"})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(self.get_state()["wallets"][0]["balance"],1000)
        self.assertEqual(self.get_state()["savings"][0]["amount"],700)
        result=self.client.put(f"/api/savings/{sid}",headers=self.headers,json={"amount":1001,"wallet_id":1,"category":"Savings"})
        self.assertEqual(result.status_code,422)
        category=next(c for c in self.get_state()["category_details"] if c["name"]=="Savings")
        self.assertEqual(self.client.delete(f'/api/categories/{category["id"]}',headers=self.headers).status_code,409)
        category=next(c for c in self.get_state()["category_details"] if c["name"]=="Food")
        self.assertEqual(self.client.delete(f'/api/categories/{category["id"]}',headers=self.headers).status_code,200)
    def test_native_proxy_conflict_cannot_replace_cloud(self):
        self.add()
        snapshot=deepcopy(self.records["account-a"]["data"])
        result=self.client.post("/api/cloud/workspace",headers=self.headers,json={"data":snapshot,"expected_revision":0})
        self.assertEqual(result.status_code,409)
        self.assertEqual(self.records["account-a"]["data"],snapshot)

class AuthTests(unittest.TestCase):
    def setUp(self):
        self.client=TestClient(app)
        self.patches=[patch("backend.cloud.read_session",return_value=(None,None)),patch("backend.cloud.cipher",return_value=Fernet(Fernet.generate_key()))]
        for p in self.patches:p.start()
    def tearDown(self):
        self.client.close()
        for p in reversed(self.patches):p.stop()
    def test_oauth_only_enabled_providers_pkce_cookie(self):
        with patch("backend.cloud.call",return_value={"external":{"google":True,"github":False}}),patch("backend.cloud.settings",return_value=("https://example.supabase.co","anon")),patch.dict(os.environ,{"HISHAB_PUBLIC_URL":"https://mydailyhishab.vercel.app"}):
            self.assertEqual(self.client.get("/api/auth/providers").json()["providers"],["google"])
            result=self.client.get("/api/auth/oauth/google",follow_redirects=False)
            self.assertEqual(result.status_code,303)
            self.assertIn("code_challenge=",result.headers["location"])
            self.assertIn("HttpOnly",result.headers["set-cookie"])
            self.assertIn("Secure",result.headers["set-cookie"])
            self.assertEqual(self.client.get("/api/auth/oauth/github",follow_redirects=False).status_code,422)
    def test_recovery_and_callback_missing_verifier_are_safe(self):
        with patch("backend.cloud.call",return_value={}) as call:
            result=self.client.post("/api/auth/forgot-password",json={"email":"a@example.test"})
            self.assertEqual(result.status_code,200)
            self.assertIn("code_challenge",call.call_args.kwargs["body"])
        self.client.cookies.clear()
        result=self.client.get("/auth/callback?code=bad",follow_redirects=False)
        self.assertEqual(result.headers["location"],"/?auth_error=1")
    def test_password_requires_authentication(self):
        self.assertEqual(self.client.put("/api/auth/password",json={"password":"test-password"}).status_code,401)

import base64,json,time,unittest
from unittest.mock import patch
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from backend import cloud
from backend.main import app
FACTOR="12345678-1234-1234-1234-123456789abc"
def token(aal):return "header."+base64.urlsafe_b64encode(json.dumps({"aal":aal}).encode()).decode().rstrip("=")+".signature"
class SecurityTests(unittest.TestCase):
 def setUp(self):
  self.identity={"access_token":token("aal1"),"user":{"id":"test-user","email":"test@example.test","factors":[]}}
  self.client=TestClient(app)
  self.patches=[patch("backend.cloud.read_session",side_effect=lambda request:(self.identity,None)),patch("backend.cloud.cipher",return_value=Fernet(Fernet.generate_key()))]
  for p in self.patches:p.start()
 def tearDown(self):
  self.client.close()
  for p in reversed(self.patches):p.stop()
 def test_optional_mfa_claims_require_verified_factors(self):
  profile={"id":"user","factors":[]}
  self.assertFalse(cloud.verified_session({"access_token":token("aal1")},profile)["mfa_required"])
  profile["factors"]=[{"status":"unverified"}]
  self.assertFalse(cloud.verified_session({"access_token":token("aal1")},profile)["mfa_required"])
  profile["factors"]=[{"status":"verified"}]
  self.assertTrue(cloud.verified_session({"access_token":token("aal1")},profile)["mfa_required"])
  self.assertFalse(cloud.verified_session({"access_token":token("aal2")},profile)["mfa_required"])
 def test_stepup_blocks_cloud_and_password_but_allows_authentication(self):
  self.identity.update(mfa_required=True)
  self.identity["user"]["factors"]=[{"id":FACTOR,"factor_type":"totp","status":"verified"}]
  with patch("backend.cloud.read_workspace") as workspace:
   self.assertEqual(self.client.get("/api/state").status_code,403)
   status=self.client.get("/api/cloud/status")
   self.assertTrue(status.json()["mfa_required"])
   workspace.assert_not_called()
  self.assertEqual(self.client.put("/api/auth/password",json={"password":"new-password"}).status_code,403)
  self.assertEqual(self.client.post("/api/auth/mfa/enroll",json={}).status_code,403)
 def test_verify_upgrades_cookie_without_returning_tokens(self):
  tokens={"access_token":token("aal2"),"refresh_token":"private-refresh","expires_in":3600}
  with patch("backend.cloud.call",side_effect=[{"id":"challenge"},tokens]) as call:
   response=self.client.post("/api/auth/mfa/verify",json={"factor_id":FACTOR,"code":"123456"})
   self.assertEqual(response.status_code,200,response.text)
   self.assertEqual(response.json(),{"verified":True})
   self.assertNotIn("private-refresh",response.text)
   self.assertIn("HttpOnly",response.headers["set-cookie"])
   self.assertEqual(call.call_args.args[3],{"challenge_id":"challenge","code":"123456"})
 def test_wrong_code_never_sets_session(self):
  from fastapi import HTTPException
  with patch("backend.cloud.call",side_effect=[{"id":"challenge"},HTTPException(401,"Wrong code")]):
   response=self.client.post("/api/auth/mfa/verify",json={"factor_id":FACTOR,"code":"000000"})
   self.assertEqual(response.status_code,401)
   self.assertNotIn("set-cookie",response.headers)
 def test_passkey_proxy_keeps_session_http_only_and_limits_ceremonies(self):
  self.assertEqual(self.client.post("/api/auth/passkey/other/options",json={}).status_code,422)
  with patch("backend.cloud.call",return_value={"access_token":token("aal1"),"refresh_token":"private-refresh"}):
   response=self.client.post("/api/auth/passkey/authentication/verify",json={"challenge_id":FACTOR,"credential":{"id":"synthetic-credential"}})
   self.assertEqual(response.status_code,200,response.text)
   self.assertEqual(response.json(),{"signed_in":True})
   self.assertNotIn("private-refresh",response.text)
 def test_mfa_security_endpoints_require_a_session(self):
  with patch("backend.cloud.read_session",return_value=(None,None)):
   for endpoint in ["/api/auth/security","/api/auth/passkeys"]:self.assertEqual(self.client.get(endpoint).status_code,401)
 def test_android_association_contains_only_public_release_identity(self):
  result=self.client.get("/.well-known/assetlinks.json")
  self.assertEqual(result.status_code,200)
  self.assertEqual(result.json()[0]["target"]["package_name"],"com.digitxbd.hishab")

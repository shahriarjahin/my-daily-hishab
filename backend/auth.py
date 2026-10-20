"""Browser authentication callbacks. Tokens and PKCE verifiers stay in HttpOnly cookies."""
import base64
import hashlib
import json
import os
import secrets
from urllib.parse import urlencode, urlsplit
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import Field, SecretStr
from . import cloud
from .api import Input

router = APIRouter()
FLOW_COOKIE = "hishab_auth_flow"

def app_origin(request):
    value = os.getenv("HISHAB_PUBLIC_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme not in ("https", "http") or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise HTTPException(503, "Configure the public app URL.")
    if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1", "testserver"):
        raise HTTPException(503, "HTTPS is required for authentication.")
    return value

def begin_flow(request, response, purpose):
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    value = cloud.cipher().encrypt(json.dumps({"verifier": verifier, "purpose": purpose}).encode()).decode()
    response.set_cookie(FLOW_COOKIE, value, httponly=True, secure=app_origin(request).startswith("https:"), samesite="lax", max_age=3600, path="/")
    return challenge

class EmailInput(Input):
    email: str = Field(min_length=3, max_length=254)

class PasswordInput(Input):
    password: SecretStr = Field(min_length=8, max_length=1024)
    current_password: SecretStr | None = None

@router.get("/api/auth/providers")
def providers():
    try:
        result = cloud.call("GET", "/auth/v1/settings") or {}
        external = result.get("external", {})
        return {"providers": [p for p in ("google", "github") if external.get(p)]}
    except HTTPException:
        return {"providers": []}

@router.get("/api/auth/oauth/{provider}")
def oauth(provider: str, request: Request):
    if provider not in ("google", "github"):
        raise HTTPException(422, "Unsupported sign-in provider.")
    if provider not in providers()["providers"]:
        raise HTTPException(422, "Enable this sign-in provider in Supabase first.")
    response = RedirectResponse("/", status_code=303)
    challenge = begin_flow(request, response, "login")
    url, _ = cloud.settings()
    response.headers["location"] = url + "/auth/v1/authorize?" + urlencode({"provider": provider, "redirect_to": app_origin(request) + "/auth/callback", "code_challenge": challenge, "code_challenge_method": "s256"})
    return response

@router.post("/api/auth/forgot-password")
def forgot_password(body: EmailInput, request: Request, response: Response):
    challenge = begin_flow(request, response, "recovery")
    cloud.call("POST", "/auth/v1/recover?" + urlencode({"redirect_to": app_origin(request) + "/auth/callback"}), body={"email": body.email.strip(), "code_challenge": challenge, "code_challenge_method": "s256"})
    return {"message": "If this email has an account, a password reset link has been sent."}

@router.put("/api/auth/password")
def change_password(body: PasswordInput):
    identity = cloud.user()
    values = {"password": body.password.get_secret_value()}
    if body.current_password:
        values["current_password"] = body.current_password.get_secret_value()
    cloud.call("PUT", "/auth/v1/user", identity["access_token"], values)
    return {"saved": True}

@router.get("/auth/callback")
def callback(request: Request, code: str = "", error: str = ""):
    if error:
        return RedirectResponse("/?auth_error=1", status_code=303)
    if not code:
        # Email confirmation using the legacy implicit flow is handled by the
        # public shell; its fragment is cleared before tokens reach the server.
        from .main import dashboard
        return dashboard(request)
    try:
        flow = json.loads(cloud.cipher().decrypt(request.cookies.get(FLOW_COOKIE, "").encode(), ttl=3600))
        tokens = cloud.call("POST", "/auth/v1/token?grant_type=pkce", body={"auth_code": code, "code_verifier": flow["verifier"]})
        response = RedirectResponse("/?recovery=1#password" if flow.get("purpose") == "recovery" else "/#home", status_code=303)
        cloud.set_cookie(response, cloud.token_data(tokens))
    except Exception:
        response = RedirectResponse("/?auth_error=1", status_code=303)
    response.delete_cookie(FLOW_COOKIE, path="/")
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response

class TokenInput(Input):
    access_token: SecretStr
    refresh_token: SecretStr
    recovery: bool = False

@router.post("/api/auth/callback")
def implicit_callback(body: TokenInput, response: Response):
    access = body.access_token.get_secret_value()
    cloud.call("GET", "/auth/v1/user", access)
    # Exchange the refresh token too, rather than trusting client token metadata.
    tokens = cloud.call("POST", "/auth/v1/token?grant_type=refresh_token", body={"refresh_token": body.refresh_token.get_secret_value()})
    verified = cloud.call("GET", "/auth/v1/user", tokens["access_token"])
    original = cloud.call("GET", "/auth/v1/user", access)
    if verified["id"] != original["id"]:
        raise HTTPException(401, "Invalid authentication callback.")
    cloud.set_cookie(response, cloud.token_data(tokens))
    return {"signed_in": True}

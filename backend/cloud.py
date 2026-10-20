"""Supabase Auth and versioned, account-owned workspaces. No admin key is used."""
import json
import os
import time
from contextvars import ContextVar
from pathlib import Path

import httpx
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parent.parent
CURRENT_USER = ContextVar("hishab_user", default=None)
COOKIE = "hishab_session"


def settings():
    load_dotenv(ROOT / ".env", override=True, encoding="utf-8-sig")
    return (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/"), os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY", "")


def cloud_mode():
    return True


def cipher():
    load_dotenv(ROOT / ".env", override=True, encoding="utf-8-sig")
    key = os.getenv("HISHAB_SECRET_KEY")
    if key:
        return Fernet(key.encode())
    raise HTTPException(503, "Set HISHAB_SECRET_KEY in the deployment environment.")


def call(method, path, token=None, body=None, extra_headers=None):
    url, key = settings()
    if not url or not key:
        raise HTTPException(503, "Supabase is not configured.")
    headers = {"apikey": key, "Authorization": "Bearer " + (token or key), "Content-Type": "application/json", **(extra_headers or {})}
    try:
        with httpx.Client(timeout=20, follow_redirects=False, trust_env=False) as client:
            response = client.request(method, url + path, headers=headers, json=body)
    except httpx.HTTPError:
        raise HTTPException(503, "Could not reach Supabase. Your cloud records are unchanged.") from None
    if response.status_code >= 400:
        try:
            code = response.json().get("code", "")
        except Exception:
            code = ""
        if code in ("PGRST205", "PGRST202", "42P01", "42883"):
            raise HTTPException(503, "Supabase setup is required. Run supabase/migrations/001_hishab.sql in your project's SQL Editor.")
        if code == "40001":
            raise HTTPException(409, "Your cloud data changed on another device. Reload and try again.")
        if response.status_code in (400, 401, 403, 422) and path.startswith("/auth/"):
            messages = {
                "email_not_confirmed": "Confirm your email using the link from Supabase, then sign in.",
                "over_email_send_rate_limit": "Too many confirmation emails were requested. Wait a little before trying again.",
                "user_already_exists": "An account already exists for this email. Use Sign in.",
                "email_address_invalid": "Enter a valid email address.",
                "signup_disabled": "New account registration is disabled in this Supabase project.",
                "weak_password": "Choose a stronger password that meets the project's password requirements.",
            }
            raise HTTPException(401, messages.get(code, "Check your email and password, and confirm your email if required."))
        raise HTTPException(502, "Supabase could not complete this action. Check project configuration and account access.")
    return response.json() if response.content else None


def cookie_value(tokens):
    return cipher().encrypt(json.dumps(tokens).encode()).decode()


def set_cookie(response, tokens):
    response.set_cookie(COOKIE, cookie_value(tokens), httponly=True, secure=os.getenv("VERCEL") == "1" or os.getenv("COOKIE_SECURE") == "true" or os.getenv("HISHAB_PUBLIC_URL", "").startswith("https://"), samesite="lax", max_age=60 * 60 * 24 * 30, path="/")


def read_session(request):
    bearer = request.headers.get("authorization", "")
    if bearer.startswith("Bearer "):
        token = bearer[7:]
        try:
            identity = call("GET", "/auth/v1/user", token)
            return {"access_token": token, "user": {"id": identity["id"], "email": identity.get("email", "")}}, None
        except HTTPException:
            return None, None
    encrypted = request.cookies.get(COOKIE)
    if not encrypted:
        return None, None
    try:
        saved = json.loads(cipher().decrypt(encrypted.encode(), ttl=60 * 60 * 24 * 30))
    except (InvalidToken, ValueError, KeyError):
        return None, None
    refreshed = None
    try:
        if saved.get("expires_at", 0) < time.time() + 60:
            response = call("POST", "/auth/v1/token?grant_type=refresh_token", body={"refresh_token": saved["refresh_token"]})
            saved = token_data(response)
            refreshed = saved
        # Verify identity with Supabase; do not trust a user id supplied by the client.
        user = call("GET", "/auth/v1/user", saved["access_token"])
        saved["user"] = {"id": user["id"], "email": user.get("email", "")}
        return saved, refreshed
    except (HTTPException, KeyError):
        return None, None


def token_data(data):
    return {"access_token": data["access_token"], "refresh_token": data["refresh_token"],
            "expires_at": data.get("expires_at", time.time() + data.get("expires_in", 3600))}


def user():
    session = CURRENT_USER.get()
    if not session:
        raise HTTPException(401, "Sign in to access your cloud workspace.")
    return session


def read_workspace():
    identity = user()
    rows = call("GET", "/rest/v1/hishab_workspaces?select=data,revision,updated_at&user_id=eq." + identity["user"]["id"], identity["access_token"])
    row = rows[0] if rows else {"data": None, "revision": 0, "updated_at": None}
    if isinstance(row["data"], dict) and row["data"].get("format") == "hishab-encrypted-v1":
        try:
            payload = json.loads(cipher().decrypt(row["data"]["ciphertext"].encode()))
            if payload["user_id"] != identity["user"]["id"]:
                raise ValueError("Wrong account")
            row = row | {"data": payload["workspace"]}
            identity["workspace_encrypted"] = True
        except (InvalidToken, ValueError, KeyError, TypeError):
            raise HTTPException(503, "Cloud records cannot be decrypted. Restore the original server encryption key.") from None
    return row


def save_workspace(data, expected_revision):
    identity = user()
    if os.getenv("HISHAB_ENCRYPT_WORKSPACES", "false").lower() == "true" or identity.get("workspace_encrypted"):
        payload = {"user_id": identity["user"]["id"], "workspace": data}
        data = {"format": "hishab-encrypted-v1", "ciphertext": cipher().encrypt(json.dumps(payload, ensure_ascii=False).encode()).decode()}
    return call("POST", "/rest/v1/rpc/save_hishab_workspace", identity["access_token"], {"expected_revision": expected_revision, "workspace_data": data})


def read_ai_configs():
    identity = user()
    rows = call("GET", "/rest/v1/hishab_ai_configs?select=encrypted_config&user_id=eq." + identity["user"]["id"], identity["access_token"])
    if not rows:
        return {}
    try:
        return json.loads(cipher().decrypt(rows[0]["encrypted_config"].encode()))
    except (InvalidToken, ValueError):
        raise HTTPException(503, "AI credentials cannot be decrypted. Restore the deployment's original HISHAB_SECRET_KEY.") from None


def save_ai_configs(config):
    identity = user()
    call("POST", "/rest/v1/hishab_ai_configs?on_conflict=user_id", identity["access_token"],
         {"user_id": identity["user"]["id"], "encrypted_config": cipher().encrypt(json.dumps(config).encode()).decode()},
         {"Prefer": "resolution=merge-duplicates,return=minimal"})

"""Provider adapters and automatic failover. Credentials never enter ledger backups."""
import json
import ipaddress
import logging
import os
import socket
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
LOCK = threading.RLock()
HEALTH = {}
LAST_USED = {}
PROVIDERS = {
    "google": {"name": "Google AI Studio", "model": "gemini-flash-latest", "env": "GOOGLE_API_KEY"},
    "openai": {"name": "OpenAI", "model": "gpt-5-mini", "env": "OPENAI_API_KEY"},
    "anthropic": {"name": "Anthropic", "model": "claude-haiku-4-5", "env": "ANTHROPIC_API_KEY"},
    "cohere": {"name": "Cohere", "model": "command-a-03-2025", "env": "COHERE_API_KEY"},
    "mistral": {"name": "Mistral AI", "model": "mistral-small-latest", "env": "MISTRAL_API_KEY"},
    "deepseek": {"name": "DeepSeek", "model": "deepseek-chat", "env": "DEEPSEEK_API_KEY"},
    "openrouter": {"name": "OpenRouter", "model": "openai/gpt-4.1-mini", "env": "OPENROUTER_API_KEY"},
    "custom": {"name": "Custom compatible API", "model": "", "env": "CUSTOM_AI_API_KEY"},
}


class ProviderError(Exception):
    def __init__(self, reason, status=None, code=None):
        super().__init__(reason)
        self.reason, self.status, self.code = reason, status, code


def cipher():
    from .cloud import cipher as server_cipher
    return server_cipher()


def load_configs():
    load_dotenv(ROOT / ".env", override=True, encoding="utf-8-sig")
    from .cloud import read_ai_configs
    stored = read_ai_configs()
    configs = []
    from .cloud import CURRENT_USER
    identity = CURRENT_USER.get()
    owner = os.getenv("HISHAB_OWNER_EMAIL", "").strip().casefold()
    allow_environment_keys = bool(owner and identity and identity["user"].get("email", "").casefold() == owner)
    for order, (provider_id, defaults) in enumerate(PROVIDERS.items()):
        saved = stored.get(provider_id, {})
        key = os.getenv(defaults["env"], "")
        if provider_id == "google":
            key = key or os.getenv("GOOGLE_API_KEY_404_HISHAB", "")
        if not allow_environment_keys:
            key = ""
        if saved.get("encrypted_key"):
            try:
                key = cipher().decrypt(saved["encrypted_key"].encode()).decode()
            except Exception:
                key = ""
        configs.append({"id": provider_id, "name": defaults["name"], "key": key,
            "model": saved.get("model") or (os.getenv("GEMINI_MODEL") if provider_id == "google" else None) or defaults["model"],
            "enabled": saved.get("enabled", True), "priority": saved.get("priority", order + 1),
            "base_url": saved.get("base_url", "")})
    return sorted(configs, key=lambda c: (c["priority"], list(PROVIDERS).index(c["id"])))


def scope():
    from .cloud import CURRENT_USER
    identity = CURRENT_USER.get()
    return identity["user"]["id"] if identity else "unauthenticated"


def public_status():
    configs = load_configs()
    result = []
    for config in configs:
        with LOCK:
            health = dict(HEALTH.get((scope(), config["id"]), {}))
        result.append({k: config[k] for k in ("id", "name", "model", "enabled", "priority", "base_url")}
            | {"configured": bool(config["key"] and config["model"] and (config["id"] != "custom" or config["base_url"])),
               "cooldown_seconds": max(0, int(health.get("until", 0) - time.monotonic())),
               "last_error": health.get("reason")})
    return {"providers": result, "last_used": LAST_USED.get(scope()), "automatic_failover": True}


def save_config(provider_id, data):
    if provider_id not in PROVIDERS:
        raise ValueError("Unknown provider.")
    if data.get("base_url"):
        parsed = urlsplit(data["base_url"])
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Use an HTTPS API base URL without credentials or query parameters.")
        if provider_id != "custom":
            raise ValueError("Only the custom provider accepts an API base URL.")
        public_destination(data["base_url"])
    from .cloud import read_ai_configs, save_ai_configs
    stored = read_ai_configs()
    item = stored.setdefault(provider_id, {})
    for key in ("model", "enabled", "priority", "base_url"):
        if key in data:
            item[key] = data[key]
    if data.get("api_key"):
        item["encrypted_key"] = cipher().encrypt(data["api_key"].strip().encode()).decode()
    save_ai_configs(stored)
    with LOCK:
        HEALTH.pop((scope(), provider_id), None)


def reset_health():
    with LOCK:
        for key in list(HEALTH):
            if key[0] == scope():
                HEALTH.pop(key, None)


def public_destination(address):
    parsed = urlsplit(address)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError("Use a public HTTPS AI endpoint.")
    try:
        addresses = list(dict.fromkeys(r[4][0] for r in socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)))
        ips = [ipaddress.ip_address(ip) for ip in addresses]
        if not ips or any(not ip.is_global or ip.is_multicast or getattr(ip, "ipv4_mapped", None) for ip in ips):
            raise ValueError("Use a public HTTPS AI endpoint.")
    except OSError:
        raise ValueError("AI endpoint hostname could not be resolved.") from None
    ip = addresses[0]
    host = "[" + ip + "]" if ":" in ip else ip
    return urlunsplit((parsed.scheme, host + (":" + str(parsed.port) if parsed.port else ""), parsed.path, parsed.query, "")), parsed.hostname, parsed.netloc


def post(url, headers, body, timeout, custom=False):
    # No automatic redirects: a provider must not redirect a credential to another host.
    limits = httpx.Timeout(timeout, connect=min(3, timeout), write=min(3, timeout), pool=min(2, timeout))
    extensions = {}
    if custom:
        try:
            url, hostname, authority = public_destination(url)
        except ValueError:
            raise ProviderError("configuration") from None
        # Pin the validated address while retaining TLS hostname verification.
        headers = {**headers, "Host": authority}
        extensions = {"sni_hostname": hostname}
    with httpx.Client(timeout=limits, follow_redirects=False, trust_env=False) as client:
        response = client.request("POST", url, headers=headers, json=body, extensions=extensions)
    if not 200 <= response.status_code < 300:
        code = response.status_code
        reason = "credit_limit" if code == 402 else "rate_or_credit_limit" if code == 429 else "credentials" if code in (401, 403) else "unavailable" if code >= 500 else "configuration"
        try:
            upstream = response.json().get("error", {})
            message = str(upstream.get("message", "")).lower() if isinstance(upstream, dict) else ""
            upstream = upstream.get("code") if isinstance(upstream, dict) else None
            upstream = upstream if isinstance(upstream, str) and upstream in {"invalid_api_key", "model_not_found", "insufficient_quota", "unsupported_parameter", "unsupported_value", "invalid_request_error", "billing_hard_limit_reached", "rate_limit_exceeded", "context_length_exceeded"} else None
            if "json" in message and "contain" in message:
                upstream = "json_instruction_missing"
        except ValueError:
            upstream = None
        if upstream in ("insufficient_quota", "billing_hard_limit_reached"):
            reason = "credit_limit"
        raise ProviderError(reason, code, upstream)
    return response.json()


def call_provider(config, prompt, text, timeout):
    image = text if isinstance(text, dict) else None
    text = image["text"] if image else text
    key, model, provider_id = config["key"], config["model"], config["id"]
    messages = [{"role": "system", "content": prompt}, {"role": "user", "content": text}]
    if provider_id == "google":
        from google import genai
        from google.genai import types
        try:
            with genai.Client(api_key=key, http_options=types.HttpOptions(timeout=int(timeout * 1000), retry_options=types.HttpRetryOptions(attempts=1))) as client:
                import base64
                contents = [text, types.Part.from_bytes(data=base64.b64decode(image["image"]), mime_type=image["mime_type"])] if image else text
                response = client.models.generate_content(model=model, contents=contents,
                    config=types.GenerateContentConfig(system_instruction=prompt, response_mime_type="application/json"))
            return response.text
        except (httpx.TimeoutException, httpx.NetworkError):
            raise ProviderError("network_or_timeout") from None
        except Exception as exc:
            code = getattr(exc, "code", None)
            reason = "rate_or_credit_limit" if code == 429 else "credit_limit" if code == 402 else "credentials" if code in (401, 403) else "configuration" if code in (400, 404) else "unavailable"
            raise ProviderError(reason, code) from None
    headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if provider_id == "openai":
        content = [{"type": "input_text", "text": text}, {"type": "input_image", "image_url": "data:" + image["mime_type"] + ";base64," + image["image"]}] if image else text
        result = post("https://api.openai.com/v1/responses", headers,
            {"model": model, "input": [{"role": "system", "content": prompt}, {"role": "user", "content": content}], "store": False,
             "text": {"format": {"type": "json_object"}}}, timeout)
        return "".join(part.get("text", "") for item in result.get("output", []) for part in item.get("content", []) if part.get("type") == "output_text")
    if provider_id == "anthropic":
        if image:
            messages[1]["content"] = [{"type": "image", "source": {"type": "base64", "media_type": image["mime_type"], "data": image["image"]}}, {"type": "text", "text": text}]
        result = post("https://api.anthropic.com/v1/messages",
            {"x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
            {"model": model, "max_tokens": 4096, "system": prompt, "messages": [messages[1]]}, timeout)
        return "".join(c.get("text", "") for c in result.get("content", []) if c.get("type") == "text")
    if provider_id == "cohere":
        if image:
            raise ProviderError("image_not_supported")
        result = post("https://api.cohere.com/v2/chat", headers,
            {"model": model, "messages": messages, "response_format": {"type": "json_object"}}, timeout)
        return "".join(c.get("text", "") for c in result.get("message", {}).get("content", []) if c.get("type") == "text")
    endpoints = {"mistral": "https://api.mistral.ai/v1", "deepseek": "https://api.deepseek.com", "openrouter": "https://openrouter.ai/api/v1", "custom": config["base_url"].rstrip("/")}
    if image:
        if provider_id == "deepseek":
            raise ProviderError("image_not_supported")
        messages[1]["content"] = [{"type": "text", "text": text}, {"type": "image_url", "image_url": {"url": "data:" + image["mime_type"] + ";base64," + image["image"]}}]
    result = post(endpoints[provider_id] + "/chat/completions", headers,
        {"model": model, "messages": messages, "response_format": {"type": "json_object"}}, timeout, custom=provider_id == "custom")
    return result["choices"][0]["message"]["content"]


def require_enabled(session):
    from .models import AppSetting
    from fastapi import HTTPException
    if not (session.get(AppSetting, 1) or AppSetting()).ai_enabled:
        raise HTTPException(403, "Enable AI in Settings first.")


def extract(prompt, text, validator):
    """Try each connected provider once. Validate before accepting any result."""
    failures = []
    configs = [c for c in load_configs() if c["enabled"] and c["key"] and c["model"] and (c["id"] != "custom" or c["base_url"])]
    if not configs:
        raise ProviderError("Connect at least one AI provider in Settings.")
    # Leave room for authentication, cloud reads and the mobile client's 45s timeout.
    deadline = time.monotonic() + 30
    for config in configs:
        if isinstance(text, dict) and config["id"] in ("cohere", "deepseek"):
            failures.append({"provider": config["name"], "reason": "image_not_supported"})
            continue
        with LOCK:
            health = HEALTH.get((scope(), config["id"]), {})
        if health.get("until", 0) > time.monotonic():
            failures.append({"provider": config["name"], "reason": health["reason"]})
            continue
        remaining = deadline - time.monotonic()
        if remaining < 2:
            break
        try:
            raw = call_provider(config, prompt, text, min(12, remaining))
            raw = (raw or "").strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
            result = validator(json.loads(raw))
            with LOCK:
                HEALTH.pop((scope(), config["id"]), None)
                LAST_USED[scope()] = config["name"]
            return result | {"provider": config["name"], "fallback_used": bool(failures), "attempts": failures}
        except ProviderError as exc:
            reason = exc.reason
            logging.getLogger(__name__).warning("AI provider %s failed: %s (HTTP %s, code %s)", config["id"], reason, exc.status, exc.code)
        except (httpx.TimeoutException, httpx.NetworkError):
            reason = "network_or_timeout"
        except Exception:
            reason = "invalid_response"
        cooldown = 3600 if reason == "credit_limit" else 300 if reason in ("credentials", "configuration") else 60
        with LOCK:
            HEALTH[(scope(), config["id"])] = {"reason": reason, "until": time.monotonic() + cooldown}
        failures.append({"provider": config["name"], "reason": reason})
    explanations = {"credit_limit": "out of credit", "rate_or_credit_limit": "quota or rate limit", "credentials": "key rejected", "configuration": "model or API configuration rejected", "network_or_timeout": "connection timed out", "invalid_response": "unusable AI output", "unavailable": "provider unavailable", "image_not_supported": "receipt images not supported"}
    names = "; ".join(f["provider"] + ": " + explanations.get(f["reason"], f["reason"].replace("_", " ")) for f in failures)
    raise ProviderError("AI import failed. " + (names or "Request time budget reached") + ". Your records were not changed. Check Settings → AI connections; quota/key errors need a working provider, not repeated retries.")

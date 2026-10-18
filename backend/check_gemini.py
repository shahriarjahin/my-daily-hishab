"""Developer connectivity check; prints no credentials and saves no records."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from .ai import call_provider, ProviderError


def main():
    load_dotenv(Path(__file__).parent.parent / ".env", encoding="utf-8-sig")
    key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY_404_HISHAB")
    if not key:
        print("Gemini check: missing server key")
        return
    try:
        config = {"id": "google", "key": key, "model": os.getenv("GEMINI_MODEL", "gemini-flash-latest")}
        result = json.loads(call_provider(config, 'Return JSON: {"wallets":[{"name":"Cash","balance":1500}],"transactions":[]} for the stated balance.', "cash 1500 tk ache", 20))
        print("Gemini check: " + ("wallet extraction succeeded" if result.get("wallets") else "no matching balance"))
    except Exception:
        print("Gemini check failed; check model access, key and quota.")


if __name__ == "__main__":
    main()

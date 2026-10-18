# Hishab cloud app

All active financial data belongs to a signed-in Supabase account. There is no local-data mode.
The Python server serves the responsive web app and the same JSON API that a future iOS/Android
client can use. Supabase stores versioned workspaces and encrypted per-account AI connections.

## Development

1. Use Python 3.12 and install `requirements.txt` in `.venv`.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `HISHAB_SECRET_KEY` in the ignored root `.env`.
   Generate a stable secret using `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
3. Run `supabase/migrations/001_hishab.sql` once in the project SQL Editor.
4. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1`.
5. Open http://127.0.0.1:8001/, create an account, confirm email if required, and sign in.

Running the server on your computer is development hosting only. Its ledger still saves to Supabase.
Production cookies use HTTPS on Vercel. The local loopback development URL uses an HTTP-only cookie.

## Features

- Current balance across wallets, month totals, transactions and charts.
- AI detection of separate wallet balances from English, Bangla and Banglish messages.
  Preview shows existing/new wallets and requires confirmation. Applying a current balance
  adjusts the opening balance to preserve existing income and spending history.
- Explicit wallet choice in smart entry, manual entry and editable AI suggestions.
- Automatic failover among Google AI Studio, OpenAI, Anthropic, Cohere, Mistral, DeepSeek,
  OpenRouter and a custom compatible HTTPS API. Connect keys and set priority in Settings.
  Credit/rate errors, network/service errors, and invalid output advance to the next provider.
  Only validated output is accepted. No ledger writes occur during extraction.
- Transaction search, month/type filters, editing, removal confirmation and CSV export.
- Monthly category budgets, progress and over-budget indicators.
- Real-data insights, account preferences, light/dark/system theme and installable web manifest.

## Cloud persistence

Each account owns a row in `hishab_workspaces`, protected by row-level security.
Every request verifies Supabase identity, loads a workspace into a disposable in-memory database,
and persists mutations through `save_hishab_workspace` with the expected revision. Concurrent
changes fail with a reload request instead of silently overwriting another device.
No SQLite file is used by active requests. No admin or service-role key is used.

Browser sessions use encrypted HTTP-only cookies. Native clients can send a Supabase access token
in `Authorization: Bearer ...`. AI keys are encrypted under the stable server secret and saved
in the separate, account-protected `hishab_ai_configs` table, outside ledger exports/imports.
The host's environment may optionally supply provider keys to the account named by `HISHAB_OWNER_EMAIL`.
Other accounts connect their own private keys; they cannot use the owner's environment credentials.

## Previous records

`hishab-migration.json` preserves the prior app's ledger without keys. In Settings → Import previous
Hishab records, choose this file after signing in. Import is permitted only for an empty account.
Old database files remain as backups and are excluded from Git and Vercel deployment.

## Verification and deployment

Install `requirements-dev.txt`, then run:

```powershell
.\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_app backend.test_integrations -v
```

Tests use disposable memory and mocked cloud/provider calls, never production credentials.
See `docs/CLOUD_DEPLOYMENT.md` for Vercel setup and `mobile/README.md` for mobile-client boundaries.

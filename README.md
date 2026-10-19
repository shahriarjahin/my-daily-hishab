# my-daily-hishab

Project repository: https://github.com/shahriarjahin/my-daily-hishab

The app display name remains **Hishab**.

[Open web app](https://hishab.smjahin.online/) · [Download Android APK](https://github.com/shahriarjahin/my-daily-hishab/releases/latest)

Android releases include a signed APK for installation and a SHA-256 checksum for verification. Android 8.0 or later is required. Signing keys and private configuration are excluded from this repository.

Cloud personal-finance app for Bangladeshi taka, with English, বাংলা and Banglish AI entry.

## Features

- Supabase email/password login and private, account-owned cloud data
- Multiple wallets, income, expenses and transfers
- Monthly budgets, category allocations, savings goals and regular spending
- Loans, repayments, charts, filters and CSV exports
- AI advisor, SMS/receipt import and automatic provider fallback
- Responsive light/dark interface and home-screen installation

## Run locally

Use Python 3.12. Create a virtual environment and install `requirements.txt`.
Copy `.env.example` to `.env`, fill in the required values, and run
`supabase/migrations/001_hishab.sql` once in your Supabase SQL Editor.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open http://127.0.0.1:8001/. Financial records are stored in Supabase even during local development.

## Deploy to Vercel

1. Import this GitHub repository in Vercel as a FastAPI project.
2. Keep the root directory at the repository root and leave build/output settings at their defaults.
3. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY` and the existing stable `HISHAB_SECRET_KEY` as server environment variables.
4. Optionally add `GOOGLE_API_KEY` and `HISHAB_OWNER_EMAIL`, or connect AI keys through Settings after signing in.
5. Deploy, then add your production domain to Supabase Auth URL configuration.

Never commit `.env` or change the encryption key when moving an existing account to production.
See [deployment details](docs/CLOUD_DEPLOYMENT.md) and the [feature guide](docs/FINANCE_FEATURES.md).

## Project layout

- `app.py`: Vercel entrypoint
- `backend/`: API, cloud persistence, templates and frontend assets
- `supabase/migrations/`: tables, account access policies and conflict-safe save function
- `mobile/README.md`: Android APK, offline SQLite, cloud sync and release builds

The app uses no persistent server database files and never caches financial API responses in the browser.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_app backend.test_integrations backend.test_finance -q
```

Tests use disposable memory and mocked accounts/providers.

## Android

The native Android app stores records in encrypted SQLite and syncs with the same Supabase account. Manual bookkeeping works offline after the first online sign-in. AI features use your hosted backend. See [Android installation and releases](mobile/README.md).

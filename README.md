<div align="center">

<img src="backend/static/hishab-icon-v2-192.png" width="96" alt="Hishab logo" />

# Hishab

**Your everyday money companion.**

Wallets, budgets and smarter bookkeeping — in English, বাংলা and Banglish.

[![Download APK](https://img.shields.io/badge/Download_Android_APK-DCA73E?style=for-the-badge&logo=android&logoColor=191815)](https://github.com/shahriarjahin/my-daily-hishab/releases/latest)
[![Documentation](https://img.shields.io/badge/Read_the_docs-191815?style=for-the-badge&logo=readthedocs&logoColor=white)](docs/FINANCE_FEATURES.md)

[![Latest release](https://img.shields.io/github/v/release/shahriarjahin/my-daily-hishab?color=dca73e&label=release)](https://github.com/shahriarjahin/my-daily-hishab/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/shahriarjahin/my-daily-hishab/total?color=10b981)](https://github.com/shahriarjahin/my-daily-hishab/releases)
[![Stars](https://img.shields.io/github/stars/shahriarjahin/my-daily-hishab?style=flat&color=dca73e)](https://github.com/shahriarjahin/my-daily-hishab/stargazers)
[![Issues](https://img.shields.io/github/issues/shahriarjahin/my-daily-hishab)](https://github.com/shahriarjahin/my-daily-hishab/issues)
[![Last commit](https://img.shields.io/github/last-commit/shahriarjahin/my-daily-hishab)](https://github.com/shahriarjahin/my-daily-hishab/commits/main)

React · TypeScript · Capacitor · FastAPI · Supabase

</div>

---

## Everything in one place

| Manage | Plan | Understand |
| --- | --- | --- |
| Multiple wallets and transfers | Monthly budgets and category limits | Spending charts and cash flow |
| Income, expenses and receipts | Savings goals and allocations | Search, filters and CSV exports |
| Loans and repayments | Regular spending and quantities | AI advisor and automatic provider fallback |

- **Made for daily use:** BDT and popular currencies, Bangla/English, light, dark and glass themes.
- **One account:** Supabase login and account-owned data across web and Android.
- **Android offline:** encrypted SQLite storage with cloud sync when connected.
- **Optional AI:** enable it in Settings for English, Bangla or Banglish entry and editable import previews.
- **A calmer start:** branded loading screen, reduced-motion support and placeholders during longer waits.

## Get the Android app

**[↓ Download the latest signed APK](https://github.com/shahriarjahin/my-daily-hishab/releases/latest)**

Requires **Android 8.0+**. Open the latest release and select the `.apk` asset. A SHA-256 checksum is included. To update, install over the existing app; do not uninstall first. Android asks for installation confirmation. You can also check for updates in the app's settings.

Cloud sync uses the hosted Hishab backend. Optional AI also needs an internet connection and a configured provider. An iOS native build is not available yet.

## Run locally

Requires **Python 3.12** and a recent **Node.js 22 LTS** installation.

1. Copy `.env.example` to `.env` and enter your Supabase settings and stable encryption secret.
2. Run [the database migration](supabase/migrations/001_hishab.sql) in your Supabase SQL Editor.
3. Install dependencies, build the interface and start the server:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm ci --prefix frontend
.\.venv\Scripts\python.exe scripts/build_frontend.py
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Open **http://127.0.0.1:8001/**. Web records remain in your Supabase account during local development.

<details>
<summary><strong>Deploy to Vercel</strong></summary>

1. Import this repository as a FastAPI project, using the repository root.
2. Keep build/output settings at their defaults; the production React bundle is committed.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and the existing stable `HISHAB_SECRET_KEY` in Vercel.
4. Optionally set `GOOGLE_API_KEY` and `HISHAB_OWNER_EMAIL`, or connect private AI keys in Settings.
5. Deploy and add your production domain to Supabase Auth URL configuration.

Never publish `.env`, signing keys or financial exports. Keep the encryption secret unchanged when moving an existing account.

[Full deployment guide](docs/CLOUD_DEPLOYMENT.md) · [Sign-in, password recovery and cloud encryption setup](docs/ACCOUNT_SETUP.md)

</details>

<details>
<summary><strong>Development and verification</strong></summary>

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m unittest backend.test_api backend.test_app backend.test_integrations backend.test_finance backend.test_account_updates mobile.test_compatibility -q
npm test --prefix frontend
node --test mobile/test_ledger.cjs
npm run test:browser --prefix frontend
```

Browser checks require Google Chrome. Tests use synthetic records and mocked accounts/providers, not production financial data.

</details>

## Inside the project

| Folder | Purpose |
| --- | --- |
| `frontend/` | React screens, TypeScript, Vite and Capacitor configuration |
| `backend/` | Python API, authentication, AI connections and compiled web assets |
| `mobile/` | Android plugin, encrypted storage, offline ledger and release tools |
| `supabase/migrations/` | Account policies and revision-protected cloud saves |
| `scripts/` | Frontend build and asset publishing |
| `docs/` | Features, deployment, branding and release guides |

Shared CSS and public branding remain in `backend/static/`. The committed React bundle supports Python-only hosting; it is regenerated by the frontend build script.

## Explore the docs

[Features](docs/FINANCE_FEATURES.md) · [Frontend](frontend/README.md) · [Android builds](mobile/README.md) · [Cloud deployment](docs/CLOUD_DEPLOYMENT.md) · [React migration](docs/REACT_MIGRATION.md) · [Google Play](docs/GOOGLE_PLAY_RELEASE.md)

---

<div align="center">

Created by **[Shahriar Morshed Jahin](https://github.com/shahriarjahin)** · **DigitXBD**

[Report a problem](https://github.com/shahriarjahin/my-daily-hishab/issues) · [Browse releases](https://github.com/shahriarjahin/my-daily-hishab/releases)

</div>

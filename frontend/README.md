# Hishab React interface

React 19, strict TypeScript, Vite and Capacitor 8. The production web app uses FastAPI's existing same-origin API; provider keys and the authentication cookie stay on the server. Android uses the local `Hishab` Capacitor plugin, encrypted SQLite and the existing account sync worker. No financial data or session tokens are written to browser storage.

## Build and run

From the repository root:

```powershell
npm ci --prefix frontend
.\.venv\Scripts\python.exe scripts/build_frontend.py
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

FastAPI serves the committed `backend/static/react` production bundle and `/assets`. Rebuild this bundle after editing React; Vercel's Python deployment does not install frontend tools. Development with hot reload uses `npm run dev --prefix frontend` while FastAPI runs on port 8001.

```powershell
npm test --prefix frontend
npm run test:browser --prefix frontend
```

Browser checks use an isolated Chrome profile and synthetic records; no account credentials or external API calls are used. Chrome must be installed. `npm run format --prefix frontend` formats the source.

## Structure

- `src/context.tsx`: account state, guarded refresh, theme, language and notifications.
- `src/api.ts`: same-origin cookie transport or typed Capacitor plugin calls; native saves are serialized and acknowledged after durable storage.
- `src/screens`: actual React screens for Activity, budgets, assets, AI, settings and dashboard.
- `src/components`: shared UI, twelve-tooth Settings icon and keypad entry sheet.
- `src/forms.tsx`: typed, server-validated record editors.
- `src/locales/bn.json`: existing Bangla presentation translations.
- `capacitor.config.ts`: existing package ID `com.digitxbd.hishab`; native project is `../mobile/android`.

The shared offline ledger remains `mobile/web/ledger.js`: it is bundled as a module, not injected as a page script. Its exact-cent validation and shared Supabase workspace schema remain covered by the existing ledger and compatibility tests. The former global UI scripts and template have been removed. Existing CSS and public branding assets are reused.

## Native platforms

Build Android with `python mobile/build.py`, which builds React, runs Capacitor sync, generates a fresh empty seed/public configuration, and signs using the existing private key. Java 21 and Gradle 8.14.3 are required; `mobile/bootstrap.py` installs portable Windows tools.

Android's existing `Store`, `Vault`, `Runtime`, `SyncJob` and updater are retained. The Capacitor plugin replaces the former JavaScript-interface protocol. An in-place upgrade from 1.1.0 is tested with synthetic encrypted records.

No iOS native project is shipped yet. Building iOS requires macOS/Xcode and an iOS implementation of the `Hishab` storage/sync plugin; Android Java code does not automatically become Swift. The React interface can be reused for that work.

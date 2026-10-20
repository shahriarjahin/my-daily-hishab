# Hishab demo showcase

Fictional records covering May 1, 2025–October 20, 2026: 18 calendar months, with a partial October.

- 3,467 income and expense transactions
- 5 wallets, 74 movements: 72 transfers and 2 historical-loan repayments
- 72 savings allocations, 4 goals, 2 loans, 9 category budgets, 2 regular trackers
- No real financial records, API keys, or passwords in the JSON

The JSON passed the backend workspace validator and was imported through the UI into the user-provided demo account. The importer preserves the destination account's settings and protects populated accounts. Generated settings are therefore not applied to the destination account.

Open `showcase.html` for the gallery. Individual JPEGs in `screenshots/` are actual browser captures at an iPhone-sized viewport. Gallery frames are illustrative; these are not physical-device screenshots. A desktop import confirmation is included.

Reproduce the JSON with `.venv\Scripts\python.exe -m scripts.generate_demo` from the repository root. Import only into an empty workspace. All final wallet balances and available balances are positive. Transfers are excluded from income and expenses; savings are reservations rather than expenses. Loans represent historical balances with partial repayments, without new loan proceeds added to wallets.

Android backup import is available in Settings → Data & app for empty offline or cloud workspaces. Offline imports stay on the phone; cloud-mode imports join the normal sync queue. Existing records are not merged or overwritten.

# Hishab Feature & Accounting Reference

All cloud workspace records, plans, recurring bills, categories, shortcut tokens, and advisor history belong to the authenticated Supabase user and follow strict row-level ownership policies.

## 1. Quick Entry & Automation

| Capability | Where to find it | Behavior |
| --- | --- | --- |
| Quick templates & last wallet | Floating `+` → **Add entry** | Auto-derives up to 5 frequent chips (pinned items first); remembers the last-used wallet |
| BD MFS & bank SMS parser | **Paste SMS** / Android **Share → Log in Hishab** | Parses bKash, Nagad, Rocket & bank SMS into income, expenses, or transfers with **Cash Out fee** separation |
| Voice input | Floating `+` → **Voice** | Captures Web Speech (`en-US` / `bn-BD`) and fills amount, note, wallet, and suggested category |
| Split bills | Floating `+` → **Split bill with friends** | Logs your share as an expense (optional self-inclusion) and creates per-friend receivables |
| Optimistic UI & offline queue | Web dashboard & Android APK | Web saves reflect immediately and replay offline writes on reconnect; Android commits offline to encrypted SQLite |
| Shortcuts & Back Tap (`/quick`) | **Settings → Data → Shortcut & Quick Webhook** | Generates scoped `hishab_sc_...` tokens with one-tap copy links/prompts for `/quick` (Top-3 wallets popup), iOS Shortcuts, Tasker, or MacroDroid |
| Android Shortcuts, Tile & Widgets | Android 8.0+ APK | Launcher long-press shortcuts (**Quick Add**, **Paste SMS**, **Transfer**), Quick Settings tile (**Quick Hishab**), `ACTION_SEND` share receiver, and two Home Screen widgets (`4×2` Summary & `4×1` Quick Bar) |

## 2. Core Accounting & Planning Rules

- **Wallet balance:** `opening_balance + income − expenses + incoming movements − outgoing movements`. Opening balances, loan principals, and inter-wallet transfers never inflate income or spending totals. Borrowed-loan repayments count as expenses once through their movement without a second wallet debit.
- **Transfers & fees:** Inter-wallet transfers check unreserved funds before transferring. Optional transfer or Cash Out fees are stored alongside the movement as an expense from the source wallet.
- **Savings & goals:** Savings reserve funds inside a wallet without changing the wallet's headline balance. Transfers, new savings, and lending cannot exceed unreserved funds (`wallet balance − reserved savings`).
- **Loans & historical debt:** Borrowed/lent records support partial repayments atomically (`POST /api/loans/{id}/repayments`). Existing debt can be recorded with `affect_wallet=false` and optional `wallet_id=null` without altering current balances.
- **Net position:** `total wallet balances + loans receivable − debt owed`.
- **Daily allowance & forecast:** Daily allowance divides remaining monthly budget before today's expenses by remaining calendar days in Asia/Dhaka, then subtracts today's spending. Forecast estimates `month_spent / elapsed_days × days_in_month`.
- **Recurring bills (`Plan → Bills`):** Tracks weekly, monthly, or yearly obligations with due dates and one-tap **Pay** (`POST /api/bills/{id}/pay`), creating the transaction and advancing `next_due_date` atomically.
- **Regular trackers (`Plan → Regulars`):** Aggregates matching expenses and unit quantities against daily targets across daily, weekly (Mon–Sun), monthly, or yearly periods without double-counting quick logs.
- **Insights & MoM comparison (`Insights`):** Displays 12-month income/expense series, category breakdown, Month-over-Month category deltas, top expenses, and spending pace projections.
- **Activity & PDF Statements (`Activity`):** Multi-wallet/category filters, search, custom date presets, windowed history pagination, CSV export (**Settings → Data**), and downloadable branded PDF statements (`1`, `3`, `6`, `12` months or custom dates) generated server-side on web and offline on-device on Android.

## 3. Shortcut API Contract

When relational PostgreSQL mode is active, personal tokens (`hishab_sc_...`) authenticate two headless endpoints via `X-Shortcut-Token` (or `Authorization: Bearer`):

- `GET /api/shortcuts/wallets` — returns `top_wallets` (up to 3 wallets ordered by transaction count descending) and all `wallets`.
- `POST /api/shortcuts/log` — accepts natural text or raw SMS (`{ "text": "...", "wallet"?: "..." }`) or structured fields (`amount`, `description`, `category`, `type`, `wallet_id`/`wallet`), parses BD MFS transfers/fees or expenses, commits atomically, and returns updated wallet balance.

## 4. AI Integrations & Failover

- **Cloud AI (`Settings → AI connections`):** Advisor chat, natural-language entry, budget auto-plan, and JPEG/PNG/WebP receipt scanning (up to 2 MB) try enabled providers in ascending priority order, automatically failing over on rate limits, quota exhaustion, or network errors.
- **Review-before-saving & privacy:** AI never mutates wallet balances directly without user confirmation. Receipt images are processed in memory and not persisted in the workspace.
- **On-device Offline AI:** Optional ~630 MB GGUF model on 64-bit Android handles BDT text extraction offline without network traffic (see [OFFLINE_AI.md](OFFLINE_AI.md)).

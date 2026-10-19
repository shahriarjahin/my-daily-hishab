# Daily use and screenshot feature map

All financial records, plans, categories and advisor history belong to the signed-in Supabase account.
The existing workspace JSON format accepts these new collections; no additional SQL migration is required.
Provider keys remain encrypted in the existing account configuration table.

## Enter money received

Select Cash in Smart entry, type `70 tk cash paisi`, submit, and review the suggestion before saving.
It should be Income, 70 BDT, Cash. Existing wallet balances are different: `cash 1500 tk ache` sets a
reviewed current balance, rather than creating income. Manual entry and the floating + button's
Income action are also available.

## What is available

| Reference function | Where to find it |
| --- | --- |
| Daily spending limit, days left and today's remaining allowance | Budgets |
| Monthly spending cap, expected income and savings target | Plan → Budget → Monthly plan |
| Needs / wants / savings allocation and editable percentages | Plan → Budget → Monthly plan |
| Per-category limits and progress | Plan → Budget → Category budget |
| AI allocation plan with editable amounts and review | Plan → Budget → AI auto-plan |
| Cloud-saved advisor conversation | AI advisor |
| SMS, payment memo and receipt text extraction | Transactions → Import |
| JPEG, PNG and WebP receipt extraction, maximum 2 MB | Transactions → Import |
| Income, expense and savings categories with colors and icons | Settings → Categories |
| Rename categories while updating related records; archive unused categories | Settings → Categories → category |
| Wallet and category multi-select, amount range, custom dates, reset | Transactions → Filters |
| Today, week, month, year and all-time presets | Transactions → Period |
| Opening balance history and income/expense/transfer filters | Transactions |
| Export exactly the filtered view, including opening balances and movements | Transactions → Export view |
| Spending charts, top categories, savings rate and budget remaining | Insights |
| Month-end forecast, daily pace, biggest expense, active day and average expense | Insights |
| Outstanding loans and receivables | Wallets → Loans |
| Income, expense and transfer | Floating + button |
| Savings, goals and regular trackers | Plan |
| Loans and repayments | Wallets → Loans |
| SMS and receipt import | Transactions → Import |
| Wallet-to-wallet transfer bookkeeping | Wallets → Transfer or + → Transfer |
| Reserve savings in a wallet and release reservations | Plan → Savings & goals |
| Target-based savings goals, dates and contribution progress | Plan → Savings & goals |
| Borrowed/lent money with partial repayment tracking | Wallets → Loans |
| Regular spending, quantity counts, daily limits and period selection | Plan → Regulars |
| Quick expense entry prefilled for a regular tracker | Regulars → Quick log |

## How the numbers work

- Wallet balance = opening balance + income − expenses + incoming movements − outgoing movements.
  Opening balances and loan/transfer movements never enter income or expense totals.
- Savings are earmarks inside wallets. They reduce funds available for everyday use without changing
  the total wallet balance. The app prevents new reservations, transfers or lending beyond unreserved funds.
  Existing expenses can exceed reservations; available funds then make the shortfall visible.
- Net position = wallet money + loans receivable − debt owed. Repayments update outstanding amounts
  and wallets atomically; overpayments are rejected.
- Daily allowance divides the budget remaining before today's expenses by the remaining calendar
  days, including today. Today's expenses then reduce today's allowance. Dhaka dates are used throughout.
- Forecast = spending so far / elapsed calendar days × days in the month. It is an estimate, not a guarantee.
- Potential extra savings subtracts existing reservations, the remaining spending budget and outstanding
  debt from wallet money. No amount is suggested until a spending cap is set.
- The needs/wants/savings split uses expected monthly income when supplied, otherwise recorded monthly
  income. Wallet opening balances and borrowing are never treated as earnings.
- The default 50/30/20 split is an adjustable budgeting guideline. See the
  [CFPB budgeting activity](https://www.consumerfinance.gov/consumer-tools/educator-tools/youth-financial-education/teach/activities/analyzing-budgets/).
- Regular tracker quantities sum only expense quantities with the matching unit. Their spending comes
  from the existing ledger, so quick logs are not counted twice. Weekly limits cover Monday–Sunday;
  monthly and yearly limits use the full calendar period. Future dates are excluded from regular totals.

## AI and deployment details

Advisor and planning requests send an account summary and recent advisor conversation to a connected
provider. Receipt images are processed in memory and are not saved in the workspace. Text-only Cohere
and DeepSeek adapters are skipped for image requests. Other image adapters require a vision-capable model.
Providers are tried in configured priority order automatically when a provider has unavailable credit,
rate limits, invalid responses or other errors. An actual backup needs its own working key and credit.

AI plans are suggestions. Previewing a plan changes no budgets or wallet entries. Applying a plan saves
the reviewed settings and replaces category limits atomically. Receipt parsing always opens a review.
Loan and transfer tools record bookkeeping; the app does not connect to banks or initiate payments.

The service worker caches application assets only, never API responses, exports, sessions or finances.
Runtime finance processing uses a disposable in-memory database. Vercel setup remains in
[CLOUD_DEPLOYMENT.md](CLOUD_DEPLOYMENT.md); native packaging guidance remains in `mobile/README.md`.

Vision protocols follow the official
[Google image guide](https://ai.google.dev/gemini-api/docs/image-understanding),
[OpenAI vision guide](https://developers.openai.com/api/docs/guides/images-vision), and
[Anthropic vision guide](https://platform.claude.com/docs/en/build-with-claude/vision).

Historical loan entry: POST /api/loans accepts affect_wallet=false, optional wallet_id=null and an original date to record outstanding debt without changing cash. New loans default to affect_wallet=true and require a wallet.

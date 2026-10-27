# Loan editing and PDF statements implementation plan

Goal: edit initial loan amounts safely, count borrowed repayments as expenses, and download branded bank-style statements on the web. No APK build.

Architecture: keep movements as the single cash source. Derive expense rows for outgoing loan repayments in account views, never duplicate financial records. Correct an original loan movement by the principal delta; reject a principal below repayments or insufficient wallet funds. Protect direction/date when linked cash history exists. PDF generation reads the authenticated workspace and includes all real cash movements once.

- [x] Regression tests: borrowed repayment expense once, lent repayment excluded, reversal, principal edits after repayment and insufficient funds, account isolation and statement date/balance accuracy.
- [x] Shared cloud/native ledger rules, editable loan UI with protected linked direction/date; derived expense display and backup/export safety.
- [x] Authenticated PDF endpoint using ReportLab, exact rolling month/3/6/12 and inclusive custom dates, optional wallet, opening/closing balances, debit/credit/running balance. Hishab top logo, DigitXBD left footer, page numbering, embedded Bangla-capable fonts.
- [x] Activity statement dialog with date/wallet selection and download/loading/error handling; Bangla UI translations.
- [x] Build web assets, run backend/frontend/ledger/browser checks, render synthetic multi-page PDF and inspect it. Leave APK/version and real user records unchanged.

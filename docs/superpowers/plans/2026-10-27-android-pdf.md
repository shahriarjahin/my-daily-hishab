# Android PDF export plan

Use Android PdfDocument and the existing save-document picker to generate statements entirely on-device. Reuse the web statement dialog for period and wallet choices. A tested TypeScript read-only projection builds the same opening, debit, credit, closing and running balances from the device snapshot, excluding derived repayment expense rows to avoid counting cash twice. Native rendering embeds existing logos and the bundled Bangla font, repeats table headers and page numbers, and never changes the ledger.

- [x] Test calendar ranges, opening balances, transfers and repayment deduplication against the web calculations.
- [x] Add bounded native PDF rendering and a save-document callback on the disk executor.
- [x] Replace Android CSV action with the shared PDF dialog; keep CSV in Settings.
- [x] Test a multi-page PDF with Android instrumentation, inspect its render, rebuild with the existing signing key and publish a new patch release. v2.3.2 is already published; do not replace its assets.

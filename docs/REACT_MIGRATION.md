# React and Capacitor migration — 2.0.0

## Preserved

- Android package identity, release signing certificate, encrypted database filename, key aliases, session preferences and background sync job identity.
- Supabase schema version 1, row-level policies, workspace revisions and compare-and-swap conflict behavior.
- Python API, AI failover configuration and account authentication.
- Wallets and transfers, income/expense editing, budgets, plans, categories, goals, savings, historical loans, repayments, quantity-based regulars, exports, AI review, appearance and Bangla settings.
- GitHub update checking and installer confirmation.

## Changed

The frontend runs React components with strict TypeScript rather than global HTML-string renderers. FastAPI serves a prebuilt Vite bundle. A local Capacitor Android plugin delegates to the existing encrypted database and sync implementation. The Settings symbol is a twelve-tooth gear. The sync caption under the Home wordmark has been removed; sync controls remain in Settings on Android.

## Private working copy

Before migration, a complete source/configuration/release snapshot was created under the locally ignored `backups/` directory. It includes a SHA-256 manifest, the original 1.1.0 APK/AAB, local configuration, migration backup and private release key. Build dependency caches were not duplicated. `RESTORE.txt` documents how to use it. Never publish this private snapshot.

Restore into a separate folder, create a Python environment and install its requirements. Do not install an older Android APK over a newer version or uninstall a phone app with unsynced records; use the backup for source rollback and build a higher version code if necessary.

## Verification

- Strict TypeScript and Vite production build.
- React browser flows with synthetic data: auth controls, gear geometry, income/expense saves, decimal amounts, nondefault wallet, editing, wallet creation, search, safe AI failure, core routes, light/dark, Bangla and desktop widths.
- TypeScript transport tests: cookie/revision behavior, conflict propagation, serialized durable native writes and stale write rejection.
- Existing Python finance/cloud and offline ledger tests.
- Android upgrade test: install old app, create encrypted synthetic records, install Capacitor APK in place, and verify old ciphertext remains readable. React login and plugin registration are checked on-device.

Real-account sync and future-version installation on a physical phone require user sign-in and Android installer confirmation. No production financial data was used by these tests. iOS native integration has not been implemented or built.

## Repository cleanup

Obsolete pre-React HTML renderers, navigation scripts, native WebView transport/UI, their retired transport tests, and superseded icons were removed. Shared CSS, current branding, the offline ledger and its compatibility tests remain. A private local copy of removed files is retained under ignored `backups/`.

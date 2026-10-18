# Deploy Hishab to Vercel

The app is cloud-only. Local development and production both use Supabase Auth and account-owned
cloud workspaces. No live ledger is stored on the server filesystem or in browser storage.

## Supabase

1. Run `supabase/migrations/001_hishab.sql` in the project's SQL Editor. This creates workspace
   and encrypted-AI-config tables, owner-only policies and the revision-checked save function.
2. Enable email/password login in Supabase Auth. If email confirmation is enabled, configure
   the production Site URL and confirmation redirects under Auth URL Configuration.
3. Use the project URL and anonymous/publishable API key. Do not supply a service-role key.

## Vercel

1. Import this repository with the FastAPI framework preset. Root `app.py` exports the ASGI app.
   `vercel.json` supplies the function configuration. No frontend build command is needed.
2. Set these **server environment variables** in Vercel:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Your Supabase project HTTPS URL |
   | `SUPABASE_ANON_KEY` | Your project's anonymous/public API key |
   | `HISHAB_SECRET_KEY` | A Fernet key generated once and kept stable |
   | `GOOGLE_API_KEY` | Optional host-provided Google AI key |
   | `HISHAB_OWNER_EMAIL` | Account allowed to use host-provided provider keys; otherwise connect private keys in Settings |
   | `GEMINI_MODEL` | Optional; defaults to `gemini-flash-latest` |

   Generate the secret with:

   ```powershell
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   For an existing installation, copy the same `HISHAB_SECRET_KEY` from your ignored `.env` into Vercel.
   Changing it invalidates browser sessions and prevents decryption of saved provider keys.

3. Deploy and set the resulting HTTPS domain as your Supabase Site URL.
4. Sign in, check `/api/health`, add a small entry, reload, and check the same account on a second device.
5. For the old app's data, use Settings → Import previous Hishab records with `hishab-migration.json`.
   Import is restricted to an empty account, so existing cloud transactions cannot be replaced accidentally.

`.vercelignore` excludes credentials, database backups, migration data, APKs, experiments and ML datasets.
Only runtime app code, assets and schema SQL are required by the web deployment.

## Automatic AI failover

In Settings, connect any providers you have credits for. Lower priority numbers are tried first.
The app reacts to request failures; it does not claim to know every provider's remaining credit balance.
It tries each enabled, connected provider at most once per extraction. Credit failures cool down longer;
rate, network and invalid-output failures temporarily cool down. Cooldown state is an instance-local
optimization; cold starts may retry a provider, but requests still advance automatically on failure.

The text can be sent to more than one connected provider during failover. Extraction never writes
transactions or wallets. Wallet updates always require explicit review, even when transaction quick-save
is enabled. Non-Google adapters are verified with protocol fixtures and require the corresponding API
keys to test live. Model identifiers remain editable because availability depends on provider accounts.

## Mobile use

The manifest, touch icon and asset-only service worker support home-screen installation. In Safari,
use Share → Add to Home Screen. Android browsers may offer Install app. Network access is required
for login, financial records and AI. The service worker never caches account/API responses or exports.
The Android APK now includes encrypted SQLite and offline bookkeeping, with Supabase sync when connected. See `mobile/README.md` for Android installation and signed release builds. The web/PWA remains cloud-only.

## Architecture limits

The versioned workspace is a single JSON document per account. This fits a personal ledger and keeps
wallet, budget and transaction changes atomic. Each save replaces the account document with conflict
checking. If the app grows to very large ledgers or shared household accounts, move the same API to
normalized Supabase tables, paginated queries and server-side aggregates before adding those features.

## Primary references

- [Vercel FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Cohere Chat v2](https://docs.cohere.com/v2/reference/chat)
- [Mistral Chat](https://docs.mistral.ai/api/endpoint/chat)
- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [OpenRouter Chat API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)

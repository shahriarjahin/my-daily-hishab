# Deploy Hishab to Vercel & Supabase

Hishab runs as a FastAPI application backed by Supabase Auth and PostgreSQL. Local development and Vercel production both use account-owned cloud persistence; no ledger data is written to the web server filesystem.

## 1. Supabase Setup

1. Run all SQL migrations in order inside the Supabase SQL Editor:
   - `supabase/migrations/001_hishab.sql` — base workspace/AI config tables, RLS ownership policies, and revision-checked saves
   - `supabase/migrations/002_optional_mfa.sql` — optional authenticator MFA enforcement policies
   - `supabase/migrations/003_relational_schema.sql` — relational ledger schema (`wallets`, `transactions`, `movements`, `budgets`, `goals`, `savings`, `loans`, `regulars`, `categories`) with RLS
   - `supabase/migrations/004_bills_and_shortcuts.sql` — `recurring_bills` and `shortcut_tokens` tables with RLS
2. Enable **Email/Password** (and optional Google/GitHub OAuth or Passkeys) in **Supabase → Authentication**. Configure your Site URL and redirect callbacks under **URL Configuration** (see [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md)).
3. Copy your project URL, public `anon`/publishable key, and pooled PostgreSQL `DATABASE_URL` (Transaction mode, port `6543`). Do **not** deploy a `service_role` key.

## 2. Vercel Deployment

1. Import the repository using the **FastAPI** preset from the repository root (`app.py` exports `app`, `vercel.json` bundles `backend/static/**` and `supabase/migrations/**`).
2. Leave build/output overrides empty — the compiled React bundle is committed under `backend/static/react/`.
3. Configure environment variables in Vercel:

   | Variable | Purpose |
   | --- | --- |
   | `SUPABASE_URL` | Supabase project HTTPS URL |
   | `SUPABASE_ANON_KEY` | Supabase public anon/publishable key |
   | `DATABASE_URL` | Pooled Supabase PostgreSQL URI for fast relational mode |
   | `HISHAB_SECRET_KEY` | Stable Fernet key for session cookies and encrypted provider keys |
   | `HISHAB_PUBLIC_URL` | Production origin (`https://your-app.vercel.app`) for auth callbacks |
   | `GOOGLE_API_KEY` | Optional host-provided Gemini key |
   | `HISHAB_OWNER_EMAIL` | Account permitted to use host-provided keys |
   | `GEMINI_MODEL` | Optional model override (default: `gemini-flash-latest`) |
   | `HISHAB_ENCRYPT_WORKSPACES` | Optional `true`/`false` switch for encrypted cloud snapshot fallback |

   Generate a Fernet secret once:

   ```powershell
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```

   Keep `HISHAB_SECRET_KEY` constant across deployments; rotating it invalidates existing sessions and encrypted API keys.

4. Deploy, verify `/api/health`, sign in, test `/quick` Shortcut entry, and confirm state persists across reload.

## 3. Standalone Shortcut Popup (`/quick`) & Service Worker

- `GET /quick` serves `backend/static/quick.html` + `/static/quick.js` with strict `script-src 'self'` CSP for Apple Shortcuts **Show Web View** or mobile browser shortcuts.
- The asset-only service worker (`/sw.js`) caches static bundle assets only — never API responses, Shortcut endpoints, CSV/PDF exports, or authentication cookies.

## 4. Primary References

- [Vercel FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi)
- [Supabase Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Cohere Chat v2](https://docs.cohere.com/v2/reference/chat)
- [Mistral Chat](https://docs.mistral.ai/api/endpoint/chat)
- [DeepSeek JSON output](https://api-docs.deepseek.com/guides/json_mode/)
- [OpenRouter Chat API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request)

# Account and privacy setup

## Email links and password recovery

In Supabase → Authentication → URL Configuration:

- Site URL: `https://mydailyhishab.vercel.app`
- Redirect URLs: `https://mydailyhishab.vercel.app/auth/callback` and `http://127.0.0.1:8001/auth/callback`.
- Keep the standard confirmation and recovery email templates using `{{ .ConfirmationURL }}`.

Set `HISHAB_PUBLIC_URL=https://mydailyhishab.vercel.app` in the production server environment. In local development leave it unset so the app uses its current origin. Old emails still contain their old localhost URL; request a fresh email after changing the configuration. Password recovery links should be opened in the browser that requested them (PKCE protection).

## Google and GitHub

Enable each provider in Supabase → Authentication → Sign In / Providers, and enter its OAuth client ID and secret there. The app shows only providers enabled in Supabase.

Create a Google OAuth web client or GitHub OAuth app with this authorized callback URL:
`https://osnbpbzjczdqmrqxrfep.supabase.co/auth/v1/callback`

For Google, use `https://mydailyhishab.vercel.app` as the authorized JavaScript origin. Keep provider secrets in Supabase, never in the React app. Browser sign-in uses PKCE with an encrypted HttpOnly verifier cookie. Android currently uses email/password; its Forgot password action opens the hosted recovery screen.

## Encrypting cloud records

The server supports authenticated encryption of the workspace JSON in Supabase. This protects the ledger from someone with database access alone. The app server can decrypt it for sync and AI; this is not end-to-end encryption. Account identifiers, revisions and timestamps remain visible.

1. Back up existing records and preserve the existing `HISHAB_SECRET_KEY` securely. Losing it loses access to encrypted records and AI credentials.
2. Deploy this server and upgrade Android installations to the matching build, which syncs through `/api/cloud/workspace`. Older APKs sync directly with Supabase and cannot read encrypted workspaces.
3. Set `HISHAB_ENCRYPT_WORKSPACES=true` in the server environment and redeploy.
4. Each account's existing plaintext workspace becomes encrypted on its next successful save. This is not a bulk migration; accounts that have not saved remain plaintext. Old database backups may still contain plaintext according to their retention policy.

The switch defaults to false for a safe staged rollout. An already encrypted workspace stays encrypted on future writes even if the switch is disabled. User identity is bound inside the encrypted payload; the existing Supabase ownership policies and revision conflict checks still apply. Encryption is not enabled on your hosted deployment merely by changing repository code.

## Optional AI and currencies

AI is off by default. Enable it in Settings before connecting providers or sending records to AI. Currency changes the unit shown throughout the app; it does not convert existing balances or support separate exchange rates per wallet.

## Optional MFA and passkeys

MFA enrollment and passkeys are optional, per account. Email/password remains available. Once an account has a verified second factor, Hishab requires verification before cloud records are loaded. Configure MFA from Account security. Keep the authenticator setup key safely; removing a verified factor requires a verified session.

Apply `supabase/migrations/002_optional_mfa.sql` after migration 001. This adds restrictive database policies as well as the app server checks, without requiring MFA for users who have not opted in. Deploy compatible web and Android clients before enabling MFA on accounts using older clients.

Passkeys remain experimental in Supabase. Configure Authentication → Passkeys with display name Hishab, relying party ID `mydailyhishab.vercel.app`, and origin `https://mydailyhishab.vercel.app`. Do not change an existing RP ID without considering registered passkeys: changing it invalidates those credentials. Production passkeys cannot be tested from localhost under that RP ID.

Android uses Credential Manager, with the same private release signing key. Deploy the public `/.well-known/assetlinks.json` endpoint and add this Android origin to the allowed Supabase origins:

`android:apk-key-hash:D8HNmgvs5UvKq_BFFqQcnHte8n1GIndxqsN43wPAZtI`

Real passkey registration and MFA enrollment must be completed by the account owner on their device. Test code uses synthetic credentials; it never creates a passkey or changes MFA on a real account.

## Android offline mode and onboarding

The Android welcome screen asks for a name and offers offline use or cloud sign-in. Web remains cloud-only. Offline data stays in the app's encrypted SQLite workspace and is separate from cloud accounts. Switching mode preserves it and never automatically uploads or merges it. Choose offline again to reopen it; export a backup from Data & app before transferring records manually. Offline mode has no AI, account security, automatic update checks, or sync traffic. The APK bundles the interface, so it can start without an internet connection.

New users on both web and Android are asked for their name before entering their workspace. Empty accounts receive a skippable six-step quick start. Completion is saved with the workspace; it can be replayed from Settings.

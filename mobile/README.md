# Mobile delivery

The current deliverable is a responsive, installable web app. Deploy the same FastAPI app on HTTPS
to use it daily on iPhone or Android. No native package or app-store submission has been created.

For a future native app, use Supabase's iOS/Android authentication SDK to sign in, then send its
access token as `Authorization: Bearer <access_token>` to the hosted Hishab API. `/api/state` returns
the account workspace and revision. Send `X-Workspace-Revision` on mutation requests to protect
against stale screens. A `409` means reload and let the user retry their change.

Keep all provider API keys and the encryption secret on the backend. The native client sends typed
text to `/api/extract`, displays editable transactions or wallet balances, and saves only after review.
The existing JSON endpoints are independent of the web interface; API schemas are available at `/docs`.

Native calls must use HTTPS and a verified Supabase JWT. Ordinary native HTTP clients do not need
browser CORS. A packaged WebView should load the deployed same-origin web app; a separately hosted
web client would need an explicit, narrow origin policy added to the backend.

Passwords are managed by Supabase Auth. Do not bundle the AI keys, server encryption key, service-role
key, database backups or development `.env` in an iOS or Android package.

# Hishab for Android

Android 8.0 or later; targets Android 16 (API 36). Package: `com.digitxbd.hishab`. The universal APK shares the website's UI, including Bangla, wallet brands and Liquid Glass. It contains its own encrypted SQLite database. Manual finance operations work without the Python server. Android System WebView provides the rendering engine.

## Install and use

1. Copy `mobile/dist/hishab-1.0.0-release.apk` to your phone and open it. Android may ask you to allow installation from your browser or file manager.
2. Sign in to your existing Supabase account while connected. Your cloud workspace downloads automatically. No financial records or login credentials are preloaded in the APK.
3. Record income, expenses, transfers, budgets, categories, savings, loans and regulars offline. Changes commit to the phone database before network requests.
4. Sync runs after changes, on resume, roughly every minute while open, and periodically in Android's background scheduler when a network is available. Background timing depends on Android battery restrictions. Settings → Sync & device → Sync now is also available.
5. AI extraction, receipts, advisor and AI planning require internet and your deployed backend: `https://mydailyhishab.vercel.app`. Provider keys stay on that backend. Review suggestions before applying them.

If both phone and cloud have changed, automatic sync stops. Choose a **complete workspace copy** in Settings: cloud or phone. This is explicit conflict resolution, not record-by-record merging. Both original versions are saved encrypted in Recovery copies and can be exported. Choosing the phone copy replaces the cloud snapshot after a revision check. Choosing cloud replaces the active device snapshot. A newer cloud edit triggers another conflict instead of being overwritten.

## Device storage

`Store.java` manages app-private `hishab.sqlite`. Workspace and recovery rows use AES-GCM encryption with an Android Keystore key. Access/refresh tokens are encrypted separately; passwords are never saved. Android backup is disabled because the device key cannot be restored on another phone. Signing out removes the session; encrypted account-specific records remain for the next sign-in. Reinstalling or clearing app data removes local records. Sync pending changes or export a backup first.

Only APK-owned assets run in the WebView. Cleartext HTTP, remote pages inside the WebView, frames, file access and remote JavaScript are blocked. Public links open externally. The APK contains only Supabase's public URL/anon key and the backend URL; existing Supabase account policies protect cloud data. No service-role key, server encryption key or AI key is bundled.

## Rebuild

This computer has official Google Android SDK tools, Microsoft OpenJDK 17 and Gradle 8.11.1 under ignored `mobile/.tools`. The owner authorized accepting the SDK license.

```powershell
.\.venv\Scripts\python.exe mobile/build.py
```

On a new Windows machine, install repository Python requirements, run `python mobile/bootstrap.py`, accept Google's SDK license, and install `platforms;android-36`, `build-tools;36.0.0` and `platform-tools` using sdkmanager. Existing tools can be selected using `ANDROID_HOME` and `JAVA_HOME`.

Build variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `HISHAB_BACKEND_URL`. Local builds can read the ignored `.env` or `mobile/mobile-config.json`. A strict asset allowlist packages an empty workspace template, never developer account data.

## Release signing

The first build generated `mobile/release-keys/hishab-release.p12` and `mobile/release-keys/signing.properties`. **Back up this folder privately.** The properties file contains its password. Both files are excluded from Git. Direct APK updates need this same key and a higher version code. Losing the key prevents installing future signed updates over this app.

Update `mobile/version.json` (`code` must increase) for future releases. Outputs under `mobile/dist/` include a signed installable APK, an Android App Bundle (AAB), and SHA-256 checksums. Google Play distribution additionally needs your developer account, listing, privacy policy, data-safety declarations and store testing/review. No store release is published automatically.

## GitHub release builds

`.github/workflows/android-release.yml` supports manual runs or tags such as `android-v1.0.1`. Artifacts are attached to the workflow run; no public release is published automatically.

Repository variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (public anon/publishable key)
- `HISHAB_BACKEND_URL`

Repository secrets, using the **same local release key**:

- `ANDROID_KEYSTORE_BASE64`: Base64 contents of `hishab-release.p12`
- `ANDROID_KEYSTORE_PASSWORD`: `storePassword` from signing.properties
- `ANDROID_KEY_PASSWORD`: `keyPassword` from signing.properties

Alias: `hishab`. Never put these signing values in source files, issues or chat. CI fails if the release key is missing rather than generating an incompatible identity. Increase the version in `mobile/version.json` before tagging an update.

## Validation

```powershell
node --test mobile/test_ledger.cjs mobile/test_transport.cjs
.\.venv\Scripts\python.exe -m unittest mobile.test_compatibility -v
```

Compatibility tests import a synthetic Android workspace into the Python database, validate the shared cloud schema, and compare all planning fields and wallet balances with the web implementation. Release builds run Android vital lint and signing validation. Android 15 emulator verification passed 13 native checks covering encryption, persistence, account isolation, stale acknowledgments, conflict recovery and the packaged login screen. The JavaScript tests pass 19 ledger/transport checks, plus the Python compatibility check. Real-account login and cross-device sync still require sign-in on a phone; automated tests never use production credentials or records.

The instrumented checks are in `android/app/src/androidTest`. Build `assembleReleaseAndroidTest`, install both APKs on an emulator, then run `adb shell am instrument -w com.digitxbd.hishab.test/com.digitxbd.hishab.DatabaseChecks`. These checks use isolated synthetic accounts and make no authenticated production requests.

The API 36 target follows [Google Play's current target API requirement](https://developer.android.com/google/play/requirements/target-sdk). SDK compatibility uses [Android Gradle Plugin 8.10.1](https://developer.android.com/build/releases/agp-8-10-0-release-notes).

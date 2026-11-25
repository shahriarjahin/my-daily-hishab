# Upload Hishab to Google Play

Upload the **Android App Bundle (`.aab`)**, not the installable `.apk`. Current version target: `mobile/version.json` (`com.digitxbd.hishab`, minimum Android 8.0 / API 26, target Android 16 / API 36).

## 1. Developer Account & Store Listing

1. Open [Google Play Console](https://play.google.com/console/signup) and complete account/device verification.
2. Create the **Hishab** app listing under **Finance**, prepare store icons (`512×512`), feature graphic (`1024×500`), phone screenshots using synthetic demo data, support email, and a public privacy policy URL covering cloud sync, Keystore SQLite encryption, account deletion, and optional AI providers.
3. Implement and link an external + in-app account deletion request flow matching Google Play's [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

## 2. Store Build vs. Direct GitHub Release Build

- Direct GitHub builds (`mobile/build.py`) include the verified GitHub APK self-updater and `REQUEST_INSTALL_PACKAGES` permission.
- **Before submitting to Google Play**, remove `AppUpdater` checks and `REQUEST_INSTALL_PACKAGES` from the Play flavor/manifest so updates are delivered exclusively through Google Play.
- Keep `mobile/release-keys/` backed up privately. Enroll in [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756) using matching signing identity if updates must install seamlessly over sideloaded builds.

## 3. Testing & Release Cadence

1. Upload `.aab` to **Internal testing** and verify sign-in, offline sync, conflict recovery, widgets, shortcuts, Quick Tile, Share Sheet SMS parsing, and PDF export on physical Android hardware.
2. Complete closed testing requirements if publishing under a new personal developer account, then submit for Production review.
3. For every subsequent update, increment both `name` and `code` in `mobile/version.json` and run `python mobile/build.py`.

References: [Play App Creation Guide](https://support.google.com/googleplay/android-developer/answer/9859152) · [Android Target API Requirements](https://developer.android.com/google/play/requirements/target-sdk)

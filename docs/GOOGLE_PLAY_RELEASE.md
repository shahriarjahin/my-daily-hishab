# Upload Hishab to Google Play

Upload the **Android App Bundle (.aab)**, not the installable APK. Current direct-distribution build: `mobile/dist/hishab-2.0.0-release.aab`; package `com.digitxbd.hishab`; version name `2.0.0`, version code `5`; minimum Android 8; target Android 16/API 36.

## 1. Open your developer account

Use [Google Play Console](https://play.google.com/console/signup). Choose Personal if publishing as yourself, or Organization if publishing as a registered business. Complete identity/contact verification and pay Google's one-time US$25 registration fee. New personal accounts may also require Android-device verification through the Play Console app. Google provides the current steps in [Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435).

## 2. Complete these app requirements before production

The binary builds and installs, but these publishing requirements are **not yet implemented or completed**:

- A public privacy-policy page, linked in both the app and Play Console. Describe account/email information, personal financial entries, encrypted phone storage, Supabase sync, retention/deletion, and which AI providers receive submitted text, account summaries and receipt images.
- Account deletion: the app allows account creation, so provide an accessible in-app deletion/request flow and an external web page where users can request account/data deletion. Sign out is not account deletion. Define what happens to synced data and device copies, and disclose any required retention.
- A dedicated reviewer/test account containing synthetic records, with reliable access instructions. Do not give reviewers your personal finance account. Verify login, email confirmation, sync, offline edits and AI using that test account.
- Confirm provider limits and payment arrangements before public distribution. The shared backend and configured AI providers must remain available to your users.

See Google's [User Data and privacy policy requirements](https://support.google.com/googleplay/android-developer/answer/18258653) and [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111). Complete the Play Console Data safety answers according to actual data flows; do not claim that no data is collected or that everything stays on-device when sync/AI is enabled.

## 3. Create the app and listing

In Play Console choose **Create app**. Suggested name: Hishab. Choose App, your default language, and free/paid distribution. Accept the required declarations yourself. Select the Finance category if it accurately describes the listing.

Prepare the app title, short/full descriptions, support email, privacy-policy URL, a 512×512 store icon, 1024×500 feature graphic, and at least two clear phone screenshots using synthetic/demo data. The existing 512px PNG is a design source; prepare the store icon to Google's specifications before uploading. Google lists the current rules under [Preview assets](https://support.google.com/googleplay/android-developer/answer/9866151).

## 4. Complete App content

Follow every incomplete item in the dashboard: privacy policy, App access, ads declaration, content rating, target audience, Data safety, account deletion and any financial-features declaration shown for this finance app. Describe bookkeeping functionality accurately; it does not execute bank payments, lend money or provide investment products. Supply reviewer login details in **App access**. Indicate ads only if ads actually exist (the current app contains no ad SDK).

## 5. Upload to Internal testing first

Open **Test and release → Testing → Internal testing → Create new release**. Set up Play App Signing, upload `hishab-1.0.1-release.aab`, add release notes, resolve validation warnings and roll out to your chosen testers. Test the Play-installed version on actual phones, including sign-in, offline entries, reconnect sync, conflicting changes, receipt selection and backups.

Keep `mobile/release-keys/` private and backed up. The current APK is signed with that local key. If you want Play-installed builds to update directly over existing sideloaded APKs, configure the same app-signing identity during initial Play App Signing enrollment. If Google generates a different app-signing key, Play and sideloaded installations will not update over each other without uninstalling; sync/export pending records first. The upload key and Play app-signing key are distinct roles. Follow [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

## 6. Complete closed testing if required

For personal developer accounts created after November 13, 2023, Google currently requires at least **12 testers continuously opted in for 14 days** in a closed test before applying for production access. Internal testing alone does not satisfy this requirement. Answer the production-access questions about testing and readiness. See [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

## 7. Request production publication

After testing requirements and dashboard checks are complete, create a Production release, choose distribution countries, upload/promote the tested bundle, review the release and submit it for Google's review. Approval is decided by Google. No Play Console upload or publication has been performed by Codex.

## Future updates

Increase both values in `mobile/version.json`, build again with `python mobile/build.py`, and upload the new AAB. Preserve `com.digitxbd.hishab`, the signing identity and your Play Console account. Never reuse a version code already uploaded. The repository includes a manual/tag-triggered Android build workflow; configure the signing secrets and public deployment variables as described in `mobile/README.md` before using it.

Official starting point: [Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152). The API 36 target follows [Google Play's current target API requirement](https://developer.android.com/google/play/requirements/target-sdk).


The 1.1.0 GitHub build has a direct APK updater and REQUEST_INSTALL_PACKAGES permission. Prepare a separate Play build without that updater/permission before Play submission; do not submit the GitHub build unchanged.

# Optional on-device AI

Android 2.3.0 introduces CPU-based text extraction using a separate, optional model download. Web AI remains provider-based. No model weights are bundled in the APK or uploaded with the source repository.

## Use

1. Open Settings → General & Appearance → Offline AI.
2. Download the approximately 630 MB model, preferably over Wi-Fi. Keep the app open until it finishes.
3. Turn on Use on-device AI.
4. Open Home → Type with AI, select the wallet, and enter a short English, Bangla or Banglish message.
5. Review every proposed amount, category, type and wallet, then save.

This works in Android's offline workspace and in its cloud workspace. In a cloud workspace, saving joins the existing sync queue; model inference itself makes no network request. Offline AI never silently falls back to a cloud provider. Disable it to resume configured cloud extraction.

The model runs on 64-bit ARM or x86 devices with at least 3 GB physical RAM; storage checks require roughly 900 MB free for installation. Real-world speed depends on the phone. The first request loads the model. Input is limited to 1,000 characters and a 2,048-token context; generation is bounded and fails without saving if incomplete or invalid.

## Supported scope

- Text income and expenses in BDT, using the explicitly selected wallet.
- App-side mapping to active expense/income categories. The model cannot create a wallet, select an arbitrary wallet ID or alter balances directly.
- Mandatory editable review, regardless of the cloud quick-save preference.
- Loan/transfer keywords and model loan categories are rejected with directions to the dedicated screens. These are not recorded as ordinary income or expenses.

Receipt images, wallet-balance setup, advice and automatic planning are not handled by this model. Use their existing manual or cloud flows. It can misunderstand text; review is required. Removing the model does not remove financial records. Downloads cancelled or failing integrity checks do not become available for inference.

## Model and runtime provenance

- Model: [Hishab Qwen3.5 0.8B JSON full v10, Q6_K](https://huggingface.co/ryuma007/hishab-qwen3.5-0.8b-json-full-v10-GGUF), Apache-2.0, by its original publisher. The app uses that publisher's model; it does not claim to have trained a new model.
- Revision, URL, exact byte count and SHA-256 are pinned in `mobile/offline-ai.json`. Installation requires a matching checksum. Redirects are restricted to HTTPS Hugging Face hosts.
- Engine: [llama.cpp](https://github.com/ggml-org/llama.cpp), MIT, commit `781dbc5ac98921dbdb5e5b2ec5b7a50960e937d4`. `scripts/prepare_offline_ai.py` verifies the source archive before extraction. Native CMake builds are statically linked into the app's JNI library for ARM64 and x86_64.
- Each request gets a fresh model context. Prompts and model outputs are not logged; the context is freed after generation. Disabling/removing the model frees cached weights. The model file is in app-private storage excluded from Android backup.

Original model-card benchmark numbers describe synthetic training/evaluation datasets, not a measured accuracy guarantee for this app. The Android instrumentation suite uses synthetic examples to check integration; physical-phone evaluation on a broader, labelled app-specific dataset is still needed before making accuracy or speed claims.

Initial isolated x86_64 emulator verification passed 46 native checks with Wi-Fi and mobile data disabled. The model returned the expected amounts for `Lunch 250 tk` (250), `70 tk cash paisi` (70) and `চা ২০ টাকা` (20), taking approximately 11–13 seconds per sample. Inference did not change the workspace revision. These three samples are smoke checks, not an accuracy benchmark or a prediction of physical-device speed.

## Build

The existing Android build additionally requires NDK `28.2.13676358` and CMake `3.22.1`. `python mobile/build.py` prepares the pinned source and model metadata, compiles the native engine, and builds the signed APK/AAB. The one-time model download is performed by the user, not the build.

To run the optional native inference checks, place the pinned model at the test app's external-files location as `offline-test-model.gguf`, install the app and release AndroidTest APK, disable emulator networking, and run:

```text
adb shell am instrument -w -e offlineAi true com.digitxbd.hishab.test/com.digitxbd.hishab.DatabaseChecks
```

These checks use the isolated emulator's offline workspace and never access real cloud accounts.

## Local ML maintenance

The separate, ignored `ml/` research folder remains on the PC. The following local changes were made with originals preserved under ignored `backups/ml-before-offline-ai/`:

- `update_system_prompt.py`: explicit CLI, import-safe functions, UTF-8, preserved original backup and atomic replacement.
- `push_dataset.py`, `push_model.py`, `gguf.py`: explicit upload destination, private by default; `--public` is required to request public publication. No uploads or training runs were started.
- `probe_gguf.py`: explicit official `llama-cli` support; no hard-coded assumption that a sibling kiln executable exists. Legacy kiln is available only when explicitly supplied.

The shipped TypeScript adapter handles the app-specific schema. This avoids changing the trained model's expected schema or training prompt without retraining. Existing benchmark reports remain historical, with their provenance preserved.

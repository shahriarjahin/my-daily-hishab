# Optional On-Device Android AI

Android builds include optional CPU-based text extraction using a separate model download. Web AI remains provider-based; no model weights are bundled in the APK or Git repository.

## Setup & Usage

1. Open **Settings → General & Appearance → Offline AI**.
2. Download the pinned ~630 MB GGUF model over Wi-Fi and wait for checksum verification to complete.
3. Toggle **Use on-device AI**.
4. Open **Add entry → Type with AI**, choose a wallet, and type English, Bangla, or Banglish transaction text.
5. Review every suggested amount, category, type, and wallet before saving.

Works in both Android offline workspaces and cloud workspaces (without sending inference prompts over the network). Requires a 64-bit device (ARM64 or x86_64) with at least 3 GB RAM and ~900 MB free internal storage.

## Supported Scope & Safety

- Extracts BDT income/expenses using existing active categories; cannot create wallets or change balances without user review.
- Rejects loan/transfer prompts with guidance to the dedicated transfer and loan screens so balances stay consistent.
- Receipt images, advisor chat, and AI budget auto-plan continue to use configured cloud providers when enabled.
- Contexts are isolated and freed after each request; removing the model deletes weights from app-private storage without touching financial records.

## Model & Engine Provenance

- **Model:** [Hishab Qwen3.5 0.8B JSON full v10 (Q6_K GGUF)](https://huggingface.co/ryuma007/hishab-qwen3.5-0.8b-json-full-v10-GGUF) (Apache-2.0); revision URL, byte size, and SHA-256 checksum pinned in `mobile/offline-ai.json`.
- **Engine:** [llama.cpp](https://github.com/ggml-org/llama.cpp) (MIT, commit `781dbc5ac98921dbdb5e5b2ec5b7a50960e937d4`), statically built via NDK `28.2.13676358` + CMake `3.22.1` inside `mobile/build.py`.

## Emulator Verification

With the pinned model copied to app external files as `offline-test-model.gguf` and emulator networking disabled:

```text
adb shell am instrument -w -e offlineAi true com.digitxbd.hishab.test/com.digitxbd.hishab.DatabaseChecks
```

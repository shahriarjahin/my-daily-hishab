import { useEffect, useState } from "react";
import { device } from "../api";
import { useStore } from "../context";
import type { OfflineAiStatus } from "../offlineAi";
import { Button, Card, ErrorMessage, Modal } from "./UI";

export function OfflineAiSettings() {
  const { t, refresh } = useStore();
  const [status, setStatus] = useState<OfflineAiStatus | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState(false);
  const load = () =>
    device<OfflineAiStatus>("offline-ai")
      .then(setStatus)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => void load(), 1000);
    return () => clearInterval(timer);
  }, [working]);
  const run = async (action: string, enabled?: boolean) => {
    setWorking(true);
    setError("");
    try {
      await device("offline-ai", { action, enabled });
      await load();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  return (
    <Card className="section-gap">
      <h2>{t("Offline AI")}</h2>
      <p className="form-hint">
        {t(
          "Optional text entry in English, বাংলা or Banglish. Runs on this phone after a one-time model download.",
        )}
      </p>
      {status && (
        <>
          <p>
            {status.name} · {Math.ceil(status.model_bytes / 1000000)} MB
          </p>
          {!status.supported ? (
            <p className="form-hint">
              {t("Offline AI requires a 64-bit phone with at least 3 GB RAM.")}
            </p>
          ) : (
            <>
              {!status.ready && (
                <Button disabled={working} onClick={() => void run("download")}>
                  {t(working ? "Downloading model…" : "Download model")}
                </Button>
              )}
              {working && !status.ready && (
                <>
                  <progress
                    max={status.model_bytes}
                    value={status.downloaded_bytes}
                    aria-label={t("Model download")}
                  />
                  <p>
                    {Math.round(
                      (status.downloaded_bytes / status.model_bytes) * 100,
                    )}
                    %
                  </p>
                  <Button
                    secondary
                    onClick={() =>
                      void device("offline-ai", { action: "cancel" })
                    }
                  >
                    {t("Cancel")}
                  </Button>
                </>
              )}
              {status.ready && (
                <>
                  <label className="settings-row">
                    {t("Use on-device AI")}
                    <input
                      type="checkbox"
                      checked={status.enabled}
                      disabled={working}
                      onChange={(e) => void run("enable", e.target.checked)}
                    />
                  </label>
                  <Button
                    secondary
                    disabled={working}
                    onClick={() => setRemove(true)}
                  >
                    {t("Remove model")}
                  </Button>
                </>
              )}
            </>
          )}
          <p className="form-hint">
            {t(
              "Text only · BDT · Always review before saving. Loans, transfers, receipts and advice use their existing screens.",
            )}
          </p>
          <a
            className="text-button"
            href={status.source}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Model source")} · {status.license}
          </a>
        </>
      )}
      <ErrorMessage message={error} />
      {remove && (
        <Modal title="Remove model" close={() => setRemove(false)}>
          <p>
            {t(
              "Remove the downloaded model? Your financial records will stay unchanged.",
            )}
          </p>
          <Button
            onClick={() => {
              setRemove(false);
              void run("remove");
            }}
          >
            {t("Remove model")}
          </Button>
        </Modal>
      )}
    </Card>
  );
}

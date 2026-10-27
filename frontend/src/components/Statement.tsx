import { useState } from "react";
import { useStore } from "../context";
import { day } from "../utils";
import { device, native } from "../api";
import { buildStatement } from "../statement";
import { Button, ErrorMessage, Modal } from "./UI";

export function Statement({ close }: { close: () => void }) {
  const { state, t } = useStore();
  const today = day();
  const [period, setPeriod] = useState("1"),
    [wallet, setWallet] = useState("");
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="PDF statement" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (native) {
              await device(
                "statement",
                buildStatement(state!, {
                  period,
                  start: from,
                  end: to,
                  wallet_id: wallet ? Number(wallet) : undefined,
                }),
              );
              return;
            }
            const query = new URLSearchParams({ period });
            if (wallet) query.set("wallet_id", wallet);
            if (period === "custom") {
              query.set("start", from);
              query.set("end", to);
            }
            const response = await fetch("/api/statements/pdf?" + query, {
              credentials: "same-origin",
            });
            if (!response.ok) {
              const body = await response.json().catch(() => ({}));
              throw new Error(
                typeof body.detail === "string"
                  ? body.detail
                  : "Statement generation failed. Try again.",
              );
            }
            if (
              !response.headers.get("content-type")?.includes("application/pdf")
            )
              throw new Error("Statement generation failed. Try again.");
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.download =
              response.headers
                .get("content-disposition")
                ?.match(/filename="([^"]+)"/)?.[1] || "hishab-statement.pdf";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label className="form-field">
            {t("Statement period")}
            <select
              aria-label={t("Statement period")}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {[
                ["1", "Past month"],
                ["3", "Past 3 months"],
                ["6", "Past 6 months"],
                ["12", "Past year"],
                ["custom", "Custom dates"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {t(l)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            {t("Wallet")}
            <select
              aria-label={t("Wallet")}
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            >
              <option value="">{t("All wallets")}</option>
              {state!.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {period === "custom" && (
            <>
              <label className="form-field">
                {t("From")}
                <input
                  aria-label={t("From")}
                  type="date"
                  required
                  max={to}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="form-field">
                {t("To")}
                <input
                  aria-label={t("To")}
                  type="date"
                  required
                  min={from}
                  max={today}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button secondary onClick={close}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {t(busy ? "Generating…" : "Download PDF")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

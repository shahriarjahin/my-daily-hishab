import { useMemo, useState } from "react";
import { useStore } from "../context";
import { Modal, ErrorMessage } from "./UI";
import { Icon } from "./Icon";
import { day, dated } from "../utils";
import type { EntryType, QuickTemplate } from "../types";
import { parseQuickOrSms, suggestCategory, type ParsedSmsResult } from "../smsParser";
import {
  deriveQuickTemplates,
  getLastWalletId,
  setLastWalletId,
  togglePinnedTemplate,
} from "../smartEntry";

export function EntrySheet({
  close,
  transfer,
  smart,
}: {
  close: () => void;
  transfer: () => void;
  smart: () => void;
}) {
  const { state: s, mutate, busy, t, notify, money, language } = useStore();
  const defaultWallet = useMemo(() => {
    const saved = getLastWalletId(s!.wallets[0]?.id || 0);
    return s!.wallets.some((w) => w.id === saved) ? saved : s!.wallets[0]?.id || 0;
  }, [s]);

  const [type, setType] = useState<EntryType>("expense"),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState(""),
    [manualCategory, setManualCategory] = useState(false),
    [wallet, setWallet] = useState(defaultWallet),
    [date, setDate] = useState(day()),
    [note, setNote] = useState(""),
    [quantity, setQuantity] = useState(""),
    [unit, setUnit] = useState(""),
    [smsOpen, setSmsOpen] = useState(false),
    [smsText, setSmsText] = useState(""),
    [pendingTransfer, setPendingTransfer] = useState<ParsedSmsResult | null>(null),
    [listening, setListening] = useState(false),
    [splitFriends, setSplitFriends] = useState(""),
    [includeSelf, setIncludeSelf] = useState(true),
    [pinnedVersion, setPinnedVersion] = useState(0),
    [error, setError] = useState("");

  const templates = useMemo(
    () => deriveQuickTemplates(s!.transactions),
    [s!.transactions, pinnedVersion],
  );

  const categories = s!.category_details.filter(
    (c) =>
      !c.archived &&
      (type === "income"
        ? c.bucket === "income"
        : ["needs", "wants"].includes(c.bucket)),
  );
  const chosen = categories.some((c) => c.name === category)
    ? category
    : categories[0]?.name || "";

  const parsedParties = splitFriends
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const numericAmount = Number(amount);
  const validSplitTotal = Number.isFinite(numericAmount) && numericAmount > 0 && parsedParties.length > 0;
  const splitCounts = parsedParties.length + (includeSelf ? 1 : 0);
  const rawEach = validSplitTotal && splitCounts > 0 ? Math.floor((numericAmount * 100) / splitCounts) / 100 : 0;
  const friendsTotal = validSplitTotal ? Math.round(rawEach * parsedParties.length * 100) / 100 : 0;
  const mySplitShare = validSplitTotal ? Math.round((numericAmount - friendsTotal) * 100) / 100 : 0;

  const applyParsedInput = (raw: string) => {
    const parsed = parseQuickOrSms(raw, s!.wallets, s!.category_details, wallet);
    if (!parsed) {
      setNote(raw.slice(0, 240));
      const guessed = suggestCategory(raw, type, s!.category_details);
      if (guessed) setCategory(guessed);
      return false;
    }
    if (parsed.kind === "transfer") {
      setPendingTransfer(parsed);
      setSmsOpen(false);
      return true;
    }
    setPendingTransfer(null);
    if (parsed.type) setType(parsed.type);
    setAmount(String(parsed.amount));
    if (parsed.category) {
      setCategory(parsed.category);
      setManualCategory(true);
    }
    if (parsed.walletId) setWallet(parsed.walletId);
    setNote(parsed.description);
    setSmsOpen(false);
    return true;
  };

  const quickLogTemplate = async (tpl: QuickTemplate) => {
    setError("");
    try {
      setLastWalletId(tpl.wallet_id);
      const res = (await mutate("/transactions", "POST", {
        transactions: [
          {
            amount: tpl.amount,
            type: tpl.type,
            category: tpl.category,
            wallet_id: tpl.wallet_id,
            date: dated(day()),
            description: tpl.description,
            quantity: null,
            unit: "",
          },
        ],
      })) as { queued?: boolean } | undefined;
      notify(res?.queued ? "Saved offline" : "Saved");
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startVoice = () => {
    setError("");
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) {
      setError(t("Voice input is not supported in this browser."));
      return;
    }
    try {
      const rec = new Speech();
      rec.lang = language === "bn" ? "bn-BD" : "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      setListening(true);
      rec.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || "";
        if (transcript) applyParsedInput(transcript);
      };
      rec.onerror = () => {
        setListening(false);
        setError(t("Could not capture voice input."));
      };
      rec.onend = () => setListening(false);
      rec.start();
    } catch {
      setListening(false);
      setError(t("Voice input is not supported in this browser."));
    }
  };

  const handlePasteSms = async () => {
    setError("");
    if (navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && parseQuickOrSms(clip, s!.wallets, s!.category_details, wallet)) {
          applyParsedInput(clip);
          notify("Parsed SMS");
          return;
        }
      } catch {}
    }
    setSmsOpen((v) => !v);
  };

  return (
    <Modal title="Add entry" close={close} className="money-sheet">
      <div className="modern-segment entry-types">
        {(["expense", "income"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setType(v);
              setManualCategory(false);
            }}
            className={type === v ? "active" : ""}
          >
            {t(v === "expense" ? "Expense" : "Income")}
          </button>
        ))}
        <button type="button" onClick={transfer}>{t("Transfer")}</button>
      </div>

      {templates.length > 0 && (
        <div className="quick-templates" aria-label={t("Quick entries")}>
          {templates.map((tpl) => (
            <button
              type="button"
              key={tpl.key}
              disabled={busy}
              className={"chip quick-chip " + (tpl.pinned ? "pinned" : "")}
              onClick={() => void quickLogTemplate(tpl)}
              title={t("Tap to log immediately")}
            >
              <span>{tpl.description}</span>
              <strong>{money(tpl.amount)}</strong>
            </button>
          ))}
        </div>
      )}

      {pendingTransfer && (
        <div className="sms-transfer-banner">
          <div>
            <strong>{pendingTransfer.description}</strong>
            <small>
              {money(pendingTransfer.amount)}
              {pendingTransfer.fee ? ` + ${money(pendingTransfer.fee)} ${t("Fee")}` : ""}
            </small>
          </div>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={async () => {
              setError("");
              try {
                const res = (await mutate("/transfers", "POST", {
                  from_wallet_id: pendingTransfer.fromWalletId,
                  to_wallet_id: pendingTransfer.toWalletId,
                  amount: pendingTransfer.amount,
                  fee: pendingTransfer.fee || 0,
                  description: pendingTransfer.description,
                })) as { queued?: boolean } | undefined;
                notify(res?.queued ? "Saved offline" : "Saved");
                close();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("Save transfer")}
          </button>
        </div>
      )}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
              throw new Error("Enter a positive amount with at most two decimals.");
            setLastWalletId(wallet);
            if (type === "expense" && parsedParties.length > 0) {
              const shares = parsedParties.map((party) => ({ party, amount: rawEach }));
              if (!shares.every((x) => x.amount > 0))
                throw new Error("Enter a larger amount to split.");
              const res = (await mutate("/splits", "POST", {
                description: note.trim() || chosen,
                category: chosen,
                wallet_id: wallet,
                date: dated(date),
                my_share: mySplitShare,
                shares,
              })) as { queued?: boolean } | undefined;
              notify(res?.queued ? "Saved offline" : "Saved");
              close();
              return;
            }
            const res = (await mutate("/transactions", "POST", {
              transactions: [
                {
                  amount: Number(amount),
                  type,
                  category: chosen,
                  wallet_id: wallet,
                  date: dated(date),
                  description: note.trim() || chosen,
                  quantity: quantity ? Number(quantity) : null,
                  unit,
                },
              ],
            })) as { queued?: boolean } | undefined;
            notify(res?.queued ? "Saved offline" : "Saved");
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="pad-value">
          <span>
            {
              new Intl.NumberFormat("en", {
                style: "currency",
                currency: s!.settings.currency || "BDT",
                currencyDisplay: "narrowSymbol",
              })
                .formatToParts(0)
                .find((x) => x.type === "currency")?.value
            }
          </span>
          <input
            name="amount"
            aria-label={t("Amount")}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
          />
        </label>

        <div className="entry-assists">
          <button type="button" onClick={handlePasteSms}>
            <Icon name="sms" />
            {t("Paste SMS")}
          </button>
          <button type="button" onClick={startVoice} className={listening ? "active" : ""}>
            <Icon name="mic" />
            {listening ? t("Listening...") : t("Voice")}
          </button>
          {s!.settings.ai_enabled && (
            <button type="button" onClick={smart}>
              <Icon name="spark" />
              {t("Type with AI")}
            </button>
          )}
        </div>

        {smsOpen && (
          <div className="sms-paste-box">
            <textarea
              rows={2}
              placeholder={t("Paste bKash, Nagad or bank SMS...")}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (!applyParsedInput(smsText)) {
                  setError(t("Could not detect transaction details in that text."));
                } else {
                  notify("Parsed SMS");
                }
              }}
            >
              {t("Parse")}
            </button>
          </div>
        )}

        <span className="modern-label">{t("Category")}</span>
        <div className="pad-categories">
          {categories.slice(0, 6).map((c) => (
            <button
              type="button"
              key={c.id}
              className={"chip " + (chosen === c.name ? "active" : "")}
              onClick={() => {
                setCategory(c.name);
                setManualCategory(true);
              }}
            >
              {t(c.name)}
            </button>
          ))}
          {categories.length > 6 && (
            <select
              aria-label={t("All categories")}
              value={chosen}
              onChange={(e) => {
                setCategory(e.target.value);
                setManualCategory(true);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          )}
        </div>
        {type === "expense" && chosen === "Food" && (
          <div className="pad-categories section-gap" aria-label={t("Meal")}>
            {["Breakfast", "Lunch", "Dinner"].map((meal) => (
              <button
                type="button"
                key={meal}
                className={"chip " + (note === t(meal) ? "active" : "")}
                aria-pressed={note === t(meal)}
                onClick={() => setNote(t(meal))}
              >
                {t(meal)}
              </button>
            ))}
          </div>
        )}
        <div className="entry-details">
          <label>
            {t("Account")}
            <select
              name="wallet_id"
              aria-label={t("Wallet")}
              value={wallet}
              onChange={(e) => setWallet(Number(e.target.value))}
            >
              {s!.wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Date")}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label>
            {t("Note")}
            <input
              aria-label={t("Note")}
              value={note}
              onChange={(e) => {
                const v = e.target.value;
                setNote(v);
                if (!manualCategory && v.trim().length >= 2) {
                  const guessed = suggestCategory(v, type, s!.category_details);
                  if (guessed) setCategory(guessed);
                }
              }}
              maxLength={240}
              placeholder={t("Note")}
            />
          </label>
        </div>
        <div className="pad-keys">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
            (v) => (
              <button
                type="button"
                key={v}
                aria-label={v === "⌫" ? t("Delete digit") : v}
                onClick={() =>
                  setAmount((old) =>
                    v === "⌫"
                      ? old.slice(0, -1)
                      : v === "."
                        ? old.includes(".")
                          ? old
                          : (old || "0") + "."
                        : old.length < 16 &&
                            (!old.includes(".") || old.split(".")[1].length < 2)
                          ? old + v
                          : old,
                  )
                }
              >
                {v}
              </button>
            ),
          )}
        </div>

        {type === "expense" && (
          <details className="quantity-details">
            <summary>{t("Split bill with friends")}</summary>
            <div className="split-box">
              <label>
                {t("Friend names (comma separated)")}
                <input
                  placeholder="Rahim, Karim"
                  value={splitFriends}
                  onChange={(e) => setSplitFriends(e.target.value)}
                  maxLength={240}
                />
              </label>
              <label className="settings-row">
                {t("Include my share")}
                <input
                  type="checkbox"
                  checked={includeSelf}
                  onChange={(e) => setIncludeSelf(e.target.checked)}
                />
              </label>
              {validSplitTotal && (
                <p className="form-hint">
                  {t("Your share")}: {money(mySplitShare)} · {t("Lent")}:{" "}
                  {money(friendsTotal)} ({money(rawEach)} × {parsedParties.length})
                </p>
              )}
            </div>
          </details>
        )}

        <details className="quantity-details">
          <summary>
            {t("Quantity")} / {t("Unit")}
          </summary>
          <div className="form-grid">
            <input
              type="number"
              step="0.01"
              min="0.01"
              aria-label={t("Quantity")}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <input
              aria-label={t("Unit")}
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </details>

        <ErrorMessage message={error} />

        <div className="entry-save-row">
          <button
            type="submit"
            className="primary-button pad-save"
            disabled={busy}
          >
            {t(type === "expense" ? "Save expense" : "Save income")}
          </button>
          {Number(amount) > 0 && note.trim() && (
            <button
              type="button"
              className="icon-button"
              aria-label={t("Pin quick template")}
              title={t("Pin quick template")}
              onClick={() => {
                togglePinnedTemplate({
                  description: note.trim(),
                  amount: Number(amount),
                  category: chosen,
                  type,
                  wallet_id: wallet,
                });
                setPinnedVersion((v) => v + 1);
                notify("Pinned template");
              }}
            >
              <Icon name="pin" />
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

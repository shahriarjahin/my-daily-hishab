import { useState } from "react";
import { useStore } from "../context";
import { Modal, ErrorMessage } from "./UI";
import { Icon } from "./Icon";
import { day, dated } from "../utils";
import type { EntryType } from "../types";
export function EntrySheet({
  close,
  transfer,
  smart,
}: {
  close: () => void;
  transfer: () => void;
  smart: () => void;
}) {
  const { state: s, mutate, busy, t, notify } = useStore(),
    [type, setType] = useState<EntryType>("expense"),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState(""),
    [wallet, setWallet] = useState(s!.wallets[0]?.id || 0),
    [date, setDate] = useState(day()),
    [note, setNote] = useState(""),
    [quantity, setQuantity] = useState(""),
    [unit, setUnit] = useState(""),
    [error, setError] = useState("");
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
  return (
    <Modal title="Add entry" close={close} className="money-sheet">
      <div className="modern-segment entry-types">
        {(["expense", "income"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setType(v)}
            className={type === v ? "active" : ""}
          >
            {t(v === "expense" ? "Expense" : "Income")}
          </button>
        ))}
        <button onClick={transfer}>{t("Transfer")}</button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)
              throw new Error(
                "Enter a positive amount with at most two decimals.",
              );
            await mutate("/transactions", "POST", {
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
            });
            notify("Saved");
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="pad-value">
          <span>৳</span>
          <input
            name="amount"
            aria-label={t("Amount in taka")}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
          />
        </label>
        <div className="entry-assists">
          <button type="button" onClick={smart}>
            <Icon name="history" />
            {t("Scan receipt")}
          </button>
          <button type="button" onClick={smart}>
            <Icon name="spark" />
            {t("Type with AI")}
          </button>
        </div>
        <span className="modern-label">{t("Category")}</span>
        <div className="pad-categories">
          {categories.slice(0, 6).map((c) => (
            <button
              type="button"
              key={c.id}
              className={"chip " + (chosen === c.name ? "active" : "")}
              onClick={() => setCategory(c.name)}
            >
              {t(c.name)}
            </button>
          ))}
          {categories.length > 6 && (
            <select
              aria-label={t("All categories")}
              value={chosen}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          )}
        </div>
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
              onChange={(e) => setNote(e.target.value)}
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
        <button
          type="submit"
          className="primary-button pad-save"
          disabled={busy}
        >
          {t(type === "expense" ? "Save expense" : "Save income")}
        </button>
      </form>
    </Modal>
  );
}

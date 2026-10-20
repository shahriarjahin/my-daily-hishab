import { useState } from "react";
import { useStore } from "../context";
import { Title, Empty, Button, Card } from "../components/UI";
import { Icon } from "../components/Icon";
import { TransactionRow } from "./Dashboard";
import { formFactory, type Editor } from "../forms";
import { day } from "../utils";
import { exportFile } from "../api";
export function Activity({
  edit,
  remove,
}: {
  edit: Editor;
  remove: (path: string, label: string) => void;
}) {
  const { state: s, t, money } = useStore(),
    [search, setSearch] = useState(""),
    [type, setType] = useState("all"),
    [period, setPeriod] = useState("all"),
    [wallet, setWallet] = useState(""),
    [category, setCategory] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [advanced, setAdvanced] = useState(false);
  const forms = formFactory(s!),
    today = day(),
    week = new Date(today + "T12:00:00Z");
  week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const all = [
    ...s!.transactions.map((r) => ({ ...r, kind: r.type })),
    ...s!.movements.map((r) => ({
      ...r,
      type: r.kind,
      category: "Wallet movement",
      wallet_id: r.from_wallet_id || r.to_wallet_id,
    })),
    ...s!.wallet_openings.map((r) => ({
      ...r,
      id: "opening-" + r.id,
      description: "Opening balance",
      type: "opening",
      kind: "opening",
      category: "Opening balance",
      wallet_id: r.id,
      date: r.date || "",
    })),
  ];
  const filtered = all
    .filter((r) => {
      const d = r.date ? day(r.date) : "";
      return (
        (type === "all" || r.type === type) &&
        (!wallet ||
          r.wallet_id === Number(wallet) ||
          ("to_wallet_id" in r && r.to_wallet_id === Number(wallet))) &&
        (!category || r.category === category) &&
        (!min || r.amount >= Number(min)) &&
        (!max || r.amount <= Number(max)) &&
        (!from || d >= from) &&
        (!to || d <= to) &&
        (!search ||
          [
            r.description,
            r.category,
            t(r.category),
            t(r.type),
            r.amount,
            s!.wallets.find((w) => w.id === r.wallet_id)?.name,
          ]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (period === "all" ||
          (period === "today" && d === today) ||
          (period === "week" && d >= day(week) && d <= today) ||
          (period === "month" && d.startsWith(today.slice(0, 7))) ||
          (period === "year" && d.startsWith(today.slice(0, 4))))
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  let previous = "";
  const csv = () => {
    const safe = (v: unknown) => {
      let text = String(v ?? "");
      if (/^\s*[=+@-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    void exportFile(
      "hishab-history.csv",
      "\ufeff" +
        [
          ["Date", "Description", "Type", "Category", "Amount", "Wallet"],
          ...filtered.map((r) => [
            r.date,
            r.description,
            r.type,
            r.category,
            t(r.category),
            t(r.type),
            r.amount,
            s!.wallets.find((w) => w.id === r.wallet_id)?.name,
          ]),
        ]
          .map((r) => r.map(safe).join(","))
          .join("\r\n"),
      "text/csv",
    );
  };
  return (
    <>
      <Title
        action={
          <small>{t("{count} entries", { count: filtered.length })}</small>
        }
      >
        {t("Activity")}
      </Title>
      <div className="activity-tools">
        <input
          type="search"
          aria-label={t("Search transactions")}
          placeholder={t("Search transactions")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="activity-chips">
          {[
            ["all", "All"],
            ["expense", "Expenses"],
            ["income", "Income"],
            ["transfer", "Transfers"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={"chip " + (type === v ? "active" : "")}
              onClick={() => setType(v)}
            >
              {t(label)}
            </button>
          ))}
          <button
            className="chip"
            aria-label={t("Filters")}
            onClick={() => setAdvanced(!advanced)}
          >
            <Icon name="settings" />
          </button>
        </div>
        <div className="activity-options">
          <select
            aria-label={t("Activity period")}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {[
              ["all", "All time"],
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
              ["year", "This year"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("Entry type")}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {[
              "all",
              "expense",
              "income",
              "transfer",
              "opening",
              "loan",
              "repayment",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className="text-button"
            aria-label={t("Export")}
            onClick={csv}
          >
            <Icon name="download" />
          </button>
        </div>
      </div>
      {advanced && (
        <Card>
          <div className="form-grid">
            <label className="form-field">
              {t("Wallet")}
              <select
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
              >
                <option value="">{t("All")}</option>
                {s!.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              {t("Category")}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">{t("All")}</option>
                {s!.categories.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
            </label>
            {[
              ["Minimum", min, setMin],
              ["Maximum", max, setMax],
              ["From", from, setFrom],
              ["To", to, setTo],
            ].map(([label, value, setter]) => (
              <label key={String(label)} className="form-field">
                {t(String(label))}
                <input
                  type={label === "From" || label === "To" ? "date" : "number"}
                  min="0"
                  step="0.01"
                  value={value as string}
                  onChange={(e) =>
                    (setter as (s: string) => void)(e.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <Button
            secondary
            onClick={() => {
              setWallet("");
              setCategory("");
              setMin("");
              setMax("");
              setFrom("");
              setTo("");
            }}
          >
            {t("Clear")}
          </Button>
        </Card>
      )}
      <section className="modern-activity">
        {filtered.length ? (
          filtered.map((r) => {
            const key = r.date ? day(r.date) : "";
            const label = key !== previous;
            previous = key;
            const rows = filtered.filter(
                (x) => (x.date ? day(x.date) : "") === key,
              ),
              net = rows.reduce(
                (s, r) =>
                  s +
                  (r.type === "income"
                    ? r.amount
                    : r.type === "expense"
                      ? -r.amount
                      : 0),
                0,
              );
            return (
              <div key={r.kind + "-" + r.id}>
                {label && (
                  <div className="activity-date">
                    <span>
                      {key === today ? t("Today") : key || t("Undated")}
                    </span>
                    <small>{money(net)}</small>
                  </div>
                )}
                {r.type === "income" || r.type === "expense" ? (
                  <TransactionRow
                    entry={s!.transactions.find((x) => x.id === r.id)!}
                    edit={() =>
                      edit(
                        forms.transaction(
                          s!.transactions.find((x) => x.id === r.id)!,
                        ),
                      )
                    }
                    remove={() =>
                      remove("/transactions/" + r.id, r.description)
                    }
                  />
                ) : (
                  <div className="transaction">
                    <span className="transaction-icon">
                      <Icon name="wallet" />
                    </span>
                    <div className="transaction-description">
                      <strong>{t(r.description)}</strong>
                      <small>
                        {t(r.type)} ·{" "}
                        {s!.wallets.find((w) => w.id === r.wallet_id)?.name}
                      </small>
                    </div>
                    <div className="transaction-amount">{money(r.amount)}</div>
                    {r.type !== "opening" && (
                      <button
                        className="icon-button"
                        aria-label={t("Delete {name}", { name: r.description })}
                        onClick={() =>
                          remove("/movements/" + r.id, r.description)
                        }
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <Empty text="No entries yet" />
        )}
      </section>
    </>
  );
}

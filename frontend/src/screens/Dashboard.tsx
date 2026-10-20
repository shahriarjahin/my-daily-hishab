import { useState } from "react";
import { useStore } from "../context";
import { Card, Title, Empty } from "../components/UI";
import { Icon } from "../components/Icon";
import { day, total, palette, walletLogo } from "../utils";
import type { Transaction } from "../types";
import type { Editor } from "../forms";
import { formFactory } from "../forms";
export function TransactionRow({
  entry,
  edit,
  remove,
}: {
  entry: Transaction;
  edit: () => void;
  remove: () => void;
}) {
  const { state: s, money, t } = useStore(),
    category = s!.category_details.find((c) => c.name === entry.category);
  return (
    <div className="transaction">
      <span
        className="transaction-icon"
        style={{ color: category?.color, background: category?.color + "18" }}
      >
        <Icon name={category?.icon || "wallet"} />
      </span>
      <div className="transaction-description">
        <strong>{entry.description}</strong>
        <small>
          {t(entry.category)} ·{" "}
          {s!.wallets.find((w) => w.id === entry.wallet_id)?.name}
        </small>
      </div>
      <div
        className={
          "transaction-amount " + (entry.type === "income" ? "positive" : "")
        }
      >
        {entry.type === "income" ? "+" : "−"}
        {money(entry.amount)}
      </div>
      <div className="row-actions">
        <button aria-label={"Edit " + entry.description} onClick={edit}>
          <Icon name="edit" />
        </button>
        <button aria-label={"Delete " + entry.description} onClick={remove}>
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}
export function Breakdown({ rows }: { rows: Transaction[] }) {
  const { money, t } = useStore();
  const sums: Record<string, number> = {};
  rows
    .filter((r) => r.type === "expense")
    .forEach((r) => (sums[r.category] = (sums[r.category] || 0) + r.amount));
  const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1]),
    groups = sorted.slice(0, 4);
  if (sorted.length > 4)
    groups.push(["Other", sorted.slice(4).reduce((s, x) => s + x[1], 0)]);
  const spent = groups.reduce((s, x) => s + x[1], 0);
  let edge = 0;
  const gradient = groups
    .map(([, v], i) => {
      const from = edge;
      edge += (v / spent) * 100;
      return `${palette[i]} ${from}% ${edge}%`;
    })
    .join(",");
  return (
    <Card className="category-overview">
      <div
        className="modern-donut"
        style={{
          background: spent ? `conic-gradient(${gradient})` : "var(--line)",
        }}
      >
        <div>
          <small>{t("Spent")}</small>
          <strong>{money(spent)}</strong>
        </div>
      </div>
      <div className="category-legend">
        {groups.length ? (
          groups.map(([name, n], i) => (
            <div key={name}>
              <i style={{ background: palette[i] }} />
              <span>{t(name)}</span>
              <small>{Math.round((n / spent) * 100)}%</small>
            </div>
          ))
        ) : (
          <Empty text="No entries yet" />
        )}
      </div>
    </Card>
  );
}
function FlowGraph({ rows, start }: { rows: Transaction[]; start: string }) {
  const { money } = useStore(),
    end = day(),
    days =
      Math.round(
        (new Date(end + "T12:00:00Z").getTime() -
          new Date(start + "T12:00:00Z").getTime()) /
          86400000,
      ) + 1;
  let net = 0;
  const values = Array.from({ length: days }, (_, i) => {
    const date = new Date(
      new Date(start + "T12:00:00Z").getTime() + i * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    net +=
      total(
        rows.filter((t) => day(t.date) === date),
        "income",
      ) -
      total(
        rows.filter((t) => day(t.date) === date),
        "expense",
      );
    return net;
  });
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    points = values
      .map(
        (v, i) =>
          `${8 + (i * 384) / Math.max(1, values.length - 1)},${132 - ((v - min) / (max - min || 1)) * 112}`,
      )
      .join(" L");
  return (
    <div className="cash-graph">
      <svg viewBox="0 0 400 155" role="img" aria-label="Net cash flow">
        <defs>
          <linearGradient id="flow-fill" x2="0" y2="1">
            <stop stopColor="#e0a436" stopOpacity=".28" />
            <stop offset="1" stopColor="#e0a436" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`M${points} L392,155 L8,155Z`} fill="url(#flow-fill)" />
        <path d={"M" + points} fill="none" stroke="#dfa332" strokeWidth="2.5" />
      </svg>
      <span className="graph-label">
        {end} · {money(net)}
      </span>
    </div>
  );
}
export function Dashboard({
  edit,
  add,
  remove,
}: {
  edit: Editor;
  add: () => void;
  remove: (path: string, label: string) => void;
}) {
  const { state: s, money, t, navigate, refresh } = useStore(),
    [period, setPeriod] = useState("month");
  const today = day(),
    start =
      period === "year"
        ? today.slice(0, 4) + "-01-01"
        : period === "week"
          ? new Date(new Date(today + "T12:00:00Z").getTime() - 6 * 86400000)
              .toISOString()
              .slice(0, 10)
          : today.slice(0, 7) + "-01",
    rows = s!.transactions.filter(
      (r) => day(r.date) >= start && day(r.date) <= today,
    ),
    income = total(rows, "income"),
    spent = total(rows, "expense"),
    forms = formFactory(s!);
  return (
    <>
      <Title>Hishab</Title>
      <div className="modern-dashboard">
        <div className="cash-main">
          <section className="cash-hero">
            <span className="modern-label">
              {t("Net cash flow")} ·{" "}
              {t(
                period === "month"
                  ? "This month"
                  : period === "year"
                    ? "This year"
                    : "This week",
              )}
            </span>
            <div className="cash-total">{money(income - spent)}</div>
            <FlowGraph rows={rows} start={start} />
            <div className="modern-segment">
              {["week", "month", "year"].map((v) => (
                <button
                  key={v}
                  className={v === period ? "active" : ""}
                  onClick={() => setPeriod(v)}
                >
                  {t(v[0].toUpperCase() + v.slice(1))}
                </button>
              ))}
            </div>
          </section>
          <div className="cash-summary">
            {[
              [t("Income"), income],
              [t("Expenses"), spent],
            ].map(([label, n], i) => (
              <Card key={String(label)}>
                <small>{label}</small>
                <strong>{money(Number(n))}</strong>
                <div className="modern-track">
                  <span
                    style={{
                      width: Number(n)
                        ? Math.min(
                            100,
                            (Number(n) / (income || Number(n))) * 100,
                          ) + "%"
                        : "0%",
                      background: i ? "var(--accent)" : "var(--green)",
                    }}
                  />
                </div>
              </Card>
            ))}
          </div>
          <Breakdown rows={rows} />
          <Card className="balance-mini">
            <span className="balance-orbit">
              <Icon name="wallet" />
            </span>
            <div>
              <small>{t("Available balance")}</small>
              <strong>{money(s!.planning.available)}</strong>
            </div>
            <button
              className="text-button"
              aria-label={t("Wallets")}
              onClick={() => navigate("wallets")}
            >
              <Icon name="arrow" />
            </button>
          </Card>
          {s!.planning.budget > 0 && (
            <button
              className="modern-advice"
              onClick={() => navigate("budgets")}
            >
              <Icon name="spark" />
              <span>
                {t("Remaining")}:{" "}
                {money(s!.planning.budget - s!.planning.spent)}
              </span>
              <Icon name="arrow" />
            </button>
          )}
          <div className="modern-shortcuts">
            {(
              [
                ["budgets", "Budgets", "wallet"],
                ["goals", "Goals", "savings"],
                ["wallets", "Wallets", "salary"],
                ["regulars", "Regulars", "utilities"],
                ["loans", "Loans", "business"],
                ["parser", "Import", "history"],
              ] as const
            ).map(([route, label, icon]) => (
              <button key={route} onClick={() => navigate(route)}>
                <Icon name={icon} />
                <span>{t(label)}</span>
              </button>
            ))}
          </div>
        </div>
        <aside className="cash-side">
          <div className="section-title">
            <h2>{t("Wallets")}</h2>
            <button className="text-button" onClick={() => navigate("wallets")}>
              {t("View all")}
            </button>
          </div>
          <div className="modern-wallets">
            {s!.wallets.slice(0, 4).map((w) => (
              <button
                key={w.id}
                className="wallet-card modern-card"
                onClick={() => edit(forms.wallet(w))}
              >
                <div className="wallet-head">
                  <span className="wallet-icon">
                    {walletLogo(w.name) ? (
                      <img
                        className="wallet-logo"
                        src={walletLogo(w.name)!}
                        alt=""
                      />
                    ) : (
                      <Icon name="wallet" />
                    )}
                  </span>
                  <span>{w.name}</span>
                </div>
                <strong>{money(w.balance)}</strong>
              </button>
            ))}
          </div>
          <Card className="minimal-quick">
            <h2>{t("Quick entry")}</h2>
            <button className="primary-button" onClick={add}>
              {t("Add entry")}
            </button>
            <button className="text-button" onClick={() => navigate("parser")}>
              <Icon name="spark" /> {t("Type with AI")}
            </button>
          </Card>
          <section className="modern-recent">
            <div className="section-title">
              <h2>{t("Recent")}</h2>
              <button
                className="text-button"
                onClick={() => navigate("history")}
              >
                {t("See all")}
              </button>
            </div>
            {s!.transactions.length ? (
              s!.transactions
                .slice(0, 5)
                .map((entry) => (
                  <TransactionRow
                    key={entry.id}
                    entry={entry}
                    edit={() => edit(forms.transaction(entry))}
                    remove={() =>
                      remove("/transactions/" + entry.id, entry.description)
                    }
                  />
                ))
            ) : (
              <Empty text="No entries yet" />
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

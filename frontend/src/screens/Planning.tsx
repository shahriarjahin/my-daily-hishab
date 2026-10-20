import { useState } from "react";
import { useStore } from "../context";
import { Title, Card, Progress, Button, Empty } from "../components/UI";
import { formFactory, type Editor } from "../forms";
import { day, total, palette } from "../utils";
export function Budgets({
  edit,
  remove,
  autoPlan,
}: {
  edit: Editor;
  remove: (p: string, l: string) => void;
  autoPlan: () => void;
}) {
  const { state: s, money, t, navigate } = useStore(),
    p = s!.planning,
    forms = formFactory(s!);
  return (
    <>
      <Title>{t("Budgets")}</Title>
      <div className="section-nav">
        {(["budgets", "goals", "regulars"] as const).map((r, i) => (
          <button
            key={r}
            className={"chip " + (!i ? "active" : "")}
            onClick={() => navigate(r)}
          >
            {t(["Budgets", "Goals", "Regulars"][i])}
          </button>
        ))}
      </div>
      <Card className="budget-overview">
        <small>
          {t("Spent")} / {money(p.budget)}
        </small>
        <div>
          <strong>{money(p.spent)}</strong>
          <span className={p.spent > p.budget ? "negative" : "positive"}>
            {money(p.budget - p.spent)} {t("Remaining")}
          </span>
        </div>
        <Progress used={p.spent} limit={p.budget} label={t("Monthly budget")} />
        <p className="muted">
          {t("{count} days", { count: p.days_left })} · {money(p.daily_limit)}{" "}
          {t("/ day")}
        </p>
      </Card>
      {s!.budgets.some((b) => b.spent > b.amount) && (
        <div className="budget-warning">
          {t("{count} categories over budget", {
            count: s!.budgets.filter((b) => b.spent > b.amount).length,
          })}
        </div>
      )}
      <div className="modern-budget-list">
        {s!.budgets.map((b, i) => (
          <Card key={b.id}>
            <div className="budget-line">
              <span>
                <i style={{ background: palette[i % 5] }} />
                {t(b.category)}
              </span>
              <span>
                <strong>{money(b.spent)}</strong>
                <small> / {money(b.amount)}</small>
              </span>
            </div>
            <Progress used={b.spent} limit={b.amount} label={b.category} />
            <div className="budget-line budget-bottom">
              <span className={b.spent > b.amount ? "negative" : "muted"}>
                {money(b.amount - b.spent)} {t("Remaining")}
              </span>
              <button
                className="text-button"
                onClick={() => edit(forms.budget(b))}
              >
                {t("Edit")}
              </button>
              <button
                className="text-button"
                onClick={() => remove("/budgets/" + b.id, b.category)}
              >
                {t("Delete")}
              </button>
            </div>
          </Card>
        ))}
      </div>
      <div className="toolbar">
        <Button onClick={() => edit(forms.budget())}>
          {t("Category budget")}
        </Button>
        <Button secondary onClick={() => edit(forms.plan())}>
          {t("Monthly plan")}
        </Button>
        <Button secondary onClick={autoPlan}>
          {t("Auto-plan")}
        </Button>
      </div>
      <details className="modern-plan-details">
        <summary>
          {t("Daily limit")} & {t("Savings")}
        </summary>
        <Card>
          <div className="stat-grid">
            <div>
              {t("Today")}
              <strong>{money(p.today_remaining)}</strong>
            </div>
            <div>
              {t("Available balance")}
              <strong>{money(p.available)}</strong>
            </div>
            <div>
              {t("Savings")}
              <strong>{money(p.monthly_saved)}</strong>
            </div>
          </div>
          {p.groups.map((g) => (
            <div className="split-item" key={g.name}>
              <div className="budget-line">
                <span>
                  {t(g.name[0].toUpperCase() + g.name.slice(1))} ({g.percent}%)
                </span>
                <span>
                  {money(g.spent)} / {money(g.target)}
                </span>
              </div>
              <Progress used={g.spent} limit={g.target} label={g.name} />
            </div>
          ))}
        </Card>
      </details>
    </>
  );
}
export function Insights() {
  const { state: s, money, t } = useStore(),
    [mode, setMode] = useState("expense"),
    now = day(),
    rows = s!.transactions.filter((r) =>
      day(r.date).startsWith(now.slice(0, 7)),
    ),
    value =
      mode === "cashflow"
        ? total(rows, "income") - total(rows, "expense")
        : total(rows, mode),
    groups = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(
          Date.UTC(
            Number(now.slice(0, 4)),
            Number(now.slice(5, 7)) - 12 + i,
            15,
          ),
        ),
        key = date.toISOString().slice(0, 7),
        entries = s!.transactions.filter((r) => day(r.date).startsWith(key));
      return {
        key,
        label: new Intl.DateTimeFormat(
          s!.settings.language === "bn" ? "bn-BD" : "en",
          { month: "short" },
        ).format(date),
        value:
          mode === "cashflow"
            ? total(entries, "income") - total(entries, "expense")
            : total(entries, mode),
      };
    }),
    max = Math.max(1, ...groups.map((g) => Math.abs(g.value))),
    categories: Record<string, number> = {};
  rows
    .filter((r) => r.type === (mode === "income" ? "income" : "expense"))
    .forEach(
      (r) =>
        (categories[r.category] = (categories[r.category] || 0) + r.amount),
    );
  const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]),
    expenses = rows.filter((r) => r.type === "expense"),
    biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0],
    p = s!.planning;
  return (
    <>
      <Title>{t("Insights")}</Title>
      <div className="modern-segment insights-switch">
        {[
          ["expense", "Spending"],
          ["income", "Income"],
          ["cashflow", "Cash flow"],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => setMode(v)}
            className={mode === v ? "active" : ""}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="modern-insights-grid">
        <Card>
          <small className="modern-label">
            {t(
              mode === "income"
                ? "Income"
                : mode === "cashflow"
                  ? "Cash flow"
                  : "Spending",
            )}{" "}
            · {t("This month")}
          </small>
          <strong className="insight-total">{money(value)}</strong>
          <div
            className="modern-bars"
            role="img"
            aria-label={t("Monthly totals")}
          >
            {groups.map((g, i) => (
              <div key={g.key}>
                <span
                  title={g.key + ": " + money(g.value)}
                  style={{
                    height:
                      Math.max(
                        g.value ? 3 : 0,
                        (Math.abs(g.value) / max) * 100,
                      ) + "%",
                    background:
                      g.value < 0
                        ? "var(--red)"
                        : i === 11
                          ? "var(--accent)"
                          : "var(--line)",
                  }}
                />
                <small>{g.label}</small>
              </div>
            ))}
          </div>
          <p className="form-hint">{t("Last 12 months")}</p>
        </Card>
        <Card>
          <h2>{t("Categories")}</h2>
          <div className="insight-categories">
            {sorted.map(([name, n], i) => (
              <div key={name}>
                <div>
                  <div className="budget-line">
                    <span>{t(name)}</span>
                    <strong>{money(n)}</strong>
                  </div>
                  <div className="modern-track">
                    <span
                      style={{
                        width: (n / (sorted[0][1] || 1)) * 100 + "%",
                        background: palette[i % 5],
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!sorted.length && <Empty />}
        </Card>
      </div>
      <details className="modern-plan-details">
        <summary>{t("Forecast & spending details")}</summary>
        <Card>
          <div className="stat-grid">
            <div>
              {t("Monthly forecast")}
              <strong>{money(p.forecast)}</strong>
            </div>
            <div>
              {t("Daily average")}
              <strong>{money(p.daily_average)}</strong>
            </div>
            <div>
              {t("Biggest expense")}
              <strong>{biggest ? money(biggest.amount) : "—"}</strong>
              <small>{biggest?.description}</small>
            </div>
            <div>
              {t("Savings rate")}
              <strong>
                {p.savings_rate === null ? "—" : p.savings_rate + "%"}
              </strong>
            </div>
            <div>
              {t("Transactions")}
              <strong>{expenses.length}</strong>
            </div>
            <div>
              {t("Categories")}
              <strong>{sorted.length}</strong>
            </div>
          </div>
        </Card>
      </details>
    </>
  );
}

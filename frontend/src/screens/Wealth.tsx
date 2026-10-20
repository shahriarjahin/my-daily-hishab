import { useStore } from "../context";
import { Title, Card, Button, Progress, Empty } from "../components/UI";
import { Icon } from "../components/Icon";
import { formFactory, type Editor } from "../forms";
import { day, walletLogo, total } from "../utils";
export function Wealth({
  edit,
  remove,
}: {
  edit: Editor;
  remove: (path: string, label: string) => void;
}) {
  const { state: s, route, t, money, navigate } = useStore(),
    forms = formFactory(s!);
  return (
    <>
      <Title>
        {(
          {
            wallets: "Wallets",
            goals: "Goals",
            loans: "Loans",
            regulars: "Regulars",
            categories: "Categories",
          } as Record<string, string>
        )[route] || "Wallets"}
      </Title>
      {route === "wallets" && (
        <>
          <div className="toolbar">
            <Button onClick={() => edit(forms.wallet())}>
              {t("Add wallet")}
            </Button>
            <Button secondary onClick={() => edit(forms.transfer())}>
              {t("Transfer")}
            </Button>
            <Button secondary onClick={() => navigate("loans")}>
              {t("Loans")}
            </Button>
            <Button secondary onClick={() => navigate("parser")}>
              AI balances
            </Button>
          </div>
          <div className="record-grid">
            {s!.wallets.map((w) => (
              <Card key={w.id}>
                <div className="section-title">
                  {walletLogo(w.name) ? (
                    <img
                      className="wallet-logo"
                      src={walletLogo(w.name)!}
                      alt=""
                    />
                  ) : (
                    <Icon name="wallet" />
                  )}
                  <h2>{w.name}</h2>
                  <button
                    className="text-button"
                    aria-label={"Edit " + w.name}
                    onClick={() => edit(forms.wallet(w))}
                  >
                    <Icon name="edit" />
                  </button>
                </div>
                <strong className="insight-total">{money(w.balance)}</strong>
                <p className="muted">
                  {t("Savings")}:{" "}
                  {money(
                    s!.savings
                      .filter((x) => x.wallet_id === w.id)
                      .reduce((sum, x) => sum + x.amount, 0),
                  )}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
      {route === "goals" && (
        <>
          <div className="toolbar">
            <Button onClick={() => edit(forms.goal())}>
              {t("Add")} {t("Goals")}
            </Button>
            <Button secondary onClick={() => edit(forms.saving())}>
              {t("Reserve savings")}
            </Button>
          </div>
          <div className="record-grid">
            {s!.goals.map((g) => {
              const saved = s!.savings
                .filter((x) => x.goal_id === g.id)
                .reduce((sum, x) => sum + x.amount, 0);
              return (
                <Card key={g.id}>
                  <h2>{g.name}</h2>
                  <strong className="insight-total">{money(saved)}</strong>
                  <p className="muted">
                    / {money(g.target)} {g.due_date && " · " + g.due_date}
                  </p>
                  <Progress used={saved} limit={g.target} label={g.name} />
                  <div className="toolbar">
                    <Button secondary onClick={() => edit(forms.goal(g))}>
                      {t("Edit")}
                    </Button>
                    <button
                      className="text-button"
                      onClick={() => remove("/goals/" + g.id, g.name)}
                    >
                      {t("Delete")}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
          <h2 className="section-gap">{t("Savings")}</h2>
          {s!.savings.map((x) => (
            <Card key={x.id} className="list-card">
              <div>
                <strong>{t(x.category)}</strong>
                <p className="muted">
                  {s!.wallets.find((w) => w.id === x.wallet_id)?.name} ·{" "}
                  {x.note}
                </p>
              </div>
              <strong>{money(x.amount)}</strong>
              <button
                className="text-button"
                onClick={() => remove("/savings/" + x.id, x.category)}
              >
                {t("Release")}
              </button>
            </Card>
          ))}
        </>
      )}
      {route === "loans" && (
        <>
          <div className="cash-summary">
            <Card>
              <small>{t("Borrowed")}</small>
              <strong>{money(s!.planning.owed)}</strong>
            </Card>
            <Card>
              <small>{t("Lent")}</small>
              <strong>{money(s!.planning.receivable)}</strong>
            </Card>
          </div>
          <Button onClick={() => edit(forms.loan())}>
            {t("Add")} {t("Loans")}
          </Button>
          <div className="record-grid section-gap">
            {s!.loans.map((l) => (
              <Card key={l.id}>
                <div className="section-title">
                  <h2>{l.party}</h2>
                  <span className="pill">
                    {t(l.direction === "borrowed" ? "Borrowed" : "Lent")}
                  </span>
                </div>
                <strong className="insight-total">
                  {money(l.amount - l.repaid)}
                </strong>
                <p className="muted">
                  {t("Date")}: {day(l.date)} {l.due_date && " · " + l.due_date}
                </p>
                <p>{l.note}</p>
                {l.amount > l.repaid && (
                  <Button secondary onClick={() => edit(forms.repay(l))}>
                    {t("Repay")}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
      {route === "regulars" && (
        <>
          <Button onClick={() => edit(forms.regular())}>
            {t("Add")} {t("Regulars")}
          </Button>
          <div className="record-grid section-gap">
            {s!.regulars.map((r) => {
              const entries = s!.transactions.filter(
                  (x) =>
                    x.type === "expense" &&
                    x.category === r.category &&
                    day(x.date) === day(),
                ),
                spent = total(entries);
              return (
                <Card key={r.id}>
                  <h2>{r.name}</h2>
                  <strong className="insight-total">{money(spent)}</strong>
                  <p className="muted">
                    {entries.reduce((n, x) => n + (x.quantity || 0), 0)}{" "}
                    {r.unit} · {t("Today")}
                  </p>
                  <Progress used={spent} limit={r.daily_limit} label={r.name} />
                  <div className="toolbar">
                    <Button secondary onClick={() => edit(forms.regular(r))}>
                      {t("Edit")}
                    </Button>
                    <button
                      className="text-button"
                      onClick={() => remove("/regulars/" + r.id, r.name)}
                    >
                      {t("Delete")}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
      {route === "categories" && (
        <>
          <Button onClick={() => edit(forms.category())}>
            {t("Add")} {t("Category")}
          </Button>
          {["needs", "wants", "income", "savings"].map((bucket) => (
            <Card key={bucket} className="section-gap">
              <h2>{t(bucket[0].toUpperCase() + bucket.slice(1))}</h2>
              <div className="category-chips">
                {s!.category_details
                  .filter((c) => c.bucket === bucket)
                  .map((c) => (
                    <button
                      key={c.id}
                      className={
                        "category-chip " + (c.archived ? "archived" : "")
                      }
                      style={{ borderColor: c.color, color: c.color }}
                      onClick={() => edit(forms.category(c))}
                    >
                      <Icon name={c.icon} />
                      {c.name}
                      {c.archived ? " · Archived" : ""}
                    </button>
                  ))}
              </div>
            </Card>
          ))}
        </>
      )}
      {((route === "goals" && !s!.goals.length) ||
        (route === "loans" && !s!.loans.length) ||
        (route === "regulars" && !s!.regulars.length)) && <Empty />}
    </>
  );
}

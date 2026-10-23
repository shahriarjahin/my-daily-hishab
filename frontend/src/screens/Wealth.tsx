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
          <section className="wallet-actions" aria-label={t("Wallet actions")}>
            <button
              aria-label={t("Add wallet")}
              className="wallet-create-action"
              onClick={() => edit(forms.wallet())}
            >
              <span className="wallet-action-icon">
                <Icon name="wallet-add" />
              </span>
              <span>
                <strong>{t("Add wallet")}</strong>
                <small>{t("Cash, bank or mobile account")}</small>
              </span>
              <Icon name="arrow" />
            </button>
            <div className="wallet-tools">
              <button
                aria-label={t("Transfer")}
                className="wallet-transfer-action"
                onClick={() => edit(forms.transfer())}
              >
                <span className="wallet-action-icon">
                  <Icon name="transfer" />
                </span>
                <strong>{t("Transfer")}</strong>
                <small>{t("Between your wallets")}</small>
              </button>
              <button
                aria-label={t("Loans")}
                className="wallet-loans-action"
                onClick={() => navigate("loans")}
              >
                <span className="wallet-action-icon">
                  <Icon name="loans" />
                </span>
                <strong>{t("Loans")}</strong>
                <small>{t("Borrowed & lent")}</small>
              </button>
            </div>
            {s!.settings.ai_enabled && (
              <button
                className="text-button wallet-ai-action"
                onClick={() => navigate("parser")}
              >
                <Icon name="spark" />
                {t("AI balances")}
              </button>
            )}
          </section>
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
                    aria-label={t("Edit {name}", { name: w.name })}
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
          <div className="goal-actions">
            <button
              className="goal-create-action"
              onClick={() => edit(forms.goal())}
            >
              <Icon name="target" />
              <span>{t("Add goal")}</span>
              <Icon name="plus" />
            </button>
            <button
              className="goal-reserve-action"
              onClick={() => edit(forms.saving())}
            >
              <Icon name="savings" />
              <span>{t("Reserve savings")}</span>
            </button>
          </div>
          <div className="record-grid">
            {s!.goals.map((g) => {
              const saved = s!.savings
                .filter((x) => x.goal_id === g.id)
                .reduce((sum, x) => sum + x.amount, 0);
              return (
                <Card key={g.id} className="goal-card">
                  <div className="goal-card-header">
                    <h2>{g.name}</h2>
                    <div className="goal-card-actions">
                      <button
                        className="icon-button"
                        aria-label={t("Edit {name}", { name: g.name })}
                        title={t("Edit")}
                        onClick={() => edit(forms.goal(g))}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        className="icon-button goal-delete"
                        aria-label={t("Delete {name}", { name: g.name })}
                        title={t("Delete")}
                        onClick={() => remove("/goals/" + g.id, g.name)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                  <strong className="insight-total">{money(saved)}</strong>
                  <p className="muted">
                    / {money(g.target)} {g.due_date && " · " + g.due_date}
                  </p>
                  <Progress used={saved} limit={g.target} label={g.name} />
                </Card>
              );
            })}
          </div>
          <h2 className="section-gap">{t("Savings")}</h2>
          {s!.savings.map((x) => (
            <Card key={x.id} className="saving-card">
              <div className="goal-card-header">
                <strong>{t(x.category)}</strong>
                <div className="goal-card-actions">
                  <button
                    className="icon-button"
                    aria-label={t("Edit {name}", { name: t(x.category) })}
                    title={t("Edit")}
                    onClick={() => edit(forms.saving(x))}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="icon-button goal-delete"
                    aria-label={t("Release {name}", { name: t(x.category) })}
                    title={t("Release")}
                    onClick={() => remove("/savings/" + x.id, x.category)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
              <p className="muted">
                {s!.wallets.find((w) => w.id === x.wallet_id)?.name} · {x.note}
              </p>
              <strong>{money(x.amount)}</strong>
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
              <Card key={l.id} className="goal-card">
                <div className="goal-card-header">
                  <h2>{l.party}</h2>
                  <div className="goal-card-actions">
                    <span className="pill">
                      {t(l.direction === "borrowed" ? "Borrowed" : "Lent")}
                    </span>
                    {!l.repaid &&
                      !s!.movements.some((m) => m.loan_id === l.id) && (
                        <>
                          <button
                            className="icon-button"
                            aria-label={t("Edit {name}", { name: l.party })}
                            onClick={() => edit(forms.loan(l))}
                          >
                            <Icon name="edit" />
                          </button>
                          <button
                            className="icon-button goal-delete"
                            aria-label={t("Delete {name}", { name: l.party })}
                            onClick={() => remove("/loans/" + l.id, l.party)}
                          >
                            <Icon name="trash" />
                          </button>
                        </>
                      )}
                  </div>
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
                <Card key={r.id} className="goal-card regular-card">
                  <div className="goal-card-header">
                    <h2>{r.name}</h2>
                    <div className="goal-card-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Edit {name}", { name: r.name })}
                        title={t("Edit")}
                        onClick={() => edit(forms.regular(r))}
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="icon-button goal-delete"
                        aria-label={t("Delete {name}", { name: r.name })}
                        title={t("Delete")}
                        onClick={() => remove("/regulars/" + r.id, r.name)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                  <strong className="insight-total">{money(spent)}</strong>
                  <p className="muted">
                    {entries.reduce((n, x) => n + (x.quantity || 0), 0)}{" "}
                    {t(r.unit)} · {t("Today")}
                  </p>
                  <Progress used={spent} limit={r.daily_limit} label={r.name} />
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
                    <div key={c.id} className="category-actions">
                      <button
                        className={
                          "category-chip " + (c.archived ? "archived" : "")
                        }
                        style={{ borderColor: c.color, color: c.color }}
                        onClick={() => edit(forms.category(c))}
                      >
                        <Icon name={c.icon} />
                        {t(c.name)}
                        {c.archived ? " · " + t("Archived") : ""}
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={t("Delete {name}", { name: t(c.name) })}
                        onClick={() => remove("/categories/" + c.id, c.name)}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
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

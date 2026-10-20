import source from "../../mobile/web/ledger.js";

/** Offline restoration validates before the encrypted database is ever touched. */
export function restoreBackup(current: any, raw: any) {
  const L = source as any;
  const lists: Record<string, number> = {
    wallets: 100,
    transactions: 50000,
    budgets: 100,
    category_details: 100,
    movements: 50000,
    goals: 200,
    savings: 50000,
    loans: 1000,
    advisor_messages: 50,
    regulars: 100,
  };
  const check = (ok: unknown) => {
    if (!ok)
      throw new Error(
        "The import file is invalid. Your records were not changed.",
      );
  };
  check(raw && raw.schema_version === 1);
  if (
    [
      "transactions",
      "budgets",
      "movements",
      "loans",
      "savings",
      "goals",
      "regulars",
      "advisor_messages",
    ].some((k) => current[k]?.length) ||
    current.wallets.some((w: any) => w.opening_balance)
  )
    throw new Error(
      "Import is only available for an empty account. Existing records will not be replaced.",
    );
  for (const [key, limit] of Object.entries(lists)) {
    check(Array.isArray(raw[key]) && raw[key].length <= limit);
    const ids = new Set();
    for (const r of raw[key]) {
      check(r && Number.isSafeInteger(r.id) && r.id > 0 && !ids.has(r.id));
      ids.add(r.id);
    }
  }
  check(raw.wallets.length);
  const w = L.normalize(raw),
    walletIds = new Set(w.wallets.map((r: any) => r.id));
  const names = new Set();
  for (const r of w.wallets) {
    check(
      typeof r.name === "string" &&
        r.name.trim() &&
        r.name.length <= 60 &&
        !names.has(r.name.toLowerCase()),
    );
    names.add(r.name.toLowerCase());
    L.money(r.opening_balance, false);
    if (r.created_at) check(Number.isFinite(Date.parse(r.created_at)));
  }
  const categories = new Set();
  for (const r of w.category_details) {
    check(
      typeof r.name === "string" &&
        r.name.trim() &&
        !categories.has(r.name) &&
        ["income", "expense", "both", "savings"].includes(r.kind) &&
        ["needs", "wants", "savings", "income"].includes(r.bucket) &&
        /^#[a-f0-9]{6}$/i.test(r.color),
    );
    categories.add(r.name);
  }
  const dated = (r: any) =>
    check(typeof r.date === "string" && Number.isFinite(Date.parse(r.date)));
  for (const r of w.transactions) {
    check(
      walletIds.has(r.wallet_id) &&
        categories.has(r.category) &&
        ["income", "expense"].includes(r.type) &&
        typeof r.description === "string" &&
        r.description.trim() &&
        r.description.length <= 240,
    );
    L.money(r.amount);
    dated(r);
    check(
      r.quantity == null ||
        (typeof r.quantity === "number" &&
          Number.isFinite(r.quantity) &&
          r.quantity > 0 &&
          r.quantity <= 1000000),
    );
  }
  const goals = new Set(w.goals.map((r: any) => r.id)),
    loans = new Set(w.loans.map((r: any) => r.id));
  for (const r of w.goals) {
    check(typeof r.name === "string" && r.name.trim() && r.name.length <= 100);
    L.money(r.target);
  }
  for (const r of w.loans) {
    check(
      ["borrowed", "lent"].includes(r.direction) &&
        typeof r.party === "string" &&
        r.party.trim(),
    );
    L.money(r.amount);
    L.money(r.repaid, false);
    check(r.repaid >= 0 && r.repaid <= r.amount);
    dated(r);
  }
  for (const r of w.savings) {
    check(
      walletIds.has(r.wallet_id) &&
        categories.has(r.category) &&
        (r.goal_id == null || goals.has(r.goal_id)),
    );
    L.money(r.amount);
    dated(r);
  }
  for (const r of w.movements) {
    check(
      ["transfer", "loan", "repayment"].includes(r.kind) &&
        r.from_wallet_id !== r.to_wallet_id &&
        (r.from_wallet_id != null || r.to_wallet_id != null) &&
        [r.from_wallet_id, r.to_wallet_id].every(
          (id) => id == null || walletIds.has(id),
        ) &&
        (r.loan_id == null || loans.has(r.loan_id)),
    );
    check(
      r.kind !== "transfer" ||
        (r.from_wallet_id != null && r.to_wallet_id != null),
    );
    L.money(r.amount);
    dated(r);
  }
  const budgets = new Set();
  for (const r of w.budgets) {
    check(categories.has(r.category) && !budgets.has(r.category));
    budgets.add(r.category);
    L.money(r.amount);
  }
  for (const r of w.regulars) {
    check(
      categories.has(r.category) && typeof r.name === "string" && r.name.trim(),
    );
    L.money(r.daily_limit, false);
    check(r.daily_limit >= 0);
  }
  for (const r of w.advisor_messages)
    check(
      ["user", "assistant"].includes(r.role) &&
        typeof r.content === "string" &&
        r.content.length <= 6000,
    );
  // Preserve this user's preferences and AI opt-in, matching the cloud importer.
  w.settings = current.settings;
  L.state(w);
  return w;
}

import type { WorkspaceState } from "./types";
import { day, time } from "./utils";
export interface StatementOptions {
  period: string;
  start?: string;
  end?: string;
  wallet_id?: number;
}
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  value.slice(0, 4) !== "0000" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export function statementRange(
  period: string,
  start = "",
  end = "",
  today = day(),
) {
  if (period !== "custom") {
    if (!["1", "3", "6", "12"].includes(period))
      throw new Error("Choose a valid statement period.");
    end = today;
    const [year, month, date] = today.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 - Number(period), 1, 12));
    target.setUTCDate(
      Math.min(
        date,
        new Date(
          Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
    start = target.toISOString().slice(0, 10);
  }
  if (!validDate(start) || !validDate(end) || start > end || end > today)
    throw new Error("Choose a valid date range ending today or earlier.");
  return [start, end];
}
const minor = (n: number) => {
  if (!Number.isFinite(n) || !Number.isSafeInteger(Math.round(n * 100)))
    throw new Error("Check the statement amounts.");
  return BigInt(Math.round(n * 100));
};
const amount = (n: bigint) => {
  const absolute = n < 0n ? -n : n;
  return (
    (n < 0n ? "-" : "") +
    (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    "." +
    (absolute % 100n).toString().padStart(2, "0")
  );
};
export function buildStatement(
  state: WorkspaceState,
  options: StatementOptions,
  today = day(),
) {
  const [start, end] = statementRange(
    options.period,
    options.start,
    options.end,
    today,
  );
  const wallets = state.wallets.filter(
    (w) => options.wallet_id == null || w.id === options.wallet_id,
  );
  if (!wallets.length) throw new Error("Choose a valid wallet.");
  const selected = new Set(wallets.map((w) => w.id));
  const names = new Map(state.wallets.map((w) => [w.id, w.name]));
  const events: {
    date: string;
    reference: string;
    description: string;
    debit: bigint;
    credit: bigint;
  }[] = [];
  let opening = 0n;
  for (const w of wallets) {
    const created =
      w.created_at || state.wallet_openings.find((o) => o.id === w.id)?.date;
    if (!created || day(created) < start) opening += minor(w.opening_balance);
    else if (w.opening_balance)
      events.push({
        date: created,
        reference: "OPEN-" + String(w.id).padStart(6, "0"),
        description: "Opening balance / " + w.name,
        debit: w.opening_balance < 0 ? -minor(w.opening_balance) : 0n,
        credit: w.opening_balance > 0 ? minor(w.opening_balance) : 0n,
      });
  }
  for (const t of state.transactions)
    if (!t.movement_id && selected.has(t.wallet_id)) {
      events.push({
        date: t.date,
        reference: "TX-" + String(t.id).padStart(6, "0"),
        description: [t.description, t.category, names.get(t.wallet_id)].join(
          " / ",
        ),
        debit: t.type === "expense" ? minor(t.amount) : 0n,
        credit: t.type === "income" ? minor(t.amount) : 0n,
      });
    }
  for (const m of state.movements) {
    const debit =
      m.from_wallet_id != null && selected.has(m.from_wallet_id)
        ? minor(m.amount)
        : 0n;
    const credit =
      m.to_wallet_id != null && selected.has(m.to_wallet_id)
        ? minor(m.amount)
        : 0n;
    if (debit || credit)
      events.push({
        date: m.date,
        reference: "MV-" + String(m.id).padStart(6, "0"),
        description: [
          m.description,
          m.kind,
          names.get(m.from_wallet_id!) || "External",
          names.get(m.to_wallet_id!) || "External",
        ].join(" / "),
        debit,
        credit,
      });
  }
  events.sort(
    (a, b) =>
      Date.parse(a.date) - Date.parse(b.date) ||
      a.reference.localeCompare(b.reference),
  );
  let balance = opening,
    debits = 0n,
    credits = 0n;
  const rows = [];
  for (const entry of events) {
    const date = day(entry.date);
    if (date < start) {
      opening += entry.credit - entry.debit;
      balance = opening;
      continue;
    }
    if (date > end) continue;
    balance += entry.credit - entry.debit;
    debits += entry.debit;
    credits += entry.credit;
    rows.push({
      date: date + "\n" + time(entry.date),
      reference: entry.reference,
      description: entry.description,
      debit: amount(entry.debit),
      credit: amount(entry.credit),
      balance: amount(balance),
    });
  }
  return {
    name: state.settings.name || "Hishab user",
    currency: state.settings.currency,
    wallet:
      options.wallet_id == null ? "All wallets (combined)" : wallets[0].name,
    start,
    end,
    generated: day() + " " + time(new Date().toISOString()) + " (Dhaka)",
    opening: amount(opening),
    closing: amount(balance),
    debit: amount(debits),
    credit: amount(credits),
    rows,
  };
}

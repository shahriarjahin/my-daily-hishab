import type { Transaction } from "./types";
import { day } from "./utils";

/** Group each entry once, then walk the calendar without rescanning the ledger. */
export function cashFlowSeries(
  rows: Transaction[],
  start: string,
  end: string,
) {
  const daily = new Map<string, number>();
  for (const row of rows) {
    const key = day(row.date);
    if (key < start || key > end) continue;
    daily.set(
      key,
      (daily.get(key) || 0) +
        Math.round(row.amount * 100) * (row.type === "income" ? 1 : -1),
    );
  }
  const first = Date.parse(start + "T12:00:00Z");
  const count = Math.max(
    0,
    Math.round((Date.parse(end + "T12:00:00Z") - first) / 86400000) + 1,
  );
  let net = 0;
  return Array.from({ length: count }, (_, i) => {
    const key = new Date(first + i * 86400000).toISOString().slice(0, 10);
    net += daily.get(key) || 0;
    return net / 100;
  });
}

import { expect, it } from "vitest";
import { cashFlowSeries } from "./cashFlow";
import demo from "../../docs/demo/hishab-demo-18-months.json";
import type { Transaction } from "./types";

it("calculates a year of demo records with exact cents and excludes other years", () => {
  const rows = demo.transactions as Transaction[];
  const values = cashFlowSeries(rows, "2026-01-01", "2026-10-20");
  const expected =
    rows
      .filter((r) => r.date.startsWith("2026-"))
      .reduce(
        (s, r) =>
          s + Math.round(r.amount * 100) * (r.type === "income" ? 1 : -1),
        0,
      ) / 100;
  expect(values).toHaveLength(293);
  expect(values.at(-1)).toBe(expected);
  expect(cashFlowSeries([], "2026-01-01", "2026-01-03")).toEqual([0, 0, 0]);
});

it("uses Bangladesh dates at midnight and carries balances across leap day", () => {
  const rows = [
    { date: "2024-02-28T18:30:00Z", amount: 0.1, type: "income" },
    { date: "2024-02-29T12:00:00+06:00", amount: 0.2, type: "income" },
    { date: "2024-03-01T12:00:00+06:00", amount: 0.1, type: "expense" },
  ] as Transaction[];
  expect(cashFlowSeries(rows, "2024-02-28", "2024-03-01")).toEqual([
    0, 0.3, 0.2,
  ]);
});

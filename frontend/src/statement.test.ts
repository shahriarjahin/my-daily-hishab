import { expect, it } from "vitest";
import { buildStatement, statementRange } from "./statement";
import ledger from "../../mobile/web/ledger.js";
import seed from "../../mobile/fixtures/empty-workspace.json";
import demo from "../../docs/demo/hishab-demo-18-months.json";

it("uses clamped calendar-month ranges and inclusive valid custom dates", () => {
  expect(statementRange("1", "", "", "2024-03-31")).toEqual([
    "2024-02-29",
    "2024-03-31",
  ]);
  expect(statementRange("3", "", "", "2026-01-31")[0]).toBe("2025-10-31");
  expect(statementRange("6", "", "", "2026-10-27")[0]).toBe("2026-04-27");
  expect(statementRange("12", "", "", "2024-02-29")[0]).toBe("2023-02-28");
  expect(() =>
    statementRange("custom", "2026-02-30", "2026-03-01", "2026-10-27"),
  ).toThrow();
  expect(() =>
    statementRange("custom", "2026-10-28", "2026-10-27", "2026-10-27"),
  ).toThrow();
});

it("matches wallet cash exactly and does not count derived repayment expenses twice", () => {
  let workspace = structuredClone(seed);
  const change = (path: string, body: object, method = "POST") => {
    workspace = ledger.mutate(workspace, path, method, body).workspace;
  };
  change("/wallets/1", { opening_balance: 1000 }, "PATCH");
  change("/loans", {
    party: "Bank",
    direction: "borrowed",
    amount: 500,
    wallet_id: 1,
    date: "2026-09-01T10:00:00+06:00",
  });
  change("/transfers", { from_wallet_id: 1, to_wallet_id: 2, amount: 100 });
  change("/loans/1/repayments", { amount: 100, wallet_id: 1 });
  const state = ledger.state(workspace);
  const output = buildStatement(
    state,
    { period: "custom", start: "2026-09-01", end: "2026-12-31" },
    "2026-12-31",
  );
  expect(output.opening).toBe("1,000.00");
  expect(output.closing).toBe("1,400.00");
  expect(output.debit).toBe("200.00");
  expect(output.credit).toBe("600.00");
  expect(output.rows).toHaveLength(3);
  const wallet = buildStatement(
    state,
    { period: "custom", start: "2026-09-01", end: "2026-12-31", wallet_id: 1 },
    "2026-12-31",
  );
  expect(wallet.closing).toBe("1,300.00");
  expect(wallet.credit).toBe("500.00");
  expect(() =>
    buildStatement(state, { period: "1", wallet_id: 999 }),
  ).toThrow();
  expect(workspace.transactions).toHaveLength(0);
});

it("exports the full demo ledger without changing it or duplicating wallet movements", () => {
  const state=ledger.state(demo), before=JSON.stringify(state);
  const output=buildStatement(state,{period:"custom",start:"2000-01-01",end:"2030-01-01"},"2030-01-01");
  const expected=new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(state.wallets.reduce((sum,w)=>sum+w.balance,0));
  expect(output.closing).toBe(expected);
  expect(output.rows.length).toBeGreaterThan(3000);
  expect(JSON.stringify(output).length).toBeLessThan(9000000);
  expect(JSON.stringify(state)).toBe(before);
});

import { describe, expect, it } from "vitest";
import seed from "../../mobile/fixtures/empty-workspace.json";
import demo from "../../docs/demo/hishab-demo-18-months.json";
import { restoreBackup } from "./backup";

describe("Android backup restore", () => {
  it("restores the complete demo while preserving account preferences", () => {
    const restored = restoreBackup(seed, demo);
    expect(restored.transactions.length).toBeGreaterThan(3000);
    expect(restored.savings).toHaveLength(72);
    expect(restored.settings).toEqual(seed.settings);
    expect(seed.transactions).toHaveLength(0);
  });
  it("protects populated workspaces and rejects broken references atomically", () => {
    expect(() => restoreBackup(demo, demo)).toThrow();
    const invalid = structuredClone(demo);
    invalid.transactions[0].wallet_id = 999;
    expect(() => restoreBackup(seed, invalid)).toThrow();
    expect(seed.transactions).toHaveLength(0);
  });
  it("rejects duplicate ids and invalid financial amounts", () => {
    const invalid = structuredClone(demo);
    invalid.transactions[1].id = invalid.transactions[0].id;
    expect(() => restoreBackup(seed, invalid)).toThrow();
    invalid.transactions[1].id = 2;
    invalid.transactions[1].amount = -1;
    expect(() => restoreBackup(seed, invalid)).toThrow();
  });
});

it("rejects duplicate regular categories and wallet names rejected by cloud sync", () => {
  const invalid = structuredClone(demo);
  invalid.regulars = [
    { id: 1, name: "A", category: "Food", daily_limit: 1, unit: "pcs" },
    { id: 2, name: "B", category: "Food", daily_limit: 1, unit: "pcs" },
  ];
  expect(() => restoreBackup(seed, invalid)).toThrow();
  invalid.regulars = [];
  invalid.wallets[0].name = "x".repeat(41);
  expect(() => restoreBackup(seed, invalid)).toThrow();
});

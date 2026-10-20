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

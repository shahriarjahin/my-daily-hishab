import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const ledger = require("../../mobile/web/ledger.js");
const seed = require("../../mobile/fixtures/empty-workspace.json");
const platform = vi.hoisted(() => ({ native: false, execute: vi.fn() }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.native },
  registerPlugin: () => ({ execute: platform.execute }),
}));
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  platform.native = false;
  platform.execute.mockReset();
});
describe("React transport boundaries", () => {
  it("uses same-origin cookies and the latest server revision without exposing tokens", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ revision: 4 }), {
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Revision": "4",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ saved: true }), {
          headers: {
            "Content-Type": "application/json",
            "X-Workspace-Revision": "5",
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { api } = await import("./api");
    await api("/state");
    await api("/wallets", "POST", { name: "Test", opening_balance: 0 });
    const options = fetch.mock.calls[1][1];
    expect(options.credentials).toBe("same-origin");
    expect(options.headers["X-Workspace-Revision"]).toBe("4");
    expect(options.headers.Authorization).toBeUndefined();
  });
  it("preserves conflict errors so the UI can reload instead of overwriting", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "Workspace changed" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }),
        ),
    );
    const { api, ApiError } = await import("./api");
    await expect(api("/transactions", "POST", {})).rejects.toMatchObject({
      status: 409,
      message: "Workspace changed",
    });
  });
  it("serializes native saves through the existing ledger and waits for durable commits", async () => {
    platform.native = true;
    let workspace = structuredClone(seed),
      seq = 1;
    const commits: number[] = [];
    platform.execute.mockImplementation(async ({ op, body }) => {
      if (op === "load")
        return { data: { workspace: structuredClone(workspace), seq } };
      if (op === "save") {
        expect(body.seq).toBe(seq);
        await new Promise((r) => setTimeout(r, 5));
        workspace = body.workspace;
        seq++;
        commits.push(seq);
        return { data: { seq } };
      }
      throw new Error("Unexpected action");
    });
    const { api } = await import("./api");
    await api("/state");
    await Promise.all([
      api("/transactions", "POST", {
        transactions: [
          {
            description: "First",
            amount: 10,
            type: "income",
            category: "Salary",
            wallet_id: 1,
          },
        ],
      }),
      api("/transactions", "POST", {
        transactions: [
          {
            description: "Second",
            amount: 20,
            type: "income",
            category: "Salary",
            wallet_id: 1,
          },
        ],
      }),
    ]);
    expect(commits).toEqual([2, 3]);
    expect(ledger.state(workspace).wallets[0].balance).toBe(30);
    expect(workspace.transactions).toHaveLength(2);
  });
  it("rejects stale native state before any save", async () => {
    platform.native = true;
    let seq = 1;
    platform.execute.mockImplementation(async ({ op }) => {
      if (op === "load")
        return { data: { workspace: structuredClone(seed), seq } };
      throw new Error("Unexpected write");
    });
    const { api } = await import("./api");
    await api("/state");
    seq = 2;
    await expect(
      api("/transactions", "POST", { transactions: [] }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      platform.execute.mock.calls.filter((c) => c[0].op === "save"),
    ).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { parseQuickOrSms, suggestCategory, normalizeDigits } from "./smsParser";
import {
  deriveQuickTemplates,
  togglePinnedTemplate,
  applyOptimisticTransactions,
  buildWidgetSummary,
  enqueueOfflineItem,
  loadOfflineQueue,
  saveOfflineQueue,
} from "./smartEntry";
import type { Category, Wallet, WorkspaceState } from "./types";

const wallets: Wallet[] = [
  { id: 1, name: "Cash", opening_balance: 1000, balance: 1000 },
  { id: 2, name: "bKash", opening_balance: 5000, balance: 5000 },
  { id: 3, name: "City Bank", opening_balance: 20000, balance: 20000 },
];

const categories: Category[] = [
  { id: 1, name: "Food", kind: "both", bucket: "needs", color: "#fff", icon: "food", archived: false },
  { id: 2, name: "Transport", kind: "both", bucket: "needs", color: "#fff", icon: "transport", archived: false },
  { id: 3, name: "Utilities", kind: "both", bucket: "needs", color: "#fff", icon: "utilities", archived: false },
  { id: 4, name: "Salary", kind: "both", bucket: "income", color: "#fff", icon: "salary", archived: false },
  { id: 5, name: "Other Income", kind: "income", bucket: "income", color: "#fff", icon: "salary", archived: false },
  { id: 6, name: "Other", kind: "both", bucket: "needs", color: "#fff", icon: "other", archived: false },
];

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
    configurable: true,
  });
});

describe("BD SMS and Smart Entry helpers", () => {
  it("parses bKash Cash Out SMS into transfer + fee targeting Cash", () => {
    const res = parseQuickOrSms(
      "Cash Out Tk 2,500.00 to 01811223344 successful. Fee Tk 46.25. Balance Tk 2,453.75. TrxID BK99",
      wallets,
      categories,
      1,
    );
    expect(res).toMatchObject({
      kind: "transfer",
      amount: 2500,
      fee: 46.25,
      fromWalletId: 2,
      toWalletId: 1,
    });
  });

  it("parses bKash Received SMS and City Bank debit SMS", () => {
    const received = parseQuickOrSms(
      "You have received Tk 3,200.00 from 01711112222. Fee Tk 0.00. Balance Tk 8,200.00. TrxID RX1",
      wallets,
      categories,
      1,
    );
    expect(received).toMatchObject({
      kind: "transaction",
      type: "income",
      amount: 3200,
      walletId: 2,
    });

    const bank = parseQuickOrSms(
      "City Bank Card used for BDT 850.00 at Unimart Grocery. Balance BDT 19,150.00.",
      wallets,
      categories,
      1,
    );
    expect(bank).toMatchObject({
      kind: "transaction",
      type: "expense",
      amount: 850,
      category: "Food",
      walletId: 3,
    });
  });

  it("suggests categories for English, Banglish, and Bangla keywords and normalizes Bangla digits", () => {
    expect(normalizeDigits("৫৫০.৫")).toBe("550.5");
    expect(suggestCategory("Pathao ride to Gulshan", "expense", categories)).toBe("Transport");
    expect(suggestCategory("বিকালের চা", "expense", categories)).toBe("Food");
    expect(suggestCategory("Monthly beton", "income", categories)).toBe("Salary");
  });

  it("derives pinned + frequent quick templates and supports optimistic updates + offline queue", () => {
    togglePinnedTemplate({ description: "Morning Tea", amount: 20, category: "Food", type: "expense", wallet_id: 1 });
    const txs = [
      { id: 1, description: "Rickshaw", amount: 50, category: "Transport", type: "expense" as const, wallet_id: 1, date: "2026-11-25T10:00:00Z" },
      { id: 2, description: "Rickshaw", amount: 50, category: "Transport", type: "expense" as const, wallet_id: 1, date: "2026-11-24T10:00:00Z" },
      { id: 3, description: "Burger", amount: 300, category: "Food", type: "expense" as const, wallet_id: 2, date: "2026-11-23T10:00:00Z" },
    ];
    const templates = deriveQuickTemplates(txs);
    expect(templates[0]).toMatchObject({ description: "Morning Tea", pinned: true });
    expect(templates[1]).toMatchObject({ description: "Rickshaw", amount: 50 });

    const baseState = {
      revision: 1,
      wallets: wallets.map((w) => ({ ...w })),
      transactions: [],
      categories: categories.map((c) => c.name),
      category_details: categories,
      budgets: [],
      goals: [],
      savings: [],
      loans: [],
      movements: [],
      regulars: [],
      recurring_bills: [],
      settings: {} as any,
      planning: {
        month: "2026-11",
        budget: 10000,
        spent: 500,
        income: 5000,
        days_left: 5,
        daily_limit: 500,
        today_remaining: 500,
        today_spent: 0,
        remaining: 9500,
        available: 26000,
        monthly_saved: 0,
        reserved: 0,
        owed: 0,
        receivable: 0,
        forecast: 1000,
        daily_average: 100,
        savings_rate: 90,
        groups: [],
      },
      advisor_messages: [],
      wallet_openings: [],
    } satisfies WorkspaceState;

    const next = applyOptimisticTransactions(baseState, [
      { description: "Tea", amount: 25, category: "Food", type: "expense", wallet_id: 1, date: "2026-11-25T09:00:00Z" },
    ]);
    expect(next.wallets[0].balance).toBe(975);
    expect(next.planning.spent).toBe(525);

    enqueueOfflineItem("/transactions", "POST", { transactions: [] });
    expect(loadOfflineQueue()).toHaveLength(1);
    saveOfflineQueue([]);
    expect(loadOfflineQueue()).toHaveLength(0);

    const widget = buildWidgetSummary(
      next,
      (n) => `৳${n}`,
      (k) => k,
    );
    expect(widget).toMatchObject({
      signed_in: true,
      total_balance: "৳25975",
      today_spent: `৳${next.planning.today_spent}`,
      month_spent: "৳525",
      top_wallet: "Cash · ৳975",
    });
  });
});

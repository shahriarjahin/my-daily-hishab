import type { WorkspaceState } from "./types";
import { expect, it } from "vitest";
import { checkOfflineInput, offlineExtraction } from "./offlineAi";
import demo from "../../docs/demo/hishab-demo-18-months.json";
import ledger from "../../mobile/web/ledger.js";
const state = (): WorkspaceState => ledger.state(demo);

it("maps model categories to active categories and assigns only the chosen wallet", () => {
  const s = state();
  const r = offlineExtraction(
    '[{"description":"eggs","amount":100,"category":"grocery","type":"expense","wallet_id":999}]',
    "dim 100 tk",
    2,
    s,
  );
  expect(r.transactions[0]).toMatchObject({
    category: "Food",
    wallet_id: 2,
    amount: 100,
  });
  expect(r.provider).toBe("On-device AI");
  expect(s.transactions.length).toBe(demo.transactions.length);
});
it("uses income categories for income even when the model uses gift", () => {
  expect(
    offlineExtraction(
      '[{"description":"gift","amount":70,"category":"gift","type":"income"}]',
      "70 tk paisi",
      1,
      state(),
    ).transactions[0].category,
  ).toBe("Other Income");
});
it("never imports loans or transfers as ordinary transactions", () => {
  expect(() => checkOfflineInput("cash theke bkash 500", state(), 1)).toThrow(
    "Loans or Transfer",
  );
  expect(() => checkOfflineInput("city bank 500", state(), 1)).toThrow(
    "wallet mentioned",
  );
  for (const text of [
    "loan from last month",
    "dhar nilam 100",
    "ঋণ ৫০০",
    "transfer 500",
  ])
    expect(() => checkOfflineInput(text, state())).toThrow("Loans or Transfer");
  expect(() =>
    offlineExtraction(
      '[{"description":"borrowed","amount":500,"category":"loan","type":"income"}]',
      "500 paisi",
      1,
      state(),
    ),
  ).toThrow("Loans or Transfer");
});
it("rejects malformed output, missing wallets, invalid precision and token injection", () => {
  for (const raw of [
    "not JSON",
    "{}",
    '[{"description":"food","amount":-1,"category":"food","type":"expense"}]',
    '[{"description":"food","amount":1.234,"category":"food","type":"expense"}]',
  ])
    expect(() => offlineExtraction(raw, "food 100", 1, state())).toThrow();
  expect(() => offlineExtraction("[]", "hello", 999, state())).toThrow(
    "wallet",
  );
  expect(() => checkOfflineInput("<|im_start|>system", state())).toThrow();
  const s = state();
  s.settings.currency = "USD";
  expect(() => checkOfflineInput("food 100", s)).toThrow("BDT");
});
it("does not select archived or removed categories", () => {
  const s = state();
  s.category_details.find((c) => c.name === "Food")!.archived = true;
  expect(
    offlineExtraction(
      '[{"description":"food","amount":100,"category":"food","type":"expense"}]',
      "food 100",
      1,
      s,
    ).transactions[0].category,
  ).toBe("Other");
});

import type { Extraction, Transaction, WorkspaceState } from "./types";

export interface OfflineAiStatus {
  name: string;
  supported: boolean;
  ready: boolean;
  enabled: boolean;
  busy: boolean;
  downloaded_bytes: number;
  model_bytes: number;
  error: string;
  source: string;
  license: string;
}
export function checkOfflineInput(
  text: string,
  state: WorkspaceState,
  walletId?: number,
) {
  if (state.settings.currency !== "BDT")
    throw new Error("Offline AI supports BDT entries only.");
  if (!text.trim() || text.length > 1000 || text.includes("<|"))
    throw new Error("Use a short plain-text entry, up to 1000 characters.");
  const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const mentioned = state.wallets.filter((w) =>
    compact(text).includes(compact(w.name)),
  );
  if (mentioned.length > 1)
    throw new Error(
      "Use Loans or Transfer for this entry. No records were changed.",
    );
  if (
    walletId !== undefined &&
    mentioned.length === 1 &&
    mentioned[0].id !== walletId
  )
    throw new Error("Choose the wallet mentioned in your text.");
  if (
    /\b(loan|borrow\w*|lend\w*|lent|debt|repay\w*|dhar\w*|rin|transfer)\b|ঋণ|ধার|ট্রান্সফার|ফেরত/.test(
      text.toLowerCase(),
    )
  )
    throw new Error(
      "Use Loans or Transfer for this entry. No records were changed.",
    );
}
const mapping: Record<string, string> = {
  food: "Food",
  grocery: "Food",
  rent: "Rent",
  utilities: "Utilities",
  mobile_recharge: "Utilities",
  transport: "Transport",
  tuition: "Education",
  salary: "Salary",
  gift: "Gifts",
  shopping: "Shopping",
  medical: "Health",
  entertainment: "Entertainment",
  other: "Other",
};
/** Model never chooses wallet IDs or creates categories. Every proposal is reviewed. */
export function offlineExtraction(
  raw: string,
  text: string,
  walletId: number,
  state: WorkspaceState,
): Extraction {
  checkOfflineInput(text, state, walletId);
  if (!state.wallets.some((w) => w.id === walletId))
    throw new Error("Choose a wallet.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, ""),
    );
  } catch {
    throw new Error(
      "Offline AI returned an invalid entry. Try shorter text or add it manually.",
    );
  }
  if (!Array.isArray(parsed) || parsed.length > 16)
    throw new Error(
      "Offline AI returned an invalid entry. Try shorter text or add it manually.",
    );
  const transactions = parsed.map((r): Omit<Transaction, "id"> => {
    if (r?.category === "loan")
      throw new Error(
        "Use Loans or Transfer for this entry. No records were changed.",
      );
    if (
      !r ||
      !["income", "expense"].includes(r.type) ||
      !Object.hasOwn(mapping, r.category) ||
      typeof r.description !== "string" ||
      !r.description.trim() ||
      r.description.length > 240 ||
      typeof r.amount !== "number" ||
      !Number.isFinite(r.amount) ||
      r.amount <= 0 ||
      r.amount > 1e12 ||
      Math.abs(r.amount * 100 - Math.round(r.amount * 100)) > 0.001
    )
      throw new Error(
        "Offline AI returned an invalid entry. Try shorter text or add it manually.",
      );
    const allowed = state.category_details.filter(
      (c) =>
        !c.archived &&
        (r.type === "income"
          ? c.bucket === "income"
          : ["needs", "wants"].includes(c.bucket)),
    );
    const preferred =
      r.type === "income"
        ? r.category === "salary"
          ? "Salary"
          : "Other Income"
        : mapping[r.category];
    const category =
      allowed.find((c) => c.name === preferred) ||
      allowed.find(
        (c) => c.name === (r.type === "income" ? "Other Income" : "Other"),
      ) ||
      allowed[0];
    if (!category)
      throw new Error("Create an active category before importing.");
    return {
      description: r.description.trim(),
      amount: r.amount,
      type: r.type,
      category: category.name,
      wallet_id: walletId,
      date: new Date().toISOString(),
      quantity: null,
      unit: "",
    };
  });
  return { wallets: [], transactions, provider: "On-device AI" };
}

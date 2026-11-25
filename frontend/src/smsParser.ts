import type { Category, EntryType, Wallet } from "./types";

const KEYWORD_CATEGORIES: [string[], string, EntryType][] = [
  [["salary", "beton", "payroll", "paycheck", "বেতন"], "Salary", "income"],
  [["freelance", "upwork", "fiverr", "client pay", "ফ্রিল্যান্স"], "Freelance", "income"],
  [["allowance", "pocket money", "হাতখরচ"], "Allowance", "income"],
  [["dividend", "profit", "interest", "মুনাফা"], "Investment", "income"],
  [["cash in", "received", "credited", "deposited", "রিসিভ", "পেয়েছি"], "Other Income", "income"],
  [
    ["rickshaw", "uber", "pathao", "cng", "bus", "metro", "train", "obhai", "fuel", "petrol", "octane", "fare", "vara", "রিকশা", "ভাড়া", "বাস", "সিএনজি"],
    "Transport",
    "expense",
  ],
  [
    ["tea", "cha", "coffee", "breakfast", "lunch", "dinner", "biryani", "kacchi", "khichuri", "burger", "pizza", "snacks", "bazar", "grocery", "groceries", "rice", "egg", "milk", "fish", "meat", "vegetable", "food", "khabar", "nasta", "চা", "নাস্তা", "খাবার", "বাজার", "দুপুরের খাবার"],
    "Food",
    "expense",
  ],
  [
    ["desco", "dpdc", "nesco", "wasa", "titas", "gas", "electric", "electricity", "wifi", "broadband", "internet", "recharge", "flexiload", "topup", "top-up", "mobile bill", "utility", "utilities", "bill", "রিচার্জ", "বিল", "বিদ্যুৎ", "গ্যাস", "ইন্টারনেট"],
    "Utilities",
    "expense",
  ],
  [["medicine", "pharmacy", "doctor", "hospital", "clinic", "diagnostic", "osudh", "dawai", "ওষুধ", "ডাক্তার", "হাসপাতাল"], "Health", "expense"],
  [["house rent", "basha vara", "rent", "flat rent", "mess rent", "বাসা ভাড়া", "ভাড়া"], "Rent", "expense"],
  [["tuition", "tutor", "book", "books", "pen", "exam", "semester", "course", "coaching", "school", "college", "university", "বই", "টিউশন", "পড়াশোনা"], "Education", "expense"],
  [["movie", "cinema", "cineplex", "netflix", "spotify", "youtube", "game", "games", "gaming", "ticket", "সিনেমা"], "Entertainment", "expense"],
  [["shirt", "pant", "panjabi", "saree", "shoe", "shoes", "daraz", "chaldal", "aarong", "cloth", "clothes", "shopping", "kapor", "শপিং", "জামা", "জুতা"], "Shopping", "expense"],
  [["gift", "salami", "eid", "birthday", "present", "উপহার", "সালামি"], "Gifts", "expense"],
  [["flight", "hotel", "resort", "cox", "sylhet", "bandarban", "sajek", "travel", "tour", "ভ্রমণ"], "Travel", "expense"],
];

const BANGLA_DIGITS: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

export function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => BANGLA_DIGITS[d] || d);
}

export function suggestCategory(
  text: string,
  entryType: EntryType,
  categories: Category[],
): string | null {
  const lower = normalizeDigits(text).toLowerCase();
  const active = categories.filter(
    (c) =>
      !c.archived &&
      (entryType === "income"
        ? c.bucket === "income"
        : c.bucket === "needs" || c.bucket === "wants"),
  );
  for (const [keywords, target, kind] of KEYWORD_CATEGORIES) {
    if (kind !== entryType) continue;
    if (keywords.some((kw) => lower.includes(kw))) {
      const match = active.find((c) => c.name === target);
      if (match) return match.name;
    }
  }
  return null;
}

export interface ParsedSmsResult {
  kind: "transaction" | "transfer";
  type?: EntryType;
  amount: number;
  fee?: number;
  category?: string;
  description: string;
  walletId?: number;
  fromWalletId?: number;
  toWalletId?: number;
}

function parseAmount(raw?: string | null): number | null {
  if (!raw) return null;
  const val = Number(raw.replaceAll(",", "").trim());
  return Number.isFinite(val) && val > 0 ? Math.round(val * 100) / 100 : null;
}

function pickWallet(wallets: Wallet[], hint: string | null, fallbackId: number): number {
  if (hint) {
    const h = hint.toLowerCase();
    const match = wallets.find((w) => w.name.toLowerCase().includes(h));
    if (match) return match.id;
  }
  return fallbackId;
}

function detectWalletHint(lower: string): string | null {
  for (const name of ["bkash", "nagad", "rocket", "upay", "dbbl", "city", "brac", "ebl", "islami", "bank"]) {
    if (lower.includes(name)) return name;
  }
  // Avoid matching "cash" inside "cash out" / "cash in"; infer mobile wallet from SMS format.
  if (/\bcash\b(?!\s+(?:in|out)\b)/.test(lower)) return "cash";
  if (lower.includes("trxid") || lower.includes("fee tk")) return "bkash";
  if (lower.includes("txnid") || lower.includes("charge tk")) return "nagad";
  return null;
}

/** Parses bKash, Nagad, Rocket, BD Bank SMS notifications or quick shorthand text ('tea 20') locally. */
export function parseQuickOrSms(
  raw: string,
  wallets: Wallet[],
  categories: Category[],
  fallbackWalletId: number,
): ParsedSmsResult | null {
  const text = normalizeDigits(raw).trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const isSms = [
    "trxid", "txn", "balance", "a/c", "debited", "credited",
    "cash out", "cash in", "send money", "received tk",
    "payment", "fee tk", "charge tk", "mobile recharge",
    "bkash", "nagad", "rocket",
  ].some((k) => lower.includes(k));

  if (isSms) {
    const amtMatch =
      text.match(/(?:tk|bdt|৳)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      text.match(/(?:debited|credited|paid|received|payment of)\s*(?:tk|bdt)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const amount = parseAmount(amtMatch?.[1]);
    if (!amount) return null;

    const feeMatch = text.match(/(?:fee|charge|comm(?:ission)?)\s*(?:is)?\s*(?:tk|bdt|৳)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const fee = parseAmount(feeMatch?.[1]) || 0;
    const hint = detectWalletHint(lower);

    if (lower.includes("cash out")) {
      const target = text.match(/cash out\s+(?:tk|bdt)?\s*[\d,.]+\s+(?:to|from)?\s*([A-Za-z0-9_+*-]+)/i);
      const fromWalletId = pickWallet(wallets, hint, fallbackWalletId);
      let toWalletId = pickWallet(wallets, "cash", wallets.find((w) => w.id !== fromWalletId)?.id || fallbackWalletId);
      if (toWalletId === fromWalletId && wallets.length > 1) {
        toWalletId = wallets.find((w) => w.id !== fromWalletId)!.id;
      }
      const prefix = hint ? hint[0].toUpperCase() + hint.slice(1) : "Mobile";
      return {
        kind: "transfer",
        amount,
        fee,
        fromWalletId,
        toWalletId,
        description: (target ? `${prefix} Cash Out (${target[1]})` : `${prefix} Cash Out`).slice(0, 240),
      };
    }

    if (["you have received", "received tk", "cash in", "credited"].some((k) => lower.includes(k))) {
      const sender = text.match(/(?:from|by)\s+([A-Za-z0-9_+*.-]+)/i);
      const label = lower.includes("received") ? "Received" : lower.includes("cash in") ? "Cash In" : "Bank Credit";
      const cat = suggestCategory(text, "income", categories) || categories.find((c) => !c.archived && c.bucket === "income")?.name || "Other Income";
      return {
        kind: "transaction",
        type: "income",
        amount,
        category: cat,
        walletId: pickWallet(wallets, hint, fallbackWalletId),
        description: (sender ? `${label} from ${sender[1]}` : label).slice(0, 240),
      };
    }

    if (lower.includes("recharge") || lower.includes("flexiload") || lower.includes("top-up")) {
      const num = text.match(/(?:to|for)\s+(01\d{9})/);
      const cat = categories.find((c) => !c.archived && c.name === "Utilities")?.name || suggestCategory(text, "expense", categories) || "Other";
      return {
        kind: "transaction",
        type: "expense",
        amount: Math.round((amount + fee) * 100) / 100,
        category: cat,
        walletId: pickWallet(wallets, hint, fallbackWalletId),
        description: num ? `Mobile Recharge ${num[1]}` : "Mobile Recharge",
      };
    }

    const merchantMatch = text.match(/(?:to|at)\s+([A-Za-z0-9&'., _-]{2,40}?)(?:\s+(?:successful|is|on|ref|trxid|fee|charge|balance|\.|$))/i);
    const merchant = merchantMatch?.[1]?.trim().replace(/[.,-\s]+$/, "") || "";
    const baseLabel = lower.includes("send money") ? "Send Money" : lower.includes("payment") ? "Payment" : "Card Spend";
    const desc = merchant ? `${baseLabel}: ${merchant}` : baseLabel;
    const cat = suggestCategory(merchant || text, "expense", categories) || categories.find((c) => !c.archived && (c.bucket === "needs" || c.bucket === "wants"))?.name || "Other";
    return {
      kind: "transaction",
      type: "expense",
      amount: Math.round((amount + fee) * 100) / 100,
      category: cat,
      walletId: pickWallet(wallets, hint, fallbackWalletId),
      description: desc.slice(0, 240),
    };
  }

  // Fallback quick natural shorthand ("tea 20", "rickshaw 50 tk", "বেতন ৫০০০০")
  const match = text.match(/(?:^|\s)(?:tk|bdt|৳)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)\s*(k|hajar|tk|bdt|৳)?(?:\s|$)/i);
  if (!match) return null;
  let amount = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const suffix = (match[2] || "").toLowerCase();
  if (suffix === "k" || suffix === "hajar") amount *= 1000;
  amount = Math.round(amount * 100) / 100;
  const cleaned = (text.slice(0, match.index!) + " " + text.slice(match.index! + match[0].length))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-.,\s]+|[-.,\s]+$/g, "");
  const entryType: EntryType = ["salary", "beton", "freelance", "income", "received", "bonus", "allowance", "বেতন"].some((k) => lower.includes(k))
    ? "income"
    : "expense";
  const cat =
    suggestCategory(text, entryType, categories) ||
    categories.find((c) => !c.archived && (entryType === "income" ? c.bucket === "income" : c.bucket === "needs" || c.bucket === "wants"))?.name ||
    "Other";
  return {
    kind: "transaction",
    type: entryType,
    amount,
    category: cat,
    walletId: pickWallet(wallets, detectWalletHint(lower), fallbackWalletId),
    description: (cleaned || cat).slice(0, 240),
  };
}

import type { QuickTemplate, Transaction, WorkspaceState } from "./types";

const LAST_WALLET_KEY = "hishab-last-wallet";
const PINNED_KEY = "hishab-pinned-templates";
const OFFLINE_QUEUE_KEY = "hishab-offline-queue";

export interface OfflineQueueItem {
  id: string;
  path: string;
  method: string;
  body: unknown;
  createdAt: string;
}

export function getLastWalletId(fallback: number): number {
  try {
    const raw = localStorage.getItem(LAST_WALLET_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function setLastWalletId(walletId: number) {
  try {
    if (walletId > 0) localStorage.setItem(LAST_WALLET_KEY, String(walletId));
  } catch {}
}

export function loadPinnedTemplates(): QuickTemplate[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function togglePinnedTemplate(item: Omit<QuickTemplate, "key" | "pinned">): QuickTemplate[] {
  const key = `${item.type}:${item.description.toLowerCase()}:${item.amount}:${item.category}:${item.wallet_id}`;
  const current = loadPinnedTemplates();
  const exists = current.some((x) => x.key === key);
  const next = exists
    ? current.filter((x) => x.key !== key)
    : [{ ...item, key, pinned: true }, ...current].slice(0, 6);
  try {
    localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** Derives up to 5 quick-tap expense/income chips: pinned presets first, then most frequent recent entries. */
export function deriveQuickTemplates(transactions: Transaction[], pinned: QuickTemplate[] = loadPinnedTemplates()): QuickTemplate[] {
  const out: QuickTemplate[] = [...pinned];
  const seen = new Set(pinned.map((x) => x.key));
  const counts = new Map<string, { item: QuickTemplate; count: number; latest: number }>();

  for (const tx of transactions.slice(0, 200)) {
    if (tx.movement_id != null || tx.id < 0) continue;
    const key = `${tx.type}:${tx.description.trim().toLowerCase()}:${tx.amount}:${tx.category}:${tx.wallet_id}`;
    if (seen.has(key)) continue;
    const prev = counts.get(key);
    const ts = Date.parse(tx.date) || 0;
    if (prev) {
      prev.count += 1;
      prev.latest = Math.max(prev.latest, ts);
    } else {
      counts.set(key, {
        item: {
          key,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          wallet_id: tx.wallet_id,
        },
        count: 1,
        latest: ts,
      });
    }
  }

  const ranked = [...counts.values()]
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .map((x) => x.item);

  for (const r of ranked) {
    if (out.length >= 5) break;
    out.push(r);
  }
  return out;
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(items: OfflineQueueItem[]) {
  try {
    if (items.length) localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
    else localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {}
}

export function enqueueOfflineItem(path: string, method: string, body: unknown): OfflineQueueItem[] {
  const current = loadOfflineQueue();
  const next = [
    ...current,
    {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      path,
      method,
      body,
      createdAt: new Date().toISOString(),
    },
  ];
  saveOfflineQueue(next);
  return next;
}

/** Optimistically applies a POST /transactions batch onto WorkspaceState for instant 0ms UI feedback. */
export function applyOptimisticTransactions(
  state: WorkspaceState,
  entries: Omit<Transaction, "id">[],
): WorkspaceState {
  if (!entries.length) return state;
  const tempBase = -Math.floor(Date.now() % 100000000);
  const created: Transaction[] = entries.map((item, idx) => ({
    ...item,
    id: tempBase - idx - 1,
  }));

  const walletDeltas = new Map<number, number>();
  let spentDelta = 0;
  let incomeDelta = 0;
  let todaySpentDelta = 0;
  const catDeltas = new Map<string, number>();
  const monthPrefix = state.planning.month;
  const todayPrefix = new Date().toISOString().slice(0, 10);

  for (const t of created) {
    const signed = t.type === "income" ? t.amount : -t.amount;
    walletDeltas.set(t.wallet_id, (walletDeltas.get(t.wallet_id) || 0) + signed);
    if (t.date.startsWith(monthPrefix)) {
      if (t.type === "expense") {
        spentDelta += t.amount;
        catDeltas.set(t.category, (catDeltas.get(t.category) || 0) + t.amount);
        if (t.date.slice(0, 10) === todayPrefix) todaySpentDelta += t.amount;
      } else {
        incomeDelta += t.amount;
      }
    }
  }

  return {
    ...state,
    transactions: [...created, ...state.transactions],
    wallets: state.wallets.map((w) =>
      walletDeltas.has(w.id)
        ? { ...w, balance: Math.round((w.balance + (walletDeltas.get(w.id) || 0)) * 100) / 100 }
        : w,
    ),
    budgets: state.budgets.map((b) =>
      catDeltas.has(b.category)
        ? { ...b, spent: Math.round((b.spent + (catDeltas.get(b.category) || 0)) * 100) / 100 }
        : b,
    ),
    planning: {
      ...state.planning,
      spent: Math.round((state.planning.spent + spentDelta) * 100) / 100,
      income: Math.round((state.planning.income + incomeDelta) * 100) / 100,
      today_spent: Math.round((state.planning.today_spent + todaySpentDelta) * 100) / 100,
      today_remaining: Math.max(0, Math.round((state.planning.today_remaining - todaySpentDelta) * 100) / 100),
      remaining: Math.max(0, Math.round((state.planning.remaining - spentDelta) * 100) / 100),
      available: Math.round((state.planning.available + incomeDelta - spentDelta) * 100) / 100,
    },
  };
}

export interface WidgetSummaryPayload {
  signed_in: boolean;
  total_balance: string;
  today_spent: string;
  month_spent: string;
  budget: string;
  top_wallet: string;
  label_total: string;
  label_today: string;
  label_add: string;
  label_sms: string;
  label_transfer: string;
}

/** Builds a localized summary snapshot synced to native Android Home Screen widgets. */
export function buildWidgetSummary(
  state: WorkspaceState,
  moneyFn: (n: number) => string,
  tFn: (s: string) => string,
): WidgetSummaryPayload {
  const totalBalance = state.wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
  const counts = new Map<number, number>();
  for (const tx of state.transactions) {
    counts.set(tx.wallet_id, (counts.get(tx.wallet_id) || 0) + 1);
  }
  const top = [...state.wallets].sort(
    (a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.id - b.id,
  )[0];
  return {
    signed_in: true,
    total_balance: moneyFn(Math.round(totalBalance * 100) / 100),
    today_spent: moneyFn(state.planning.today_spent || 0),
    month_spent: moneyFn(state.planning.spent || 0),
    budget: state.planning.budget > 0 ? moneyFn(state.planning.budget) : "",
    top_wallet: top ? `${top.name} · ${moneyFn(top.balance)}` : "",
    label_total: tFn("Total balance"),
    label_today: tFn("Today"),
    label_add: `+ ${tFn("Quick add")}`,
    label_sms: tFn("Paste SMS"),
    label_transfer: tFn("Transfer"),
  };
}

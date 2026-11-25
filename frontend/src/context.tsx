import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, status, native, device, ApiError, resetRevision } from "./api";
import type { WorkspaceState, CloudStatus, Route, Provider, Transaction } from "./types";
import { translate, type TranslationValues } from "./i18n";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import {
  applyOptimisticTransactions,
  buildWidgetSummary,
  enqueueOfflineItem,
  loadOfflineQueue,
  saveOfflineQueue,
} from "./smartEntry";
const routes = new Set<Route>([
  "home",
  "history",
  "insights",
  "hub",
  "budgets",
  "wallets",
  "goals",
  "loans",
  "regulars",
  "parser",
  "settings",
  "general",
  "categories",
  "connections",
  "data",
  "more",
  "password",
  "security",
]);
const currentRoute = () =>
  routes.has(location.hash.slice(1) as Route)
    ? (location.hash.slice(1) as Route)
    : "home";
interface Context {
  language: "en" | "bn";
  state: WorkspaceState | null;
  cloud: CloudStatus | null;
  providers: Provider[];
  route: Route;
  loading: boolean;
  error: string;
  busy: boolean;
  pendingSync: number;
  refresh: () => Promise<void>;
  syncPending: () => Promise<void>;
  loadMoreTransactions: (loadAll?: boolean) => Promise<void>;
  mutate: (path: string, method: string, body?: unknown) => Promise<unknown>;
  navigate: (route: Route) => void;
  goBack: () => void;
  notify: (message: string) => void;
  t: (text: string, values?: TranslationValues) => string;
  money: (n: number) => string;
}
const Store = createContext<Context | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState | null>(null),
    [cloud, setCloud] = useState<CloudStatus | null>(null),
    [providers, setProviders] = useState<Provider[]>([]),
    [route, setRoute] = useState(currentRoute),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pendingSync, setPendingSync] = useState(() => loadOfflineQueue().length),
    [toast, setToast] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "bn">(
    () => {
      try {
        return localStorage.getItem("hishab-language") === "bn" ? "bn" : "en";
      } catch {
        return "en";
      }
    },
  );
  const language = state?.settings.language || preferredLanguage;
  useEffect(() => {
    if (!state) return;
    setPreferredLanguage(state.settings.language);
    try {
      localStorage.setItem("hishab-language", state.settings.language);
    } catch {}
  }, [state?.settings.language]);
  const generation = useRef(0),
    navigation = useRef({
      key: Date.now().toString(36) + Math.random().toString(36).slice(2),
      index: 0,
    }),
    saving = useRef(false),
    syncing = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncPending = async () => {
    if (native || syncing.current) return;
    const queue = loadOfflineQueue();
    if (!queue.length || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    syncing.current = true;
    try {
      const remaining = [...queue];
      while (remaining.length) {
        const item = remaining[0];
        try {
          await api(item.path, item.method, item.body);
          remaining.shift();
          saveOfflineQueue(remaining);
          setPendingSync(remaining.length);
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            await api<WorkspaceState>("/state");
            await api(item.path, item.method, item.body);
            remaining.shift();
            saveOfflineQueue(remaining);
            setPendingSync(remaining.length);
          } else if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401) {
            remaining.shift();
            saveOfflineQueue(remaining);
            setPendingSync(remaining.length);
          } else {
            break;
          }
        }
      }
      if (!remaining.length) {
        const next = await api<WorkspaceState>("/state");
        setState(next);
        setToast("Synced offline entries");
      }
    } catch {} finally {
      syncing.current = false;
    }
  };

  const loadMoreTransactions = async (loadAll = false) => {
    if (!state || native) return;
    const offset = state.transactions.length;
    const limit = loadAll ? 50000 : 300;
    const page = await api<{ transactions: Transaction[]; has_more: boolean; total: number }>(
      `/transactions?offset=${offset}&limit=${limit}`,
    );
    setState((prev) => {
      if (!prev) return prev;
      const seen = new Set(prev.transactions.map((t) => `${t.id}:${t.movement_id || ""}`));
      const extra = page.transactions.filter((t) => !seen.has(`${t.id}:${t.movement_id || ""}`));
      return {
        ...prev,
        transactions: [...prev.transactions, ...extra],
        has_more_transactions: page.has_more,
        total_transaction_count: page.total,
      };
    });
  };

  const refresh = async () => {
    const id = ++generation.current;
    try {
      const account = await status();
      if (id !== generation.current) return;
      setCloud(account);
      if (!account.signed_in) {
        setState(null);
        resetRevision();
        return;
      }
      if (account.mfa_required) {
        setState(null);
        return;
      }
      if (account.setup_required) return;
      if (!native && loadOfflineQueue().length) await syncPending();
      const next = await api<WorkspaceState>("/state");
      if (id === generation.current) {
        setState(next);
        setError("");
      }
      if (next.settings.ai_enabled)
        api<{ providers: Provider[] }>("/ai/providers")
          .then((result) => {
            if (id === generation.current) setProviders(result.providers);
          })
          .catch(() => {});
    } catch (e) {
      if (id === generation.current)
        setError(e instanceof Error ? e.message : "Could not load account.");
    } finally {
      if (id === generation.current) setLoading(false);
    }
  };
  const mutate = async (path: string, method: string, body?: unknown) => {
    if (saving.current) throw new Error("Wait for the current save.");
    saving.current = true;
    setBusy(true);
    const id = ++generation.current;
    const isTxBatch = path === "/transactions" && method === "POST" && Boolean((body as { transactions?: unknown[] })?.transactions);
    const canQueueOffline = !native && (isTxBatch || (method === "POST" && ["/transfers", "/splits"].includes(path)) || /^\/bills\/\d+\/pay$/.test(path));
    const snapshot = state;
    if (isTxBatch && state) {
      const batch = (body as { transactions: Omit<Transaction, "id">[] }).transactions;
      setState((prev) => (prev ? applyOptimisticTransactions(prev, batch) : prev));
    }
    try {
      if (!native && typeof navigator !== "undefined" && navigator.onLine === false && canQueueOffline) {
        const q = enqueueOfflineItem(path, method, body);
        setPendingSync(q.length);
        return { queued: true };
      }
      const result = await api(path, method, body);
      // Sync authoritative state in the background on fast optimistic tx saves; await on others.
      const bgRefresh = api<WorkspaceState>("/state")
        .then((next) => {
          if (id === generation.current) {
            setState(next);
            setError("");
          }
        })
        .catch(() => {});
      if (!isTxBatch) await bgRefresh;
      return result;
    } catch (e) {
      if (canQueueOffline && !(e instanceof ApiError)) {
        const q = enqueueOfflineItem(path, method, body);
        setPendingSync(q.length);
        return { queued: true };
      }
      if (isTxBatch && snapshot) setState(snapshot);
      if (e instanceof ApiError && (e.status === 409 || e.status === 401))
        await refresh();
      throw e;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const notify = (message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  };
  useEffect(() => {
    void refresh();
    // Mark only entries visited in this app session. A cold deep link returns
    // Home instead of sending the user to an unrelated website.
    history.replaceState(
      { ...history.state, hishabNavigation: navigation.current },
      "",
    );
    const hash = () => {
      const previous = history.state?.hishabNavigation;
      if (previous?.key === navigation.current.key) {
        navigation.current = { ...previous };
      } else {
        navigation.current = {
          ...navigation.current,
          index: navigation.current.index + 1,
        };
        history.replaceState(
          { ...history.state, hishabNavigation: navigation.current },
          "",
        );
      }
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", hash);
    const poll = () => {
      if (
        !saving.current &&
        document.visibilityState === "visible" &&
        !document.querySelector("dialog[open]") &&
        !document.activeElement?.matches("input,textarea,select")
      )
        void refresh();
    };
    const interval = setInterval(poll, 30000);
    const onOnline = () => void syncPending();
    window.addEventListener("focus", poll);
    window.addEventListener("device-sync", poll);
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("focus", poll);
      window.removeEventListener("device-sync", poll);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  useEffect(() => {
    const theme = state?.settings.theme || "dark";
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system"
          ? matchMedia("(prefers-color-scheme:dark)").matches
            ? "dark"
            : "light"
          : theme;
      if (native)
        void SystemBars.setStyle({
          style:
            document.documentElement.dataset.theme === "light"
              ? SystemBarsStyle.Light
              : SystemBarsStyle.Dark,
        }).catch(() => {});
    };
    apply();
    document.documentElement.lang = language;
    const media = matchMedia("(prefers-color-scheme:dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state?.settings.theme, language]);
  const formatMoney = (n: number) =>
    new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-IN", {
      style: "currency",
      currency: state?.settings.currency || "BDT",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  const translateText = (text: string, values?: TranslationValues) =>
    translate(text, language, values);

  useEffect(() => {
    if (!native) return;
    if (!cloud?.signed_in || cloud.mfa_required || !state) {
      void device("widget", { signed_in: false }).catch(() => {});
      return;
    }
    void device("widget", buildWidgetSummary(state, formatMoney, translateText)).catch(() => {});
  }, [state, cloud?.signed_in, cloud?.mfa_required, language]);

  return (
    <Store.Provider
      value={{
        language,
        state,
        cloud,
        providers,
        route,
        loading,
        error,
        busy,
        pendingSync,
        refresh,
        syncPending,
        loadMoreTransactions,
        mutate,
        goBack: () => {
          if (navigation.current.index > 0) history.back();
          else location.hash = "home";
        },
        navigate: (r) => {
          location.hash = r;
          window.scrollTo(0, 0);
        },
        notify,
        t: translateText,
        money: formatMoney,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {translate(toast, language)}
        </div>
      )}
    </Store.Provider>
  );
}
export function useStore() {
  const value = useContext(Store);
  if (!value) throw new Error("Missing store");
  return value;
}

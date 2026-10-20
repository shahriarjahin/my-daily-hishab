import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, status, native, device, ApiError, resetRevision } from "./api";
import type { WorkspaceState, CloudStatus, Route, Provider } from "./types";
import { translate, type TranslationValues } from "./i18n";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
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
  refresh: () => Promise<void>;
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
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (account.setup_required) return;
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
    generation.current++;
    try {
      const result = await api(path, method, body);
      await refresh();
      return result;
    } catch (e) {
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
    window.addEventListener("focus", poll);
    window.addEventListener("device-sync", poll);
    return () => {
      clearInterval(interval);
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("focus", poll);
      window.removeEventListener("device-sync", poll);
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
        refresh,
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
        t: (text, values) => translate(text, language, values),
        money: (n) =>
          new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-IN", {
            style: "currency", currency: state?.settings.currency || "BDT", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2,
          }).format(n),
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

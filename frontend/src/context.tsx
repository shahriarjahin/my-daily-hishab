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
import bangla from "./locales/bn.json";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
const translations: Record<string, string> = {
  Home: "হোম",
  Activity: "লেনদেন",
  Insights: "পরিসংখ্যান",
  Ask: "জিজ্ঞাসা",
  "Ask Hishab": "হিসাবকে জিজ্ঞাসা",
  Settings: "সেটিংস",
  Budgets: "বাজেট",
  Wallets: "ওয়ালেট",
  Goals: "লক্ষ্য",
  Loans: "ঋণ",
  Regulars: "নিয়মিত খরচ",
  Import: "আমদানি",
  More: "আরও",
  Categories: "বিভাগ",
  "AI connections": "এআই সংযোগ",
  "Data & app": "তথ্য ও অ্যাপ",
  Income: "আয়",
  Expense: "খরচ",
  Expenses: "খরচ",
  Transfer: "স্থানান্তর",
  Transfers: "স্থানান্তর",
  Save: "সংরক্ষণ",
  Cancel: "বাতিল",
  Delete: "মুছুন",
  Edit: "সম্পাদনা",
  "Add entry": "এন্ট্রি যোগ",
  "Add wallet": "ওয়ালেট যোগ",
  Amount: "পরিমাণ",
  Category: "বিভাগ",
  Date: "তারিখ",
  Note: "বিবরণ",
  Account: "অ্যাকাউন্ট",
  Wallet: "ওয়ালেট",
  Description: "বিবরণ",
  Recent: "সাম্প্রতিক",
  "See all": "সব দেখুন",
  "View all": "সব দেখুন",
  All: "সব",
  Week: "সপ্তাহ",
  Month: "মাস",
  Year: "বছর",
  "Cash flow": "নিট লেনদেন",
  Spending: "খরচ",
  "Quick entry": "দ্রুত এন্ট্রি",
  "Sign in": "সাইন ইন",
  "Create account": "অ্যাকাউন্ট তৈরি",
  "Sign out": "সাইন আউট",
  Email: "ইমেইল",
  Password: "পাসওয়ার্ড",
  Appearance: "চেহারা",
  Language: "ভাষা",
  Light: "হালকা",
  Dark: "গাঢ়",
  System: "সিস্টেম",
  "Review before saving": "সংরক্ষণের আগে যাচাই",
  "Monthly plan": "মাসিক পরিকল্পনা",
  "Auto-plan": "স্বয়ংক্রিয় পরিকল্পনা",
  "Category budget": "বিভাগের বাজেট",
  "No entries yet": "এখনও কোনো এন্ট্রি নেই",
  "Available balance": "ব্যবহারযোগ্য টাকা",
  "Net cash flow": "নিট লেনদেন",
  Spent: "খরচ",
  Remaining: "অবশিষ্ট",
  "Scan receipt": "রসিদ স্ক্যান",
  "Type with AI": "এআই দিয়ে লিখুন",
  "Save expense": "খরচ সংরক্ষণ",
  "Save income": "আয় সংরক্ষণ",
  "Search transactions": "লেনদেন খুঁজুন",
  "All time": "সব সময়",
  Today: "আজ",
  "This week": "এই সপ্তাহ",
  "This month": "এই মাস",
  "This year": "এই বছর",
  "Sync now": "এখন সিঙ্ক করুন",
  "Check for updates": "আপডেট খুঁজুন",
  "App updates": "অ্যাপ আপডেট",
  "Check automatically": "স্বয়ংক্রিয়ভাবে খুঁজুন",
  Export: "এক্সপোর্ট",
  Filters: "ফিল্টার",
  Clear: "মুছুন",
  "No records": "কোনো রেকর্ড নেই",
  Saved: "সংরক্ষিত",
  "Connection failed": "সংযোগ ব্যর্থ",
  Back: "পিছনে",
  Add: "যোগ করুন",
  Needs: "প্রয়োজন",
  Wants: "ইচ্ছা",
  Savings: "সঞ্চয়",
  "Monthly budget": "মাসিক বাজেট",
  "Planned income": "পরিকল্পিত আয়",
  "Savings target": "সঞ্চয়ের লক্ষ্য",
  "Opening balance": "শুরুর টাকা",
  Name: "নাম",
  "Monthly limit": "মাসিক সীমা",
  "Daily limit": "দৈনিক সীমা",
  Unit: "একক",
  Target: "লক্ষ্য",
  "Due date": "শেষ তারিখ",
  Party: "ব্যক্তি",
  Borrowed: "ধার নেওয়া",
  Lent: "ধার দেওয়া",
  Repay: "পরিশোধ",
  "Existing loan": "আগের ঋণ",
  "New loan": "নতুন ঋণ",
  "Reserve savings": "সঞ্চয় রাখুন",
  Release: "ছাড়ুন",
  "Edit plan": "পরিকল্পনা বদলান",
  "Export backup": "ব্যাকআপ নিন",
  "Recovery copies": "পুনরুদ্ধার কপি",
  "AI server": "এআই সার্ভার",
  "Automatic fallback": "স্বয়ংক্রিয় বিকল্প",
  Connect: "সংযোগ করুন",
  Configure: "সাজান",
  "No AI providers connected": "এআই সংযোগ নেই",
  "Ask about your spending, budgets, and goals.":
    "খরচ, বাজেট এবং লক্ষ্য নিয়ে জিজ্ঞাসা করুন।",
  "What do you want to know about your money?":
    "আপনার টাকা সম্পর্কে কী জানতে চান?",
  "Last 12 months": "গত ১২ মাস",
};
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
  "categories",
  "connections",
  "data",
  "more",
]);
const currentRoute = () =>
  routes.has(location.hash.slice(1) as Route)
    ? (location.hash.slice(1) as Route)
    : "home";
interface Context {
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
  notify: (message: string) => void;
  t: (text: string) => string;
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
  const generation = useRef(0),
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
    const hash = () => setRoute(currentRoute());
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
    document.documentElement.lang = state?.settings.language || "en";
    const media = matchMedia("(prefers-color-scheme:dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state?.settings.theme, state?.settings.language]);
  const language = state?.settings.language || "en";
  return (
    <Store.Provider
      value={{
        state,
        cloud,
        providers,
        route,
        loading,
        error,
        busy,
        refresh,
        mutate,
        navigate: (r) => {
          location.hash = r;
          window.scrollTo(0, 0);
        },
        notify,
        t: (text) =>
          language === "bn"
            ? translations[text] ||
              (bangla as Record<string, string>)[text] ||
              text
            : text,
        money: (n) =>
          "৳" +
          new Intl.NumberFormat(language === "bn" ? "bn-BD" : "en-IN", {
            maximumFractionDigits: 2,
          }).format(n),
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
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

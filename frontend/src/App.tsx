import { useEffect, useState } from "react";
import { useStore } from "./context";
import { api, native, device } from "./api";
import { Icon } from "./components/Icon";
import { Button, Card, ErrorMessage, Modal, Title } from "./components/UI";
import { EntrySheet } from "./components/EntrySheet";
import { RecordForm, formFactory, type FormSpec } from "./forms";
import { Dashboard } from "./screens/Dashboard";
import { Activity } from "./screens/Activity";
import { Budgets, Insights } from "./screens/Planning";
import { Wealth } from "./screens/Wealth";
import { Advisor, Importer, AutoPlan } from "./screens/AI";
import { SettingsScreen } from "./screens/Settings";
import type { Route } from "./types";
import { LoadingScreen } from "./components/LoadingScreen";
function Auth() {
  const { refresh, t } = useStore(),
    [mode, setMode] = useState("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-main">
      <div className="auth-layout">
        <section className="auth-intro">
          <img
            src="/static/hishab-logo-v2.png"
            className="auth-logo"
            alt="Hishab"
          />
          <h1>
            Your money.
            <br />
            Your space.
            <br />
            <span>Everywhere.</span>
          </h1>
          <p>English, বাংলা or Banglish · Your everyday finance companion</p>
        </section>
        <Card className="auth-card">
          <div className="signin-brand">
            <img src="/static/hishab-logo-v2.png" alt="Hishab logo" />
            <span>Hishab</span>
          </div>
          <h2>{t(mode === "login" ? "Sign in" : "Create account")}</h2>
          <div className="modern-segment auth-tabs">
            {[
              ["login", "Sign in"],
              ["signup", "Create account"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={mode === id ? "active" : ""}
                onClick={() => {
                  setMode(id);
                  setError("");
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <form
            id="auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setWorking(true);
              setError("");
              try {
                const result = await api<{
                  signed_in: boolean;
                  message?: string;
                }>("/auth/" + mode, "POST", { email, password });
                setPassword("");
                if (result.signed_in) await refresh();
                else
                  setError(
                    result.message ||
                      "Confirm your account by email, then sign in.",
                  );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setWorking(false);
              }
            }}
          >
            <label className="form-field">
              {t("Email")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="form-field section-gap">
              {t("Password")}
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={6}
                maxLength={1024}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <ErrorMessage message={error} />
            <Button type="submit" disabled={working}>
              {working
                ? "Working…"
                : t(mode === "login" ? "Sign in" : "Create account")}
            </Button>
          </form>
          <p className="form-hint">
            {native
              ? "Encrypted on this phone. Syncs with your account."
              : "Your records stay in your cloud account."}
          </p>
        </Card>
      </div>
    </main>
  );
}
export default function App() {
  const {
      state: s,
      cloud,
      route,
      loading,
      error,
      refresh,
      t,
      navigate,
      busy,
      mutate,
    } = useStore(),
    [sheet, setSheet] = useState(false),
    [form, setForm] = useState<FormSpec | null>(null),
    [deletion, setDeletion] = useState<{ path: string; label: string } | null>(
      null,
    ),
    [deleteError, setDeleteError] = useState(""),
    [auto, setAuto] = useState(false);
  useEffect(() => {
    const back = () => {
      if (deletion) setDeletion(null);
      else if (auto) setAuto(false);
      else if (form) setForm(null);
      else if (sheet) setSheet(false);
      else if (route !== "home") navigate("home");
      else if (native) void device("exit");
    };
    window.addEventListener("hishab-back", back);
    return () => window.removeEventListener("hishab-back", back);
  }, [deletion, auto, form, sheet, route]);
  const remove = (path: string, label: string) => {
    setDeleteError("");
    setDeletion({ path, label });
  };
  if (loading) return <LoadingScreen />;
  if (error && !s)
    return (
      <main>
        <Card>
          <h1>Could not load Hishab</h1>
          <ErrorMessage message={error} />
          <Button onClick={() => void refresh()}>Retry</Button>
        </Card>
      </main>
    );
  if (!cloud?.signed_in) return <Auth />;
  if (cloud.setup_required)
    return (
      <main>
        <Card>
          <h1>Cloud setup required</h1>
          <p>{cloud.message}</p>
          <a href="/api/cloud/setup.sql">Setup SQL</a>
          <Button onClick={() => void refresh()}>Check again</Button>
        </Card>
      </main>
    );
  if (!s) return <main>Loading your account…</main>;
  const forms = formFactory(s),
    links: [Route, string, string][] = [
      ["home", "Home", "home"],
      ["history", "Activity", "history"],
      ["insights", "Insights", "insights"],
      ["budgets", "Budgets", "wallet"],
      ["wallets", "Wallets", "wallet"],
      ["hub", "Ask", "spark"],
      ["more", "More", "other"],
      ["settings", "Settings", "settings"],
    ],
    active =
      route === "history"
        ? "history"
        : route === "insights"
          ? "insights"
          : route === "hub"
            ? "hub"
            : "home";
  let content;
  switch (route) {
    case "home":
      content = (
        <Dashboard edit={setForm} add={() => setSheet(true)} remove={remove} />
      );
      break;
    case "history":
      content = <Activity edit={setForm} remove={remove} />;
      break;
    case "budgets":
      content = (
        <Budgets
          edit={setForm}
          remove={remove}
          autoPlan={() => setAuto(true)}
        />
      );
      break;
    case "insights":
      content = <Insights />;
      break;
    case "hub":
      content = <Advisor />;
      break;
    case "parser":
      content = <Importer />;
      break;
    case "wallets":
    case "goals":
    case "loans":
    case "regulars":
    case "categories":
      content = <Wealth edit={setForm} remove={remove} />;
      break;
    case "settings":
    case "connections":
    case "data":
      content = <SettingsScreen edit={setForm} />;
      break;
    default:
      content = (
        <>
          <Title>More</Title>
          <div className="destination-list">
            {(
              [
                ...links.filter((x) =>
                  ["wallets", "budgets", "hub", "settings"].includes(x[0]),
                ),
                ["goals", "Goals", "savings"],
                ["loans", "Loans", "business"],
                ["regulars", "Regulars", "utilities"],
                ["parser", "Import", "history"],
              ] as [Route, string, string][]
            ).map(([r, label, i]) => (
              <button
                className="destination-card"
                key={r}
                onClick={() => navigate(r)}
              >
                <Icon name={i} />
                <strong>{t(label)}</strong>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </>
      );
  }
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <a href="#home" className="brand">
            <img
              src="/static/hishab-logo-v2.png"
              className="brand-logo"
              alt=""
            />
            <span>hishab.</span>
          </a>
          <nav aria-label="Main navigation">
            {links.map(([r, label, i]) => (
              <a
                href={"#" + r}
                key={r}
                className={"nav-item " + (route === r ? "active" : "")}
                aria-current={route === r ? "page" : undefined}
              >
                <Icon name={i} />
                <span>{t(label)}</span>
              </a>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="status-dot" />
            {native ? "Encrypted on device" : "Cloud account"}
          </div>
        </aside>
        <div className="workspace">
          <main id="main" key={route}>
            {error && <ErrorMessage message={error} />} {content}
          </main>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(
          [
            ["home", "Home", "home"],
            ["history", "Activity", "history"],
            ["add", "", "plus"],
            ["insights", "Insights", "insights"],
            ["hub", "Ask", "spark"],
          ] as const
        ).map(([r, label, i]) =>
          r === "add" ? (
            <button
              className="nav-create"
              key={r}
              aria-label={t("Add entry")}
              onClick={() => setSheet(true)}
            >
              <Icon name={i} />
            </button>
          ) : (
            <a
              key={r}
              href={"#" + r}
              className={"nav-item " + (active === r ? "active" : "")}
              aria-current={active === r ? "page" : undefined}
            >
              <Icon name={i} />
              <span>{t(label)}</span>
            </a>
          ),
        )}
      </nav>
      {sheet && (
        <EntrySheet
          close={() => setSheet(false)}
          transfer={() => {
            setSheet(false);
            setForm(forms.transfer());
          }}
          smart={() => {
            setSheet(false);
            navigate("parser");
          }}
        />
      )}
      {form && (
        <RecordForm
          key={form.path + form.title}
          spec={form}
          close={() => setForm(null)}
        />
      )}{" "}
      {auto && <AutoPlan close={() => setAuto(false)} />}{" "}
      {deletion && (
        <Modal title="Delete" close={() => setDeletion(null)}>
          <p>Remove “{deletion.label}”? Related balances will update.</p>
          <ErrorMessage message={deleteError} />
          <div className="form-actions">
            <Button secondary onClick={() => setDeletion(null)}>
              {t("Cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                try {
                  await mutate(deletion.path, "DELETE");
                  setDeletion(null);
                } catch (e) {
                  setDeleteError((e as Error).message);
                }
              }}
            >
              {t("Delete")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

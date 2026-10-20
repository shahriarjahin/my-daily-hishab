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
import { PasswordForm } from "./components/PasswordForm";
import {
  AndroidWelcome,
  WelcomeName,
  QuickStart,
} from "./components/Onboarding";
import { Security, MFAVerification } from "./screens/Security";
import { usePasskey } from "./passkeys";
import { LoadingScreen } from "./components/LoadingScreen";
function Auth() {
  const { refresh, t } = useStore(),
    [mode, setMode] = useState(
      new URLSearchParams(location.search).has("forgot")
        ? "forgot-password"
        : "login",
    ),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [signupName, setSignupName] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState(
      new URLSearchParams(location.search).has("auth_error")
        ? "Sign-in link expired. Please try again."
        : "",
    ),
    [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    if (!native)
      void api<{ providers: string[] }>("/auth/providers")
        .then((x) => setProviders(x.providers))
        .catch(() => {});
  }, []);
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
            {t("Your money.")}
            <br />
            {t("Your space.")}
            <br />
            <span>{t("Everywhere.")}</span>
          </h1>
          <p>
            {t("English, বাংলা or Banglish · Your everyday finance companion")}
          </p>
        </section>
        <Card className="auth-card">
          <div className="signin-brand">
            <img src="/static/hishab-logo-v2.png" alt="Hishab logo" />
            <span>Hishab</span>
          </div>
          <h2>
            {t(
              mode === "forgot-password"
                ? "Reset password"
                : mode === "login"
                  ? "Sign in"
                  : "Create account",
            )}
          </h2>
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
              if (native && mode === "forgot-password") {
                try {
                  await device("forgot-password");
                } catch (e) {
                  setError((e as Error).message);
                }
                return;
              }
              setWorking(true);
              setError("");
              try {
                const result = await api<{
                  signed_in: boolean;
                  message?: string;
                }>(
                  "/auth/" + mode,
                  "POST",
                  mode === "forgot-password"
                    ? { email }
                    : {
                        email,
                        password,
                        ...(mode === "signup"
                          ? { name: signupName.trim() }
                          : {}),
                      },
                );
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
            {mode === "signup" && (
              <label className="form-field">
                {t("What should we call you?")}
                <input
                  name="name"
                  required
                  autoComplete="given-name"
                  maxLength={60}
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                />
              </label>
            )}
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
            {mode !== "forgot-password" && (
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
            )}
            <ErrorMessage message={error} />
            <Button type="submit" disabled={working}>
              {working
                ? t("Working…")
                : t(
                    mode === "forgot-password"
                      ? "Reset password"
                      : mode === "login"
                        ? "Sign in"
                        : "Create account",
                  )}
            </Button>
          </form>
          <button
            className="text-button section-gap"
            onClick={() => {
              setMode(mode === "forgot-password" ? "login" : "forgot-password");
              setError("");
            }}
          >
            {t(
              mode === "forgot-password"
                ? "Back to sign in"
                : "Forgot password?",
            )}
          </button>
          {providers.map((provider) => (
            <a
              className="secondary-button oauth-button"
              key={provider}
              href={"/api/auth/oauth/" + provider}
            >
              {t(
                provider === "google"
                  ? "Continue with Google"
                  : "Continue with GitHub",
              )}
            </a>
          ))}
          <button
            type="button"
            className="secondary-button oauth-button"
            disabled={working}
            onClick={async () => {
              setWorking(true);
              setError("");
              try {
                await usePasskey();
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setWorking(false);
              }
            }}
          >
            {t("Sign in with a passkey")}
          </button>
          <p className="form-hint">
            {t(
              native
                ? "Encrypted on this phone. Syncs with your account."
                : "Your records stay in your cloud account.",
            )}
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
      goBack,
      busy,
      mutate,
    } = useStore(),
    [sheet, setSheet] = useState(false),
    [form, setForm] = useState<FormSpec | null>(null),
    [deletion, setDeletion] = useState<{ path: string; label: string } | null>(
      null,
    ),
    [deleteError, setDeleteError] = useState(""),
    [auto, setAuto] = useState(false),
    [cloudChoice, setCloudChoice] = useState(false),
    [tutorial, setTutorial] = useState(false);
  useEffect(() => {
    const back = () => {
      if (document.querySelector(".quickstart-slide")) {
        window.dispatchEvent(new Event("hishab-tutorial-dismiss"));
        return;
      }
      if (deletion) setDeletion(null);
      else if (auto) setAuto(false);
      else if (form) setForm(null);
      else if (sheet) setSheet(false);
      else if (route !== "home") goBack();
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
          <h1>{t("Could not load Hishab")}</h1>
          <ErrorMessage message={error} />
          <Button onClick={() => void refresh()}>{t("Retry")}</Button>
        </Card>
      </main>
    );
  if (!cloud?.signed_in)
    return native && !cloudChoice ? (
      <AndroidWelcome cloud={() => setCloudChoice(true)} />
    ) : (
      <>
        <Auth />
        {native && (
          <button
            className="welcome-back text-button"
            onClick={() => setCloudChoice(false)}
          >
            {t("Back")}
          </button>
        )}
      </>
    );
  if (cloud.mfa_required) return <MFAVerification />;
  if (cloud.setup_required)
    return (
      <main>
        <Card>
          <h1>{t("Cloud setup required")}</h1>
          <p>{cloud.message}</p>
          <a href="/api/cloud/setup.sql">{t("Setup SQL")}</a>
          <Button onClick={() => void refresh()}>{t("Check again")}</Button>
        </Card>
      </main>
    );
  if (!s) return <main>{t("Loading your account…")}</main>;
  if (!s.settings.name.trim()) return <WelcomeName />;
  const showTutorial =
    tutorial ||
    (!s.settings.tutorial_seen &&
      !s.transactions.length &&
      !s.movements.length &&
      !s.goals.length &&
      !s.loans.length);
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
  const navOptions: [Route, string, string][] = [
    ["wallets", "Wallets", "wallet"],
    ["budgets", "Budgets", "wallet"],
    ["goals", "Goals", "savings"],
    ["regulars", "Regulars", "utilities"],
    ["loans", "Loans", "business"],
    ["more", "More", "other"],
    ["hub", "Ask", "spark"],
  ];
  const fifth =
    navOptions.find(
      (x) =>
        x[0] === s.settings.bottom_nav &&
        (x[0] !== "hub" || s.settings.ai_enabled),
    ) || navOptions[0];
  let content;
  switch (route) {
    case "password":
      content = (
        <PasswordForm
          recovery={
            new URLSearchParams(location.search).get("recovery") === "1"
          }
        />
      );
      break;
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
    case "security":
      content = <Security />;
      break;
    case "general":
    case "settings":
    case "connections":
    case "data":
      content = (
        <SettingsScreen edit={setForm} quickStart={() => setTutorial(true)} />
      );
      break;
    default:
      content = (
        <>
          <Title>{t("More")}</Title>
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
            )
              .filter(
                ([r]) =>
                  s.settings.ai_enabled ||
                  (r === "parser" && cloud?.offline_ai?.enabled) ||
                  !["hub", "parser"].includes(r),
              )
              .map(([r, label, i]) => (
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
  if (
    !s.settings.ai_enabled &&
    !(route === "parser" && cloud?.offline_ai?.enabled) &&
    ["hub", "parser", "connections"].includes(route)
  )
    content = (
      <>
        <Title>{t("AI")}</Title>
        <Card>
          <Button onClick={() => navigate("settings")}>
            {t("Enable AI in Settings")}
          </Button>
        </Card>
      </>
    );
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
          <nav aria-label={t("Main navigation")}>
            {links
              .filter(([r]) => s.settings.ai_enabled || r !== "hub")
              .map(([r, label, i]) => (
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
            {t(native ? "Encrypted on device" : "Cloud account")}
          </div>
        </aside>
        <div className="workspace">
          <main id="main" data-route={route} key={route}>
            {error && <ErrorMessage message={error} />} {content}
          </main>
        </div>
      </div>
      <nav className="mobile-nav" aria-label={t("Mobile navigation")}>
        {(
          [
            ["home", "Home", "home"],
            ["history", "Activity", "history"],
            ["add", "", "plus"],
            ["insights", "Insights", "insights"],
            fifth,
          ] as [string, string, string][]
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
              className={
                "nav-item " +
                (route === r ||
                (r === "home" && active === "home" && route !== fifth[0])
                  ? "active"
                  : "")
              }
              aria-current={route === r ? "page" : undefined}
            >
              <Icon name={i} />
              <span>{t(label)}</span>
            </a>
          ),
        )}
      </nav>
      {showTutorial && <QuickStart close={() => setTutorial(false)} />}
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
          <p>
            {t("Remove “{name}”? Related balances will update.", {
              name: deletion.label,
            })}
          </p>
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

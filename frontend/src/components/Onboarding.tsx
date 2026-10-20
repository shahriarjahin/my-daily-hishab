import { useEffect, useState } from "react";
import { useStore } from "../context";
import { device } from "../api";
import { Button, Card, ErrorMessage, Modal } from "./UI";
import { Icon } from "./Icon";
export function AndroidWelcome({ cloud }: { cloud: () => void }) {
  const { t, refresh } = useStore();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="welcome-main">
      <Card className="welcome-card">
        <img src="/static/hishab-logo-v2.png" alt="Hishab" width="64" />
        <h1>{t("Welcome to Hishab")}</h1>
        <label className="form-field">
          {t("What should we call you?")}
          <input
            autoComplete="given-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="welcome-options">
          <button
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await device("offline", { name: name.trim() });
                await refresh();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="wallet" />
            <strong>{t("Use offline")}</strong>
            <small>{t("Only on this phone. No account needed.")}</small>
          </button>
          <button
            disabled={!name.trim() || busy}
            onClick={async () => {
              try {
                await device("welcome-name", { name: name.trim() });
                cloud();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Icon name="transfer" />
            <strong>{t("Sync with cloud")}</strong>
            <small>{t("Sign in or create an account.")}</small>
          </button>
        </div>
        <ErrorMessage message={error} />
      </Card>
    </main>
  );
}
export function WelcomeName() {
  const { t, cloud, mutate } = useStore();
  const [name, setName] = useState(cloud?.name || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="welcome-main">
      <Card className="welcome-card">
        <img src="/static/hishab-logo-v2.png" alt="Hishab" width="64" />
        <h1>{t("Welcome to Hishab")}</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await mutate("/settings", "PATCH", { name: name.trim() });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="form-field">
            {t("What should we call you?")}
            <input
              autoFocus
              autoComplete="given-name"
              maxLength={60}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={!name.trim() || busy}>
            {t("Continue")}
          </Button>
        </form>
      </Card>
    </main>
  );
}
const steps = [
  [
    "wallet",
    "Start with your wallets",
    "Add cash, bank and mobile wallets with their current balances.",
  ],
  [
    "plus",
    "Record your day",
    "Tap + for income or expenses. Choose the wallet used for each entry.",
  ],
  [
    "transfer",
    "Move money correctly",
    "Use Transfer between your wallets. Loans track money borrowed or lent.",
  ],
  [
    "savings",
    "Plan ahead",
    "Set budgets, reserve savings and build goals without changing your cash balance.",
  ],
  [
    "insights",
    "See the bigger picture",
    "Activity shows your records. Insights shows spending patterns.",
  ],
  [
    "settings",
    "Make it yours",
    "Choose language, appearance and currency in Settings. AI is optional.",
  ],
] as const;
export function QuickStart({ close }: { close: () => void }) {
  const { t, mutate } = useStore();
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const done = async () => {
    setBusy(true);
    try {
      await mutate("/settings", "PATCH", { tutorial_seen: true });
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const dismiss = () => void done();
    window.addEventListener("hishab-tutorial-dismiss", dismiss);
    return () => window.removeEventListener("hishab-tutorial-dismiss", dismiss);
  }, [mutate]);
  const [icon, title, body] = steps[index];
  return (
    <Modal title="Quick start" close={() => void done()}>
      <div className="quickstart-slide">
        <span className="tutorial-icon">
          <Icon name={icon} />
        </span>
        <small>
          {index + 1} / {steps.length}
        </small>
        <h2>{t(title)}</h2>
        <p>{t(body)}</p>
      </div>
      <ErrorMessage message={error} />
      <div className="form-actions">
        <Button
          secondary
          disabled={busy}
          onClick={() => (index ? setIndex(index - 1) : void done())}
        >
          {t(index ? "Back" : "Skip")}
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            index === steps.length - 1 ? void done() : setIndex(index + 1)
          }
        >
          {t(index === steps.length - 1 ? "Get started" : "Next")}
        </Button>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { useStore } from "../context";
import { api, native, device, exportFile } from "../api";
import { Title, Card, Button, ErrorMessage, Modal } from "../components/UI";
import { Icon } from "../components/Icon";
import { formFactory, type Editor } from "../forms";
import type { Provider, CloudStatus, Settings as SettingsType } from "../types";
function DeviceSettings() {
  const { t, notify, refresh } = useStore(),
    [status, setStatus] = useState<CloudStatus | null>(null),
    [updates, setUpdates] = useState({ automatic: true, version: "" }),
    [server, setServer] = useState(""),
    [error, setError] = useState(""),
    [conflict, setConflict] = useState(false);
  const check = async () => {
    const value = await device<CloudStatus>("status");
    setStatus(value);
    setServer(value.backend_url || "");
  };
  useEffect(() => {
    void check();
    device<typeof updates>("updates")
      .then(setUpdates)
      .catch(() => {});
  }, []);
  const run = async (op: string, body: unknown = {}) => {
    try {
      await device(op, body);
      await check();
      await refresh();
      notify(t("Saved"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Card className="section-gap">
        <div className="section-title">
          <h2>{t("Sync now")}</h2>
          <span className="pill">{status?.sync_state}</span>
        </div>
        <div className="toolbar">
          <Button onClick={() => void run("sync")}>{t("Sync now")}</Button>
          <Button
            secondary
            onClick={async () => {
              try {
                const local = await device<{ workspace: unknown }>("load");
                await exportFile(
                  "hishab-backup.json",
                  JSON.stringify(local.workspace, null, 2),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("Export backup")}
          </Button>
          <Button
            secondary
            onClick={async () => {
              try {
                await exportFile(
                  "hishab-recovery.json",
                  JSON.stringify(await device("recoveries"), null, 2),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("Recovery copies")}
          </Button>
          {status?.sync_state === "conflict" && (
            <Button onClick={() => setConflict(true)}>Review conflict</Button>
          )}
        </div>
        <details>
          <summary>{t("AI server")}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("config", { backend_url: server });
            }}
          >
            <label className="form-field">
              HTTPS backend URL
              <input
                type="url"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                required
              />
            </label>
            <p className="form-hint">
              Use your own Hishab server. Your sign-in token is sent to this
              server for AI requests.
            </p>
            <Button type="submit">{t("Save")}</Button>
          </form>
        </details>
      </Card>
      <Card className="section-gap">
        <div className="section-title">
          <h2>{t("App updates")}</h2>
          <span>{updates.version}</span>
        </div>
        <label className="settings-row">
          {t("Check automatically")}
          <input
            type="checkbox"
            checked={updates.automatic}
            onChange={(e) =>
              device<typeof updates>("updates", { automatic: e.target.checked })
                .then(setUpdates)
                .catch((e) => setError(e.message))
            }
          />
        </label>
        <Button
          secondary
          onClick={() =>
            void device("updates", { check: true }).catch((e) =>
              setError(e.message),
            )
          }
        >
          {t("Check for updates")}
        </Button>
        <p className="form-hint">
          GitHub downloads · Android confirms installation
        </p>
      </Card>
      <ErrorMessage message={error} />
      {conflict && (
        <Modal title="Choose a sync copy" close={() => setConflict(false)}>
          <p>
            Choose the complete workspace to keep. Both versions are saved as
            recovery copies before replacement.
          </p>
          <div className="toolbar">
            <Button
              onClick={() => {
                setConflict(false);
                void run("resolve", { choice: "cloud" });
              }}
            >
              Use cloud copy
            </Button>
            <Button
              secondary
              onClick={() => {
                setConflict(false);
                void run("resolve", { choice: "device" });
              }}
            >
              Keep phone copy
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SettingsScreen({ edit }: { edit: Editor }) {
  const {
      state: s,
      cloud,
      providers,
      route,
      t,
      navigate,
      mutate,
      notify,
    } = useStore(),
    [error, setError] = useState(""),
    [name, setName] = useState(s!.settings.name),
    [confirmLogout, setConfirmLogout] = useState(false),
    [restore, setRestore] = useState<File | null>(null);
  const forms = formFactory(s!);
  const save = async (values: Partial<SettingsType>) => {
    try {
      await mutate("/settings", "PATCH", values);
      notify(t("Saved"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (route === "connections")
    return (
      <>
        <Title>AI connections</Title>
        <p className="form-hint">
          {t("Automatic fallback")} · lower priority first
        </p>
        {providers.length ? (
          providers.map((p) => (
            <Card key={p.id} className="list-card">
              <div>
                <h2>{p.name}</h2>
                <p className="muted">{p.model}</p>
                <p className={p.configured ? "positive" : "muted"}>
                  {p.configured
                    ? p.enabled
                      ? "Connected"
                      : "Paused"
                    : "Not connected"}
                  {p.last_error
                    ? " · " + p.last_error.replaceAll("_", " ")
                    : ""}
                </p>
              </div>
              <Button secondary onClick={() => edit(forms.provider(p))}>
                {t(p.configured ? "Configure" : "Connect")}
              </Button>
            </Card>
          ))
        ) : (
          <p>{t("No AI providers connected")}</p>
        )}
        <Button
          secondary
          onClick={() =>
            void mutate("/ai/retry", "POST", {}).catch((e) =>
              setError(e.message),
            )
          }
        >
          Retry providers
        </Button>
        <p className="form-hint">
          Keys are encrypted on the server. AI requests may reach multiple
          providers.
        </p>
        <ErrorMessage message={error} />
      </>
    );
  if (route === "data")
    return (
      <>
        <Title>Data & app</Title>
        <Card>
          <h2>{t("Export")}</h2>
          <Button
            secondary
            onClick={async () => {
              try {
                const safe = (v: unknown) => {
                  let text = String(v ?? "");
                  if (/^\s*[=+@-]/.test(text)) text = "'" + text;
                  return '"' + text.replaceAll('"', '""') + '"';
                };
                await exportFile(
                  "hishab-transactions.csv",
                  "\ufeff" +
                    [
                      [
                        "Date",
                        "Description",
                        "Type",
                        "Category",
                        "Amount",
                        "Wallet",
                      ],
                      ...s!.transactions.map((r) => [
                        r.date,
                        r.description,
                        r.type,
                        r.category,
                        r.amount,
                        s!.wallets.find((w) => w.id === r.wallet_id)?.name,
                      ]),
                    ]
                      .map((row) => row.map(safe).join(","))
                      .join("\r\n"),
                  "text/csv",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            CSV
          </Button>
          <p className="form-hint">
            {s!.transactions.length} entries · {s!.wallets.length} wallets
          </p>
        </Card>
        {!native && (
          <Card className="section-gap">
            <h2>Import previous records</h2>
            <p className="form-hint">
              Only allowed for an empty account. Existing records are protected.
            </p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setRestore(e.target.files?.[0] || null)}
            />
            <Button
              secondary
              disabled={!restore}
              onClick={async () => {
                try {
                  if (!restore) return;
                  if (restore.size > 8000000)
                    throw new Error("Backup is too large.");
                  await mutate("/cloud/import", "POST", {
                    data: JSON.parse(await restore.text()),
                    expected_revision: s!.revision,
                  });
                  notify(t("Saved"));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t("Import")}
            </Button>
          </Card>
        )}
        {native && <DeviceSettings />}
        <ErrorMessage message={error} />
      </>
    );
  return (
    <>
      <Title>Settings</Title>
      <Card>
        <form
          className="settings-row"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ name });
          }}
        >
          <label className="form-field">
            {t("Name")}
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit" secondary>
            {t("Save")}
          </Button>
        </form>
        <label className="settings-row">
          {t("Appearance")}
          <select
            aria-label={t("Appearance")}
            value={s!.settings.theme}
            onChange={(e) =>
              void save({ theme: e.target.value as SettingsType["theme"] })
            }
          >
            {(["light", "dark", "glass", "system"] as const).map((v) => (
              <option key={v} value={v}>
                {t(
                  v === "glass"
                    ? "Liquid Glass"
                    : v[0].toUpperCase() + v.slice(1),
                )}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-row">
          {t("Language")}
          <select
            aria-label={t("Language")}
            value={s!.settings.language}
            onChange={(e) =>
              void save({ language: e.target.value as "en" | "bn" })
            }
          >
            <option value="en">English</option>
            <option value="bn">বাংলা</option>
          </select>
        </label>
        <label className="settings-row">
          {t("Review before saving")}
          <input
            type="checkbox"
            checked={s!.settings.review_before_saving}
            onChange={(e) =>
              void save({ review_before_saving: e.target.checked })
            }
          />
        </label>
        <div className="settings-row">
          <span>BDT · Bangladeshi taka</span>
          <span>৳</span>
        </div>
      </Card>
      <div className="destination-list section-gap">
        {(
          [
            ["categories", "Categories", "shopping"],
            ["connections", "AI connections", "spark"],
            ["data", "Data & app", "download"],
          ] as const
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
      {native && <DeviceSettings />}
      <Card className="developer-credit section-gap">
        <small>Developed by</small>
        <h3>Shahriar Morshed Jahin</h3>
        <div className="credit-links">
          <a
            href="https://github.com/shahriarjahin"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
          <span>
            Courtesy of <strong>DigitXBD</strong>
          </span>
        </div>
      </Card>
      <div className="settings-row">
        <span className="muted">{cloud?.email}</span>
        <Button secondary onClick={() => setConfirmLogout(true)}>
          {t("Sign out")}
        </Button>
      </div>
      <ErrorMessage message={error} />
      {confirmLogout && (
        <Modal title="Sign out" close={() => setConfirmLogout(false)}>
          <p>
            Sync pending changes or export a backup before removing this
            account’s session.
          </p>
          <div className="toolbar">
            <Button
              onClick={() =>
                void mutate("/auth/logout", "POST", {}).catch((e) =>
                  setError(e.message),
                )
              }
            >
              {t("Sign out")}
            </Button>
            <Button secondary onClick={() => setConfirmLogout(false)}>
              {t("Cancel")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

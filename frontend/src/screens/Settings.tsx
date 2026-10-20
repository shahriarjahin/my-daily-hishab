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
      notify("Saved");
      return true;
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Card className="section-gap">
        <div className="section-title">
          <h2>{t("Sync now")}</h2>
          <span className="pill">{t(status?.sync_state || "idle")}</span>
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
            <Button onClick={() => setConflict(true)}>
              {t("Review conflict")}
            </Button>
          )}
        </div>
        <details>
          <summary>{t("App server")}</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("config", { backend_url: server });
            }}
          >
            <label className="form-field">
              {t("HTTPS backend URL")}
              <input
                type="url"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                required
              />
            </label>
            <p className="form-hint">
              {t("Use your own Hishab server for cloud sync and optional AI.")}
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
          {t("GitHub downloads · Android confirms installation")}
        </p>
      </Card>
      <ErrorMessage message={error} />
      {conflict && (
        <Modal title="Choose a sync copy" close={() => setConflict(false)}>
          <p>
            {t(
              "Choose the complete workspace to keep. Both versions are saved as recovery copies before replacement.",
            )}
          </p>
          <div className="toolbar">
            <Button
              onClick={() => {
                setConflict(false);
                void run("resolve", { choice: "cloud" });
              }}
            >
              {t("Use cloud copy")}
            </Button>
            <Button
              secondary
              onClick={() => {
                setConflict(false);
                void run("resolve", { choice: "device" });
              }}
            >
              {t("Keep phone copy")}
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
      busy,
    } = useStore(),
    [error, setError] = useState(""),
    [name, setName] = useState(s!.settings.name),
    [editingName, setEditingName] = useState(false),
    [confirmLogout, setConfirmLogout] = useState(false),
    [restore, setRestore] = useState<File | null>(null);
  const forms = formFactory(s!);
  const save = async (values: Partial<SettingsType>) => {
    try {
      await mutate("/settings", "PATCH", values);
      notify("Saved");
      return true;
    } catch (e) {
      setError((e as Error).message);
    }
  };
  if (route === "connections")
    return (
      <>
        <Title>{t("AI connections")}</Title>
        <p className="form-hint">
          {t("Automatic fallback")} · {t("lower priority first")}
        </p>
        {providers.length ? (
          providers.map((p) => (
            <Card key={p.id} className="list-card">
              <div>
                <h2>{p.name}</h2>
                <p className="muted">{p.model}</p>
                <p className={p.configured ? "positive" : "muted"}>
                  {t(
                    p.configured
                      ? p.enabled
                        ? "Connected"
                        : "Paused"
                      : "Not connected",
                  )}
                  {p.last_error
                    ? " · " + t(p.last_error.replaceAll("_", " "))
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
          {t("Retry providers")}
        </Button>
        <p className="form-hint">
          {t(
            "Keys are encrypted on the server. AI requests may reach multiple providers.",
          )}
        </p>
        <ErrorMessage message={error} />
      </>
    );
  if (route === "data")
    return (
      <>
        <Title>{t("Data & app")}</Title>
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
            {t("{count} entries", { count: s!.transactions.length })} ·{" "}
            {t("{count} wallets", { count: s!.wallets.length })}
          </p>
        </Card>
        {!native && (
          <Card className="section-gap">
            <h2>{t("Import previous records")}</h2>
            <p className="form-hint">
              {t(
                "Only allowed for an empty account. Existing records are protected.",
              )}
            </p>
            <input disabled={busy}
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
                  notify("Saved");
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
  if (route === "general") return <><Title>{t("General & Appearance")}</Title>
      <Card>

        <label className="settings-row">
          {t("Appearance")}
          <select disabled={busy}
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
          <select disabled={busy}
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
          {t("Enable AI")}
          <input disabled={busy}
            type="checkbox"
            checked={s!.settings.ai_enabled}
            onChange={(e) => void save({ ai_enabled: e.target.checked })}
          />
        </label>
        <label className="settings-row">
          {t("Currency")}
          <select disabled={busy}
            aria-label={t("Currency")}
            value={s!.settings.currency || "BDT"}
            onChange={(e) => void save({ currency: e.target.value })}
          >
            {[
              "BDT",
              "USD",
              "EUR",
              "GBP",
              "INR",
              "PKR",
              "AED",
              "SAR",
              "QAR",
              "KWD",
              "CAD",
              "AUD",
              "SGD",
              "MYR",
              "JPY",
              "CNY",
            ].map((code) => (
              <option key={code} value={code}>
                {code} ·{" "}
                {new Intl.DisplayNames(
                  [s!.settings.language === "bn" ? "bn" : "en"],
                  { type: "currency" },
                ).of(code)}
              </option>
            ))}
          </select>
        </label>
        <p className="form-hint">
          {t("Currency changes the display only; amounts are not converted.")}
        </p>
        <label className="settings-row">
          {t("Bottom navigation")}
          <select disabled={busy}
            aria-label={t("Bottom navigation")}
            value={!s!.settings.ai_enabled && s!.settings.bottom_nav === "hub" ? "wallets" : s!.settings.bottom_nav || "wallets"}
            onChange={(e) =>
              void save({
                bottom_nav: e.target.value as SettingsType["bottom_nav"],
              })
            }
          >
            {[
              ["wallets", "Wallets"],
              ["budgets", "Budgets"],
              ["goals", "Goals"],
              ["regulars", "Regulars"],
              ["loans", "Loans"],
              ["more", "More"],
              ...(s!.settings.ai_enabled ? [["hub", "Ask"]] : []),
            ].map(([route, label]) => (
              <option key={route} value={route}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        {s!.settings.ai_enabled && (
          <label className="settings-row">
            {t("Review before saving")}
            <input disabled={busy}
              type="checkbox"
              checked={s!.settings.review_before_saving}
              onChange={(e) =>
                void save({ review_before_saving: e.target.checked })
              }
            />
          </label>
        )}
      </Card>
<ErrorMessage message={error}/></>;
  return (
    <>
      <Title>{t("Settings")}</Title>
      <Card className="account-card">
        <form className="account-identity" onSubmit={e=>{e.preventDefault();if(editingName)void save({name}).then(saved=>{if(saved)setEditingName(false);});}}>
          <span className="account-avatar" aria-hidden="true">{(s!.settings.name.trim() || cloud?.email || "H").slice(0,1).toLocaleUpperCase()}</span>
          <div className="account-name-details">
            {editingName ? <input className="account-name-inline" aria-label={t("Name")} autoFocus disabled={busy} maxLength={60} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key === "Escape"){e.preventDefault();setName(s!.settings.name);setEditingName(false);}}}/> : <h2>{s!.settings.name || t("Your account")}</h2>}
            <p className="muted">{cloud?.email}</p>
          </div>
          {editingName ? <button key="save-name" type="submit" disabled={busy} className="account-name-edit text-button" aria-label={t("Save")}><Icon name="check"/></button> : <button key="edit-name" type="button" className="account-name-edit text-button" aria-label={t("Edit name")} onClick={()=>{setName(s!.settings.name);setEditingName(true);}}><Icon name="edit"/></button>}
        </form>
        <div className="account-buttons">
          <Button secondary onClick={() => navigate("password")}>{t("Change password")}</Button>
          <button type="button" className="secondary-button account-signout" onClick={() => setConfirmLogout(true)}>{t("Sign out")}</button>
        </div>
      </Card>
      <div className="destination-list section-gap">
        {(
          [
            ["general", "General & Appearance", "settings"],
            ["categories", "Categories", "shopping"],
            ["connections", "AI connections", "spark"],
            ["data", "Data & app", "download"],
          ] as const
        )
          .filter(([r]) => s!.settings.ai_enabled || r !== "connections")
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
      {native && <DeviceSettings />}
      <Card className="developer-credit section-gap">
        <small>{t("Developed by")}</small>
        <div className="developer-person">
          <img
            src="/static/developer-avatar.png"
            width="36"
            height="36"
            alt=""
          />
          <h3>Shahriar Morshed Jahin</h3>
        </div>
        <div className="credit-links">
          <a
            href="https://github.com/shahriarjahin"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
          <img
            className="digitxbd-credit-logo"
            src="/static/digitxbd-logo.png"
            alt="DigitXBD"
          />
        </div>
      </Card>
      <ErrorMessage message={error} />
      {confirmLogout && (
        <Modal title="Sign out" close={() => setConfirmLogout(false)}>
          <p>
            {t(
              "Sync pending changes or export a backup before removing this account’s session.",
            )}
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

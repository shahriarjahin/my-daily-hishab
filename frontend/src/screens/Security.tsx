import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../context";
import { usePasskey } from "../passkeys";
import { Button, Card, ErrorMessage, Title, Modal } from "../components/UI";
type Factor = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string;
};
type Enrollment = {
  id: string;
  totp: { qr_code: string; secret: string; uri: string };
};
function CodeForm({ factor, done }: { factor: string; done: () => void }) {
  const { t, refresh } = useStore();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="account-password"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api("/auth/mfa/verify", "POST", { factor_id: factor, code });
          setCode("");
          await refresh();
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="form-field">
        {t("Verification code")}
        <input
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <ErrorMessage message={error} />
      <Button type="submit" disabled={busy}>
        {t("Verify")}
      </Button>
    </form>
  );
}
export function MFAVerification() {
  const { cloud, t, mutate } = useStore();
  const factors = cloud?.factors || [];
  const [factor, setFactor] = useState(factors[0]?.id || "");
  return (
    <main className="welcome-main">
      <Card className="welcome-card">
        <h1>{t("Two-step verification")}</h1>
        <p className="muted">
          {t("Verify your identity to open your cloud records.")}
        </p>
        {factors.length > 1 && (
          <select
            aria-label={t("Verification method")}
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
          >
            {factors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.friendly_name || f.factor_type}
              </option>
            ))}
          </select>
        )}
        <CodeForm factor={factor} done={() => {}} />
        <button
          className="text-button section-gap"
          onClick={() => void mutate("/auth/logout", "POST", {})}
        >
          {t("Sign out")}
        </button>
      </Card>
    </main>
  );
}
export function Security() {
  const { t, refresh } = useStore();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [passkeys, setPasskeys] = useState<
    { id: string; friendly_name?: string }[]
  >([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removal, setRemoval] = useState<{ path: string } | null>(null);
  const load = async () => {
    try {
      const result = await api<{ factors: Factor[] }>("/auth/security");
      setFactors(result.factors);
      try {
        const keys =
          await api<{ id: string; friendly_name?: string }[]>("/auth/passkeys");
        setPasskeys(keys);
      } catch {
        /* Passkeys may be disabled in this project. */
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title>{t("Account security")}</Title>
      <Card>
        <h2>{t("Two-step verification")}</h2>
        <p className="form-hint">
          {t("Use an authenticator app for an extra sign-in code.")}
        </p>
        {factors.map((f) => (
          <div className="settings-row" key={f.id}>
            <span>
              {f.friendly_name || f.factor_type}
              {f.status !== "verified" ? " · " + t("Unfinished setup") : ""}
            </span>
            <Button
              secondary
              onClick={() => setRemoval({ path: "/auth/mfa/" + f.id })}
            >
              {t("Remove")}
            </Button>
          </div>
        ))}
        {!factors.some((f) => f.status === "verified") && (
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const result = await api<Enrollment>(
                  "/auth/mfa/enroll",
                  "POST",
                  {},
                );
                setEnrollment(result);
              })
            }
          >
            {t("Set up authenticator")}
          </Button>
        )}
      </Card>
      <Card className="section-gap">
        <h2>{t("Passkeys")}</h2>
        <p className="form-hint">
          {t("Sign in with your fingerprint, face or device PIN.")}
        </p>
        {passkeys.map((key) => (
          <div className="settings-row" key={key.id}>
            <span>{key.friendly_name || t("Passkey")}</span>
            <Button
              secondary
              onClick={() => setRemoval({ path: "/auth/passkeys/" + key.id })}
            >
              {t("Remove")}
            </Button>
          </div>
        ))}
        <Button
          disabled={busy}
          onClick={() => void run(() => usePasskey(true))}
        >
          {t("Add passkey")}
        </Button>
      </Card>
      <ErrorMessage message={error} />
      {enrollment && (
        <Modal
          title="Set up authenticator"
          close={() =>
            void run(async () => {
              await api("/auth/mfa/" + enrollment.id, "DELETE");
              setEnrollment(null);
            })
          }
        >
          <p>
            {t(
              "Scan this QR code in your authenticator app, then enter its six-digit code.",
            )}
          </p>
          <img
            className="mfa-qr"
            alt={t("Authenticator QR code")}
            src={
              enrollment.totp.qr_code.startsWith("data:")
                ? enrollment.totp.qr_code
                : "data:image/svg+xml;charset=utf-8," +
                  encodeURIComponent(enrollment.totp.qr_code)
            }
          />
          <details>
            <summary>{t("Manual setup key")}</summary>
            <code className="mfa-secret">{enrollment.totp.secret}</code>
          </details>
          <CodeForm
            factor={enrollment.id}
            done={() => {
              setEnrollment(null);
              void load();
            }}
          />
        </Modal>
      )}
      {removal && (
        <Modal title="Remove sign-in method" close={() => setRemoval(null)}>
          <p>{t("Remove this sign-in method from your account?")}</p>
          <div className="form-actions">
            <Button secondary onClick={() => setRemoval(null)}>
              {t("Cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(removal.path, "DELETE");
                  setRemoval(null);
                  await refresh();
                })
              }
            >
              {t("Remove")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

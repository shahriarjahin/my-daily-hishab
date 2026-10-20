import { useState } from "react";
import { useStore } from "../context";
import { api } from "../api";
import { Button, Card, ErrorMessage, Title } from "./UI";
export function PasswordForm({ recovery = false }: { recovery?: boolean }) {
  const { t, notify, navigate } = useStore();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Title>{t("Change password")}</Title>
      <Card>
        <form
          className="account-password"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            if (password !== confirm) {
              setError("Passwords do not match.");
              return;
            }
            setBusy(true);
            try {
              await api("/auth/password", "PUT", {
                password,
                ...(current ? { current_password: current } : {}),
              });
              setCurrent("");
              setPassword("");
              setConfirm("");
              notify("Password updated");
              history.replaceState(
                history.state,
                "",
                location.pathname + location.hash,
              );
              navigate("settings");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!recovery && (
            <label className="form-field">
              {t("Current password")}
              <input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
          )}
          <label className="form-field">
            {t("New password")}
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={1024}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="form-field">
            {t("Confirm password")}
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={busy}>
            {t("Save")}
          </Button>
        </form>
      </Card>
    </>
  );
}

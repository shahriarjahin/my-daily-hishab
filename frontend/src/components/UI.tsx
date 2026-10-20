import { useEffect, useRef, type ReactNode } from "react";
import { useStore } from "../context";
import { translateError } from "../i18n";
import { Icon } from "./Icon";
export function Title({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  const { navigate, goBack, route, t } = useStore();
  return (
    <div className="modern-heading">
      <div className="page-title">
        {!["home", "history", "insights", "hub"].includes(route) && (
          <button
            type="button"
            className="page-back"
            onClick={goBack}
            aria-label={t("Back")}
            title={t("Back")}
          >
            <Icon name="back" />
          </button>
        )}
        <h1>{typeof children === "string" ? t(children) : children}</h1>
      </div>
      <div>
        {action}
        <button
          className="profile-link"
          onClick={() => navigate("settings")}
          aria-label={t("Settings")}
        >
          <Icon name="settings" />
        </button>
      </div>
    </div>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"modern-card " + className}>{children}</section>;
}
export function Button({
  children,
  onClick,
  secondary = false,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={secondary ? "secondary-button" : "primary-button"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Empty({ text = "No records" }: { text?: string }) {
  const { t } = useStore();
  return (
    <div className="empty-state">
      <Icon name="wallet" />
      <p>{t(text)}</p>
    </div>
  );
}
export function Progress({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  return (
    <div
      className={"progress " + (used > limit ? "over" : "")}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <span style={{ width: pct + "%" }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    { t } = useStore();
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-header">
        <h2>{t(title)}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Cancel")}
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="react-modal-content">{children}</div>
    </dialog>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  const { language } = useStore();
  return message ? (
    <p className="form-error" role="alert">
      {translateError(message, language)}
    </p>
  ) : null;
}

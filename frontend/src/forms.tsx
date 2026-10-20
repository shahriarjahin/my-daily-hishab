import { useState } from "react";
import { useStore } from "./context";
import type {
  Values,
  WorkspaceState,
  Transaction,
  Wallet,
  Budget,
  Goal,
  Category,
  Regular,
  Loan,
  Provider,
} from "./types";
import { day, dated } from "./utils";
import { Button, ErrorMessage, Modal } from "./components/UI";
export interface Field {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "color"
    | "select"
    | "checkbox"
    | "password"
    | "url"
    | "textarea";
  options?: { value: string | number; label: string }[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}
export interface FormSpec {
  title: string;
  path: string;
  method?: string;
  fields: Field[];
  values: Values;
  prepare?: (values: Values) => unknown;
  note?: string;
}
export type Editor = (spec: FormSpec) => void;
export function RecordForm({
  spec,
  close,
}: {
  spec: FormSpec;
  close: () => void;
}) {
  const { mutate, t, busy, notify } = useStore(),
    [values, setValues] = useState(spec.values),
    [error, setError] = useState("");
  const update = (key: string, value: string | number | boolean) =>
    setValues((v) => ({ ...v, [key]: value }));
  return (
    <Modal title={spec.title} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await mutate(
              spec.path,
              spec.method || "POST",
              spec.prepare ? spec.prepare(values) : values,
            );
            notify("Saved");
            close();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          {spec.note && <p className="form-hint wide">{t(spec.note)}</p>}
          {spec.fields.map((f) => (
            <label key={f.name} className="form-field">
              {t(f.label)}
              {f.type === "select" ? (
                <select
                  aria-label={t(f.label)}
                  value={String(values[f.name] ?? "")}
                  required={f.required !== false}
                  onChange={(e) => update(f.name, e.target.value)}
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => update(f.name, e.target.checked)}
                />
              ) : f.type === "textarea" ? (
                <textarea
                  value={String(values[f.name] ?? "")}
                  maxLength={2000}
                  required={f.required !== false}
                  onChange={(e) => update(f.name, e.target.value)}
                />
              ) : (
                <input
                  aria-label={t(f.label)}
                  type={f.type || "text"}
                  value={String(values[f.name] ?? "")}
                  required={f.required !== false}
                  min={f.min ?? (f.type === "number" ? 0 : undefined)}
                  max={f.max ?? (f.type === "number" ? 1e12 : undefined)}
                  step={f.step || (f.type === "number" ? "0.01" : undefined)}
                  maxLength={f.type === "password" ? 10000 : 240}
                  onChange={(e) =>
                    update(
                      f.name,
                      f.type === "number"
                        ? e.target.value === ""
                          ? ""
                          : Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
        </div>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button secondary onClick={close}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={busy}>
            {t("Save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
const select = (
  name: string,
  label: string,
  options: { value: string | number; label: string }[],
  required = true,
): Field => ({ name, label, type: "select", options, required });
const opts = (list: string[]) => list.map((value) => ({ value, label: value }));
const amount = (name = "amount", label = "Amount"): Field => ({
  name,
  label,
  type: "number",
  min: 0.01,
});
const moneyFields = (v: Values) =>
  Object.fromEntries(
    Object.entries(v).map(([k, value]) => [
      k,
      [
        "wallet_id",
        "from_wallet_id",
        "to_wallet_id",
        "goal_id",
        "priority",
      ].includes(k)
        ? value === ""
          ? null
          : Number(value)
        : value,
    ]),
  );
export function formFactory(s: WorkspaceState) {
  const wallets = s.wallets.map((w) => ({ value: w.id, label: w.name })),
    expense = s.category_details
      .filter((c) => !c.archived && ["needs", "wants"].includes(c.bucket))
      .map((c) => c.name),
    saving = s.category_details
      .filter((c) => !c.archived && c.bucket === "savings")
      .map((c) => c.name);
  return {
    wallet: (w?: Wallet): FormSpec => ({
      title: w ? "Edit wallet" : "Add wallet",
      path: "/wallets" + (w ? "/" + w.id : ""),
      method: w ? "PATCH" : "POST",
      values: { name: w?.name || "", opening_balance: w?.opening_balance || 0 },
      fields: [
        { name: "name", label: "Name" },
        { ...amount("opening_balance", "Opening balance"), min: -1e12 },
      ],
      note: "Opening balance is the amount before recorded transactions.",
    }),
    transaction: (entry: Transaction): FormSpec => ({
      title: "Edit entry",
      path: "/transactions/" + entry.id,
      method: "PATCH",
      values: {
        description: entry.description,
        amount: entry.amount,
        type: entry.type,
        category: entry.category,
        wallet_id: entry.wallet_id,
        date: day(entry.date),
        quantity: entry.quantity || "",
        unit: entry.unit || "",
      },
      fields: [
        { name: "description", label: "Description" },
        amount(),
        select("type", "Type", opts(["expense", "income"])),
        select("category", "Category", opts(s.categories)),
        select("wallet_id", "Wallet", wallets),
        { name: "date", label: "Date", type: "date" },
        { ...amount("quantity", "Quantity"), required: false },
        { name: "unit", label: "Unit", required: false },
      ],
      prepare: (v) => ({
        ...moneyFields(v),
        date: dated(String(v.date)),
        quantity: v.quantity || null,
      }),
    }),
    transfer: (): FormSpec => ({
      title: "Transfer",
      path: "/transfers",
      values: {
        from_wallet_id: s.wallets[0]?.id,
        to_wallet_id: s.wallets[1]?.id || s.wallets[0]?.id,
        amount: "",
        description: "Wallet transfer",
      },
      fields: [
        select("from_wallet_id", "From wallet", wallets),
        select("to_wallet_id", "To wallet", wallets),
        amount(),
        { name: "description", label: "Description" },
      ],
      prepare: moneyFields,
    }),
    budget: (b?: Budget): FormSpec => ({
      title: "Category budget",
      path: "/budgets",
      method: "PUT",
      values: { category: b?.category || expense[0], amount: b?.amount || "" },
      fields: [
        select("category", "Category", opts(expense)),
        amount("amount", "Monthly limit"),
      ],
    }),
    plan: (): FormSpec => ({
      title: "Monthly plan",
      path: "/plan",
      method: "PUT",
      values: {
        monthly_budget: s.settings.monthly_budget,
        planned_income: s.settings.planned_income,
        savings_target: s.settings.savings_target,
        needs_percent: s.settings.needs_percent,
        wants_percent: s.settings.wants_percent,
        savings_percent: s.settings.savings_percent,
      },
      fields: [
        amount("monthly_budget", "Monthly budget"),
        amount("planned_income", "Planned income"),
        amount("savings_target", "Savings target"),
        ...["needs", "wants", "savings"].map((g) => ({
          ...amount(g + "_percent", g[0].toUpperCase() + g.slice(1) + " (%)"),
          max: 100,
          step: "1",
        })),
      ].map((f) => ({ ...f, min: 0 })),
    }),
    goal: (g?: Goal): FormSpec => ({
      title: g ? "Edit goal" : "Add goal",
      path: "/goals" + (g ? "/" + g.id : ""),
      method: g ? "PUT" : "POST",
      values: {
        name: g?.name || "",
        target: g?.target || "",
        due_date: g?.due_date || "",
        color: g?.color || "#e4a52f",
      },
      fields: [
        { name: "name", label: "Name" },
        amount("target", "Target"),
        { name: "due_date", label: "Due date", type: "date", required: false },
        { name: "color", label: "Color", type: "color" },
      ],
      prepare: (v) => ({ ...v, due_date: v.due_date || null }),
    }),
    saving: (): FormSpec => ({
      title: "Reserve savings",
      path: "/savings",
      values: {
        amount: "",
        category: saving[0],
        wallet_id: s.wallets[0]?.id,
        goal_id: "",
        note: "",
      },
      fields: [
        amount(),
        select("category", "Category", opts(saving)),
        select("wallet_id", "Wallet", wallets),
        select(
          "goal_id",
          "Goal",
          [
            { value: "", label: "No goal" },
            ...s.goals.map((g) => ({ value: g.id, label: g.name })),
          ],
          false,
        ),
        { name: "note", label: "Note", required: false },
      ],
      prepare: moneyFields,
    }),
    loan: (): FormSpec => ({
      title: "Record a loan",
      path: "/loans",
      values: {
        party: "",
        direction: "borrowed",
        amount: "",
        wallet_id: s.wallets[0]?.id,
        affect_wallet: "true",
        date: day(),
        due_date: "",
        note: "",
      },
      fields: [
        select("affect_wallet", "Loan entry", [
          { value: "true", label: "New loan" },
          { value: "false", label: "Existing loan" },
        ]),
        { name: "party", label: "Party" },
        select("direction", "Direction", opts(["borrowed", "lent"])),
        amount(),
        select("wallet_id", "Wallet", wallets),
        { name: "date", label: "Date", type: "date" },
        { name: "due_date", label: "Due date", type: "date", required: false },
        { name: "note", label: "Note", required: false },
      ],
      note: "For an old loan already spent, select Existing loan and enter only the outstanding amount. Wallet stays unchanged.",
      prepare: (v) => ({
        ...moneyFields(v),
        affect_wallet: v.affect_wallet === "true",
        wallet_id: v.affect_wallet === "false" ? null : Number(v.wallet_id),
        date: dated(String(v.date)),
        due_date: v.due_date || null,
      }),
    }),
    repay: (l: Loan): FormSpec => ({
      title: "Repay",
      path: "/loans/" + l.id + "/repayments",
      values: { amount: "", wallet_id: s.wallets[0]?.id },
      fields: [amount(), select("wallet_id", "Wallet", wallets)],
      prepare: moneyFields,
    }),
    category: (c?: Category): FormSpec => ({
      title: c ? "Edit category" : "Add category",
      path: "/categories" + (c ? "/" + c.id : ""),
      method: c ? "PUT" : "POST",
      values: {
        name: c?.name || "",
        kind: c?.kind || "expense",
        bucket: c?.bucket || "needs",
        color: c?.color || "#e4a52f",
        icon: c?.icon || "other",
        archived: c?.archived || false,
      },
      fields: [
        { name: "name", label: "Name" },
        select("kind", "Type", opts(["expense", "income", "savings", "both"])),
        select(
          "bucket",
          "Budget group",
          opts(["needs", "wants", "savings", "income"]),
        ),
        select(
          "icon",
          "Icon",
          opts([
            "food",
            "transport",
            "shopping",
            "utilities",
            "health",
            "education",
            "entertainment",
            "rent",
            "gifts",
            "salary",
            "travel",
            "business",
            "savings",
            "other",
            "wallet",
          ]),
        ),
        { name: "color", label: "Color", type: "color" },
        { name: "archived", label: "Archived", type: "checkbox" },
      ],
    }),
    regular: (r?: Regular): FormSpec => ({
      title: r ? "Edit regular" : "Add regular",
      path: "/regulars" + (r ? "/" + r.id : ""),
      method: r ? "PUT" : "POST",
      values: {
        name: r?.name || "",
        category: r?.category || expense[0],
        daily_limit: r?.daily_limit || 0,
        unit: r?.unit || "pcs",
      },
      fields: [
        { name: "name", label: "Name" },
        select("category", "Category", opts(expense)),
        { ...amount("daily_limit", "Daily limit"), min: 0 },
        { name: "unit", label: "Unit" },
      ],
    }),
    provider: (p: Provider): FormSpec => ({
      title: p.name,
      path: "/ai/providers/" + p.id,
      method: "PUT",
      values: {
        api_key: "",
        model: p.model,
        enabled: p.enabled,
        priority: p.priority,
        base_url: p.base_url || "",
      },
      fields: [
        {
          name: "api_key",
          label: "API key",
          type: "password",
          required: false,
        },
        { name: "model", label: "Model ID" },
        ...(p.id === "custom"
          ? [{ name: "base_url", label: "API base URL", type: "url" as const }]
          : []),
        {
          name: "priority",
          label: "Priority",
          type: "number",
          min: 1,
          max: 99,
          step: "1",
        },
        { name: "enabled", label: "Enabled", type: "checkbox" },
      ],
      prepare: (v) => ({
        ...v,
        api_key: v.api_key || null,
        priority: Number(v.priority),
      }),
      note: "Blank key keeps the existing key. Lower priority is tried first.",
    }),
  };
}

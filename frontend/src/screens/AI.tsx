import { useState } from "react";
import { useStore } from "../context";
import { api } from "../api";
import type { Extraction, Plan } from "../types";
import {
  Title,
  Card,
  Button,
  ErrorMessage,
  Modal,
  Empty,
} from "../components/UI";
import { Icon } from "../components/Icon";
export function Advisor() {
  const { state: s, t, mutate, busy } = useStore(),
    [question, setQuestion] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <Title>Ask Hishab</Title>
      {!s!.advisor_messages.length && (
        <div className="ask-intro">
          <span className="ask-icon">
            <Icon name="spark" />
          </span>
          <h2>{t("What do you want to know about your money?")}</h2>
          <p className="muted">
            {t("Ask about your spending, budgets, and goals.")}
          </p>
          <div className="ask-prompts">
            {[
              "Where did I spend the most this month?",
              "How much can I save this month?",
              "What should I cut first?",
              "Help me plan a realistic budget.",
            ].map((q) => (
              <button key={q} onClick={() => setQuestion(q)}>
                {t(q)}
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </div>
      )}
      <Card className="concise-advisor">
        {s!.advisor_messages.length > 0 && (
          <>
            <button
              className="text-button"
              onClick={() =>
                void mutate("/advisor", "DELETE").catch((e) =>
                  setError(e.message),
                )
              }
            >
              {t("Clear")}
            </button>
            <div className="advisor-messages">
              {s!.advisor_messages.map((m) => (
                <article key={m.id} className={"chat-message " + m.role}>
                  <small>{m.role === "user" ? "You" : "AI"}</small>
                  <p>{m.content}</p>
                </article>
              ))}
            </div>
          </>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              await mutate("/advisor", "POST", { message: question });
              setQuestion("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label className="form-field">
            {t("Ask")}
            <textarea
              name="message"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              required
            />
          </label>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={busy}>
            {t("Ask")}
          </Button>
        </form>
        <p className="form-hint">
          Your account summary and chat are sent to connected AI providers.
        </p>
      </Card>
    </>
  );
}
export function Importer() {
  const { state: s, t, money, mutate, notify } = useStore(),
    [text, setText] = useState(""),
    [wallet, setWallet] = useState(s!.wallets[0]?.id || 0),
    [mode, setMode] = useState("auto"),
    [file, setFile] = useState<File | null>(null),
    [result, setResult] = useState<Extraction | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  const extract = async () => {
    setError("");
    setWorking(true);
    try {
      let image: string | undefined;
      if (file) {
        if (file.size > 2000000) throw new Error("Choose an image under 2 MB.");
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Could not read image."));
          reader.readAsDataURL(file);
        });
      }
      const output = await api<Extraction>("/extract", "POST", {
        text: text.trim() || "Read this receipt.",
        mode,
        wallet_id: wallet,
        ...(image ? { image, mime_type: file!.type } : {}),
      });
      if (!output.wallets.length && !output.transactions.length)
        throw new Error("No financial entries found.");
      if (!s!.settings.review_before_saving && !output.wallets.length) {
        await mutate("/transactions", "POST", {
          transactions: output.transactions,
        });
        setText("");
        notify(t("Saved"));
      } else setResult(output);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  };
  return (
    <>
      <Title>Import</Title>
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void extract();
          }}
        >
          <label className="form-field">
            English, বাংলা or Banglish
            <textarea
              value={text}
              maxLength={10000}
              onChange={(e) => setText(e.target.value)}
              placeholder="70 tk cash paisi"
            />
          </label>
          <div className="form-grid section-gap">
            <label className="form-field">
              {t("Wallet")}
              <select
                value={wallet}
                onChange={(e) => setWallet(Number(e.target.value))}
              >
                {s!.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Type
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="auto">Auto</option>
                <option value="transactions">Income / expense</option>
                <option value="wallets">Current wallet balances</option>
              </select>
            </label>
            <label className="form-field wide">
              {t("Scan receipt")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>
          <ErrorMessage message={error} />
          <Button type="submit" disabled={working}>
            {working ? "Working…" : t("Import")}
          </Button>
          <p className="form-hint">
            {t("Review before saving")}:{" "}
            {s!.settings.review_before_saving ? "On" : "Off"} · AI providers
            receive your text or receipt.
          </p>
        </form>
      </Card>
      {result && (
        <Modal title="Review entries" close={() => setResult(null)}>
          <p className="form-hint">{result.provider}</p>
          {result.wallets.map((w, i) => (
            <div key={i} className="form-grid review-entry">
              <label className="form-field">
                {t("Name")}
                <input
                  value={w.name}
                  readOnly={w.existing}
                  onChange={(e) =>
                    setResult({
                      ...result,
                      wallets: result.wallets.map((x, j) =>
                        i === j ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label className="form-field">
                {t("Opening balance")}
                <input
                  type="number"
                  step="0.01"
                  value={w.balance}
                  onChange={(e) =>
                    setResult({
                      ...result,
                      wallets: result.wallets.map((x, j) =>
                        i === j ? { ...x, balance: Number(e.target.value) } : x,
                      ),
                    })
                  }
                />
              </label>
              <p className="form-hint wide">
                Current balances are not income. Existing transactions are kept.
              </p>
            </div>
          ))}
          {result.transactions.map((entry, i) => (
            <div key={i} className="review-entry">
              <div className="form-grid">
                <label className="form-field">
                  {t("Description")}
                  <input
                    value={entry.description}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        transactions: result.transactions.map((x, j) =>
                          i === j ? { ...x, description: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label className="form-field">
                  {t("Amount")}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={entry.amount}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        transactions: result.transactions.map((x, j) =>
                          i === j
                            ? { ...x, amount: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <label className="form-field">
                  Type
                  <select
                    value={entry.type}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        transactions: result.transactions.map((x, j) =>
                          i === j
                            ? {
                                ...x,
                                type: e.target.value as "income" | "expense",
                              }
                            : x,
                        ),
                      })
                    }
                  >
                    <option value="expense">{t("Expense")}</option>
                    <option value="income">{t("Income")}</option>
                  </select>
                </label>
                <label className="form-field">
                  {t("Category")}
                  <select
                    value={entry.category}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        transactions: result.transactions.map((x, j) =>
                          i === j ? { ...x, category: e.target.value } : x,
                        ),
                      })
                    }
                  >
                    {s!.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  {t("Wallet")}
                  <select
                    value={entry.wallet_id}
                    onChange={(e) =>
                      setResult({
                        ...result,
                        transactions: result.transactions.map((x, j) =>
                          i === j
                            ? { ...x, wallet_id: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  >
                    {s!.wallets.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="text-button"
                onClick={() =>
                  setResult({
                    ...result,
                    transactions: result.transactions.filter((_, j) => j !== i),
                  })
                }
              >
                {t("Delete")}
              </button>
            </div>
          ))}
          <ErrorMessage message={error} />
          <Button
            disabled={
              working || (!result.transactions.length && !result.wallets.length)
            }
            onClick={async () => {
              setWorking(true);
              setError("");
              try {
                if (result.wallets.length)
                  await mutate("/wallets/balances", "POST", {
                    wallets: result.wallets,
                  });
                if (result.transactions.length)
                  await mutate("/transactions", "POST", {
                    transactions: result.transactions,
                  });
                setResult(null);
                setText("");
                notify(t("Saved"));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setWorking(false);
              }
            }}
          >
            {t("Save")}
          </Button>
        </Modal>
      )}
    </>
  );
}
export function AutoPlan({ close }: { close: () => void }) {
  const { mutate, t, money } = useStore(),
    [message, setMessage] = useState(""),
    [proposal, setProposal] = useState<{
      plan: Plan;
      summary: string;
      provider: string;
    } | null>(null),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false);
  return (
    <Modal title="Auto-plan" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setWorking(true);
          setError("");
          try {
            if (proposal) {
              await mutate("/plan", "PUT", {
                ...proposal.plan,
                allocations: proposal.plan.allocations?.filter(
                  (a) => a.amount > 0,
                ),
              });
              close();
            } else setProposal(await api("/plan/preview", "POST", { message }));
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setWorking(false);
          }
        }}
      >
        {!proposal ? (
          <label className="form-field">
            {t("Monthly plan")}
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="Monthly income 30000, spending cap 24000, save 6000"
            />
          </label>
        ) : (
          <>
            <p>{proposal.summary}</p>
            <p className="form-hint">
              {proposal.provider} · Review before applying. This replaces
              category limits.
            </p>
            <div className="form-grid">
              {(
                [
                  "monthly_budget",
                  "planned_income",
                  "savings_target",
                  "needs_percent",
                  "wants_percent",
                  "savings_percent",
                ] as const
              ).map((key) => (
                <label className="form-field" key={key}>
                  {key.replaceAll("_", " ")}
                  <input
                    type="number"
                    min="0"
                    step={key.includes("percent") ? "1" : "0.01"}
                    value={proposal.plan[key]}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        plan: {
                          ...proposal.plan,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
              {proposal.plan.allocations?.map((a, i) => (
                <label className="form-field" key={a.category}>
                  {t(a.category)}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={a.amount}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        plan: {
                          ...proposal.plan,
                          allocations: proposal.plan.allocations!.map((x, j) =>
                            i === j
                              ? { ...x, amount: Number(e.target.value) }
                              : x,
                          ),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </>
        )}
        <ErrorMessage message={error} />
        <Button type="submit" disabled={working}>
          {working ? "Working…" : proposal ? t("Save") : t("Auto-plan")}
        </Button>
      </form>
    </Modal>
  );
}

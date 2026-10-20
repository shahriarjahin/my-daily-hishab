import { Capacitor, registerPlugin } from "@capacitor/core";
import ledgerSource from "../../mobile/web/ledger.js";
import type { WorkspaceState, CloudStatus } from "./types";
import { restoreBackup } from "./backup";
import {
  checkOfflineInput,
  offlineExtraction,
  type OfflineAiStatus,
} from "./offlineAi";
interface DeviceLedger {
  state(workspace: unknown): WorkspaceState;
  mutate(
    workspace: unknown,
    path: string,
    method: string,
    body: unknown,
  ): { workspace: unknown; result: unknown };
}
const ledger = ledgerSource as DeviceLedger;
interface NativeBridge {
  execute(options: { op: string; body: unknown }): Promise<{ data: unknown }>;
}
const bridge = registerPlugin<NativeBridge>("Hishab");
export const native = Capacitor.isNativePlatform();
export async function device<T = unknown>(
  op: string,
  body: unknown = {},
): Promise<T> {
  return (await bridge.execute({ op, body })).data as T;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
let revision: number | undefined;
let queue: Promise<unknown> = Promise.resolve();
export function resetRevision() {
  revision = undefined;
}
async function nativeRequest<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  if (path === "/cloud/status") {
    const value = await device<CloudStatus>("status");
    try {
      value.offline_ai = await device<OfflineAiStatus>("offline-ai");
    } catch {}
    return value as T;
  }
  if (path === "/extract" && method === "POST") {
    const localAi = await device<OfflineAiStatus>("offline-ai");
    if (localAi.enabled) {
      const input = body as {
        text: string;
        wallet_id: number;
        mode?: string;
        image?: string;
      };
      if (input.image || input.mode === "wallets")
        throw new Error("Offline AI supports text income and expenses only.");
      const local = await device<{ workspace: unknown }>("load");
      const state = ledger.state(local.workspace);
      checkOfflineInput(input.text, state, input.wallet_id);
      const result = await device<{ raw: string }>("offline-ai", {
        action: "generate",
        text: input.text,
      });
      return offlineExtraction(
        result.raw,
        input.text,
        input.wallet_id,
        state,
      ) as T;
    }
  }
  if (
    path === "/auth/security" ||
    path.startsWith("/auth/mfa") ||
    path.startsWith("/auth/passkeys")
  )
    return device<T>("security", { path, method, body });
  if (path.startsWith("/auth/")) return device<T>(path.split("/").pop()!, body);
  if (path === "/ai/providers" && method === "GET")
    return device<T>("providers");
  if (
    path.startsWith("/ai/") ||
    path === "/extract" ||
    path === "/plan/preview" ||
    (path === "/advisor" && method === "POST")
  )
    return device<T>("remote", {
      path,
      method,
      body: method === "GET" ? null : body,
    });
  const local = await device<{ workspace: unknown; seq: number }>("load");
  if (path === "/state") {
    revision = local.seq;
    return { ...ledger.state(local.workspace), revision: local.seq } as T;
  }
  if (revision !== undefined && revision !== local.seq)
    throw new ApiError("Records changed. Reload before saving.", 409);
  const change =
    path === "/cloud/import" && method === "POST"
      ? {
          workspace: restoreBackup(
            local.workspace,
            (body as { data: unknown }).data,
          ),
          result: { imported: true },
        }
      : ledger.mutate(local.workspace, path, method, body);
  const saved = await device<{ seq: number }>("save", {
    workspace: change.workspace,
    seq: local.seq,
  });
  revision = saved.seq;
  return change.result as T;
}
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  if (native) {
    const task = queue
      .then(() => nativeRequest<T>(path, method, body))
      .catch((e) => {
        throw e instanceof Error ? e : new Error("Device request failed.");
      });
    queue = task.catch(() => {});
    return task;
  }
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(revision !== undefined
        ? { "X-Workspace-Revision": String(revision) }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let message = "Request failed. Please try again.";
    try {
      const data = await response.json();
      message =
        typeof data.detail === "string"
          ? data.detail
          : data.detail?.[0]?.msg || message;
    } catch {}
    throw new ApiError(message, response.status);
  }
  const next = response.headers.get("X-Workspace-Revision");
  if (next !== null) revision = Number(next);
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (path === "/state") revision = data.revision;
  return data as T;
}
export const status = () => api<CloudStatus>("/cloud/status");
export async function exportFile(
  name: string,
  content: string,
  mime = "application/json",
) {
  if (native) {
    await device("export", { name, content, mime });
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

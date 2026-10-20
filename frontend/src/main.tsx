import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./context";
import "./styles.css";
import "./loading.css";
async function start() {
  if (location.pathname === "/auth/callback") {
    const params = new URLSearchParams(location.hash.slice(1));
    const access_token = params.get("access_token"),
      refresh_token = params.get("refresh_token"),
      recovery = params.get("type") === "recovery";
    history.replaceState(null, "", "/auth/callback");
    if (access_token && refresh_token) {
      try {
        const response = await fetch("/api/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token, refresh_token }),
        });
        if (!response.ok) throw new Error();
        location.replace(recovery ? "/?recovery=1#password" : "/#home");
        return;
      } catch {
        location.replace("/?auth_error=1");
        return;
      }
    } else {
      location.replace("/?auth_error=1");
      return;
    }
  }
  createRoot(document.getElementById("root")!).render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}
void start();
// Cache the public UI shell only; finance and authentication responses are never cached.
if (
  "serviceWorker" in navigator &&
  !location.hostname.includes("localhost") &&
  location.protocol === "https:"
)
  navigator.serviceWorker.register("/sw.js").catch(() => {});

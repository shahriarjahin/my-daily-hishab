import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StoreProvider } from "./context";
import "./styles.css";
import "./loading.css";
createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
// Cache the public UI shell only; finance and authentication responses are never cached.
if (
  "serviceWorker" in navigator &&
  !location.hostname.includes("localhost") &&
  location.protocol === "https:"
)
  navigator.serviceWorker.register("/sw.js").catch(() => {});

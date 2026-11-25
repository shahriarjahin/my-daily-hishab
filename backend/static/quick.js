(function () {
  "use strict";

  var TOKEN_KEY = "hishab-quick-token";
  var WALLETS_CACHE_KEY = "hishab-quick-wallets";

  var tokenSection = document.getElementById("tokenSection");
  var tokenInput = document.getElementById("tokenInput");
  var saveTokenBtn = document.getElementById("saveTokenBtn");
  var toggleTokenBtn = document.getElementById("toggleTokenBtn");
  var changeTokenBtn = document.getElementById("changeTokenBtn");

  var quickForm = document.getElementById("quickForm");
  var textInput = document.getElementById("textInput");
  var pasteBtn = document.getElementById("pasteBtn");
  var walletPills = document.getElementById("walletPills");
  var walletHint = document.getElementById("walletHint");
  var extraWalletWrap = document.getElementById("extraWalletWrap");
  var extraWalletSelect = document.getElementById("extraWalletSelect");
  var saveBtn = document.getElementById("saveBtn");
  var statusBox = document.getElementById("statusBox");

  var selectedWallet = "";
  var topWallets = [];
  var allWallets = [];

  function readFragmentToken() {
    var raw = (window.location.hash || "").replace(/^#/, "").trim();
    if (!raw) return "";
    if (raw.indexOf("token=") === 0) {
      return decodeURIComponent(raw.slice(6)).trim();
    }
    if (raw.indexOf("hishab_sc_") === 0) {
      return decodeURIComponent(raw).trim();
    }
    var params = new URLSearchParams(raw);
    return (params.get("token") || "").trim();
  }

  function getStoredToken() {
    try {
      return (window.localStorage.getItem(TOKEN_KEY) || "").trim();
    } catch (_err) {
      return "";
    }
  }

  function setStoredToken(token) {
    try {
      if (token) {
        window.localStorage.setItem(TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } catch (_err) {
      // Ignore storage quota / private mode failures.
    }
  }

  function getCachedWallets() {
    try {
      var raw = window.localStorage.getItem(WALLETS_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.top_wallets)) return parsed;
    } catch (_err) {
      // Ignore invalid cache.
    }
    return null;
  }

  function setCachedWallets(payload) {
    try {
      window.localStorage.setItem(WALLETS_CACHE_KEY, JSON.stringify(payload));
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function setStatus(kind, message) {
    if (!message) {
      statusBox.hidden = true;
      statusBox.textContent = "";
      statusBox.className = "status";
      return;
    }
    statusBox.hidden = false;
    statusBox.className = "status" + (kind ? " " + kind : "");
    statusBox.textContent = message;
  }

  function showTokenSetup(focusToken) {
    tokenSection.hidden = false;
    quickForm.hidden = true;
    toggleTokenBtn.hidden = true;
    changeTokenBtn.hidden = true;
    if (focusToken) {
      tokenInput.focus();
    }
  }

  function showQuickForm() {
    tokenSection.hidden = true;
    quickForm.hidden = false;
    toggleTokenBtn.hidden = false;
    changeTokenBtn.hidden = false;
    window.setTimeout(function () {
      textInput.focus();
    }, 60);
  }

  function updateSelectionUI() {
    var buttons = walletPills.querySelectorAll(".wallet-pill");
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var active = btn.dataset.wallet === selectedWallet;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", active ? "true" : "false");
    }
    if (extraWalletWrap && !extraWalletWrap.hidden) {
      var inTop = topWallets.indexOf(selectedWallet) !== -1;
      extraWalletSelect.value = inTop ? "" : selectedWallet;
    }
  }

  function renderWallets(data) {
    topWallets = Array.isArray(data && data.top_wallets) ? data.top_wallets : [];
    allWallets = Array.isArray(data && data.wallets) ? data.wallets : topWallets;

    if (!selectedWallet || allWallets.indexOf(selectedWallet) === -1) {
      selectedWallet = topWallets[0] || allWallets[0] || "";
    }

    walletPills.innerHTML = "";
    if (!topWallets.length) {
      var empty = document.createElement("span");
      empty.className = "wallet-empty";
      empty.textContent = "Default wallet will be used";
      walletPills.appendChild(empty);
    } else {
      walletPills.style.gridTemplateColumns =
        "repeat(" + Math.min(3, topWallets.length) + ", minmax(0, 1fr))";
      topWallets.forEach(function (name) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "wallet-pill";
        btn.textContent = name;
        btn.dataset.wallet = name;
        btn.setAttribute("role", "radio");
        btn.addEventListener("click", function () {
          selectedWallet = name;
          updateSelectionUI();
        });
        walletPills.appendChild(btn);
      });
    }

    var extras = allWallets.filter(function (w) {
      return topWallets.indexOf(w) === -1;
    });
    if (extras.length) {
      extraWalletWrap.hidden = false;
      extraWalletSelect.innerHTML = "";
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Other wallet (" + extras.length + ")...";
      extraWalletSelect.appendChild(placeholder);
      extras.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        extraWalletSelect.appendChild(opt);
      });
    } else {
      extraWalletWrap.hidden = true;
    }

    if (walletHint) {
      walletHint.textContent =
        topWallets.length > 1 ? "Top " + topWallets.length + " most used" : "Default wallet";
    }
    updateSelectionUI();
  }

  async function loadWallets() {
    var token = getStoredToken();
    if (!token) return;

    var cached = getCachedWallets();
    if (cached) {
      renderWallets(cached);
    }

    try {
      var res = await fetch("/api/shortcuts/wallets", {
        headers: { "X-Shortcut-Token": token },
      });
      if (res.status === 401) {
        setStatus("err", "Shortcut token expired or revoked. Paste a new token.");
        showTokenSetup(true);
        return;
      }
      if (!res.ok) return;
      var payload = await res.json();
      setCachedWallets(payload);
      renderWallets(payload);
    } catch (_err) {
      if (!cached) {
        walletPills.innerHTML =
          '<span class="wallet-empty">Offline? Wallet defaults will apply on save.</span>';
      }
    }
  }

  function formatMoney(value) {
    var num = Number(value);
    if (!isFinite(num)) return String(value || 0);
    return num % 1 === 0 ? num.toLocaleString() : num.toFixed(2);
  }

  async function submitEntry() {
    var token = getStoredToken();
    if (!token) {
      showTokenSetup(true);
      return;
    }

    var text = (textInput.value || "").trim();
    if (!text) {
      setStatus("err", "Type an amount and description, or paste a bank/MFS SMS.");
      textInput.focus();
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
    setStatus("", "");

    var body = { text: text };
    if (selectedWallet) {
      body.wallet = selectedWallet;
    }

    try {
      var res = await fetch("/api/shortcuts/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shortcut-Token": token,
        },
        body: JSON.stringify(body),
      });

      var data = {};
      try {
        data = await res.json();
      } catch (_jsonErr) {
        data = {};
      }

      if (res.status === 401) {
        setStatus("err", "Shortcut token rejected (401). Please update your token.");
        showTokenSetup(true);
        return;
      }

      if (!res.ok) {
        setStatus("err", data.detail || "Could not save transaction.");
        return;
      }

      if (data.kind === "transfer") {
        var feeNote = data.fee ? " (fee \u09F3" + formatMoney(data.fee) + ")" : "";
        setStatus(
          "ok",
          "Saved transfer: \u09F3" +
            formatMoney(data.amount) +
            feeNote +
            " \u00B7 " +
            (data.wallet || selectedWallet) +
            " \u00B7 Bal \u09F3" +
            formatMoney(data.balance)
        );
      } else {
        setStatus(
          "ok",
          "Saved: " +
            (data.description || text) +
            " \u2014 \u09F3" +
            formatMoney(data.amount) +
            " (" +
            (data.category || "Other") +
            ") \u00B7 " +
            (data.wallet || selectedWallet) +
            " \u00B7 Bal \u09F3" +
            formatMoney(data.balance)
        );
      }

      textInput.value = "";
      loadWallets();
    } catch (_err) {
      setStatus("err", "Network error. Check connection and try again.");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Transaction";
    }
  }

  saveTokenBtn.addEventListener("click", function () {
    var candidate = (tokenInput.value || "").trim();
    if (!candidate) {
      setStatus("err", "Paste your hishab_sc_... shortcut token first.");
      tokenInput.focus();
      return;
    }
    setStoredToken(candidate);
    tokenInput.value = "";
    setStatus("", "");
    showQuickForm();
    loadWallets();
  });

  function openTokenChanger() {
    if (tokenSection.hidden) {
      tokenInput.value = getStoredToken();
      showTokenSetup(true);
    } else if (getStoredToken()) {
      showQuickForm();
    }
  }

  toggleTokenBtn.addEventListener("click", openTokenChanger);
  changeTokenBtn.addEventListener("click", openTokenChanger);

  extraWalletSelect.addEventListener("change", function () {
    if (extraWalletSelect.value) {
      selectedWallet = extraWalletSelect.value;
      updateSelectionUI();
    }
  });

  pasteBtn.addEventListener("click", async function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      textInput.focus();
      setStatus("err", "Tap inside the box and choose Paste from your keyboard.");
      return;
    }
    try {
      var clip = await navigator.clipboard.readText();
      if (clip && clip.trim()) {
        textInput.value = clip.trim();
        setStatus("", "");
        textInput.focus();
      } else {
        setStatus("err", "Clipboard is empty.");
      }
    } catch (_err) {
      textInput.focus();
      setStatus("err", "Tap inside the box and choose Paste.");
    }
  });

  textInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitEntry();
    }
  });

  quickForm.addEventListener("submit", function (event) {
    event.preventDefault();
    submitEntry();
  });

  (function init() {
    var fragToken = readFragmentToken();
    if (fragToken) {
      setStoredToken(fragToken);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    var token = getStoredToken();
    if (!token) {
      showTokenSetup(true);
      return;
    }

    showQuickForm();
    loadWallets();
  })();
})();

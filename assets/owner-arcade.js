
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const $ = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat("en-US");

  const DEFAULTS = {
    enabled: true,
    games: {
      blackjack: true,
      slots: true,
      dice: true,
      betflip: true
    },
    streaks_enabled: true,
    minimum_wager: 1,
    maximum_wager: 1000000,
    maximum_payout: 2000000,
    maximum_streak_wins: 10
  };

  const REWARD_LABELS = {
    reward_daily: "Daily Reward",
    reward_weekly: "Weekly Reward",
    reward_work: "Work",
    reward_beg: "Beg"
  };

  let currentConfig = null;
  let creditCursor = null;
  let creditLoading = false;

  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json",
        ...(options.body ? {"Content-Type": "application/json"} : {})
      },
      body: options.body
    });

    let data = {};

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status}).`);
    }

    return data;
  }

  function setMessage(message, error = false) {
    const el = $("arcade-message");
    if (!el) return;

    el.textContent = message;
    el.className = error ? "message error" : "message";
  }

  function setStatus(message) {
    const el = $("arcade-updated");
    if (el) el.textContent = message;
  }

  function checkbox(id, value) {
    const el = $(id);
    if (el) el.checked = Boolean(value);
  }

  function numberValue(id) {
    const value = Number($(id).value);

    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${id.replaceAll("-", " ")} must be a positive whole number.`);
    }

    return value;
  }

  function renderConfig(config) {
    currentConfig = config;

    checkbox("arcade-enabled", config.enabled);
    checkbox("arcade-blackjack", config.games.blackjack);
    checkbox("arcade-slots", config.games.slots);
    checkbox("arcade-dice", config.games.dice);
    checkbox("arcade-betflip", config.games.betflip);
    checkbox("arcade-streaks", config.streaks_enabled);

    $("arcade-minimum").value = config.minimum_wager;
    $("arcade-maximum").value = config.maximum_wager;
    $("arcade-payout").value = config.maximum_payout;
    $("arcade-streak-wins").value = config.maximum_streak_wins;

    $("arcade-global-status").textContent =
      config.enabled ? "ARCADE ONLINE" : "ARCADE DISABLED";

    $("arcade-global-status").className =
      config.enabled ? "arcade-status online" : "arcade-status offline";

    setStatus(
      config.updated_at
        ? "Last configuration update: " +
          new Date(config.updated_at).toLocaleString()
        : "Configuration loaded from ONYX."
    );
  }

  function readConfig() {
    if (!currentConfig) {
      throw new Error("Load the arcade configuration first.");
    }

    const minimum = numberValue("arcade-minimum");
    const maximum = numberValue("arcade-maximum");
    const payout = numberValue("arcade-payout");
    const streakWins = numberValue("arcade-streak-wins");

    if (minimum > maximum) {
      throw new Error("Minimum wager cannot exceed maximum wager.");
    }

    if (streakWins > 100) {
      throw new Error("Maximum streak wins cannot exceed 100.");
    }

    return {
      enabled: $("arcade-enabled").checked,
      games: {
        blackjack: $("arcade-blackjack").checked,
        slots: $("arcade-slots").checked,
        dice: $("arcade-dice").checked,
        betflip: $("arcade-betflip").checked
      },
      streaks_enabled: $("arcade-streaks").checked,
      minimum_wager: minimum,
      maximum_wager: maximum,
      maximum_payout: payout,
      maximum_streak_wins: streakWins
    };
  }

  async function loadConfig() {
    setMessage("Loading arcade configuration…");

    try {
      const data = await api("/api/owner/arcade/config");
      renderConfig(data.config);
      setMessage("Arcade configuration loaded successfully.");
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  async function saveConfig() {
    const button = $("arcade-save");
    button.disabled = true;

    try {
      const config = readConfig();

      setMessage("Saving arcade settings…");

      const result = await api("/api/owner/arcade/config", {
        method: "PATCH",
        body: JSON.stringify(config)
      });

      renderConfig(result.config);

      setMessage(
        "SUCCESS — Arcade settings saved to the ONYX database."
      );

      await loadActivity();
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function renderStreaks(streaks) {
    const list = $("arcade-streak-list");
    list.replaceChildren();

    $("arcade-active-count").textContent =
      numberFormat.format(streaks.length);

    if (!streaks.length) {
      const empty = document.createElement("div");
      empty.className = "arcade-empty";
      empty.textContent = "No active streaks right now.";
      list.append(empty);
      return;
    }

    streaks.forEach(streak => {
      const row = document.createElement("div");
      row.className = "arcade-activity-row";

      const details = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = "Player " + streak.user_id;

      const meta = document.createElement("small");
      meta.textContent =
        `${streak.current_game || "Awaiting game"} · ` +
        `${streak.streak_wins} wins · ` +
        `${streak.status}`;

      const pot = document.createElement("strong");
      pot.className = "arcade-activity-value";
      pot.textContent =
        numberFormat.format(streak.pot) + " Credits";

      details.append(title, meta);
      row.append(details, pot);
      list.append(row);
    });
  }

  function renderLogs(logs) {
    const list = $("arcade-log-list");
    list.replaceChildren();

    if (!logs.length) {
      const empty = document.createElement("div");
      empty.className = "arcade-empty";
      empty.textContent = "No arcade administration changes recorded yet.";
      list.append(empty);
      return;
    }

    logs.forEach(log => {
      const row = document.createElement("div");
      row.className = "arcade-activity-row";

      const details = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = log.action;

      const meta = document.createElement("small");
      meta.textContent =
        "Owner " + log.actor_id +
        " · " +
        (log.created_at
          ? new Date(log.created_at).toLocaleString()
          : "Date unavailable");

      const detail = document.createElement("pre");
      detail.className = "arcade-log-details";
      detail.textContent = JSON.stringify(log.details || {}, null, 2);

      details.append(title, meta, detail);
      row.append(details);
      list.append(row);
    });
  }

  async function loadActivity() {
    const refresh = $("arcade-refresh");
    refresh.disabled = true;

    try {
      const [streakData, logData] = await Promise.all([
        api("/api/owner/arcade/streaks"),
        api("/api/owner/arcade/logs?limit=50")
      ]);

      renderStreaks(streakData.streaks || []);
      renderLogs(logData.logs || []);

      $("arcade-activity-updated").textContent =
        "Activity refreshed: " + new Date().toLocaleString();
    } catch (error) {
      setMessage("Could not refresh activity: " + error.message, true);
    } finally {
      refresh.disabled = false;
    }
  }

  // --------------------------------------------------
  // OWNER CREDIT EARNINGS LEDGER
  // --------------------------------------------------

  function addCreditStyles() {
    if ($("owner-credit-styles")) return;

    const style = document.createElement("style");
    style.id = "owner-credit-styles";
    style.textContent = `
      .credit-stat-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
        gap:14px;
        margin:20px 0;
      }
      .credit-stat {
        padding:18px;
        border:1px solid var(--border,rgba(255,255,255,.12));
        border-radius:14px;
        background:var(--card,rgba(255,255,255,.035));
      }
      .credit-stat span {
        display:block;
        font-size:12px;
        opacity:.7;
        margin-bottom:9px;
      }
      .credit-stat strong {
        display:block;
        font-size:25px;
        overflow-wrap:anywhere;
      }
      .credit-toolbar {
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
        margin:18px 0;
      }
      .credit-toolbar input,
      .credit-toolbar select {
        min-width:150px;
        flex:1;
        padding:11px 12px;
        border-radius:9px;
        border:1px solid var(--border,rgba(255,255,255,.16));
        background:var(--card,rgba(255,255,255,.04));
        color:inherit;
      }
      .credit-toolbar button,
      .credit-load-more {
        padding:11px 16px;
        border-radius:9px;
        border:1px solid var(--border,rgba(255,255,255,.18));
        cursor:pointer;
        color:inherit;
        background:var(--card,rgba(255,255,255,.08));
      }
      .credit-table-wrap {
        width:100%;
        overflow-x:auto;
        border:1px solid var(--border,rgba(255,255,255,.12));
        border-radius:12px;
      }
      .credit-table {
        width:100%;
        min-width:760px;
        border-collapse:collapse;
        text-align:left;
      }
      .credit-table th,
      .credit-table td {
        padding:13px 14px;
        border-bottom:1px solid var(--border,rgba(255,255,255,.09));
        vertical-align:top;
      }
      .credit-table th {
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.06em;
        opacity:.7;
      }
      .credit-table td {
        font-size:13px;
      }
      .credit-user-name {
        display:block;
        font-weight:700;
      }
      .credit-user-meta {
        display:block;
        opacity:.65;
        font-size:11px;
        margin-top:4px;
      }
      .credit-amount {
        font-weight:800;
        white-space:nowrap;
      }
      .credit-source {
        display:inline-block;
        padding:5px 8px;
        border-radius:7px;
        background:rgba(45,190,150,.12);
        font-size:11px;
      }
      .credit-message {
        padding:14px;
        opacity:.75;
      }
      .credit-actions {
        display:flex;
        gap:10px;
        align-items:center;
        margin-top:16px;
      }
      .credit-source-summary {
        display:flex;
        flex-wrap:wrap;
        gap:9px;
        margin:14px 0;
      }
      .credit-source-summary span {
        padding:8px 10px;
        border-radius:8px;
        background:var(--card,rgba(255,255,255,.05));
        font-size:12px;
      }
      @media(max-width:600px) {
        .credit-stat strong {font-size:21px}
        .credit-toolbar input,
        .credit-toolbar select {min-width:100%}
      }
    `;
    document.head.append(style);
  }

  function createCreditPanel() {
    if ($("owner-credit-panel")) return;

    const nav = $("dashboard-nav");
    const content = document.querySelector(".dashboard-content");

    if (!nav || !content) {
      console.warn("ONYX Credit Earnings: dashboard navigation was not found.");
      return;
    }

    const navButton = document.createElement("button");
    navButton.type = "button";
    navButton.dataset.dashboardView = "credits";
    navButton.hidden = true;
    navButton.textContent = "Credit Earnings";
    nav.append(navButton);

    const panel = document.createElement("section");
    panel.className = "dashboard-view";
    panel.dataset.dashboardPanel = "credits";
    panel.id = "owner-credit-panel";
    panel.hidden = true;

    panel.innerHTML = `
      <div class="view-heading">
        <div>
          <h2>Credit Earnings</h2>
          <p>Track every credit earned through ONYX bot rewards.</p>
        </div>
        <button type="button" id="credit-refresh">Refresh Ledger</button>
      </div>

      <div class="credit-stat-grid">
        <div class="credit-stat">
          <span>Total Bot Credits Earned</span>
          <strong id="credit-total">—</strong>
        </div>
        <div class="credit-stat">
          <span>Reward Transactions</span>
          <strong id="credit-transactions-count">—</strong>
        </div>
        <div class="credit-stat">
          <span>Users Rewarded</span>
          <strong id="credit-users-count">—</strong>
        </div>
      </div>

      <h3>Reward Breakdown</h3>
      <div class="credit-source-summary" id="credit-source-summary">
        <span>Loading reward totals…</span>
      </div>

      <div class="view-heading">
        <div>
          <h3>Reward History</h3>
          <p>Daily, weekly, work, and beg rewards recorded by the bot.</p>
        </div>
      </div>

      <div class="credit-toolbar">
        <input
          type="search"
          id="credit-search"
          placeholder="Search display name or exact ID"
          aria-label="Search display name or user ID"
        >
        <input
          type="text"
          id="credit-user-id"
          inputmode="numeric"
          placeholder="Filter by user ID"
          aria-label="Filter by user ID"
        >
        <select id="credit-source-filter" aria-label="Filter reward source">
          <option value="">All reward types</option>
          <option value="reward_daily">Daily</option>
          <option value="reward_weekly">Weekly</option>
          <option value="reward_work">Work</option>
          <option value="reward_beg">Beg</option>
        </select>
        <button type="button" id="credit-apply-filters">Apply Filters</button>
        <button type="button" id="credit-clear-filters">Clear</button>
      </div>

      <div id="credit-ledger-message" class="credit-message">
        Loading credit history…
      </div>

      <div class="credit-table-wrap">
        <table class="credit-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Credits Earned</th>
              <th>Reward</th>
              <th>Balance After</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody id="credit-ledger-rows"></tbody>
        </table>
      </div>

      <div class="credit-actions">
        <button type="button" class="credit-load-more" id="credit-load-more" hidden>
          Load More Transactions
        </button>
        <span id="credit-ledger-count" class="muted"></span>
      </div>

      <p class="muted" style="margin-top:18px;font-size:12px">
        Read-only ledger. Transfers, arcade payouts, and shop purchases are excluded.
      </p>
    `;

    content.append(panel);

    addCreditStyles();

    $("credit-refresh").addEventListener("click", refreshCreditLedger);

    $("credit-apply-filters").addEventListener("click", () => {
      loadCreditTransactions(false);
    });

    $("credit-clear-filters").addEventListener("click", () => {
      $("credit-search").value = "";
      $("credit-user-id").value = "";
      $("credit-source-filter").value = "";
      loadCreditTransactions(false);
    });

    $("credit-load-more").addEventListener("click", () => {
      loadCreditTransactions(true);
    });

    $("credit-search").addEventListener("keydown", event => {
      if (event.key === "Enter") loadCreditTransactions(false);
    });

    $("credit-user-id").addEventListener("keydown", event => {
      if (event.key === "Enter") loadCreditTransactions(false);
    });
  }

  function renderCreditSummary(data) {
    $("credit-total").textContent =
      numberFormat.format(data.total_earned || 0);

    $("credit-transactions-count").textContent =
      numberFormat.format(data.transaction_count || 0);

    $("credit-users-count").textContent =
      numberFormat.format(data.users_rewarded || 0);

    const container = $("credit-source-summary");
    container.replaceChildren();

    const sources = data.sources || [];

    if (!sources.length) {
      const empty = document.createElement("span");
      empty.textContent = "No reward earnings recorded yet.";
      container.append(empty);
      return;
    }

    sources.forEach(item => {
      const chip = document.createElement("span");
      const label = REWARD_LABELS[item.source] || item.source;

      chip.textContent =
        `${label}: ${numberFormat.format(item.total_earned || 0)} credits`;

      container.append(chip);
    });
  }

  function appendCreditRow(item) {
    const row = document.createElement("tr");

    const userCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "credit-user-name";
    name.textContent = item.display_name || "Name not recorded yet";

    const userMeta = document.createElement("span");
    userMeta.className = "credit-user-meta";
    userMeta.textContent =
      `${item.username ? "@" + item.username + " · " : ""}ID: ${item.user_id}`;

    userCell.append(name, userMeta);

    const amountCell = document.createElement("td");
    amountCell.className = "credit-amount";
    amountCell.textContent =
      "+" + numberFormat.format(item.amount || 0);

    const sourceCell = document.createElement("td");
    const source = document.createElement("span");
    source.className = "credit-source";
    source.textContent = REWARD_LABELS[item.source] || item.source;
    sourceCell.append(source);

    const balanceCell = document.createElement("td");
    balanceCell.textContent =
      numberFormat.format(item.balance_after || 0);

    const dateCell = document.createElement("td");
    dateCell.textContent = item.created_at
      ? new Date(item.created_at).toLocaleString()
      : "Date unavailable";

    row.append(
      userCell,
      amountCell,
      sourceCell,
      balanceCell,
      dateCell
    );

    $("credit-ledger-rows").append(row);
  }

  function creditFilterUrl(before = null) {
    const params = new URLSearchParams();
    params.set("limit", "50");

    const search = $("credit-search").value.trim();
    const userId = $("credit-user-id").value.trim();
    const source = $("credit-source-filter").value;

    if (search) params.set("search", search);
    if (userId) params.set("user_id", userId);
    if (source) params.set("source", source);
    if (before) params.set("before", String(before));

    return "/api/owner/credits/transactions?" + params.toString();
  }

  async function loadCreditTransactions(loadMore = false) {
    if (creditLoading) return;

    const message = $("credit-ledger-message");
    const moreButton = $("credit-load-more");

    if (!loadMore) {
      creditCursor = null;
      $("credit-ledger-rows").replaceChildren();
      $("credit-ledger-count").textContent = "";
      message.textContent = "Loading credit history…";
    } else if (!creditCursor) {
      return;
    }

    creditLoading = true;
    moreButton.disabled = true;

    try {
      const data = await api(creditFilterUrl(loadMore ? creditCursor : null));
      const transactions = data.transactions || [];

      transactions.forEach(appendCreditRow);

      if (!loadMore && !transactions.length) {
        message.textContent = "No matching reward transactions were found.";
      } else {
        message.textContent = "";
      }

      creditCursor = data.next_before || null;
      moreButton.hidden = !data.has_more;
      moreButton.disabled = false;

      const displayed = $("credit-ledger-rows").children.length;
      $("credit-ledger-count").textContent =
        `${numberFormat.format(displayed)} transactions displayed`;
    } catch (error) {
      message.textContent = "Could not load credit history: " + error.message;
      moreButton.hidden = true;
    } finally {
      creditLoading = false;
      moreButton.disabled = false;
    }
  }

  async function refreshCreditLedger() {
    const button = $("credit-refresh");
    button.disabled = true;

    try {
      const summary = await api("/api/owner/credits/summary");
      renderCreditSummary(summary);
      await loadCreditTransactions(false);
    } catch (error) {
      $("credit-ledger-message").textContent =
        "Could not refresh the credit ledger: " + error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function enableCreditLedgerForOwner() {
    try {
      const access = await api("/api/developer/access");

      if (access.role !== "owner") {
        return;
      }

      const navButton = document.querySelector(
        '[data-dashboard-view="credits"]'
      );

      if (navButton) {
        navButton.hidden = false;
      }

      await refreshCreditLedger();
    } catch (error) {
      console.warn("ONYX Credit Earnings access check failed:", error.message);
    }
  }

  function initCreditLedger() {
    createCreditPanel();
    enableCreditLedgerForOwner();
  }

  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  function init() {
    initCreditLedger();

    if (!$("arcade-save")) return;

    $("arcade-save").addEventListener("click", saveConfig);
    $("arcade-refresh").addEventListener("click", loadActivity);

    $("arcade-reload").addEventListener("click", async () => {
      await loadConfig();
      await loadActivity();
    });

    $("arcade-emergency-stop").addEventListener("click", async () => {
      if (!window.confirm(
        "Disable the entire ONYX arcade? This will prevent new games from starting. Continue?"
      )) return;

      $("arcade-enabled").checked = false;
      await saveConfig();
    });

    loadConfig();
    loadActivity();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

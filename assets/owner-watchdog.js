
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const $ = id => document.getElementById(id);
  const numberFormat = new Intl.NumberFormat("en-US");

  let nextCursor = null;
  let loading = false;
  let refreshTimer = null;

  const state = {
    category: "",
    outcome: "",
    search: ""
  };

  async function request(path) {
    const response = await fetch(API + path, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    let data = {};

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        data.error || "Watchdog request failed (" + response.status + ")."
      );
    }

    return data;
  }

  function escapeText(value) {
    return String(value ?? "");
  }

  function createStyles() {
    if ($("watchdog-styles")) return;

    const style = document.createElement("style");
    style.id = "watchdog-styles";

    style.textContent = `
      .watchdog-grid {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin:20px 0;
      }

      .watchdog-stat {
        padding:18px;
        border:1px solid var(--line);
        background:#091316;
        min-width:0;
      }

      .watchdog-stat span {
        display:block;
        color:var(--muted);
        font-size:10px;
        letter-spacing:.12em;
        text-transform:uppercase;
      }

      .watchdog-stat strong {
        display:block;
        color:var(--teal);
        font-size:27px;
        margin-top:8px;
        overflow-wrap:anywhere;
      }

      .watchdog-toolbar {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin:18px 0;
      }

      .watchdog-toolbar input,
      .watchdog-toolbar select {
        width:100%;
        min-width:0;
        padding:12px;
        background:#071012;
        border:1px solid var(--line);
        color:#fff;
        font:inherit;
      }

      .watchdog-toolbar input {
        grid-column:span 2;
      }

      .watchdog-actions {
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin:12px 0;
      }

      .watchdog-feed {
        display:grid;
        gap:10px;
        margin-top:16px;
      }

      .watchdog-event {
        border:1px solid var(--line);
        background:#091316;
        padding:16px;
        min-width:0;
      }

      .watchdog-event-top {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap:12px;
        flex-wrap:wrap;
      }

      .watchdog-event-title {
        font-weight:700;
        overflow-wrap:anywhere;
      }

      .watchdog-event-meta {
        color:var(--muted);
        font-size:12px;
        line-height:1.7;
        margin-top:6px;
        overflow-wrap:anywhere;
      }

      .watchdog-identity {
        margin-top:9px;
        display:grid;
        gap:5px;
        font-size:12px;
        line-height:1.6;
        overflow-wrap:anywhere;
      }

      .watchdog-identity-row {
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        align-items:baseline;
      }

      .watchdog-identity-label {
        color:var(--muted);
        min-width:48px;
      }

      .watchdog-identity-name {
        color:#e4f5f3;
        font-weight:600;
      }

      .watchdog-identity-id {
        color:var(--muted);
        font-size:11px;
        overflow-wrap:anywhere;
      }

      .watchdog-tag {
        display:inline-block;
        padding:5px 9px;
        border:1px solid var(--line);
        background:#102024;
        color:#d9eeee;
        font-size:10px;
        text-transform:uppercase;
        letter-spacing:.08em;
      }

      .watchdog-tag.error,
      .watchdog-tag.warning {
        border-color:#754b35;
        color:#ffd2a8;
        background:#21170f;
      }

      .watchdog-tag.rejected {
        border-color:#75404a;
        color:#ffb8c1;
        background:#261318;
      }

      .watchdog-details {
        margin-top:12px;
        padding:12px;
        border:1px solid var(--line);
        background:#050b0e;
      }

      .watchdog-details summary {
        cursor:pointer;
        color:var(--teal);
        font-size:12px;
      }

      .watchdog-details pre {
        margin:12px 0 0;
        color:#c8d9d9;
        font-size:11px;
        line-height:1.6;
        white-space:pre-wrap;
        overflow-wrap:anywhere;
      }

      .watchdog-empty {
        padding:26px;
        border:1px dashed var(--line);
        color:var(--muted);
        text-align:center;
      }

      .watchdog-status {
        color:var(--muted);
        font-size:12px;
        margin-top:12px;
      }

      @media(max-width:800px) {
        .watchdog-grid {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .watchdog-toolbar {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:550px) {
        .watchdog-grid {
          grid-template-columns:1fr 1fr;
        }

        .watchdog-toolbar {
          grid-template-columns:1fr;
        }

        .watchdog-toolbar input {
          grid-column:auto;
        }
      }
    `;

    document.head.append(style);
  }

  function createDashboard() {
    const nav = $("dashboard-nav");
    const content = document.querySelector(".dashboard-content");

    if (!nav || !content || $("watchdog-panel")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.dashboardView = "watchdog";
    button.innerHTML =
      '<span>◉</span><span>Watchdog<small>Global activity monitor</small></span>';

    const arcadeButton = nav.querySelector(
      '[data-dashboard-view="arcade"]'
    );

    if (arcadeButton) {
      arcadeButton.insertAdjacentElement("afterend", button);
    } else {
      nav.append(button);
    }

    const panel = document.createElement("section");
    panel.className = "dashboard-view";
    panel.dataset.dashboardPanel = "watchdog";
    panel.id = "watchdog-panel";
    panel.hidden = true;

    panel.innerHTML = `
      <div class="panel">
        <div class="view-heading">
          <div>
            <div class="eyebrow">OWNER ONLY · GLOBAL AUDIT CENTER</div>
            <h2>ONYX Watchdog</h2>
            <p>Monitor activity across every server connected to ONYX.</p>
          </div>
        </div>

        <div class="watchdog-grid">
          <div class="watchdog-stat">
            <span>Total Events</span>
            <strong id="watchdog-total">—</strong>
          </div>

          <div class="watchdog-stat">
            <span>Events · 24 Hours</span>
            <strong id="watchdog-24h">—</strong>
          </div>

          <div class="watchdog-stat">
            <span>Errors · 24 Hours</span>
            <strong id="watchdog-errors">—</strong>
          </div>

          <div class="watchdog-stat">
            <span>Warnings · 24 Hours</span>
            <strong id="watchdog-warnings">—</strong>
          </div>
        </div>

        <div class="watchdog-status" id="watchdog-category-summary">
          Loading category statistics…
        </div>

        <div class="watchdog-actions">
          <button class="button" id="watchdog-refresh" type="button">
            ↻ Refresh activity
          </button>

          <span class="watchdog-status" id="watchdog-updated">
            Waiting for data…
          </span>
        </div>

        <div class="eyebrow">ACTIVITY FILTERS</div>

        <div class="watchdog-toolbar">
          <input
            id="watchdog-search"
            type="search"
            placeholder="Search action, username, or server"
            aria-label="Search Watchdog events"
          >

          <select id="watchdog-category" aria-label="Filter by category">
            <option value="">All categories</option>
            <option value="command">Commands</option>
            <option value="moderation">Moderation</option>
            <option value="security">Security</option>
            <option value="economy">Economy</option>
            <option value="leveling">Leveling</option>
            <option value="member">Members</option>
            <option value="server">Server changes</option>
            <option value="voice">Voice</option>
            <option value="system">System</option>
          </select>

          <select id="watchdog-outcome" aria-label="Filter by outcome">
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
            <option value="rejected">Rejected</option>
            <option value="warning">Warning</option>
          </select>
        </div>

        <div class="eyebrow">GLOBAL ACTIVITY FEED</div>

        <div class="watchdog-feed" id="watchdog-feed">
          <div class="watchdog-empty">Loading Watchdog activity…</div>
        </div>

        <div class="watchdog-actions">
          <button class="button" id="watchdog-load-more" type="button" hidden>
            Load older events
          </button>
        </div>

        <div class="watchdog-status" id="watchdog-message" role="status">
          Activity refreshes automatically while this page is open.
        </div>
      </div>
    `;

    content.append(panel);

    button.addEventListener("click", () => {
      if (button.hidden) return;

      if (typeof window.loadWatchdog === "function") {
        window.loadWatchdog();
      }
    });

    $("watchdog-refresh").addEventListener("click", () => {
      window.loadWatchdog(true);
    });

    $("watchdog-load-more").addEventListener("click", () => {
      loadEvents(true);
    });

    $("watchdog-category").addEventListener("change", () => {
      state.category = $("watchdog-category").value;
      window.loadWatchdog(true);
    });

    $("watchdog-outcome").addEventListener("change", () => {
      state.outcome = $("watchdog-outcome").value;
      window.loadWatchdog(true);
    });

    let searchDelay;

    $("watchdog-search").addEventListener("input", () => {
      clearTimeout(searchDelay);

      searchDelay = setTimeout(() => {
        state.search = $("watchdog-search").value.trim();
        window.loadWatchdog(true);
      }, 350);
    });
  }

  function buildQuery(cursor) {
    const params = new URLSearchParams();
    params.set("limit", "50");

    if (state.category) {
      params.set("category", state.category);
    }

    if (state.outcome) {
      params.set("outcome", state.outcome);
    }

    if (state.search) {
      params.set("q", state.search);
    }

    if (cursor) {
      params.set("before_id", cursor);
    }

    return params.toString();
  }

  function renderStats(data) {
    $("watchdog-total").textContent =
      numberFormat.format(data.total_events || 0);

    $("watchdog-24h").textContent =
      numberFormat.format(data.events_24h || 0);

    $("watchdog-errors").textContent =
      numberFormat.format(data.errors_24h || 0);

    $("watchdog-warnings").textContent =
      numberFormat.format(data.warnings_24h || 0);

    const categories = data.categories_24h || {};
    const entries = Object.entries(categories);

    $("watchdog-category-summary").textContent = entries.length
      ? "Last 24 hours · " + entries.map(
          ([name, count]) =>
            name + ": " + numberFormat.format(count)
        ).join("  ·  ")
      : "No categorized events recorded in the last 24 hours.";
  }

  function addIdentityRow(container, label, name, id) {
    if (!name && !id) return;

    const row = document.createElement("div");
    row.className = "watchdog-identity-row";

    const heading = document.createElement("span");
    heading.className = "watchdog-identity-label";
    heading.textContent = label + ":";

    const display = document.createElement("span");
    display.className = "watchdog-identity-name";
    display.textContent = escapeText(name || id || "Unknown");

    row.append(heading, display);

    if (id && name && String(id) !== String(name)) {
      const identifier = document.createElement("span");
      identifier.className = "watchdog-identity-id";
      identifier.textContent = "(" + escapeText(id) + ")";
      row.append(identifier);
    }

    container.append(row);
  }

  function createEvent(event) {
    const article = document.createElement("article");
    article.className = "watchdog-event";

    const top = document.createElement("div");
    top.className = "watchdog-event-top";

    const info = document.createElement("div");

    const title = document.createElement("div");
    title.className = "watchdog-event-title";
    title.textContent = escapeText(event.action || "Unknown action");

    const meta = document.createElement("div");
    meta.className = "watchdog-event-meta";

    const date = event.created_at
      ? new Date(event.created_at).toLocaleString()
      : "Unknown time";

    meta.textContent = [
      date,
      "Category: " + escapeText(event.category || "Unknown"),
      "Event ID: " + escapeText(event.id)
    ].join(" · ");

    info.append(title, meta);

    const identities = document.createElement("div");
    identities.className = "watchdog-identity";

    addIdentityRow(
      identities,
      "User",
      event.display_name || event.username,
      event.user_id
    );

    addIdentityRow(
      identities,
      "Server",
      event.guild_name,
      event.guild_id
    );

    addIdentityRow(
      identities,
      "Target",
      event.target_display_name || event.target_username,
      event.target_id
    );

    info.append(identities);

    const badge = document.createElement("span");
    const outcome = String(event.outcome || "unknown").toLowerCase();
    badge.className = "watchdog-tag " + outcome;
    badge.textContent = outcome;

    top.append(info, badge);
    article.append(top);

    const details = document.createElement("details");
    details.className = "watchdog-details";

    const summary = document.createElement("summary");
    summary.textContent = "View event details";

    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(event.details || {}, null, 2);

    details.append(summary, pre);
    article.append(details);

    return article;
  }

  async function loadStats() {
    const data = await request("/api/owner/watchdog/stats");
    renderStats(data);
  }

  async function loadEvents(append = false) {
    if (loading) return;

    loading = true;

    const feed = $("watchdog-feed");
    const more = $("watchdog-load-more");
    const message = $("watchdog-message");

    if (!append) {
      nextCursor = null;
      feed.replaceChildren();

      const loadingBox = document.createElement("div");
      loadingBox.className = "watchdog-empty";
      loadingBox.textContent = "Loading global activity…";
      feed.append(loadingBox);
    }

    message.textContent = "Retrieving Watchdog events…";

    try {
      const query = buildQuery(append ? nextCursor : null);
      const data = await request(
        "/api/owner/watchdog/events?" + query
      );

      if (!append) {
        feed.replaceChildren();
      }

      const events = data.events || [];

      if (!events.length && !append) {
        const empty = document.createElement("div");
        empty.className = "watchdog-empty";
        empty.textContent =
          "No events match these filters yet.";
        feed.append(empty);
      } else {
        events.forEach(event => {
          feed.append(createEvent(event));
        });
      }

      nextCursor = data.next_before_id || null;
      more.hidden = !data.has_more;
      message.textContent =
        numberFormat.format(events.length) +
        " events loaded. " +
        (data.has_more ? "More activity is available." : "You're up to date.");

      $("watchdog-updated").textContent =
        "Last refreshed: " + new Date().toLocaleTimeString();

    } catch (error) {
      if (!append) {
        feed.replaceChildren();

        const failure = document.createElement("div");
        failure.className = "watchdog-empty";
        failure.textContent = error.message;
        feed.append(failure);
      }

      message.textContent = "Could not load events: " + error.message;
      more.hidden = true;

    } finally {
      loading = false;
    }
  }

  async function loadWatchdog(reset = false) {
    if (!$("watchdog-panel")) return;

    if (reset) {
      nextCursor = null;
    }

    try {
      await loadStats();
    } catch (error) {
      $("watchdog-category-summary").textContent =
        "Statistics unavailable: " + error.message;
    }

    await loadEvents(false);
  }

  function startAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    refreshTimer = setInterval(() => {
      const panel = $("watchdog-panel");

      if (
        panel &&
        !panel.hidden &&
        document.visibilityState === "visible"
      ) {
        loadWatchdog(true);
      }
    }, 20000);
  }

  function initialize() {
    createStyles();
    createDashboard();

    const roleLabel = $("role-label");
    const button = document.querySelector(
      '[data-dashboard-view="watchdog"]'
    );

    function updateAccess() {
      if (!roleLabel || !button) return;

      const isOwner =
        roleLabel.textContent.trim() === "ONYX Owner";

      button.hidden = !isOwner;

      if (!isOwner && $("watchdog-panel")) {
        $("watchdog-panel").hidden = true;
      }

      if (isOwner) {
        startAutoRefresh();
      }
    }

    if (roleLabel) {
      const observer = new MutationObserver(updateAccess);

      observer.observe(roleLabel, {
        childList: true,
        characterData: true,
        subtree: true
      });

      updateAccess();
    }
  }

  window.loadWatchdog = loadWatchdog;

  document.addEventListener("DOMContentLoaded", initialize);
})();

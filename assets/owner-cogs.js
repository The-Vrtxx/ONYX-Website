(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const $ = id => document.getElementById(id);

  let healthData = null;
  let loading = false;
  let refreshTimer = null;

  // Add Cog Monitor to the existing dashboard navigation.
  const nav = $("dashboard-nav");
  const content = document.querySelector(".dashboard-content");

  if (!nav || !content || $("cog-monitor-panel")) return;

  const navButton = document.createElement("button");
  navButton.type = "button";
  navButton.dataset.dashboardView = "cogs";
  navButton.innerHTML =
    '<span>⌘</span><span>Cog Monitor<small>Extension status</small></span>';

  const settingsButton = nav.querySelector(
    '[data-dashboard-view="settings"]'
  );

  nav.insertBefore(navButton, settingsButton || null);

  // Build the new dashboard section.
  const panel = document.createElement("section");
  panel.className = "dashboard-view";
  panel.id = "cog-monitor-panel";
  panel.dataset.dashboardPanel = "cogs";
  panel.hidden = true;

  panel.innerHTML = `
    <div class="panel">
      <div class="view-heading">
        <div>
          <div class="eyebrow">ONYX RUNTIME</div>
          <h2>Cog Monitor</h2>
          <p>Live extension status reported by the running ONYX bot.</p>
        </div>
        <button class="button primary" id="cog-refresh" type="button">
          Refresh
        </button>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <span>Bot status</span>
          <strong id="cog-bot-status">—</strong>
        </div>
        <div class="stat-card">
          <span>Loaded cogs</span>
          <strong id="cog-loaded-count">—</strong>
        </div>
        <div class="stat-card">
          <span>Discovered extensions</span>
          <strong id="cog-total-count">—</strong>
        </div>
        <div class="stat-card">
          <span>Load errors</span>
          <strong id="cog-failed-count">—</strong>
        </div>
      </div>

      <div class="asset-toolbar">
        <input
          id="cog-search"
          type="search"
          placeholder="Search extensions..."
          aria-label="Search extensions"
          style="background:#071012;border:1px solid var(--line);color:#fff;padding:12px;flex:1;min-width:180px;font:inherit"
        >
        <select id="cog-filter" aria-label="Filter extensions">
          <option value="all">All extensions</option>
          <option value="loaded">Loaded only</option>
          <option value="not-loaded">Not loaded</option>
          <option value="failed">Load errors</option>
        </select>
      </div>

      <div class="message" id="cog-heartbeat">
        Waiting for runtime information…
      </div>

      <div class="asset-grid" id="cog-list">
        <div class="asset-empty">Loading extensions…</div>
      </div>

      <div class="status-line" id="cog-last-refresh">
        Not refreshed yet.
      </div>
      <div class="message error" id="cog-error" role="status"></div>
    </div>
  `;

  content.append(panel);

  function statusColor(status) {
    const value = String(status || "unknown").toLowerCase();

    if (value === "online" || value === "loaded" || value === "ok") {
      return "#55d6a2";
    }

    if (value === "offline" || value === "unloaded" || value === "error") {
      return "#ff8585";
    }

    return "#e6bd70";
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function renderCogs() {
    const list = $("cog-list");
    if (!list) return;

    list.replaceChildren();

    const discovered = Array.isArray(healthData?.discovered_cogs)
      ? healthData.discovered_cogs
      : [];

    const loaded = new Set(
      (Array.isArray(healthData?.loaded_cogs)
        ? healthData.loaded_cogs
        : []).map(name => String(name))
    );

    const failed = Array.isArray(healthData?.failed_cogs)
      ? healthData.failed_cogs
      : [];

    const failedByName = new Map(
      failed
        .filter(item => item && typeof item === "object")
        .map(item => [
          String(item.name || ""),
          String(item.error || "Unknown load error")
        ])
    );

    // Include any loaded or failed extension even if an older bot inventory
    // did not include it in discovered_cogs.
    const allNames = new Set(discovered.map(name => String(name)));
    loaded.forEach(name => allNames.add(name));

    failedByName.forEach((_, name) => {
      if (name) allNames.add(name);
    });

    const search = $("cog-search").value.trim().toLowerCase();
    const filter = $("cog-filter").value;

    const entries = Array.from(allNames).map(name => {
      let status = "not-loaded";
      let error = "";

      if (loaded.has(name)) {
        status = "loaded";
      } else if (failedByName.has(name)) {
        status = "failed";
        error = failedByName.get(name);
      }

      return {name, status, error};
    });

    const filtered = entries.filter(entry => {
      const matchesSearch =
        entry.name.toLowerCase().includes(search) ||
        entry.error.toLowerCase().includes(search);

      const matchesFilter =
        filter === "all" ||
        filter === entry.status;

      return matchesSearch && matchesFilter;
    });

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "asset-empty";
      empty.textContent = entries.length
        ? "No extensions match your search or filter."
        : "No extension inventory has been reported yet.";

      list.append(empty);
      return;
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    filtered.forEach(entry => {
      const card = document.createElement("article");
      card.className = "asset-card";

      const top = document.createElement("div");
      top.className = "asset-card-top";

      const title = document.createElement("h3");
      title.textContent = entry.name;

      const badge = document.createElement("span");

      const statusLabels = {
        loaded: "LOADED",
        "not-loaded": "NOT LOADED",
        failed: "LOAD ERROR"
      };

      badge.textContent = statusLabels[entry.status];
      badge.style.cssText =
        "font-size:11px;font-weight:700;letter-spacing:.08em;color:" +
        statusColor(
          entry.status === "not-loaded" ? "unknown" : entry.status
        );

      top.append(title, badge);

      const detail = document.createElement("div");
      detail.className = "asset-meta";

      if (entry.status === "loaded") {
        detail.textContent = "Reported by the active ONYX runtime.";
      } else if (entry.status === "failed") {
        detail.textContent = "Load failure: " + entry.error;
        detail.style.color = "#ff8585";
      } else {
        detail.textContent =
          "Discovered at startup, but not present in the loaded extension registry.";
      }

      card.append(top, detail);
      list.append(card);
    });
  }

  async function loadCogs() {
    if (loading) return;

    loading = true;
    $("cog-refresh").disabled = true;
    setText("cog-error", "");

    try {
      const response = await fetch(API + "/api/owner/system-health", {
        method: "GET",
        credentials: "include",
        headers: {Accept: "application/json"}
      });

      let data = {};

      try {
        data = await response.json();
      } catch (_) {}

      if (!response.ok) {
        throw new Error(
          data.error || "Could not retrieve runtime health."
        );
      }

      healthData = data;

      const cogs = Array.isArray(data.loaded_cogs)
        ? data.loaded_cogs
        : [];

      const discovered = Array.isArray(data.discovered_cogs)
        ? data.discovered_cogs
        : [];

      const failed = Array.isArray(data.failed_cogs)
        ? data.failed_cogs
        : [];

      const botStatus = String(
        data.bot_status || "unknown"
      ).toUpperCase();

      setText("cog-bot-status", botStatus);
      $("cog-bot-status").style.color =
        statusColor(data.bot_status);

      setText(
        "cog-loaded-count",
        Number(
          data.loaded_cog_count ?? cogs.length
        ).toLocaleString()
      );

      setText(
        "cog-total-count",
        Number(
          data.discovered_cog_count ?? discovered.length
        ).toLocaleString()
      );

      setText(
        "cog-failed-count",
        Number(
          data.failed_cog_count ?? failed.length
        ).toLocaleString()
      );

      let heartbeat = "No heartbeat has been recorded.";

      if (data.last_heartbeat) {
        heartbeat =
          "Last heartbeat: " +
          new Date(data.last_heartbeat).toLocaleString();

        if (data.heartbeat_age_seconds != null) {
          heartbeat +=
            " · " +
            Number(
              data.heartbeat_age_seconds
            ).toLocaleString() +
            " seconds ago";
        }
      }

      setText("cog-heartbeat", heartbeat);
      renderCogs();

      setText(
        "cog-last-refresh",
        "Last refreshed: " +
        new Date().toLocaleTimeString()
      );

    } catch (error) {
      setText(
        "cog-error",
        "Unable to load Cog Monitor: " + error.message
      );

      setText(
        "cog-last-refresh",
        "Refresh failed: " +
        new Date().toLocaleTimeString()
      );

    } finally {
      loading = false;
      $("cog-refresh").disabled = false;
    }
  }

  function startMonitor() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    loadCogs();

    refreshTimer = setInterval(() => {
      if (
        !document.hidden &&
        !$("cog-monitor-panel").hidden
      ) {
        loadCogs();
      }
    }, 30000);
  }

  // Wire up the new section.
  $("cog-refresh").addEventListener("click", loadCogs);
  $("cog-search").addEventListener("input", renderCogs);
  $("cog-filter").addEventListener("change", renderCogs);

  navButton.addEventListener("click", startMonitor);
})();

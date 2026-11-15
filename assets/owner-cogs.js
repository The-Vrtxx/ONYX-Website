
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";

  const $ = id => document.getElementById(id);

  let healthData = null;
  let refreshTimer = null;
  let loading = false;

  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? {"Content-Type": "application/json"} : {})
      },
      body: options.body
    });

    let data = {};

    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        data.error || "The request could not be completed."
      );
    }

    return data;
  }

  function avatarUrl(user) {
    if (!user.avatar) {
      return "../../assets/onyx-mark.png";
    }

    return "https://cdn.discordapp.com/avatars/" +
      encodeURIComponent(user.id) + "/" +
      encodeURIComponent(user.avatar) +
      ".png?size=96";
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value;
  }

  function makePill(status) {
    const normalized = String(status || "unknown").toLowerCase();

    const pill = document.createElement("span");
    pill.className = "status-pill";

    if (normalized === "loaded" || normalized === "online") {
      pill.classList.add("status-loaded");
      pill.textContent = normalized.toUpperCase();
    } else if (normalized === "unloaded" || normalized === "offline") {
      pill.classList.add("status-unloaded");
      pill.textContent = normalized.toUpperCase();
    } else {
      pill.classList.add("status-unknown");
      pill.textContent = "UNKNOWN";
    }

    return pill;
  }

  function formatHeartbeat(data) {
    if (!data.last_heartbeat) {
      return "No bot heartbeat has been recorded.";
    }

    const date = new Date(data.last_heartbeat);

    if (Number.isNaN(date.getTime())) {
      return "Heartbeat timestamp unavailable.";
    }

    let result = "Last heartbeat: " + date.toLocaleString();

    if (
      data.heartbeat_age_seconds !== null &&
      data.heartbeat_age_seconds !== undefined
    ) {
      result += " · " +
        Number(data.heartbeat_age_seconds).toLocaleString() +
        " seconds ago";
    }

    return result;
  }

  function renderCogs() {
    const list = $("cog-list");
    if (!list) return;

    list.replaceChildren();

    if (!healthData) {
      list.append(emptyState("Runtime information is unavailable."));
      return;
    }

    const search = $("cog-search").value.trim().toLowerCase();
    const filter = $("cog-filter").value;

    const cogs = Array.isArray(healthData.loaded_cogs)
      ? healthData.loaded_cogs
      : [];

    const filtered = cogs
      .filter(cog => {
        const name = String(cog);
        return !search || name.toLowerCase().includes(search);
      })
      .filter(() => filter === "all" || filter === "loaded");

    if (!filtered.length) {
      let message = "No extensions match your search.";

      if (!cogs.length) {
        message = "The bot has not reported any loaded extensions.";
      }

      list.append(emptyState(message));
      setText("cog-message", "0 extensions displayed.");
      return;
    }

    filtered.forEach(cog => {
      const card = document.createElement("article");
      card.className = "cog-card";

      const top = document.createElement("div");
      top.className = "cog-card-top";

      const info = document.createElement("div");

      const title = document.createElement("h3");
      title.textContent = String(cog);

      const meta = document.createElement("div");
      meta.className = "cog-meta";
      meta.textContent = "ONYX extension";

      info.append(title, meta);

      top.append(
        info,
        makePill("loaded")
      );

      const detail = document.createElement("div");
      detail.className = "cog-meta";
      detail.style.marginTop = "13px";
      detail.textContent = "Reported by the running ONYX bot.";

      card.append(top, detail);
      list.append(card);
    });

    setText(
      "cog-message",
      filtered.length + " of " + cogs.length +
      " reported extensions displayed."
    );
  }

  function emptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
  }

  async function loadCogs() {
    if (loading) return;

    loading = true;

    const refresh = $("refresh-cogs");
    const error = $("monitor-error");

    if (refresh) refresh.disabled = true;
    if (error) error.textContent = "";

    try {
      const data = await request("/api/owner/system-health");

      healthData = data;

      const cogs = Array.isArray(data.loaded_cogs)
        ? data.loaded_cogs
        : [];

      setText(
        "loaded-count",
        Number(data.loaded_cog_count ?? cogs.length).toLocaleString()
      );

      setText(
        "total-count",
        cogs.length.toLocaleString()
      );

      const statusNode = $("bot-status");

      if (statusNode) {
        statusNode.replaceChildren(
          makePill(data.bot_status)
        );
      }

      setText(
        "heartbeat-status",
        formatHeartbeat(data)
      );

      renderCogs();

      setText(
        "last-refresh",
        "Last refreshed: " + new Date().toLocaleTimeString()
      );

    } catch (err) {
      if (error) {
        error.textContent =
          "Unable to retrieve ONYX runtime data: " + err.message;
      }

      setText(
        "last-refresh",
        "Refresh failed: " + new Date().toLocaleTimeString()
      );

    } finally {
      loading = false;

      if (refresh) refresh.disabled = false;
    }
  }

  async function logout() {
    try {
      await request("/auth/logout", {
        method: "POST",
        body: "{}"
      });
    } catch (_) {}

    window.location.href = "/owner/";
  }

  function startAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    loadCogs();

    refreshTimer = setInterval(() => {
      if (!document.hidden) {
        loadCogs();
      }
    }, 30000);
  }

  async function initialize() {
    try {
      const user = await request("/api/me");

      $("account").hidden = false;
      $("username").textContent = user.username || "Discord user";
      $("avatar").src = avatarUrl(user);

      const access = await request("/api/developer/access");

      $("login-panel").hidden = true;

      if (!access.authorized) {
        $("denied-panel").hidden = false;
        return;
      }

      $("monitor").hidden = false;

      $("role-label").textContent =
        access.role === "owner"
          ? "ONYX Owner"
          : "ONYX Developer";

      $("refresh-cogs").addEventListener("click", loadCogs);
      $("cog-search").addEventListener("input", renderCogs);
      $("cog-filter").addEventListener("change", renderCogs);

      $("clear-search").addEventListener("click", () => {
        $("cog-search").value = "";
        $("cog-filter").value = "all";
        renderCogs();
      });

      startAutoRefresh();

    } catch (err) {
      if (err.message === "Sign in with Discord first.") {
        return;
      }

      $("login-panel").hidden = false;

      const message = document.createElement("p");
      message.className = "message error";
      message.textContent = err.message;
      $("login-panel").append(message);
    }
  }

  $("logout").addEventListener("click", logout);
  $("denied-logout").addEventListener("click", logout);

  initialize();
})();

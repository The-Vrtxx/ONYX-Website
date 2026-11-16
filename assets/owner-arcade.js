
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

  let currentConfig = null;

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

  function init() {
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

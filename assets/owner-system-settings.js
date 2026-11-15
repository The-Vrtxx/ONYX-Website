
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const panel = document.querySelector(
    '[data-dashboard-panel="settings"] .panel'
  );

  if (!panel) return;

  const FEATURES = [
    ["moderation", "Moderation", "Ban, kick, timeout, and other moderation tools."],
    ["automod", "Auto Moderation", "Automated message and behavior protection."],
    ["logging", "Logging", "Server event and moderation logs."],
    ["leveling", "Global Leveling", "Global XP and level progression."],
    ["prestige", "Prestige", "Prestige progression and related systems."],
    ["tickets", "Tickets", "Ticket and support tools."],
    ["welcome", "Welcome", "Welcome messages and onboarding."],
    ["voice", "Voice", "Voice-related features."],
    ["security", "Security", "Anti-nuke, anti-raid, and security protections."]
  ];

  let currentSettings = null;
  let healthRefreshTimer = null;
  let healthLoading = false;

  function el(tag, attributes = {}, content = "") {
    const node = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
      if (key === "class") {
        node.className = value;
      } else if (key === "checked") {
        node.checked = Boolean(value);
      } else {
        node.setAttribute(key, value);
      }
    });

    if (content) node.textContent = content;
    return node;
  }

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
      throw new Error(data.error || "The request could not be completed.");
    }

    return data;
  }

  function showMessage(message, isError = false) {
    const status = document.getElementById("system-settings-status");
    if (!status) return;

    status.textContent = message;
    status.className = isError ? "message error" : "message";
  }

  function makeSection(title, description) {
    const section = el("section", {
      class: "asset-card",
      style: "margin-top:16px;padding:20px;"
    });

    section.append(
      el("h3", {}, title),
      el("p", {class: "muted"}, description)
    );

    return section;
  }

  function makeToggle(id, title, description, checked) {
    const wrapper = el("label", {
      style: [
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "gap:16px",
        "padding:14px 0",
        "border-bottom:1px solid var(--line)",
        "cursor:pointer"
      ].join(";")
    });

    const text = el("span");

    text.append(
      el("strong", {}, title),
      el("small", {
        style: "display:block;color:var(--muted);margin-top:4px"
      }, description)
    );

    const input = el("input", {
      id,
      type: "checkbox",
      style: "width:20px;height:20px;accent-color:var(--teal);flex-shrink:0"
    });

    input.checked = Boolean(checked);
    wrapper.append(text, input);

    return {wrapper, input};
  }

  function makeSelect(id, labelText, options) {
    const label = el("label", {
      style: "display:grid;gap:7px;color:var(--muted);font-size:13px"
    });

    label.append(el("span", {}, labelText));

    const select = el("select", {
      id,
      style: "background:#071012;border:1px solid var(--line);color:#fff;padding:12px;width:100%;font:inherit"
    });

    options.forEach(option => {
      select.append(
        el("option", {value: option.value}, option.label)
      );
    });

    label.append(select);
    return {label, select};
  }

  function makeInput(id, labelText, maxLength, multiline = false) {
    const label = el("label", {
      style: "display:grid;gap:7px;color:var(--muted);font-size:13px"
    });

    label.append(el("span", {}, labelText));

    const input = multiline
      ? el("textarea", {
          id,
          maxlength: String(maxLength),
          rows: "3",
          style: "background:#071012;border:1px solid var(--line);color:#fff;padding:12px;width:100%;font:inherit;resize:vertical"
        })
      : el("input", {
          id,
          type: "text",
          maxlength: String(maxLength),
          style: "background:#071012;border:1px solid var(--line);color:#fff;padding:12px;width:100%;font:inherit"
        });

    label.append(input);
    return {label, input};
  }

  function makeHealthStat(label, id) {
    const card = el("div", {
      class: "stat-card",
      style: "min-width:0"
    });

    card.append(
      el("span", {}, label),
      el("strong", {
        id,
        style: "font-size:25px;overflow-wrap:anywhere"
      }, "—")
    );

    return card;
  }

  function setHealthValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function formatDuration(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];

    if (days) parts.push(days + "d");
    if (hours || days) parts.push(hours + "h");
    if (minutes || hours || days) parts.push(minutes + "m");

    parts.push(remainingSeconds + "s");

    return parts.join(" ");
  }

  function formatTimestamp(value) {
    if (!value) return "No heartbeat recorded";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Unknown";
    }

    return date.toLocaleString();
  }

  function makeStatusPill(status) {
    const normalized = String(status || "unknown").toLowerCase();

    let color = "#aab5bb";
    let background = "#182328";
    let label = normalized.toUpperCase();

    if (normalized === "online" || normalized === "connected") {
      color = "#80e4b0";
      background = "#102a20";
    } else if (
      normalized === "offline" ||
      normalized === "disconnected"
    ) {
      color = "#ff9da8";
      background = "#32171d";
    } else if (normalized === "unknown") {
      label = "UNKNOWN";
    }

    const pill = el("span", {
      style: [
        "display:inline-flex",
        "align-items:center",
        "padding:6px 10px",
        "border-radius:20px",
        "font-size:11px",
        "font-weight:700",
        "letter-spacing:.08em",
        "color:" + color,
        "background:" + background
      ].join(";")
    }, label);

    return pill;
  }

  function buildHealthInterface() {
    const health = makeSection(
      "System Health",
      "Live runtime information reported by the ONYX bot and shared API database."
    );

    const topLine = el("div", {
      style: "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:14px 0"
    });

    const statusGroup = el("div", {
      style: "display:flex;align-items:center;gap:10px;flex-wrap:wrap"
    });

    statusGroup.append(
      el("span", {
        style: "color:var(--muted);font-size:12px"
      }, "BOT STATUS"),
      el("span", {id: "health-bot-status"}, "Loading…")
    );

    const refreshButton = el("button", {
      type: "button",
      class: "secondary-button",
      id: "refresh-system-health"
    }, "↻ Refresh health");

    topLine.append(statusGroup, refreshButton);

    const stats = el("div", {
      class: "stat-grid",
      style: "grid-template-columns:repeat(auto-fit,minmax(145px,1fr))"
    });

    stats.append(
      makeHealthStat("Bot uptime", "health-uptime"),
      makeHealthStat("Servers", "health-servers"),
      makeHealthStat("Members", "health-members"),
      makeHealthStat("Loaded cogs", "health-cogs")
    );

    const databaseSection = el("div", {
      style: "margin-top:24px"
    });

    databaseSection.append(
      el("h3", {}, "Database Connections")
    );

    const databaseGrid = el("div", {
      style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-top:12px"
    });

    const botDatabase = el("div", {
      class: "asset-card",
      style: "padding:16px"
    });

    botDatabase.append(
      el("span", {class: "muted"}, "BOT DATABASE"),
      el("div", {
        id: "health-bot-database",
        style: "margin-top:10px"
      }, "Loading…")
    );

    const apiDatabase = el("div", {
      class: "asset-card",
      style: "padding:16px"
    });

    apiDatabase.append(
      el("span", {class: "muted"}, "WEBSITE API DATABASE"),
      el("div", {
        id: "health-api-database",
        style: "margin-top:10px"
      }, "Loading…")
    );

    databaseGrid.append(botDatabase, apiDatabase);
    databaseSection.append(databaseGrid);

    const heartbeat = el("div", {
      class: "asset-card",
      style: "padding:16px;margin-top:14px"
    });

    heartbeat.append(
      el("h3", {}, "Last Bot Heartbeat"),
      el("div", {
        id: "health-last-heartbeat",
        style: "margin-top:8px;color:var(--teal)"
      }, "Waiting for heartbeat…"),
      el("div", {
        id: "health-heartbeat-age",
        class: "asset-meta",
        style: "margin-top:6px"
      }, "")
    );

    const cogSection = el("div", {
      class: "asset-card",
      style: "padding:16px;margin-top:14px"
    });

    cogSection.append(
      el("div", {
        style: "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"
      },
        {},
        ""
      )
    );

    const cogHeading = el("h3", {}, "Loaded Extensions");
    const cogCount = el("span", {
      id: "health-cog-count",
      class: "asset-meta"
    }, "0 extensions");

    const cogTitleRow = el("div", {
      style: "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"
    });

    cogTitleRow.append(cogHeading, cogCount);

    const cogList = el("div", {
      id: "health-cog-list",
      style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:14px"
    });

    cogSection.replaceChildren(cogTitleRow, cogList);

    const footer = el("div", {
      id: "health-last-refresh",
      class: "status-line"
    }, "Health data has not loaded yet.");

    const error = el("div", {
      id: "health-error",
      class: "message error",
      role: "status"
    });

    health.append(
      topLine,
      stats,
      databaseSection,
      heartbeat,
      cogSection,
      footer,
      error
    );

    refreshButton.addEventListener("click", loadHealth);

    return health;
  }

  async function loadHealth() {
    if (healthLoading) return;

    healthLoading = true;

    const refreshButton = document.getElementById(
      "refresh-system-health"
    );

    const errorNode = document.getElementById("health-error");

    if (refreshButton) refreshButton.disabled = true;
    if (errorNode) errorNode.textContent = "";

    try {
      const data = await request("/api/owner/system-health");

      setHealthValue(
        "health-bot-status",
        ""
      );

      const statusNode = document.getElementById("health-bot-status");

      if (statusNode) {
        statusNode.replaceChildren(
          makeStatusPill(data.bot_status)
        );
      }

      setHealthValue(
        "health-uptime",
        formatDuration(data.uptime_seconds)
      );

      setHealthValue(
        "health-servers",
        Number(data.guild_count || 0).toLocaleString()
      );

      setHealthValue(
        "health-members",
        Number(data.member_count || 0).toLocaleString()
      );

      setHealthValue(
        "health-cogs",
        Number(data.loaded_cog_count || 0).toLocaleString()
      );

      const botDatabaseNode = document.getElementById(
        "health-bot-database"
      );

      if (botDatabaseNode) {
        botDatabaseNode.replaceChildren(
          makeStatusPill(data.database_status)
        );
      }

      const apiDatabaseNode = document.getElementById(
        "health-api-database"
      );

      if (apiDatabaseNode) {
        apiDatabaseNode.replaceChildren(
          makeStatusPill(data.api_database_status)
        );
      }

      setHealthValue(
        "health-last-heartbeat",
        formatTimestamp(data.last_heartbeat)
      );

      const heartbeatAge = data.heartbeat_age_seconds;

      setHealthValue(
        "health-heartbeat-age",
        heartbeatAge === null || heartbeatAge === undefined
          ? "No heartbeat age available."
          : "Heartbeat age: " + heartbeatAge + " seconds"
      );

      const cogList = document.getElementById("health-cog-list");
      const cogCount = document.getElementById("health-cog-count");

      if (cogList) {
        cogList.replaceChildren();

        const cogs = Array.isArray(data.loaded_cogs)
          ? data.loaded_cogs
          : [];

        if (cogs.length === 0) {
          cogList.append(
            el("span", {
              class: "muted"
            }, "No loaded extensions reported.")
          );
        } else {
          cogs.forEach(cog => {
            cogList.append(
              el("span", {
                style: [
                  "padding:7px 10px",
                  "border:1px solid var(--line)",
                  "background:#102024",
                  "border-radius:5px",
                  "font-size:11px",
                  "overflow-wrap:anywhere"
                ].join(";")
              }, String(cog))
            );
          });
        }

        if (cogCount) {
          cogCount.textContent = cogs.length + " extensions";
        }
      }

      setHealthValue(
        "health-last-refresh",
        "Last refreshed: " + new Date().toLocaleTimeString()
      );

    } catch (error) {
      if (errorNode) {
        errorNode.textContent =
          "Unable to retrieve system health: " + error.message;
      }

      setHealthValue(
        "health-last-refresh",
        "Health check failed at " + new Date().toLocaleTimeString()
      );

    } finally {
      healthLoading = false;

      if (refreshButton) {
        refreshButton.disabled = false;
      }
    }
  }

  function startHealthRefresh() {
    if (healthRefreshTimer) {
      clearInterval(healthRefreshTimer);
    }

    loadHealth();

    healthRefreshTimer = setInterval(() => {
      const settingsView = document.querySelector(
        '[data-dashboard-panel="settings"]'
      );

      if (
        settingsView &&
        !settingsView.hidden &&
        !document.hidden
      ) {
        loadHealth();
      }
    }, 30000);
  }

  function buildInterface() {
    panel.replaceChildren();

    panel.append(
      el("div", {class: "eyebrow"}, "OWNER ONLY · GLOBAL CONFIGURATION"),
      el("h2", {}, "System Settings"),
      el(
        "p",
        {class: "muted"},
        "Manage ONYX-wide settings from one place. Saved settings are stored centrally and applied by the running bot."
      )
    );

    // BOT IDENTITY
    const identity = makeSection(
      "Bot Identity",
      "Choose the status and activity displayed by ONYX in Discord."
    );

    const statusField = makeSelect("system-presence-status", "Presence status", [
      {value: "online", label: "Online"},
      {value: "idle", label: "Idle"},
      {value: "dnd", label: "Do Not Disturb"},
      {value: "invisible", label: "Invisible"}
    ]);

    const activityField = makeSelect("system-activity-type", "Activity type", [
      {value: "playing", label: "Playing"},
      {value: "watching", label: "Watching"},
      {value: "listening", label: "Listening"},
      {value: "competing", label: "Competing"}
    ]);

    const activityText = makeInput(
      "system-activity-text",
      "Activity text",
      128
    );

    const identityGrid = el("div", {
      style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-top:16px"
    });

    identityGrid.append(
      statusField.label,
      activityField.label,
      activityText.label
    );

    identity.append(identityGrid);

    // MAINTENANCE
    const maintenance = makeSection(
      "Maintenance Mode",
      "Control whether regular users can use ONYX while maintenance is active."
    );

    const maintenanceToggle = makeToggle(
      "system-maintenance-enabled",
      "Enable maintenance mode",
      "When enabled, regular users receive the maintenance message instead of using commands.",
      false
    );

    const maintenanceMessage = makeInput(
      "system-maintenance-message",
      "Maintenance message",
      500,
      true
    );

    maintenance.append(
      maintenanceToggle.wrapper,
      maintenanceMessage.label
    );

    // FEATURE CONTROLS
    const features = makeSection(
      "Feature Controls",
      "Enable or disable supported ONYX systems globally."
    );

    FEATURES.forEach(([key, title, description]) => {
      const toggle = makeToggle(
        "system-feature-" + key,
        title,
        description,
        true
      );

      features.append(toggle.wrapper);
    });

    // SECURITY
    const security = makeSection(
      "Security Controls",
      "Manage global whitelist enforcement."
    );

    const whitelistToggle = makeToggle(
      "system-whitelist-enforced",
      "Enforce server whitelist",
      "Keep ONYX restricted to servers approved by its whitelist.",
      true
    );

    security.append(whitelistToggle.wrapper);

    // ANNOUNCEMENTS
    const announcements = makeSection(
      "Announcements",
      "Control whether system-wide announcements are enabled."
    );

    const announcementsToggle = makeToggle(
      "system-announcements-enabled",
      "Enable announcements",
      "Allow the announcement system to publish global notices.",
      true
    );

    announcements.append(announcementsToggle.wrapper);

    // LIVE HEALTH
    const health = buildHealthInterface();

    // ACTIONS
    const actions = el("div", {
      class: "asset-form-buttons",
      style: "margin-top:20px"
    });

    const save = el("button", {
      type: "button",
      class: "button primary",
      id: "save-system-settings"
    }, "Save system settings");

    const reload = el("button", {
      type: "button",
      class: "secondary-button",
      id: "reload-system-settings"
    }, "Reload settings");

    actions.append(save, reload);

    const status = el("div", {
      id: "system-settings-status",
      class: "message",
      role: "status",
      "aria-live": "polite"
    });

    const updated = el("div", {
      id: "system-settings-updated",
      class: "status-line"
    });

    panel.append(
      identity,
      maintenance,
      features,
      security,
      announcements,
      health,
      actions,
      status,
      updated
    );

    save.addEventListener("click", saveSettings);
    reload.addEventListener("click", loadSettings);
  }

  function displaySettings(settings) {
    if (!settings) return;

    currentSettings = settings;

    document.getElementById("system-presence-status").value =
      settings.presence_status || "online";

    document.getElementById("system-activity-type").value =
      settings.activity_type || "watching";

    document.getElementById("system-activity-text").value =
      settings.activity_text || "";

    document.getElementById("system-maintenance-enabled").checked =
      Boolean(settings.maintenance_enabled);

    document.getElementById("system-maintenance-message").value =
      settings.maintenance_message || "";

    document.getElementById("system-whitelist-enforced").checked =
      Boolean(settings.whitelist_enforced);

    document.getElementById("system-announcements-enabled").checked =
      Boolean(settings.announcements_enabled);

    const featureSettings = settings.features || {};

    FEATURES.forEach(([key]) => {
      const input = document.getElementById("system-feature-" + key);

      if (input) {
        input.checked = featureSettings[key] !== false;
      }
    });

    const updated = document.getElementById("system-settings-updated");

    updated.textContent = settings.updated_at
      ? "Last saved: " + new Date(settings.updated_at).toLocaleString()
      : "Using default system settings.";
  }

  async function loadSettings() {
    const reload = document.getElementById("reload-system-settings");

    if (reload) reload.disabled = true;

    showMessage("Loading global system settings…");

    try {
      const result = await request("/api/owner/system-settings");

      displaySettings(result.settings);
      showMessage("Global system settings loaded.");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      if (reload) reload.disabled = false;
    }
  }

  async function saveSettings() {
    const save = document.getElementById("save-system-settings");

    const features = {};

    FEATURES.forEach(([key]) => {
      features[key] = document.getElementById(
        "system-feature-" + key
      ).checked;
    });

    const payload = {
      presence_status:
        document.getElementById("system-presence-status").value,

      activity_type:
        document.getElementById("system-activity-type").value,

      activity_text:
        document.getElementById("system-activity-text").value.trim(),

      maintenance_enabled:
        document.getElementById("system-maintenance-enabled").checked,

      maintenance_message:
        document.getElementById("system-maintenance-message").value.trim(),

      whitelist_enforced:
        document.getElementById("system-whitelist-enforced").checked,

      announcements_enabled:
        document.getElementById("system-announcements-enabled").checked,

      features
    };

    if (!payload.activity_text) {
      showMessage("Activity text cannot be empty.", true);
      return;
    }

    if (!payload.maintenance_message) {
      showMessage("Maintenance message cannot be empty.", true);
      return;
    }

    save.disabled = true;
    showMessage("Saving global system settings…");

    try {
      const result = await request(
        "/api/owner/system-settings",
        {
          method: "PUT",
          body: JSON.stringify(payload)
        }
      );

      displaySettings(result.settings);
      showMessage("Global system settings saved successfully.");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      save.disabled = false;
    }
  }

  async function initialize() {
    try {
      const access = await request("/api/developer/access");

      if (!access.authorized || access.role !== "owner") {
        panel.replaceChildren(
          el("h2", {}, "Owner access required"),
          el(
            "p",
            {class: "muted"},
            "Only the configured ONYX owner can access global system settings."
          )
        );
        return;
      }

      buildInterface();
      await loadSettings();
      startHealthRefresh();

      const settingsButton = document.querySelector(
        '[data-dashboard-view="settings"]'
      );

      if (settingsButton) {
        settingsButton.addEventListener("click", () => {
          loadSettings();
          loadHealth();
        });
      }

    } catch (error) {
      panel.replaceChildren(
        el("h2", {}, "System settings unavailable"),
        el("p", {class: "message error"}, error.message)
      );
    }
  }

  initialize();
})();

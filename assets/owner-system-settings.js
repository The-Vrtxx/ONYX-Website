
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

  function buildInterface() {
    panel.replaceChildren();

    panel.append(
      el("div", {class: "eyebrow"}, "OWNER ONLY · GLOBAL CONFIGURATION"),
      el("h2", {}, "System Settings"),
      el(
        "p",
        {class: "muted"},
        "Manage ONYX-wide settings from one place. Saved settings are stored centrally and will apply to the running bot as runtime integration is completed."
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
      "When runtime integration is active, regular users will receive the maintenance message instead of using commands.",
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
      "Enable or disable supported ONYX systems globally. These switches are saved centrally; runtime enforcement will be connected separately."
    );

    const featureInputs = {};

    FEATURES.forEach(([key, title, description]) => {
      const toggle = makeToggle(
        "system-feature-" + key,
        title,
        description,
        true
      );

      featureInputs[key] = toggle.input;
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
      "Control whether system-wide announcements are enabled. Publishing announcements will be connected in a later step."
    );

    const announcementsToggle = makeToggle(
      "system-announcements-enabled",
      "Enable announcements",
      "Allow the announcement system to publish global notices once connected.",
      true
    );

    announcements.append(announcementsToggle.wrapper);

    // HEALTH
    const health = makeSection(
      "System Health",
      "Live bot uptime, loaded cogs, database status, and API health will be displayed here after the runtime health connection is added."
    );

    health.append(
      el("div", {
        class: "coming-soon",
        id: "system-health-status"
      }, "Runtime health reporting is not connected yet. No health values are being assumed.")
    );

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

      const settingsButton = document.querySelector(
        '[data-dashboard-view="settings"]'
      );

      if (settingsButton) {
        settingsButton.addEventListener("click", loadSettings);
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

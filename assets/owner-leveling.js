
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const container = document.getElementById("leveling-control-center");

  if (!container) return;

  const numberFormat = new Intl.NumberFormat("en-US");

  function element(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
      node.setAttribute(key, value);
    });

    if (text) node.textContent = text;
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
      throw new Error(data.error || "Request failed.");
    }

    return data;
  }

  function showMessage(message, isError = false) {
    const status = document.getElementById("leveling-status");
    if (!status) return;

    status.textContent = message;
    status.className = isError ? "message error" : "message";
  }

  function createStat(label, id) {
    const card = element("div", {class: "stat-card"});
    card.append(
      element("span", {}, label),
      element("strong", {id}, "—")
    );
    return card;
  }

  function buildInterface() {
    container.replaceChildren();

    const form = element("form", {
      id: "global-leveling-form",
      class: "asset-form"
    });

    const description = element(
      "p",
      {class: "muted wide"},
      "These values control XP earned globally across every ONYX server."
    );

    function field(labelText, id, min, max, step, help) {
      const wrapper = element("label");
      wrapper.append(element("span", {}, labelText));

      const input = element("input", {
        id,
        type: "number",
        min: String(min),
        max: String(max),
        step: String(step),
        required: "required"
      });

      wrapper.append(input);

      const hint = element("small", {}, help);
      hint.style.color = "var(--muted)";
      wrapper.append(hint);

      return {wrapper, input};
    }

    const minField = field(
      "Minimum XP per message",
      "global-min-xp",
      1,
      1000,
      1,
      "Lowest amount of XP awarded."
    );

    const maxField = field(
      "Maximum XP per message",
      "global-max-xp",
      1,
      1000,
      1,
      "Highest amount of XP awarded."
    );

    const cooldownField = field(
      "XP cooldown (seconds)",
      "global-xp-cooldown",
      5,
      86400,
      1,
      "How long a user must wait before earning XP again."
    );

    const doubleXPWrapper = element("div", {
      class: "wide",
      style: "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;border:1px solid var(--border);border-radius:12px;"
    });

    const doubleXPText = element("div");
    doubleXPText.append(
      element("strong", {}, "Double XP"),
      element(
        "p",
        {class: "muted"},
        "When enabled, eligible messages award twice the normal XP globally."
      )
    );

    const toggleLabel = element("label", {
      style: "display:flex;align-items:center;gap:10px;cursor:pointer;"
    });

    const toggle = element("input", {
      id: "global-double-xp",
      type: "checkbox",
      style: "width:20px;height:20px;accent-color:var(--accent);"
    });

    toggleLabel.append(toggle, element("span", {}, "Enabled"));
    doubleXPWrapper.append(doubleXPText, toggleLabel);

    form.append(
      description,
      minField.wrapper,
      maxField.wrapper,
      cooldownField.wrapper,
      doubleXPWrapper
    );

    const buttons = element("div", {
      class: "asset-form-buttons"
    });

    const save = element(
      "button",
      {
        type: "submit",
        class: "button primary",
        id: "save-global-leveling"
      },
      "Save global settings"
    );

    const reload = element(
      "button",
      {
        type: "button",
        class: "secondary-button",
        id: "reload-global-leveling"
      },
      "Reload settings"
    );

    buttons.append(save, reload);
    form.append(buttons);

    const status = element("div", {
      id: "leveling-status",
      class: "message",
      role: "status",
      "aria-live": "polite"
    });

    const updated = element("div", {
      id: "leveling-updated",
      class: "status-line"
    });

    const summary = element("div", {
      class: "stat-grid"
    });

    summary.append(
      createStat("Minimum XP", "summary-min-xp"),
      createStat("Maximum XP", "summary-max-xp"),
      createStat("Cooldown", "summary-cooldown"),
      createStat("Double XP", "summary-double-xp")
    );

    container.append(summary, form, status, updated);

    form.addEventListener("submit", async event => {
      event.preventDefault();

      const minXP = Number(minField.input.value);
      const maxXP = Number(maxField.input.value);
      const cooldown = Number(cooldownField.input.value);
      const doubleXP = toggle.checked;

      if (
        !Number.isInteger(minXP) ||
        !Number.isInteger(maxXP) ||
        !Number.isInteger(cooldown)
      ) {
        return showMessage("All numeric settings must be whole numbers.", true);
      }

      if (minXP < 1 || maxXP > 1000 || minXP > maxXP) {
        return showMessage(
          "XP must be between 1 and 1000, and minimum XP cannot exceed maximum XP.",
          true
        );
      }

      if (cooldown < 5 || cooldown > 86400) {
        return showMessage(
          "Cooldown must be between 5 and 86400 seconds.",
          true
        );
      }

      save.disabled = true;
      showMessage("Saving global leveling settings…");

      try {
        const result = await request(
          "/api/owner/leveling/settings",
          {
            method: "PUT",
            body: JSON.stringify({
              min_xp: minXP,
              max_xp: maxXP,
              cooldown_seconds: cooldown,
              double_xp_enabled: doubleXP
            })
          }
        );

        displaySettings(result.settings);
        showMessage("Global leveling settings saved successfully.");
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        save.disabled = false;
      }
    });

    reload.addEventListener("click", loadSettings);
  }

  function displaySettings(settings) {
    if (!settings) return;

    document.getElementById("global-min-xp").value = settings.min_xp;
    document.getElementById("global-max-xp").value = settings.max_xp;
    document.getElementById("global-xp-cooldown").value =
      settings.cooldown_seconds;

    document.getElementById("global-double-xp").checked =
      Boolean(settings.double_xp_enabled);

    document.getElementById("summary-min-xp").textContent =
      numberFormat.format(settings.min_xp);

    document.getElementById("summary-max-xp").textContent =
      numberFormat.format(settings.max_xp);

    document.getElementById("summary-cooldown").textContent =
      numberFormat.format(settings.cooldown_seconds) + "s";

    document.getElementById("summary-double-xp").textContent =
      settings.double_xp_enabled ? "Enabled (2×)" : "Disabled";

    const updated = document.getElementById("leveling-updated");

    updated.textContent = settings.updated_at
      ? "Last updated: " + new Date(settings.updated_at).toLocaleString()
      : "Using default global leveling settings.";
  }

  async function loadSettings() {
    const reload = document.getElementById("reload-global-leveling");

    if (reload) reload.disabled = true;
    showMessage("Loading global leveling settings…");

    try {
      const result = await request("/api/owner/leveling/settings");
      displaySettings(result.settings);
      showMessage("Global leveling settings loaded.");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      if (reload) reload.disabled = false;
    }
  }

  async function initialize() {
    try {
      const access = await request("/api/developer/access");

      if (!access.authorized || access.role !== "owner") {
        container.textContent =
          "These global leveling controls are available to the ONYX owner only.";
        return;
      }

      buildInterface();

      const levelingButton = document.querySelector(
        '[data-dashboard-view="leveling"]'
      );

      if (levelingButton) {
        levelingButton.addEventListener("click", loadSettings);
      }

    } catch (error) {
      container.textContent =
        "Could not initialize global leveling controls: " + error.message;
    }
  }

  initialize();
})();

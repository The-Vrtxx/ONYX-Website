
const API = "https://api.onyxdiscord.com";
const $ = id => document.getElementById(id);

let selectedGuild = null;
let currentFilters = {};
const serverListeners = new Set();

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}).`);
  }

  return data;
}

function permissionText(guild) {
  if (guild.owner) return "Server Owner";
  if (guild.administrator) return "Administrator";
  if (guild.manage_server) return "Manage Server";
  return "Manager";
}

function notifyServerListeners(guild) {
  serverListeners.forEach(callback => {
    try {
      callback(guild);
    } catch (error) {
      console.error("ONYX server listener error:", error);
    }
  });
}

/*
 * Shared interface used by management.js.
 * It does not create another login or server selector.
 */
window.ONYXDashboard = {
  api,
  getSelectedGuild: () => selectedGuild,
  getPermissionText: permissionText,

  subscribe(callback) {
    if (typeof callback !== "function") return () => {};

    serverListeners.add(callback);

    if (selectedGuild) {
      callback(selectedGuild);
    }

    return () => serverListeners.delete(callback);
  }
};

function showServerError(message) {
  const grid = $("server-grid");
  if (!grid) return;

  grid.replaceChildren();

  const box = document.createElement("div");
  box.className = "dashboard-message error";
  box.textContent = message;

  grid.append(box);
}

function createServerCard(guild) {
  const card = document.createElement("article");
  card.className = "server-card";

  const top = document.createElement("div");
  top.className = "server-top";

  const icon = document.createElement("div");
  icon.className = "server-icon";
  icon.textContent = (guild.name || "S").charAt(0).toUpperCase();

  if (guild.icon) {
    const image = document.createElement("img");
    image.className = "server-icon";
    image.src =
      `https://cdn.discordapp.com/icons/${encodeURIComponent(guild.id)}/${encodeURIComponent(guild.icon)}.png?size=128`;
    image.alt = "";
    image.onerror = () => image.replaceWith(icon);
    top.append(image);
  } else {
    top.append(icon);
  }

  const details = document.createElement("div");

  const name = document.createElement("div");
  name.className = "server-name";
  name.textContent = guild.name;

  const permission = document.createElement("div");
  permission.className = "server-permission";
  permission.textContent = permissionText(guild);

  details.append(name, permission);
  top.append(details);

  const button = document.createElement("button");
  button.textContent = "Manage Server";
  button.addEventListener("click", () => selectServer(guild));

  card.append(top, button);

  return card;
}

async function loadServers() {
  const data = await api("/api/guilds");
  const guilds = data.guilds || [];
  const grid = $("server-grid");

  grid.replaceChildren();

  $("server-count").textContent =
    `${data.count || guilds.length} MANAGEABLE SERVERS`;

  if (!guilds.length) {
    const empty = document.createElement("div");
    empty.className = "dashboard-message";
    empty.textContent =
      data.message ||
      "No manageable servers with ONYX installed were found. Check your Discord permissions and sign in again.";

    grid.append(empty);
    return;
  }

  guilds.forEach(guild => {
    grid.append(createServerCard(guild));
  });
}

function renderFilters(filters) {
  const host = $("filter-list");
  host.replaceChildren();

  currentFilters = structuredClone(filters || {});

  const labels = {
    invites: "Discord invites",
    links: "External links",
    spam: "Message spam",
    repeats: "Repeated messages"
  };

  for (const name of Object.keys(labels)) {
    const cfg = currentFilters[name] || {
      enabled: false,
      threshold: 1,
      window_seconds: 60,
      punishment: "delete",
      timeout_seconds: 600
    };

    const block = document.createElement("div");
    block.className = "filter-block";

    const head = document.createElement("div");
    head.className = "filter-head";

    const title = document.createElement("strong");
    title.textContent = labels[name];

    const toggle = document.createElement("label");
    toggle.className = "toggle-line";
    toggle.style.border = "0";
    toggle.style.padding = "0";

    const toggleText = document.createElement("span");
    toggleText.textContent = "Enabled";

    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = Boolean(cfg.enabled);
    enabled.dataset.filter = name;
    enabled.dataset.field = "enabled";

    toggle.append(toggleText, enabled);
    head.append(title, toggle);

    const row = document.createElement("div");
    row.className = "filter-row";

    row.append(
      makeFilterField(
        name, "threshold", "Threshold",
        "number", cfg.threshold, 1, 50
      ),
      makeFilterField(
        name, "window_seconds", "Window (seconds)",
        "number", cfg.window_seconds, 1, 300
      ),
      makeFilterField(
        name, "punishment", "Punishment",
        "select", cfg.punishment
      ),
      makeFilterField(
        name, "timeout_seconds", "Timeout (seconds)",
        "number", cfg.timeout_seconds, 1, 40320
      )
    );

    block.append(head, row);
    host.append(block);
  }
}

function makeFilterField(
  filter,
  field,
  labelText,
  type,
  value,
  min,
  max
) {
  const label = document.createElement("label");
  label.textContent = labelText;

  let control;

  if (type === "select") {
    control = document.createElement("select");

    for (const optionValue of [
      "delete",
      "warn",
      "timeout",
      "jail"
    ]) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent =
        optionValue.charAt(0).toUpperCase() +
        optionValue.slice(1);

      control.append(option);
    }

    control.value = value || "delete";
  } else {
    control = document.createElement("input");
    control.type = "number";
    control.min = String(min);
    control.max = String(max);
    control.value = String(value ?? min);
  }

  control.dataset.filter = filter;
  control.dataset.field = field;

  label.append(control);

  return label;
}

function readFiltersFromForm() {
  const result = {};

  for (const name of [
    "invites",
    "links",
    "spam",
    "repeats"
  ]) {
    result[name] = {
      ...(currentFilters[name] || {})
    };
  }

  document
    .querySelectorAll("[data-filter][data-field]")
    .forEach(control => {
      const name = control.dataset.filter;
      const field = control.dataset.field;

      if (!result[name]) result[name] = {};

      result[name][field] =
        field === "enabled"
          ? control.checked
          : field === "punishment"
            ? control.value
            : Number(control.value);
    });

  return result;
}

function setSaveStatus(message, kind = "") {
  const status = $("save-status");

  status.textContent = message;
  status.className = `save-status ${kind}`;
}

async function selectServer(guild) {
  if (!guild) return;

  selectedGuild = guild;

  $("selected-name").textContent = guild.name;
  $("selected-permission").textContent =
    `Your access: ${permissionText(guild)}. Loading settings…`;

  $("settings-panel").classList.add("visible");

  $("server-selection").hidden = true;
  $("server-banner").hidden = false;
  $("control-nav").classList.add("visible");

  setSaveStatus("");

  /*
   * Load the existing dashboard settings first.
   */
  try {
    const data = await api(
      `/api/server/settings?guild_id=${encodeURIComponent(guild.id)}`
    );

    const s = data.settings || {};

    $("log-channel").value = s.log_channel_id || "";
    $("welcome-channel").value = s.welcome_channel_id || "";
    $("levelup-channel").value = s.levelup_channel_id || "";

    $("welcome-message").value = s.welcome_message || "";
    $("goodbye-message").value = s.goodbye_message || "";

    $("xp-enabled").checked = Boolean(s.xp_enabled);
    $("announcements-enabled").checked =
      Boolean(s.announcements_enabled);

    renderFilters(data.filters || {});

    $("selected-permission").textContent =
      `Your access: ${permissionText(guild)}. Changes apply to this server only.`;
  } catch (error) {
    setSaveStatus(error.message, "error");
  }

  /*
   * Notify management.js that the shared server has changed.
   */
  notifyServerListeners(guild);

  showSection("home");

  $("server-banner").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveSettings() {
  if (!selectedGuild) return;

  const button = $("save-settings");
  button.disabled = true;

  setSaveStatus("Saving…");

  const payload = {
    guild_id: selectedGuild.id,

    settings: {
      log_channel_id: $("log-channel").value.trim(),
      welcome_channel_id: $("welcome-channel").value.trim(),
      levelup_channel_id: $("levelup-channel").value.trim(),

      welcome_message: $("welcome-message").value,
      goodbye_message: $("goodbye-message").value,

      xp_enabled: $("xp-enabled").checked,
      announcements_enabled: $("announcements-enabled").checked
    },

    filters: readFiltersFromForm()
  };

  try {
    const result = await api("/api/server/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setSaveStatus(
      result.message || "Settings saved.",
      "success"
    );
  } catch (error) {
    setSaveStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

/*
 * Unified dashboard navigation.
 */
function showSection(sectionName) {
  const validSections = [
    "home",
    "settings",
    "overview",
    "moderation",
    "automod",
    "roles",
    "audit"
  ];

  if (!validSections.includes(sectionName)) {
    sectionName = "home";
  }

  document
    .querySelectorAll(".control-section")
    .forEach(section => {
      section.classList.toggle(
        "active",
        section.id === `section-${sectionName}`
      );
    });

  document
    .querySelectorAll(".control-nav [data-section]")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.section === sectionName
      );
    });

  /*
   * Keep navigation changes inside the dashboard page.
   */
  const nav = $("control-nav");

  if (nav) {
    nav.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}

function setupNavigation() {
  document
    .querySelectorAll(".control-nav [data-section]")
    .forEach(button => {
      button.addEventListener("click", () => {
        showSection(button.dataset.section);
      });
    });

  document
    .querySelectorAll("[data-go-section]")
    .forEach(button => {
      button.addEventListener("click", () => {
        showSection(button.dataset.goSection);
      });
    });

  $("change-server").addEventListener("click", () => {
    $("server-selection").hidden = false;
    $("server-banner").hidden = true;
    $("control-nav").classList.remove("visible");

    document
      .querySelectorAll(".control-section")
      .forEach(section => section.classList.remove("active"));

    $("server-selection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

async function startDashboard() {
  try {
    const user = await api("/api/me");

    $("login-panel").hidden = true;
    $("dashboard-content").hidden = false;
    $("account").hidden = false;

    $("username").textContent =
      user.username || "Discord User";

    $("avatar").src = user.avatar
      ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=96`
      : "../assets/onyx-mark.png";

    await loadServers();
  } catch (error) {
    $("login-panel").hidden = false;
    $("dashboard-content").hidden = true;
    $("account").hidden = true;

    if (error.message !== "Sign in with Discord first.") {
      console.error(error);
    }
  }
}

/*
 * Shared logout: only one logout button and one session.
 */
async function logoutDashboard() {
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } catch (error) {
    console.error("ONYX logout error:", error);
  }

  location.reload();
}

$("save-settings").addEventListener("click", saveSettings);
$("logout").addEventListener("click", logoutDashboard);

setupNavigation();
startDashboard();

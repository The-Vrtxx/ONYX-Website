const API = "https://api.onyxdiscord.com";
const $ = id => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("en-US");

async function api(path, options) {
  options = options || {};
  const response = await fetch(API + path, {
    method: options.method || "GET",
    credentials: "include",
    headers: Object.assign(
      {"Accept":"application/json"},
      options.body ? {"Content-Type":"application/json"} : {},
      options.headers || {}
    ),
    body: options.body
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function setMessage(message, isError) {
  const el = $("team-message");
  el.textContent = message || "";
  el.className = isError ? "message error" : "message";
}

function avatarUrl(user) {
  if (!user.avatar) return "../assets/onyx-mark.png";
  return "https://cdn.discordapp.com/avatars/" +
    encodeURIComponent(user.id) + "/" +
    encodeURIComponent(user.avatar) + ".png?size=96";
}

async function loadOverview() {
  const data = await api("/api/developer/overview");
  $("stat-servers").textContent = numberFormat.format(data.servers || 0);
  $("stat-members").textContent = numberFormat.format(data.members || 0);
  $("stat-commands").textContent = numberFormat.format(data.commands || 0);
  $("updated-at").textContent = data.updated_at
    ? "Last bot statistics sync: " + new Date(data.updated_at).toLocaleString()
    : "Waiting for the bot's first statistics sync.";
}

function renderTeam(developers) {
  const list = $("team-list");
  list.replaceChildren();

  if (!developers.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No developers have been appointed yet.";
    list.append(empty);
    return;
  }

  developers.forEach(dev => {
    const row = document.createElement("div");
    row.className = "team-row";

    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Discord user " + dev.user_id;

    const meta = document.createElement("small");
    meta.textContent = "Appointed by " + dev.appointed_by +
      (dev.appointed_at ? " · " + new Date(dev.appointed_at).toLocaleDateString() : "");
    details.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      if (!window.confirm("Remove ONYX developer access for " + dev.user_id + "?")) return;
      remove.disabled = true;
      try {
        const result = await api("/api/developer/team/remove", {
          method: "POST",
          body: JSON.stringify({user_id: dev.user_id})
        });
        setMessage(result.message, false);
        await loadTeam();
      } catch (error) {
        setMessage(error.message, true);
        remove.disabled = false;
      }
    });

    row.append(details, remove);
    list.append(row);
  });
}

async function loadTeam() {
  const data = await api("/api/developer/team");
  renderTeam(data.developers || []);
}

async function startPortal() {
  try {
    const user = await api("/api/me");
    $("account").hidden = false;
    $("username").textContent = user.username || "Discord user";
    $("avatar").src = avatarUrl(user);

    const access = await api("/api/developer/access");
    $("login-panel").hidden = true;

    if (!access.authorized) {
      $("denied-panel").hidden = false;
      return;
    }

    $("portal").hidden = false;
    $("role-label").textContent = access.role === "owner" ? "ONYX Owner" : "ONYX Developer";
    await loadOverview();

    if (access.role === "owner") {
      $("team-panel").hidden = false;
      await loadTeam();
    } else {
      $("developer-panel").hidden = false;
    }
  } catch (error) {
    if (error.message === "Sign in with Discord first.") return;

    if (error.message.indexOf("not on the ONYX development team") !== -1) {
      $("login-panel").hidden = true;
      $("denied-panel").hidden = false;
      return;
    }

    console.error("ONYX control center:", error);
    const login = $("login-panel");
    login.hidden = false;
    const message = document.createElement("p");
    message.className = "message error";
    message.textContent = error.message;
    login.append(message);
  }
}

$("add-form").addEventListener("submit", async event => {
  event.preventDefault();
  const input = $("new-user-id");
  const userId = input.value.trim();
  setMessage("", false);

  try {
    const result = await api("/api/developer/team/add", {
      method: "POST",
      body: JSON.stringify({user_id: userId})
    });
    input.value = "";
    setMessage(result.message, false);
    await loadTeam();
  } catch (error) {
    setMessage(error.message, true);
  }
});

async function logout() {
  try { await api("/auth/logout", {method:"POST", body:"{}"}); } catch (_) {}
  window.location.href = "/owner/";
}

$("logout").addEventListener("click", logout);
$("denied-logout").addEventListener("click", logout);
startPortal();

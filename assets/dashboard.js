const API = "https://api.onyxdiscord.com";

const $ = id => document.getElementById(id);

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
    throw new Error(
      data.error || "Request failed."
    );
  }

  return data;
}


function showError(message) {

  const grid = $("server-grid");

  grid.replaceChildren();

  const error = document.createElement("div");

  error.className = "dashboard-message error";
  error.textContent = message;

  grid.append(error);
}


function getPermissionText(guild) {

  if (guild.owner) {
    return "Server Owner";
  }

  if (guild.administrator) {
    return "Administrator";
  }

  if (guild.manage_server) {
    return "Manage Server";
  }

  return "Manager";
}


function createServerCard(guild) {

  const card = document.createElement("article");

  card.className = "server-card";

  const top = document.createElement("div");

  top.className = "server-top";

  const icon = document.createElement("div");

  icon.className = "server-icon";

  if (guild.icon) {

    const image = document.createElement("img");

    image.className = "server-icon";

    image.src =
      "https://cdn.discordapp.com/icons/" +
      encodeURIComponent(guild.id) + "/" +
      encodeURIComponent(guild.icon) +
      ".png?size=128";

    image.alt = "";

    image.onerror = () => {
      image.remove();
      icon.textContent =
        guild.name.charAt(0).toUpperCase();
      top.prepend(icon);
    };

    top.append(image);

  } else {

    icon.textContent =
      guild.name.charAt(0).toUpperCase();

    top.append(icon);
  }

  const details = document.createElement("div");

  const name = document.createElement("div");

  name.className = "server-name";
  name.textContent = guild.name;

  const permission = document.createElement("div");

  permission.className = "server-permission";
  permission.textContent = getPermissionText(guild);

  details.append(name, permission);

  top.append(details);

  const button = document.createElement("button");

  button.textContent = "Select Server";

  button.addEventListener("click", () => {
    selectServer(guild);
  });

  card.append(top, button);

  return card;
}


function selectServer(guild) {

  $("selected-name").textContent = guild.name;

  $("selected-permission").textContent =
    "Your access: " + getPermissionText(guild);

  $("selected-server").classList.add("visible");

  $("selected-server").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}


async function loadServers() {

  const data = await api("/api/guilds");

  const guilds = data.guilds || [];

  const grid = $("server-grid");

  grid.replaceChildren();

  $("server-count").textContent =
    data.count + " MANAGEABLE SERVERS";

  if (!guilds.length) {

    const empty = document.createElement("div");

    empty.className = "dashboard-message";

    empty.textContent =
      "No manageable servers were found. Make sure you own a server or have Administrator or Manage Server permissions, then sign in again.";

    grid.append(empty);

    return;
  }

  guilds.forEach(guild => {
    grid.append(
      createServerCard(guild)
    );
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

    if (user.avatar) {

      $("avatar").src =
        "https://cdn.discordapp.com/avatars/" +
        encodeURIComponent(user.id) + "/" +
        encodeURIComponent(user.avatar) +
        ".png?size=96";

    } else {

      $("avatar").src =
        "../assets/onyx-mark.png";
    }

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


$("logout").addEventListener("click", async () => {

  try {

    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });

  } catch (error) {

    console.error(error);
  }

  location.reload();
});


startDashboard();

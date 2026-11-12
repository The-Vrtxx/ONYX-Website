
const API = "https://api.onyxdiscord.com";
const $ = id => document.getElementById(id);
const numberFormat = new Intl.NumberFormat("en-US");

let currentAssets = [];
let editingAssetId = null;

async function api(path, options) {
  options = options || {};

  const response = await fetch(API + path, {
    method: options.method || "GET",
    credentials: "include",
    headers: Object.assign(
      {"Accept": "application/json"},
      options.body ? {"Content-Type": "application/json"} : {},
      options.headers || {}
    ),
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

// MESSAGES

function setMessage(message, isError) {
  const el = $("team-message");
  if (!el) return;

  el.textContent = message || "";
  el.className = isError ? "message error" : "message";
}

function setAssetMessage(message, isError) {
  const el = $("asset-message");
  if (!el) return;

  el.textContent = message || "";
  el.className = isError ? "message error" : "message";
}

// ACCOUNT

function avatarUrl(user) {
  if (!user.avatar) return "../assets/onyx-mark.png";

  return "https://cdn.discordapp.com/avatars/" +
    encodeURIComponent(user.id) + "/" +
    encodeURIComponent(user.avatar) + ".png?size=96";
}

// SYSTEM OVERVIEW

async function loadOverview() {
  const data = await api("/api/developer/overview");

  $("stat-servers").textContent =
    numberFormat.format(data.servers || 0);

  $("stat-members").textContent =
    numberFormat.format(data.members || 0);

  $("stat-commands").textContent =
    numberFormat.format(data.commands || 0);

  $("updated-at").textContent = data.updated_at
    ? "Last bot statistics sync: " +
      new Date(data.updated_at).toLocaleString()
    : "Waiting for the bot's first statistics sync.";
}

// DEVELOPER MANAGEMENT

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
      (dev.appointed_at
        ? " · " + new Date(dev.appointed_at).toLocaleDateString()
        : "");

    details.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-button";
    remove.textContent = "Remove";

    remove.addEventListener("click", async () => {
      if (!window.confirm(
        "Remove ONYX developer access for " + dev.user_id + "?"
      )) return;

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

// ASSET LIBRARY

function historyElementId(assetId) {
  return "history-" +
    assetId.replace(/[^a-z0-9_-]/gi, "-");
}

function renderAssets(assets) {
  const list = $("asset-list");
  list.replaceChildren();

  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "asset-empty";
    empty.textContent =
      "No assets match these filters. Create an asset to start your library.";

    list.append(empty);
    return;
  }

  assets.forEach(asset => {
    const card = document.createElement("article");
    card.className = "asset-card";

    const top = document.createElement("div");
    top.className = "asset-card-top";

    const info = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = asset.display_name;

    const meta = document.createElement("div");
    meta.className = "asset-meta";
    meta.textContent =
      asset.category + " · " +
      asset.item_id + " · " +
      asset.rarity + " · " +
      numberFormat.format(asset.price_tokens) +
      " tokens";

    const version = document.createElement("div");
    version.className = "asset-meta";
    version.style.fontWeight = "bold";
    version.style.color = "var(--teal)";
    version.textContent = "CURRENT VERSION: v" + asset.version;

    const status = document.createElement("div");
    status.className = "asset-meta";
    status.textContent =
      (asset.is_active ? "Active" : "Inactive") +
      " · " +
      (asset.is_shop_item ? "In shop" : "Not in shop");

    info.append(title, meta, version, status);
    top.append(info);
    card.append(top);

    if (asset.description) {
      const desc = document.createElement("p");
      desc.className = "asset-meta";
      desc.textContent = asset.description;
      card.append(desc);
    }

    const actions = document.createElement("div");
    actions.className = "asset-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openAssetEditor(asset));

    const history = document.createElement("button");
    history.type = "button";
    history.textContent = "Version history";
    history.addEventListener("click", () =>
      loadAssetHistory(asset.asset_id)
    );

    actions.append(edit, history);
    card.append(actions);

    const historyBox = document.createElement("div");
    historyBox.className = "asset-history";
    historyBox.id = historyElementId(asset.asset_id);

    card.append(historyBox);
    list.append(card);
  });
}

async function loadAssets(showMessage = true) {
  if (showMessage) {
    setAssetMessage("Loading assets…", false);
  }

  const category = $("asset-category-filter").value;
  const status = $("asset-status-filter").value;

  const params = new URLSearchParams();

  if (category) {
    params.set("category", category);
  }

  if (status === "active") {
    params.set("active", "true");
  }

  if (status === "inactive") {
    params.set("active", "false");
  }

  try {
    const data = await api(
      "/api/owner/assets" +
      (params.toString() ? "?" + params : "")
    );

    currentAssets = data.assets || [];

    renderAssets(currentAssets);

    if (showMessage) {
      setAssetMessage(
        numberFormat.format(data.count || 0) +
        " assets loaded.",
        false
      );
    }

    return true;
  } catch (error) {
    renderAssets([]);
    setAssetMessage(error.message, true);
    return false;
  }
}

// ASSET EDITOR

function resetAssetForm() {
  $("asset-form").reset();

  $("asset-category").disabled = false;
  $("asset-item-id").disabled = false;

  $("asset-category").value = "frame";
  $("asset-price").value = "0";
  $("asset-sort-order").value = "0";
  $("asset-metadata").value = "{}";

  $("asset-active").checked = true;
  $("asset-shop-item").checked = true;

  $("asset-change-note").value = "";
  $("asset-history").textContent = "";

  editingAssetId = null;

  $("asset-editor-eyebrow").textContent = "NEW CATALOG ITEM";
  $("asset-editor-title").textContent = "Create asset";

  $("asset-editor-help").textContent =
    "Choose a permanent category and item ID. These cannot be changed after creation.";

  $("save-asset").textContent = "Create asset";
}

function openAssetEditor(asset) {
  resetAssetForm();

  if (asset) {
    editingAssetId = asset.asset_id;

    $("asset-category").value = asset.category;
    $("asset-item-id").value = asset.item_id;

    $("asset-category").disabled = true;
    $("asset-item-id").disabled = true;

    $("asset-display-name").value = asset.display_name || "";
    $("asset-description").value = asset.description || "";
    $("asset-price").value = asset.price_tokens || 0;
    $("asset-rarity").value = asset.rarity || "Common";
    $("asset-image-url").value = asset.image_url || "";
    $("asset-sort-order").value = asset.sort_order || 0;

    $("asset-active").checked = !!asset.is_active;
    $("asset-shop-item").checked = !!asset.is_shop_item;

    $("asset-metadata").value =
      JSON.stringify(asset.metadata || {}, null, 2);

    $("asset-editor-eyebrow").textContent =
      "EDITING " + asset.asset_id.toUpperCase();

    $("asset-editor-title").textContent = "Edit asset";

    $("asset-editor-help").textContent =
      "The permanent asset ID is locked to protect existing ownership records.";

    $("save-asset").textContent = "Save changes";
  }

  $("asset-editor").hidden = false;

  $("asset-editor").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// VERSION HISTORY

async function loadAssetHistory(assetId) {
  const box = $(historyElementId(assetId));
  if (!box) return;

  box.textContent = "Loading version history…";

  try {
    const data = await api(
      "/api/owner/assets/" +
      encodeURIComponent(assetId) +
      "/versions"
    );

    box.replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = "SAVED VERSION HISTORY";
    box.append(heading);

    const versions = data.versions || [];

    versions.forEach(version => {
      const line = document.createElement("div");

      line.style.padding = "9px 0";
      line.style.borderBottom = "1px solid var(--line)";

      line.textContent =
        "VERSION " + version.version +
        " · " + version.display_name +
        " · " + (version.change_note || "Updated") +
        " · " +
        (version.created_at
          ? new Date(version.created_at).toLocaleString()
          : "Date unavailable") +
        " · By " + (version.changed_by || "Unknown");

      box.append(line);
    });

    if (!versions.length) {
      const empty = document.createElement("div");
      empty.textContent = "No saved versions found.";
      box.append(empty);
    }

    return versions;
  } catch (error) {
    box.textContent =
      "Could not load version history: " + error.message;

    throw error;
  }
}

// SAVE ASSET

async function saveAsset(event) {
  event.preventDefault();

  let metadata;

  try {
    metadata = JSON.parse($("asset-metadata").value || "{}");

    if (
      !metadata ||
      Array.isArray(metadata) ||
      typeof metadata !== "object"
    ) {
      throw new Error("Metadata must be a JSON object.");
    }
  } catch (error) {
    setAssetMessage(
      "Metadata error: " + error.message,
      true
    );
    return;
  }

  const payload = {
    category: $("asset-category").value,
    item_id: $("asset-item-id").value.trim(),
    display_name: $("asset-display-name").value.trim(),
    description: $("asset-description").value.trim(),
    price_tokens: Number($("asset-price").value),
    rarity: $("asset-rarity").value,
    image_url: $("asset-image-url").value.trim() || null,
    sort_order: Number($("asset-sort-order").value),
    is_active: $("asset-active").checked,
    is_shop_item: $("asset-shop-item").checked,
    metadata,
    change_note: $("asset-change-note").value.trim()
  };

  const wasEditing = Boolean(editingAssetId);
  const button = $("save-asset");

  button.disabled = true;

  setAssetMessage(
    wasEditing ? "Saving asset changes…" : "Creating asset…",
    false
  );

  try {
    let result;

    if (editingAssetId) {
      const update = Object.assign({}, payload);

      delete update.category;
      delete update.item_id;

      result = await api(
        "/api/owner/assets/" + encodeURIComponent(editingAssetId),
        {
          method: "PATCH",
          body: JSON.stringify(update)
        }
      );
    } else {
      result = await api("/api/owner/assets", {
        method: "POST",
        body: JSON.stringify(payload)
      });
    }

    const savedAsset = result.asset;
    const savedAssetId = savedAsset.asset_id;
    const savedVersion = savedAsset.version;

    $("asset-editor").hidden = true;
    resetAssetForm();

    // Refresh the catalog first so the new version is visible.
    const refreshed = await loadAssets(false);

    if (!refreshed) {
      throw new Error(
        "The save succeeded, but the asset list could not refresh."
      );
    }

    // Show the saved version number after refreshing.
    setAssetMessage(
      "SUCCESS! " + savedAsset.display_name +
      " was saved as VERSION " + savedVersion + ".",
      false
    );

    // Automatically load the saved version history.
    await loadAssetHistory(savedAssetId);

    // Scroll to the updated asset's version history.
    const historyBox = $(historyElementId(savedAssetId));

    if (historyBox) {
      historyBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }

  } catch (error) {
    setAssetMessage(
      "SAVE FAILED: " + error.message,
      true
    );
  } finally {
    button.disabled = false;
  }
}

// PORTAL STARTUP

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

    $("role-label").textContent =
      access.role === "owner" ? "ONYX Owner" : "ONYX Developer";

    await loadOverview();

    if (access.role === "owner") {
      $("team-panel").hidden = false;
      $("asset-library-panel").hidden = false;

      await Promise.all([
        loadTeam(),
        loadAssets()
      ]);
    } else {
      $("developer-panel").hidden = false;
    }

  } catch (error) {
    if (error.message === "Sign in with Discord first.") return;

    if (
      error.message.indexOf(
        "not on the ONYX development team"
      ) !== -1
    ) {
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

// EVENT LISTENERS

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

$("asset-form").addEventListener("submit", saveAsset);

$("new-asset-button").addEventListener("click", () => {
  resetAssetForm();
  openAssetEditor(null);
});

$("cancel-asset-edit").addEventListener("click", () => {
  $("asset-editor").hidden = true;
  resetAssetForm();
});

$("refresh-assets").addEventListener("click", () => loadAssets());

$("asset-category-filter").addEventListener("change", () => loadAssets());
$("asset-status-filter").addEventListener("change", () => loadAssets());

// LOGOUT

async function logout() {
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } catch (_) {}

  window.location.href = "/owner/";
}

$("logout").addEventListener("click", logout);
$("denied-logout").addEventListener("click", logout);

// START

startPortal();

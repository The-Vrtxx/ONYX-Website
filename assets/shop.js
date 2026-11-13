
const API = "https://api.onyxdiscord.com";

let catalog = [];
let currentFilter = "all";

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
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function showMessage(text, error = false) {
  $("message").textContent = text;
  $("message").style.color = error
    ? "#ff9999"
    : "var(--teal)";
}

// COSMETIC PREVIEW

function renderShopPreview(canvas, item) {
  const preview = window.ONYXPreview;

  if (!preview || typeof preview.renderAsset !== "function") {
    const ctx = canvas.getContext("2d");

    canvas.width = 420;
    canvas.height = 120;

    ctx.fillStyle = "#091316";
    ctx.fillRect(0, 0, 420, 120);

    ctx.fillStyle = "#ff9999";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Preview unavailable", 210, 65);

    return;
  }

  try {
    preview.renderAsset(canvas, {
      category: item.category,
      item_id: item.id,
      display_name: item.name,
      image_url: item.image_url || null,
      metadata: item.metadata || {}
    });
  } catch (error) {
    console.error("ONYX shop preview error:", error);

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#091316";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff9999";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Preview error", canvas.width / 2, canvas.height / 2);
  }
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "shop-item";

  const category = document.createElement("div");
  category.className = "category";
  category.textContent = item.category;

  const title = document.createElement("h2");
  title.textContent = item.name;

  // Cosmetic preview
  const previewBox = document.createElement("div");
  previewBox.className = "shop-item-preview";

  const previewCanvas = document.createElement("canvas");
  previewCanvas.width = 420;
  previewCanvas.height = 300;
  previewCanvas.setAttribute(
    "aria-label",
    "Preview of " + (item.name || "ONYX cosmetic")
  );

  previewBox.append(previewCanvas);
  renderShopPreview(previewCanvas, item);

  const description = document.createElement("p");
  description.textContent = item.description || "";

  const meta = document.createElement("div");
  meta.className = "shop-meta";

  const cost = document.createElement("span");
  cost.textContent = item.cost + " TOKENS";

  const rarity = document.createElement("span");
  rarity.textContent = item.rarity || "Common";

  meta.append(cost, rarity);

  const button = document.createElement("button");

  if (item.owned) {
    button.textContent = item.equipped
      ? "Equipped"
      : "Equip";

    button.disabled = !!item.equipped;

    button.addEventListener("click", () => {
      equipItem(item.category, item.id);
    });

  } else {
    button.className = "buy";
    button.textContent = "Unlock";

    button.addEventListener("click", () => {
      buyItem(item.category, item.id);
    });
  }

  card.append(
    category,
    title,
    previewBox,
    description,
    meta,
    button
  );

  return card;
}

function renderShop() {
  const owned = catalog.filter(item => item.owned);

  $("owned-count").textContent = owned.length;

  const filtered = catalog.filter(item => {
    if (currentFilter === "all") return true;

    if (currentFilter === "owned") {
      return item.owned;
    }

    return item.category === currentFilter;
  });

  const grid = $("shop-grid");

  grid.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No items in this category yet.";

    grid.append(empty);
    return;
  }

  filtered.forEach(item => {
    grid.append(createItemCard(item));
  });
}

async function refreshShop() {
  const data = await api("/api/shop");

  catalog = data.items || [];

  $("tokens").textContent = data.tokens ?? 0;

  renderShop();
}

async function buyItem(category, item_id) {
  if (!confirm("Unlock this cosmetic with Prestige Tokens?")) {
    return;
  }

  showMessage("Processing purchase...");

  try {
    const result = await api("/api/shop/buy", {
      method: "POST",
      body: JSON.stringify({
        category,
        item_id
      })
    });

    showMessage(result.message || "Purchase complete.");

    await refreshShop();

  } catch (error) {
    showMessage(error.message, true);
  }
}

async function equipItem(category, item_id) {
  showMessage("Updating your profile...");

  try {
    await api("/api/equip", {
      method: "POST",
      body: JSON.stringify({
        category,
        item_id
      })
    });

    showMessage("Cosmetic equipped.");

    await refreshShop();

  } catch (error) {
    showMessage(error.message, true);
  }
}

async function startShop() {
  try {
    const user = await api("/api/me");

    $("login-panel").hidden = true;
    $("shop-content").hidden = false;
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
      $("avatar").src = "../assets/onyx-mark.png";
    }

    await refreshShop();

  } catch {
    $("login-panel").hidden = false;
    $("shop-content").hidden = true;
    $("account").hidden = true;
  }
}

$("filters").addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");

  if (!button) return;

  currentFilter = button.dataset.filter;

  $("filters")
    .querySelectorAll("button")
    .forEach(item => {
      item.classList.toggle("active", item === button);
    });

  renderShop();
});

$("logout").addEventListener("click", async () => {
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } catch {}

  location.reload();
});

startShop();

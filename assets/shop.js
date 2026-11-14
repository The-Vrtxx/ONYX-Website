
const API = "https://api.onyxdiscord.com";

let catalog = [];
let currentFilter = "all";
let currentUser = null;
let profileCardObjectUrl = null;

const $ = id => document.getElementById(id);

const CATEGORY_NAMES = {
  frame: "Frames",
  theme: "Themes",
  background: "Backgrounds",
  emblem: "Emblems",
  effect: "Effects",
  badge: "Badges",
  title: "Titles",
  event: "Seasonal Collectibles"
};

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
  const message = $("message");

  if (!message) return;

  message.textContent = text;
  message.style.color = error
    ? "#ff9999"
    : "var(--teal)";
}

// PROFILE CARD PREVIEW

function createProfilePreview() {
  if ($("profile-preview-section")) return;

  const section = document.createElement("section");
  section.id = "profile-preview-section";
  section.style.cssText = `
    margin: 30px 0;
    padding: 24px;
    border: 1px solid var(--line);
    background: var(--panel);
    border-radius: 4px;
  `;

  const heading = document.createElement("div");

  heading.innerHTML = `
    <div class="eyebrow">YOUR ONYX IDENTITY</div>
    <h2 style="margin:10px 0 6px">Profile Card Preview</h2>
    <p style="color:var(--muted);font-size:13px;margin-bottom:18px">
      This is your actual ONYX profile card, rendered by the same
      engine used by the Discord bot. Your preview updates when
      you equip an item.
    </p>
  `;

  const imageWrap = document.createElement("div");

  imageWrap.style.cssText = `
    width:100%;
    overflow:hidden;
    background:#050b0e;
    border:1px solid var(--line);
    border-radius:5px;
    padding:8px;
  `;

  const image = document.createElement("img");
  image.id = "profile-card-image";
  image.alt = "Your ONYX profile card";

  image.style.cssText = `
    display:block;
    width:100%;
    height:auto;
  `;

  imageWrap.append(image);

  const status = document.createElement("p");
  status.id = "profile-preview-status";

  status.style.cssText = `
    color:var(--muted);
    font-size:12px;
    margin:12px 0 0;
  `;

  status.textContent = "Loading your profile...";

  section.append(heading, imageWrap, status);

  const balance = $("shop-content").querySelector(".balance");

  balance.insertAdjacentElement("afterend", section);
}

async function refreshProfilePreview() {
  createProfilePreview();

  const status = $("profile-preview-status");
  const image = $("profile-card-image");

  try {
    status.textContent = "Loading your latest ONYX profile card...";

    const response = await fetch(
      API + "/api/profile-card.png?refresh=" + Date.now(),
      {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Accept": "image/png"
        }
      }
    );

    if (!response.ok) {
      let message = "Your profile card could not be loaded.";

      try {
        const data = await response.json();

        if (data.error) {
          message = data.error;
        }
      } catch {}

      throw new Error(message);
    }

    const blob = await response.blob();

    if (!blob.type.includes("image/png")) {
      throw new Error(
        "The profile card endpoint did not return a PNG image."
      );
    }

    const nextObjectUrl = URL.createObjectURL(blob);
    const previousObjectUrl = profileCardObjectUrl;

    profileCardObjectUrl = nextObjectUrl;

    image.onload = () => {
      if (previousObjectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(nextObjectUrl);

      if (profileCardObjectUrl === nextObjectUrl) {
        profileCardObjectUrl = null;
      }

      status.textContent =
        "The profile card image could not be displayed.";
    };

    image.src = nextObjectUrl;

    status.textContent =
      "Showing your actual ONYX profile card and current equipped cosmetics.";

  } catch (error) {
    console.error("ONYX profile preview error:", error);

    status.textContent =
      error.message ||
      "Your profile preview could not be loaded. Refresh the page to try again.";
  }
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

    ctx.fillText(
      "Preview error",
      canvas.width / 2,
      canvas.height / 2
    );
  }
}

// ITEM CARD

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = "shop-item";

  const category = document.createElement("div");
  category.className = "category";

  category.textContent =
    CATEGORY_NAMES[item.category] || item.category;

  const title = document.createElement("h2");
  title.textContent = item.name || "ONYX Cosmetic";

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
  cost.textContent =
    Number(item.cost || 0).toLocaleString() + " TOKENS";

  const rarity = document.createElement("span");
  rarity.textContent = item.rarity || "Common";

  meta.append(cost, rarity);

  const button = document.createElement("button");

  const isCollectible =
    item.collectible === true ||
    item.category === "event";

  if (isCollectible) {
    if (item.owned) {
      button.textContent = "Collected";
      button.disabled = true;
    } else {
      button.className = "buy";
      button.textContent = "Collect";

      button.addEventListener("click", () => {
        buyItem(item.category, item.id);
      });
    }

  } else if (item.owned) {
    button.textContent = item.equipped
      ? "Equipped"
      : "Equip";

    button.disabled = !!item.equipped;

    if (!item.equipped) {
      button.addEventListener("click", () => {
        equipItem(item.category, item.id);
      });
    }

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

// SHOP FILTERING

function updateFilterButtons() {
  const filters = $("filters");

  if (!filters) return;

  filters.querySelectorAll("button[data-filter]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === currentFilter
    );
  });
}

function renderShop() {
  const owned = catalog.filter(item => item.owned);

  $("owned-count").textContent = owned.length;

  const filtered = catalog.filter(item => {
    if (currentFilter === "all") {
      return true;
    }

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

    if (currentFilter === "owned") {
      empty.textContent =
        "You haven't collected any shop items yet.";
    } else {
      empty.textContent =
        "No items in this category yet.";
    }

    grid.append(empty);
    return;
  }

  filtered.forEach(item => {
    grid.append(createItemCard(item));
  });
}

// REFRESH SHOP

async function refreshShop() {
  const data = await api("/api/shop");

  catalog = Array.isArray(data.items)
    ? data.items
    : [];

  $("tokens").textContent =
    Number(data.tokens || 0).toLocaleString();

  renderShop();
  await refreshProfilePreview();
}

// PURCHASE

async function buyItem(category, item_id) {
  const item = catalog.find(entry =>
    entry.category === category &&
    entry.id === item_id
  );

  if (!item) {
    showMessage("That shop item could not be found.", true);
    return;
  }

  const action = item.collectible || category === "event"
    ? "Collect"
    : "Unlock";

  if (!confirm(
    `${action} ${item.name} with Prestige Tokens?`
  )) {
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

// EQUIP

async function equipItem(category, item_id) {
  if (category === "event" || category === "achievement") {
    showMessage(
      "This item is collectible and cannot be equipped.",
      true
    );
    return;
  }

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

// STARTUP

async function startShop() {
  try {
    const user = await api("/api/me");

    currentUser = user;

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

  } catch (error) {
    console.error("ONYX shop startup error:", error);

    $("login-panel").hidden = false;
    $("shop-content").hidden = true;
    $("account").hidden = true;
  }
}

// FILTER BUTTONS

$("filters").addEventListener("click", event => {
  const button = event.target.closest("button[data-filter]");

  if (!button) return;

  currentFilter = button.dataset.filter;

  updateFilterButtons();
  renderShop();
});

// LOGOUT

$("logout").addEventListener("click", async () => {
  try {
    await api("/auth/logout", {
      method: "POST",
      body: "{}"
    });
  } catch {}

  if (profileCardObjectUrl) {
    URL.revokeObjectURL(profileCardObjectUrl);
    profileCardObjectUrl = null;
  }

  location.reload();
});

startShop();

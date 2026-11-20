
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const $ = (selector) => document.querySelector(selector);

  const state = {
    inventory: {},
    equipped: {},
    saved: {},
    category: "frame",
    loading: false,
    applying: false,
    previewRequest: 0,
    previewUrl: null
  };

  const categories = [
    "frame",
    "theme",
    "emblem",
    "effect",
    "background",
    "badge",
    "title"
  ];

  const labels = {
    frame: "Frames",
    theme: "Themes",
    emblem: "Emblems",
    effect: "Effects",
    background: "Backgrounds",
    badge: "Badges",
    title: "Titles"
  };

  const defaults = {
    frame: {
      id: "default",
      name: "Default Frame",
      frame_category: "frame",
      source: "default"
    },
    theme: {
      id: "onyx",
      name: "Default Theme",
      source: "default"
    },
    emblem: {
      id: "default",
      name: "Default Emblem",
      source: "default"
    },
    effect: {
      id: "none",
      name: "No Effect",
      source: "default"
    },
    background: {
      id: "default",
      name: "Default Background",
      source: "default"
    },
    badge: {
      id: "default",
      name: "Default Badge",
      source: "default"
    },
    title: {
      id: "__none__",
      name: "No Title",
      source: "default",
      resetValue: null
    }
  };

  function message(text, error = false) {
    const el = $("#studio-message");
    if (!el) return;

    el.textContent = text || "";
    el.style.color = error ? "#ff8585" : "";
  }

  function setPreviewState(text) {
    const el = $("#preview-state");
    if (el) el.textContent = text;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? {
          "Content-Type": "application/json"
        } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Please sign in with Discord to use the Rank Studio."
      );
    }

    if (!response.ok) {
      let detail = "Something went wrong. Please try again.";

      try {
        const data = await response.json();
        detail = data.error || data.message || detail;
      } catch (_) {}

      throw new Error(detail);
    }

    return response;
  }

  function normalizeEquipped(data = {}) {
    return {
      frame_id: data.frame_id || "default",
      frame_category: data.frame_category || "frame",
      theme_id: data.theme_id || "onyx",
      emblem_id: data.emblem_id || "default",
      effect_id: data.effect_id || "none",
      background_id: data.background_id || "default",
      badge_id: data.badge_id || "default",
      title_id: data.title_id || null
    };
  }

  function selectedId(category) {
    return state.equipped[`${category}_id`] ?? null;
  }

  function itemId(item) {
    return item.id ?? item.item_id ?? item.title ?? null;
  }

  function itemName(item) {
    return (
      item.name ||
      item.title ||
      item.display_name ||
      item.id ||
      item.item_id ||
      "Untitled"
    );
  }

  function itemDescription(item) {
    if (item.source === "default") {
      return "Restore the default appearance";
    }

    if (item.source === "achievement") {
      return "Achievement unlocked";
    }

    if (item.source === "prestige_master") {
      return `Prestige Master title · Level ${item.required_level || ""}`;
    }

    return item.description || item.source || "Unlocked item";
  }

  function isSelected(category, item) {
    const id = itemId(item);

    if (category === "title" && item.resetValue === null) {
      return selectedId(category) === null;
    }

    if (String(selectedId(category)) !== String(id)) {
      return false;
    }

    if (category === "frame") {
      return (
        (state.equipped.frame_category || "frame") ===
        (item.frame_category || "frame")
      );
    }

    return true;
  }

  function setSelectedValue(category, item) {
    const value = item.resetValue !== undefined
      ? item.resetValue
      : itemId(item);

    state.equipped[`${category}_id`] = value;

    if (category === "frame") {
      state.equipped.frame_category =
        item.frame_category || "frame";
    }
  }

  function groupInventory(items) {
    const grouped = {};

    categories.forEach((category) => {
      grouped[category] = [];
    });

    if (!Array.isArray(items)) {
      return grouped;
    }

    items.forEach((item) => {
      if (!item || typeof item !== "object") return;

      let category = String(item.category || "").toLowerCase();

      // The API returns border items as frame items with
      // frame_category="border". Keep them in the Frames tab.
      if (category === "border") {
        category = "frame";
      }

      if (!grouped[category]) return;

      grouped[category].push(item);
    });

    // Add a default/reset choice to every cosmetic slot.
    categories.forEach((category) => {
      grouped[category].unshift({
        ...defaults[category]
      });
    });

    return grouped;
  }

  function discordAvatarUrl(user) {
    if (user.avatar && user.id) {
      const extension = user.avatar.startsWith("a_")
        ? "gif"
        : "png";

      return (
        `https://cdn.discordapp.com/avatars/` +
        `${user.id}/${user.avatar}.${extension}?size=128`
      );
    }

    if (user.id) {
      const defaultAvatar = Number(
        (BigInt(user.id) >> 22n) % 6n
      );

      return (
        `https://cdn.discordapp.com/embed/avatars/` +
        `${defaultAvatar}.png`
      );
    }

    return "";
  }

  function renderAccount(user) {
    const account = $("#studio-account");
    const login = $("#studio-login");
    const content = $("#studio-content");

    if (login) login.hidden = true;
    if (content) content.hidden = false;
    if (account) account.hidden = false;

    const username = $("#studio-username");
    const avatar = $("#studio-avatar");

    if (username) {
      username.textContent =
        user.username || user.global_name || "Discord User";
    }

    if (avatar) {
      avatar.src = discordAvatarUrl(user);
      avatar.alt = "Discord avatar";
    }
  }

  function renderLogin() {
    const login = $("#studio-login");
    const content = $("#studio-content");
    const account = $("#studio-account");

    if (login) login.hidden = false;
    if (content) content.hidden = true;
    if (account) account.hidden = true;
  }

  function renderTabs() {
    document.querySelectorAll(
      "#studio-tabs button"
    ).forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === state.category
      );
    });
  }

  function renderItems() {
    const container = $("#studio-items");
    if (!container) return;

    const items = state.inventory[state.category] || [];

    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "studio-empty";
      empty.textContent =
        `No unlocked ${labels[state.category].toLowerCase()} yet.`;

      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement("button");

      card.type = "button";
      card.className = "studio-item";
      card.classList.toggle(
        "selected",
        isSelected(state.category, item)
      );

      // Artwork canvas uses the shared ONYX preview renderer.
      const artwork = document.createElement("div");
      artwork.className = "studio-item-artwork";

      const canvas = document.createElement("canvas");
      canvas.width = 420;
      canvas.height = 300;
      canvas.setAttribute("aria-hidden", "true");
      artwork.appendChild(canvas);

      if (item.source === "default") {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#091316";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#28dcd2";
        ctx.font = "bold 54px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("↺", 210, 150);
      } else if (
        window.ONYXPreview &&
        typeof window.ONYXPreview.renderAsset === "function"
      ) {
        window.ONYXPreview.renderAsset(canvas, {
          category: state.category,
          item_id: String(itemId(item) || ""),
          display_name: itemName(item),
          image_url: item.image_url || null,
          metadata: item.metadata || {}
        });
      } else {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#091316";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#28dcd2";
        ctx.font = "bold 30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(itemName(item), 210, 150, 360);
      }

      const name = document.createElement("strong");
      name.textContent = itemName(item);

      const description = document.createElement("small");
      description.textContent = itemDescription(item);

      card.append(artwork, name, description);

      card.addEventListener("click", async () => {
        setSelectedValue(state.category, item);

        renderItems();
        await loadPreview();
      });

      container.appendChild(card);
    });
  }

  async function loadPreview() {
    const image = $("#rank-preview");
    if (!image) return;

    const requestNumber = ++state.previewRequest;

    try {
      setPreviewState("Generating preview...");

      const response = await api(
        "/api/profile-card/preview.png",
        {
          method: "POST",
          body: JSON.stringify(state.equipped)
        }
      );

      const blob = await response.blob();

      // Ignore older previews if the user selected something else
      // while the previous preview was still rendering.
      if (requestNumber !== state.previewRequest) return;

      const url = URL.createObjectURL(blob);
      const previous = state.previewUrl;

      state.previewUrl = url;
      image.src = url;

      if (previous) {
        URL.revokeObjectURL(previous);
      }

      setPreviewState("Unsaved preview");
      message("");
    } catch (error) {
      if (requestNumber !== state.previewRequest) return;

      message(error.message, true);
      setPreviewState("Preview unavailable");
    }
  }

  async function loadStudio() {
    if (state.loading) return;

    state.loading = true;
    message("Loading your ONYX collection...");

    try {
      // Fetch account information and customization inventory
      // separately because the customization endpoint does not
      // return the Discord user object.
      const [userResponse, inventoryResponse] = await Promise.all([
        api("/api/me"),
        api("/api/profile-card/customization")
      ]);

      const user = await userResponse.json();
      const data = await inventoryResponse.json();

      renderAccount(user);

      state.inventory = groupInventory(data.items || []);
      state.equipped = normalizeEquipped(data.equipped || {});
      state.saved = normalizeEquipped(data.equipped || {});

      state.category = "frame";

      renderTabs();
      renderItems();

      await loadPreview();

      setPreviewState("Saved setup");
      message("");
    } catch (error) {
      if (error.message.toLowerCase().includes("sign in")) {
        renderLogin();
      } else {
        message(error.message, true);
      }
    } finally {
      state.loading = false;
    }
  }

  async function applyChanges() {
    if (state.applying) return;

    const button = $("#apply-changes");
    state.applying = true;

    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    try {
      await api("/api/profile-card/apply", {
        method: "POST",
        body: JSON.stringify(state.equipped)
      });

      state.saved = normalizeEquipped(state.equipped);

      message("Your rank card customization has been saved!");
      setPreviewState("Saved setup");

      renderItems();
    } catch (error) {
      message(error.message, true);
    } finally {
      state.applying = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Apply Changes";
      }
    }
  }

  async function resetPreview() {
    state.equipped = normalizeEquipped(state.saved);

    renderItems();

    message("Preview reset to your saved setup.");

    await loadPreview();

    setPreviewState("Saved setup");
  }

  async function logout() {
    const button = $("#studio-logout");

    if (button) {
      button.disabled = true;
      button.textContent = "Signing out...";
    }

    try {
      await api("/auth/logout", {
        method: "POST"
      });

      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
        state.previewUrl = null;
      }

      window.location.reload();
    } catch (error) {
      message(error.message, true);

      if (button) {
        button.disabled = false;
        button.textContent = "Sign out";
      }
    }
  }

  function bindEvents() {
    $("#studio-tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest(
        "button[data-category]"
      );

      if (!button) return;

      const category = button.dataset.category;

      if (!categories.includes(category)) return;

      state.category = category;

      renderTabs();
      renderItems();
    });

    $("#apply-changes")?.addEventListener(
      "click",
      applyChanges
    );

    $("#reset-preview")?.addEventListener(
      "click",
      resetPreview
    );

    $("#studio-logout")?.addEventListener(
      "click",
      logout
    );

    // Return users to the Rank Studio after Discord login.
    const loginLink = $("#studio-login a");

    if (loginLink) {
      loginLink.href =
        `${API}/auth/discord?next=${encodeURIComponent("/customization/")}`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadStudio();
  });
})();

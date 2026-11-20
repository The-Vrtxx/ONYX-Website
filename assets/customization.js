
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
    applying: false
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
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Please sign in with Discord to use the Rank Studio.");
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
      frame_id: data.frame_id || null,
      theme_id: data.theme_id || null,
      emblem_id: data.emblem_id || null,
      effect_id: data.effect_id || null,
      background_id: data.background_id || null,
      badge_id: data.badge_id || null,
      title_id: data.title_id || null,
      frame_category: data.frame_category || "frame"
    };
  }

  function selectedId(category) {
    const key = `${category}_id`;
    return state.equipped[key] || null;
  }

  function setSelectedValue(category, id, frameCategory = null) {
    const key = `${category}_id`;
    state.equipped[key] = id || null;

    if (category === "frame") {
      state.equipped.frame_category = frameCategory || "frame";
    }
  }

  function itemId(item) {
    return item.id || item.item_id || item.title || item.name;
  }

  function itemName(item) {
    return item.name || item.title || item.display_name || item.id || item.item_id || "Untitled";
  }

  function itemDescription(item) {
    return item.description || item.source || labels[state.category] || "Unlocked item";
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
        user.username || user.global_name || user.name || "Discord User";
    }

    if (avatar) {
      avatar.src = user.avatar_url || user.avatar || "";
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
    document.querySelectorAll("#studio-tabs button").forEach((button) => {
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
    const current = selectedId(state.category);

    container.replaceChildren();

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "studio-empty";
      empty.textContent = `No unlocked ${labels[state.category].toLowerCase()} yet.`;
      container.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const id = itemId(item);
      const card = document.createElement("button");

      card.type = "button";
      card.className = "studio-item";
      card.classList.toggle("selected", String(id) === String(current));

      const icon = document.createElement("span");
      icon.className = "item-icon";
      icon.textContent = state.category === "title" ? "✦" : "◇";

      const name = document.createElement("strong");
      name.textContent = itemName(item);

      const description = document.createElement("small");
      description.textContent = itemDescription(item);

      card.append(icon, name, description);

      card.addEventListener("click", async () => {
        const frameCategory = item.frame_category || item.owned_category || null;

        setSelectedValue(state.category, id, frameCategory);
        renderItems();
        await loadPreview();
      });

      container.appendChild(card);
    });
  }

  async function loadPreview() {
    const image = $("#rank-preview");
    if (!image) return;

    try {
      setPreviewState("Generating preview...");

      const response = await api("/api/profile-card/preview.png", {
        method: "POST",
        body: JSON.stringify(state.equipped)
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const previous = image.dataset.objectUrl;

      image.src = url;
      image.dataset.objectUrl = url;

      if (previous) URL.revokeObjectURL(previous);

      setPreviewState("Unsaved preview");
    } catch (error) {
      message(error.message, true);
      setPreviewState("Preview unavailable");
    }
  }

  async function loadStudio() {
    if (state.loading) return;
    state.loading = true;
    message("Loading your ONYX collection...");

    try {
      const response = await api("/api/profile-card/customization");
      const data = await response.json();

      renderAccount(data.user || {});

      state.inventory = data.inventory || {};
      state.equipped = normalizeEquipped(data.equipped || {});
      state.saved = normalizeEquipped(data.equipped || {});

      categories.forEach((category) => {
        if (!Array.isArray(state.inventory[category])) {
          state.inventory[category] = [];
        }
      });

      state.category = "frame";

      renderTabs();
      renderItems();

      const initialImage = $("#rank-preview");
      if (initialImage && data.preview_url) {
        initialImage.src = data.preview_url;
      } else {
        await loadPreview();
      }

      setPreviewState("Saved setup");
      message("");
    } catch (error) {
      if (error.message.includes("sign in")) {
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

  function bindEvents() {
    $("#studio-tabs")?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-category]");
      if (!button) return;

      const category = button.dataset.category;
      if (!categories.includes(category)) return;

      state.category = category;
      renderTabs();
      renderItems();
    });

    $("#apply-changes")?.addEventListener("click", applyChanges);
    $("#reset-preview")?.addEventListener("click", resetPreview);

    $("#studio-logout")?.addEventListener("click", () => {
      window.location.href = `${API}/auth/logout`;
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadStudio();
  });
})();

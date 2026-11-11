
const API_URL = "https://api.onyxdiscord.com/api/commands";

let commands = [];
let categoryNames = [];
let activeCategory = "";

const searchInput = document.getElementById("commandSearch");
const categorySelect = document.getElementById("categorySelect");
const filterChips = document.getElementById("filterChips");
const sections = document.getElementById("commandSections");
const resultCount = document.getElementById("resultCount");
const emptyState = document.getElementById("emptyState");
const commandTotal = document.getElementById("commandTotal");
const categoryTotal = document.getElementById("categoryTotal");

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[character]));

function updateCounters() {
  if (commandTotal) {
    commandTotal.textContent = commands.length;
  }

  if (categoryTotal) {
    categoryTotal.textContent = categoryNames.length;
  }
}

function setCategory(value) {
  activeCategory = value;
  categorySelect.value = value;

  filterChips.querySelectorAll(".filter-chip").forEach(button => {
    button.classList.toggle("active", button.dataset.filter === value);
  });

  render();
}

function buildFilters() {
  categorySelect.innerHTML =
    '<option value="">All categories (' + categoryNames.length + ')</option>';

  filterChips.innerHTML = "";

  const counts = Object.fromEntries(
    categoryNames.map(category => [
      category,
      commands.filter(command => command.category === category).length
    ])
  );

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "filter-chip";
  allChip.dataset.filter = "";
  allChip.innerHTML = 'All commands <span>' + commands.length + '</span>';
  allChip.addEventListener("click", () => setCategory(""));
  filterChips.append(allChip);

  categoryNames.forEach(category => {
    const count = counts[category];

    const option = document.createElement("option");
    option.value = category;
    option.textContent = category + " (" + count + ")";
    categorySelect.append(option);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip";
    chip.dataset.filter = category;
    chip.innerHTML = esc(category) + " <span>" + count + "</span>";
    chip.addEventListener("click", () => setCategory(category));
    filterChips.append(chip);
  });

  filterChips.querySelector('[data-filter=""]')
    ?.classList.toggle("active", activeCategory === "");

  filterChips.querySelectorAll(".filter-chip").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.filter === activeCategory
    );
  });

  categorySelect.value = activeCategory;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  let shown = 0;

  sections.innerHTML = "";

  categoryNames.forEach(category => {
    if (activeCategory && activeCategory !== category) return;

    const matches = commands.filter(command => {
      if (command.category !== category) return false;

      const searchable = [
        command.name,
        command.usage,
        command.description,
        command.cog,
        ...(command.aliases || [])
      ].join(" ").toLowerCase();

      return !query || searchable.includes(query);
    });

    if (!matches.length) return;

    shown += matches.length;

    const section = document.createElement("section");
    section.className = "command-category";
    section.id = "cat-" + category.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    section.innerHTML =
      '<div class="category-heading">' +
        '<div><span class="eyebrow">COMMAND CATEGORY</span>' +
        '<h2>' + esc(category) + '</h2></div>' +
        '<span class="category-count">' + matches.length + ' command' +
        (matches.length === 1 ? "" : "s") + '</span>' +
      '</div><div class="command-list"></div>';

    const list = section.querySelector(".command-list");

    matches.forEach(command => {
      const card = document.createElement("article");
      card.className = "command-entry";

      card.innerHTML =
        '<div class="command-entry-top">' +
          '<h3>' + esc(command.name) + '</h3>' +
          '<button class="copy-command" type="button">Copy</button>' +
        '</div>' +
        '<code class="command-usage">' + esc(command.usage) + '</code>' +
        '<p>' + esc(command.description || "No description available.") + '</p>';

      card.querySelector("button").addEventListener("click", async event => {
        const button = event.currentTarget;

        try {
          await navigator.clipboard.writeText(command.usage || "");
          button.textContent = "Copied!";
        } catch (error) {
          button.textContent = "Select text";
        }

        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1200);
      });

      list.append(card);
    });

    sections.append(section);
  });

  resultCount.textContent =
    "Showing " + shown + " of " + commands.length + " commands";

  emptyState.textContent = commands.length
    ? "No commands match your search."
    : "The live command catalog is currently empty.";

  emptyState.style.display = shown ? "none" : "block";
}

async function loadCommands() {
  if (!commands.length) {
    emptyState.textContent = "Loading the live command catalog…";
    emptyState.style.display = "block";
  }

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("API returned HTTP " + response.status);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.commands)) {
      throw new Error("The API response did not contain a command list.");
    }

    commands = data.commands;

    categoryNames = [
      ...new Set(commands.map(command => String(command.category || "Other")))
    ].sort((a, b) => a.localeCompare(b));

    if (activeCategory && !categoryNames.includes(activeCategory)) {
      activeCategory = "";
    }

    updateCounters();
    buildFilters();
    render();

  } catch (error) {
    console.error("Unable to load ONYX commands:", error);

    if (!commands.length) {
      sections.innerHTML = "";
      resultCount.textContent = "Command catalog unavailable";
      emptyState.textContent =
        "Could not load commands from ONYX. Please try again in a moment.";
      emptyState.style.display = "block";
    }
  }
}

searchInput.addEventListener("input", render);

categorySelect.addEventListener("change", () => {
  setCategory(categorySelect.value);
});

loadCommands();

// Refresh the command catalog periodically without reloading the page.
window.setInterval(loadCommands, 60000);

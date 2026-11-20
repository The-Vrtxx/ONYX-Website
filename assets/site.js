
(() => {
  "use strict";

  const API = "https://api.onyxdiscord.com";
  const nav = document.querySelector(".topbar nav");
  const menuButton = document.querySelector(".menu-toggle");

  document.querySelectorAll("[data-year]").forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  if (!nav) return;

  const currentPath = window.location.pathname || "/";

  function injectNavigationStyles() {
    if (document.getElementById("onyx-navigation-styles")) return;

    const style = document.createElement("style");
    style.id = "onyx-navigation-styles";

    style.textContent = `
      .topbar nav.onyx-nav {
        display: flex;
        align-items: center;
        gap: 13px;
      }

      .onyx-nav-group {
        position: relative;
      }

      .onyx-nav-group > summary {
        list-style: none;
        cursor: pointer;
        color: #9fb0b3;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        padding: 12px 4px;
        white-space: nowrap;
      }

      .onyx-nav-group > summary::-webkit-details-marker {
        display: none;
      }

      .onyx-nav-group > summary::after {
        content: "⌄";
        margin-left: 7px;
        color: #00d6ca;
      }

      .onyx-nav-group[open] > summary,
      .onyx-nav-group > summary:hover,
      .onyx-nav-group > summary.has-active {
        color: #00e6d2;
      }

      .onyx-nav-menu {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        min-width: 220px;
        display: grid;
        gap: 4px;
        padding: 9px;
        background: #091316;
        border: 1px solid #1b5558;
        border-radius: 8px;
        box-shadow: 0 16px 45px #000b;
        z-index: 100;
      }

      .onyx-nav-menu a {
        display: block;
        padding: 12px 13px;
        border-radius: 5px;
        color: #aab9bc;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        text-decoration: none;
        white-space: nowrap;
      }

      .onyx-nav-menu a:hover,
      .onyx-nav-menu a.active {
        color: #00e6d2;
        background: #00e6d214;
      }

      .onyx-nav-menu a[hidden] {
        display: none !important;
      }

      .onyx-nav-direct {
        color: #9fb0b3;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .04em;
        white-space: nowrap;
        text-decoration: none;
      }

      .onyx-nav-direct:hover,
      .onyx-nav-direct.active {
        color: #00e6d2;
      }

      .onyx-nav-account {
        border: 1px solid #23605c;
        border-radius: 5px;
        padding: 10px 12px;
        color: #00e6d2 !important;
      }

      .onyx-nav-authorize {
        border: 1px solid #00bfb2;
        border-radius: 5px;
        padding: 11px 13px;
        color: #00e6d2 !important;
        white-space: nowrap;
      }

      .onyx-nav-account[hidden],
      .onyx-nav-authorize[hidden] {
        display: none !important;
      }

      @media(max-width:650px) {
        .topbar nav.onyx-nav {
          display: none;
          gap: 5px;
          max-height: calc(100vh - 80px);
          overflow-y: auto;
          align-items: stretch;
        }

        .topbar nav.onyx-nav.open {
          display: flex;
        }

        .onyx-nav-group {
          width: 100%;
          border-bottom: 1px solid #b8ffff16;
        }

        .onyx-nav-group > summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 0;
          font-size: 14px;
        }

        .onyx-nav-group > summary::after {
          content: "+";
          font-size: 19px;
        }

        .onyx-nav-group[open] > summary::after {
          content: "−";
        }

        .onyx-nav-menu {
          position: static;
          min-width: 0;
          border: 0;
          border-radius: 0;
          box-shadow: none;
          background: #0b171a;
          padding: 4px 8px 12px;
          gap: 2px;
        }

        .onyx-nav-menu a {
          padding: 13px;
          font-size: 13px;
        }

        .onyx-nav-direct {
          display: block;
          padding: 15px 0;
          font-size: 14px;
        }

        .onyx-nav-authorize,
        .onyx-nav-account {
          display: block;
          text-align: center;
          margin-top: 9px;
          padding: 14px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function makeLink(path, label, attributes = {}) {
    const link = document.createElement("a");
    link.href = path;
    link.textContent = label;

    Object.entries(attributes).forEach(([key, value]) => {
      link.setAttribute(key, value);
    });

    if (
      path === currentPath ||
      (path !== "/" && currentPath.startsWith(path))
    ) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }

    return link;
  }

  function makeGroup(label, links) {
    const details = document.createElement("details");
    details.className = "onyx-nav-group";

    const summary = document.createElement("summary");
    summary.textContent = label;

    const menu = document.createElement("div");
    menu.className = "onyx-nav-menu";

    let hasActive = false;

    links.forEach(link => {
      if (link.classList.contains("active")) {
        hasActive = true;
      }

      menu.appendChild(link);
    });

    if (hasActive) {
      summary.classList.add("has-active");
      details.open = true;
    }

    details.append(summary, menu);
    return details;
  }

  function buildNavigation() {
    nav.classList.add("onyx-nav");
    nav.classList.remove("open");
    nav.innerHTML = "";

    if (menuButton) {
      menuButton.setAttribute("aria-expanded", "false");
    }

    const home = makeLink("/", "HOME", {
      class: "onyx-nav-direct"
    });

    const explore = makeGroup("EXPLORE ONYX", [
      makeLink("/features", "FEATURES"),
      makeLink("/docs", "DOCUMENTATION"),
      makeLink("/commands/", "COMMANDS")
    ]);

    // MEMBER HUB
    const memberHub = makeGroup("MEMBER HUB", [
      makeLink("/dashboard/", "DASHBOARD"),
      makeLink("/xp", "GLOBAL XP"),
      makeLink("/achievements/", "ACHIEVEMENTS"),
      makeLink("/shop/", "PRESTIGE SHOP"),
      makeLink("/customization/", "RANK CUSTOMIZATION")
    ]);

    const help = makeGroup("HELP & INFORMATION", [
      makeLink("/support", "SUPPORT"),
      makeLink("/terms", "TERMS"),
      makeLink("/privacy", "PRIVACY")
    ]);

    const ownerLink = makeLink(
      "/owner/",
      "OWNER CONTROL CENTER",
      { class: "onyx-nav-direct" }
    );

    ownerLink.hidden = true;
    ownerLink.setAttribute("data-onyx-team", "");

    const account = makeGroup("ACCOUNT", []);

    const authLink = document.createElement("a");
    authLink.className = "onyx-nav-account";
    authLink.setAttribute("data-onyx-auth", "");
    authLink.textContent = "SIGN IN";

    const signOutLink = document.createElement("a");
    signOutLink.className = "onyx-nav-account";
    signOutLink.href = "#";
    signOutLink.textContent = "SIGN OUT";
    signOutLink.hidden = true;
    signOutLink.setAttribute("data-onyx-signout", "");

    account.querySelector(".onyx-nav-menu").append(
      authLink,
      signOutLink
    );

    const authorize = document.createElement("a");
    authorize.className = "onyx-nav-authorize";
    authorize.textContent = "AUTHORIZE ONYX ↗";
    authorize.href =
      "https://discord.com/oauth2/authorize?client_id=1566544548820422658&scope=bot%20applications.commands&permissions=8";
    authorize.target = "_blank";
    authorize.rel = "noopener";

    nav.append(
      home,
      explore,
      memberHub,
      help,
      ownerLink,
      account,
      authorize
    );

    return {
      authLink,
      signOutLink,
      ownerLink,
      account
    };
  }

  injectNavigationStyles();

  const controls = buildNavigation();

  // Toggle the mobile navigation.
  if (menuButton) {
    menuButton.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");

      menuButton.setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    });
  }

  // Close other dropdowns when one is opened.
  nav.querySelectorAll(".onyx-nav-group").forEach(group => {
    group.addEventListener("toggle", () => {
      if (!group.open) return;

      nav.querySelectorAll(".onyx-nav-group").forEach(other => {
        if (other !== group) {
          other.open = false;
        }
      });
    });
  });

  // Close the mobile menu after choosing a page.
  nav.addEventListener("click", event => {
    const link = event.target.closest("a");

    if (link && window.innerWidth <= 650) {
      nav.classList.remove("open");

      if (menuButton) {
        menuButton.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Sign out.
  controls.signOutLink.addEventListener("click", async event => {
    event.preventDefault();

    controls.signOutLink.textContent = "SIGNING OUT…";

    try {
      await fetch(API + "/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      });
    } catch (error) {
      console.error("ONYX sign-out request failed:", error);
    }

    window.location.reload();
  });

  // Discord account and permission checks.
  async function loadAccountNavigation() {
    try {
      const response = await fetch(API + "/api/me", {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        controls.ownerLink.hidden = true;
        controls.authLink.hidden = false;
        controls.authLink.textContent = "SIGN IN";
        controls.authLink.href =
          API + "/auth/discord?next=" +
          encodeURIComponent(currentPath);
        controls.signOutLink.hidden = true;
        return;
      }

      const user = await response.json();

      controls.authLink.href = "/dashboard/";
      controls.authLink.textContent =
        (user.username || "MY ACCOUNT").toUpperCase();

      controls.authLink.setAttribute(
        "aria-label",
        "Signed in as " + (user.username || "Discord user")
      );

      controls.signOutLink.hidden = false;

      try {
        const accessResponse = await fetch(
          API + "/api/developer/access",
          {
            method: "GET",
            credentials: "include",
            headers: {
              "Accept": "application/json"
            },
            cache: "no-store"
          }
        );

        if (accessResponse.ok) {
          const access = await accessResponse.json();

          controls.ownerLink.hidden = !access.authorized;

          if (access.authorized) {
            controls.ownerLink.textContent =
              access.role === "owner"
                ? "OWNER CONTROL CENTER"
                : "DEVELOPER WORKSPACE";
          }
        } else {
          controls.ownerLink.hidden = true;
        }
      } catch (error) {
        controls.ownerLink.hidden = true;
        console.error("ONYX access check failed:", error);
      }

    } catch (error) {
      controls.ownerLink.hidden = true;
      controls.authLink.hidden = false;
      controls.authLink.textContent = "SIGN IN";
      controls.authLink.href =
        API + "/auth/discord?next=" +
        encodeURIComponent(currentPath);
      controls.signOutLink.hidden = true;

      console.error("ONYX account check failed:", error);
    }
  }

  loadAccountNavigation();
})();

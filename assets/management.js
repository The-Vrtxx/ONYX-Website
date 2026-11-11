
(() => {
  const $ = id => document.getElementById(id);

  let selected = null;
  let roleData = null;
  let unsubscribe = null;
  let loadVersion = 0;

  const request = async (path, options = {}) => {
    if (!window.ONYXDashboard?.api) {
      throw new Error("The ONYX dashboard connection is not ready.");
    }

    return window.ONYXDashboard.api(path, options);
  };

  const qs = obj => new URLSearchParams(obj).toString();

  const date = value =>
    value ? new Date(value).toLocaleString() : "—";

  const empty = (host, message) => {
    if (!host) return;

    host.replaceChildren();

    const node = document.createElement("div");
    node.className = "empty";
    node.textContent = message;

    host.append(node);
  };

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);

    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;

    return node;
  };

  const setStatus = (id, message, kind = "") => {
    const node = $(id);

    if (!node) return;

    node.textContent = message;
    node.className = `status-line ${kind}`;
  };

  const guildQuery = path => {
    if (!selected) {
      throw new Error("Select a server first.");
    }

    const separator = path.includes("?") ? "&" : "?";

    return `${path}${separator}guild_id=${encodeURIComponent(selected.id)}`;
  };

  /*
   * Load all management information for the selected server.
   * A version number prevents a slower previous server request
   * from updating the page after the user switches servers.
   */
  async function selectGuild(guild) {
    if (!guild) return;

    selected = guild;
    roleData = null;

    const thisLoad = ++loadVersion;

    const permission = window.ONYXDashboard.getPermissionText(guild);

    setStatus(
      "global-status",
      `Loading management information for ${guild.name}…`
    );

    $("selected-name").textContent = guild.name;
    $("selected-permission").textContent =
      `Your access: ${permission}.`;

    const tasks = [
      loadOverview(thisLoad),
      loadModeration(thisLoad),
      loadAnalytics(thisLoad),
      loadRoles(thisLoad),
      loadAudit(thisLoad)
    ];

    await Promise.allSettled(tasks);

    if (thisLoad !== loadVersion) return;

    setStatus(
      "global-status",
      `Management information loaded for ${guild.name}.`,
      "success"
    );
  }

  /* ---------------------------
     SERVER OVERVIEW
  --------------------------- */

  async function loadOverview(version = loadVersion) {
    try {
      const data = await request(
        guildQuery("/api/server/overview")
      );

      if (version !== loadVersion) return;

      const server = data.server || {};

      const values = [
        server.member_count,
        server.channel_count,
        data.moderation_cases_30d,
        data.automod_events_7d
      ];

      const labels = [
        "Server members",
        "Channels",
        "Moderation cases · 30d",
        "AutoMod catches · 7d"
      ];

      const metrics = $("metrics");
      metrics.replaceChildren();

      values.forEach((value, index) => {
        const box = el("div", "metric");

        box.append(
          el("small", "", labels[index]),
          el(
            "strong",
            "",
            Number(value || 0).toLocaleString()
          )
        );

        metrics.append(box);
      });

      const status = $("bot-status");

      status.textContent =
        server.bot_status === "online"
          ? "ONYX online"
          : "Status delayed";

      status.className =
        `status ${server.bot_status === "online" ? "online" : ""}`;

      $("last-seen").textContent =
        `Last sync: ${date(server.last_seen)}`;

      $("server-summary").textContent =
        `${server.name || selected.name} has ${Number(server.role_count || 0).toLocaleString()} roles. Bot status is based on its latest database heartbeat.`;

      const host = $("overview-cases");
      host.replaceChildren();

      const cases = data.recent_cases || [];

      if (!cases.length) {
        empty(host, "No moderation cases recorded yet.");
        return;
      }

      cases.forEach(item => {
        host.append(makeHistoryRow(item));
      });

    } catch (error) {
      if (version === loadVersion) {
        setStatus("global-status", error.message, "error");
      }
    }
  }

  function makeHistoryRow(item) {
    const row = el("article", "row-card");
    const left = el("div");

    const title = el(
      "strong",
      "",
      `#${item.id} · ${item.action || "warning"}`
    );

    const subtitle = el(
      "p",
      "",
      `Member ${item.user_id} · Moderator ${item.moderator_id} · ${date(item.created_at)}`
    );

    left.append(title, subtitle);

    row.append(
      left,
      el("p", "", item.reason || "No reason recorded")
    );

    if (item.kind === "case") {
      const button = el("button", "btn secondary", "Details");

      button.addEventListener("click", () => {
        showCase(item.id);
      });

      row.append(button);
    }

    return row;
  }

  /* ---------------------------
     MODERATION HISTORY
  --------------------------- */

  async function loadModeration(version = loadVersion) {
    const host = $("moderation-list");

    empty(host, "Loading moderation history…");
    $("case-detail").replaceChildren();

    try {
      const member = $("member-search").value.trim();

      const query = qs({
        limit: 50,
        ...(member ? { member_id: member } : {})
      });

      const data = await request(
        guildQuery(`/api/server/moderation?${query}`)
      );

      if (version !== loadVersion) return;

      host.replaceChildren();

      const items = data.items || [];

      if (!items.length) {
        empty(host, "No warnings or moderation cases found.");
        return;
      }

      items.forEach(item => {
        host.append(makeHistoryRow(item));
      });

    } catch (error) {
      if (version === loadVersion) {
        empty(host, error.message);
      }
    }
  }

  async function showCase(id) {
    try {
      const data = await request(
        guildQuery(
          `/api/server/moderation/case?case_id=${encodeURIComponent(id)}`
        )
      );

      const item = data.case;

      if (!item) {
        throw new Error("Moderation case was not found.");
      }

      const box = $("case-detail");
      box.replaceChildren();

      const panel = el("div", "case-detail");

      panel.append(
        el("h3", "", `Case #${item.id}`),
        el("p", "", `Action: ${item.action}`),
        el("p", "", `Member: ${item.user_id}`),
        el("p", "", `Moderator: ${item.moderator_id}`),
        el("p", "", `Reason: ${item.reason || "No reason recorded"}`),
        el("p", "", `Date: ${date(item.created_at)}`)
      );

      box.append(panel);

    } catch (error) {
      setStatus("global-status", error.message, "error");
    }
  }

  /* ---------------------------
     AUTOMOD ANALYTICS
  --------------------------- */

  function renderBars(host, items, nameKey) {
    host.replaceChildren();

    if (!items || !items.length) {
      empty(host, "No activity recorded in this period.");
      return;
    }

    const max = Math.max(
      ...items.map(item => Number(item.total) || 0),
      1
    );

    items.forEach(item => {
      const row = el("div", "bar-item");
      const name = el("span", "", item[nameKey] || "Unknown");
      const track = el("div", "bar-track");
      const fill = el("div", "bar-fill");

      fill.style.width =
        `${Math.max(2, (Number(item.total) || 0) / max * 100)}%`;

      track.append(fill);

      row.append(
        name,
        track,
        el("strong", "", String(item.total || 0))
      );

      host.append(row);
    });
  }

  async function loadAnalytics(version = loadVersion) {
    try {
      const days = $("analytics-days").value;

      const data = await request(
        guildQuery(
          `/api/server/automod/analytics?days=${encodeURIComponent(days)}`
        )
      );

      if (version !== loadVersion) return;

      const host = $("automod-metrics");
      host.replaceChildren();

      [
        ["Total triggers", data.total],
        ["Successful actions", data.successful],
        ["Unsuccessful actions", data.unsuccessful],
        ["Reporting window", `${data.days || days}d`]
      ].forEach(([label, value]) => {
        const box = el("div", "metric");

        box.append(
          el("small", "", label),
          el(
            "strong",
            "",
            Number.isFinite(Number(value))
              ? Number(value).toLocaleString()
              : String(value ?? "—")
          )
        );

        host.append(box);
      });

      renderBars(
        $("filter-breakdown"),
        data.by_filter || [],
        "name"
      );

      renderBars(
        $("punishment-breakdown"),
        data.by_punishment || [],
        "name"
      );

      const recent = $("automod-recent");
      recent.replaceChildren();

      const events = data.recent || [];

      if (!events.length) {
        empty(recent, "No AutoMod triggers have been recorded yet.");
        return;
      }

      events.forEach(item => {
        const row = el("article", "row-card");
        const left = el("div");

        left.append(
          el(
            "strong",
            "",
            `${item.filter || "Unknown filter"} · ${item.punishment || "No action"}`
          ),
          el(
            "p",
            "",
            `Member ${item.user_id || "unknown"} · Channel ${item.channel_id || "unknown"} · ${date(item.created_at)}`
          )
        );

        row.append(
          left,
          el(
            "span",
            `status ${item.success ? "online" : ""}`,
            item.success ? "Action succeeded" : "Action failed"
          )
        );

        recent.append(row);
      });

    } catch (error) {
      if (version === loadVersion) {
        empty($("automod-recent"), error.message);
      }
    }
  }

  /* ---------------------------
     ROLE MANAGEMENT
  --------------------------- */

  function roleName(id) {
    return (
      roleData?.roles?.find(
        role => role.id === String(id)
      )?.name || `Deleted role (${id})`
    );
  }

  async function loadRoles(version = loadVersion) {
    try {
      const data = await request(
        guildQuery("/api/server/roles")
      );

      if (version !== loadVersion) return;

      roleData = data;

      const roles = (roleData.roles || []).filter(
        role => role.manageable
      );

      for (const id of [
        "role-select",
        "reward-role",
        "reaction-role"
      ]) {
        const select = $(id);
        select.replaceChildren();

        roles.forEach(role => {
          const option = el(
            "option",
            "",
            `${role.name} · ${role.id}`
          );

          option.value = role.id;
          select.append(option);
        });

        if (!roles.length) {
          const option = el(
            "option",
            "",
            "No manageable roles synced"
          );

          option.value = "";
          select.append(option);
        }
      }

      renderRoleList(
        "autorole-list",
        roleData.autoroles || [],
        "autorole_remove"
      );

      renderRoleList(
        "selfrole-list",
        roleData.selfroles || [],
        "selfrole_remove"
      );

      renderRoleList(
        "reward-list",
        (roleData.level_rewards || []).map(item => ({
          ...item,
          label: `Level ${item.level} → ${roleName(item.role_id)}`
        })),
        "reward_remove",
        true
      );

      const host = $("reaction-list");
      host.replaceChildren();

      const reactions = roleData.reaction_roles || [];

      if (!reactions.length) {
        empty(host, "No reaction roles configured.");
      }

      reactions.forEach(item => {
        const row = el("article", "row-card");
        const left = el("div");

        left.append(
          el(
            "strong",
            "",
            `${item.emoji} → ${roleName(item.role_id)}`
          ),
          el(
            "p",
            "",
            `Channel ${item.channel_id} · Message ${item.message_id}`
          )
        );

        const button = el("button", "btn danger", "Remove");

        button.addEventListener("click", () => {
          saveRole({
            action: "reactionrole_remove",
            message_id: item.message_id,
            emoji: item.emoji
          });
        });

        row.append(left, button);
        host.append(row);
      });

      setStatus(
        "roles-status",
        `${roles.length} roles are currently manageable by ONYX.`,
        "success"
      );

    } catch (error) {
      if (version === loadVersion) {
        setStatus("roles-status", error.message, "error");
      }
    }
  }

  function renderRoleList(
    hostId,
    items,
    action,
    rewards = false
  ) {
    const host = $(hostId);
    host.replaceChildren();

    if (!items.length) {
      empty(host, "None configured.");
      return;
    }

    items.forEach(item => {
      const id = rewards ? item.role_id : item;

      const row = el("article", "row-card");
      const left = el("div");

      const label = rewards
        ? item.label
        : roleName(id);

      left.append(el("strong", "", label));

      const button = el("button", "btn danger", "Remove");

      button.addEventListener("click", () => {
        saveRole(
          rewards
            ? { action, level: item.level }
            : { action, role_id: id }
        );
      });

      row.append(left, button);
      host.append(row);
    });
  }

  async function saveRole(payload) {
    if (!selected) return;

    setStatus("roles-status", "Saving…");

    try {
      await request("/api/server/roles", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          guild_id: selected.id
        })
      });

      setStatus(
        "roles-status",
        "Role settings saved.",
        "success"
      );

      await loadRoles();

    } catch (error) {
      setStatus("roles-status", error.message, "error");
    }
  }

  /* ---------------------------
     AUDIT LOG
  --------------------------- */

  async function loadAudit(version = loadVersion) {
    const host = $("audit-list");

    empty(host, "Loading activity…");

    try {
      const type = $("audit-filter").value;

      const query = qs({
        limit: 75,
        ...(type ? { event_type: type } : {})
      });

      const data = await request(
        guildQuery(`/api/server/audit?${query}`)
      );

      if (version !== loadVersion) return;

      host.replaceChildren();

      const items = data.items || [];

      if (!items.length) {
        empty(
          host,
          "No audit events captured yet. New events will appear here while the ONYX audit integration is running."
        );

        return;
      }

      items.forEach(item => {
        const row = el("article", "row-card");
        const left = el("div");

        left.append(
          el(
            "strong",
            "",
            (item.event_type || "unknown").replaceAll("_", " ")
          ),
          el("p", "", item.summary || "No event summary available."),
          el(
            "p",
            "",
            `${date(item.created_at)} · Actor: ${item.actor_id || "Unavailable"} · Target: ${item.target_id || "—"}`
          )
        );

        row.append(left);
        host.append(row);
      });

    } catch (error) {
      if (version === loadVersion) {
        empty(host, error.message);
      }
    }
  }

  /* ---------------------------
     EVENT LISTENERS
  --------------------------- */

  $("load-moderation").addEventListener("click", () => {
    if (selected) loadModeration();
  });

  $("load-analytics").addEventListener("click", () => {
    if (selected) loadAnalytics();
  });

  $("analytics-days").addEventListener("change", () => {
    if (selected) loadAnalytics();
  });

  $("refresh-roles").addEventListener("click", () => {
    if (selected) loadRoles();
  });

  $("load-audit").addEventListener("click", () => {
    if (selected) loadAudit();
  });

  $("audit-filter").addEventListener("change", () => {
    if (selected) loadAudit();
  });

  $("autorole-add").addEventListener("click", () => {
    saveRole({
      action: "autorole_add",
      role_id: $("role-select").value
    });
  });

  $("selfrole-add").addEventListener("click", () => {
    saveRole({
      action: "selfrole_add",
      role_id: $("role-select").value
    });
  });

  $("reward-save").addEventListener("click", () => {
    const level = Number($("reward-level").value);
    const roleId = $("reward-role").value;

    if (!Number.isInteger(level) || level < 1 || level > 10000) {
      setStatus(
        "roles-status",
        "Enter a valid reward level between 1 and 10000.",
        "error"
      );
      return;
    }

    if (!roleId) {
      setStatus(
        "roles-status",
        "Select a reward role first.",
        "error"
      );
      return;
    }

    saveRole({
      action: "reward_set",
      level,
      role_id: roleId
    });
  });

  $("reaction-save").addEventListener("click", () => {
    const channelId = $("reaction-channel").value.trim();
    const messageId = $("reaction-message").value.trim();
    const emoji = $("reaction-emoji").value.trim();
    const roleId = $("reaction-role").value;

    if (!channelId || !messageId || !emoji || !roleId) {
      setStatus(
        "roles-status",
        "Complete all reaction role fields before saving.",
        "error"
      );
      return;
    }

    saveRole({
      action: "reactionrole_add",
      channel_id: channelId,
      message_id: messageId,
      emoji,
      role_id: roleId
    });
  });

  /*
   * Subscribe to the main dashboard's shared server selection.
   */
  function connectToDashboard() {
    if (!window.ONYXDashboard?.subscribe) {
      setStatus(
        "global-status",
        "Waiting for the main ONYX dashboard to initialize…"
      );

      return false;
    }

    if (unsubscribe) unsubscribe();

    unsubscribe = window.ONYXDashboard.subscribe(selectGuild);

    return true;
  }

  if (!connectToDashboard()) {
    document.addEventListener(
      "onyx-dashboard-ready",
      connectToDashboard,
      { once: true }
    );
  }
})();

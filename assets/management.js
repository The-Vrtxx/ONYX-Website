(() => {
  const API = "https://api.onyxdiscord.com";
  const $ = id => document.getElementById(id);
  let guilds = [], selected = null, roleData = null;
  const request = async (path, options = {}) => {
    const res = await fetch(API + path, { ...options, credentials: "include", headers: {"Content-Type":"application/json", ...(options.headers || {})} });
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
    return data;
  };
  const qs = obj => new URLSearchParams(obj).toString();
  const esc = value => String(value ?? "");
  const setStatus = (id, message, kind = "") => { const el=$(id); if(el){el.textContent=message;el.className=`status-line ${kind}`;} };
  const date = value => value ? new Date(value).toLocaleString() : "—";
  const empty = (host, text) => { host.replaceChildren(); const el=document.createElement("div"); el.className="empty"; el.textContent=text; host.append(el); };
  const el = (tag, cls, text) => { const node=document.createElement(tag); if(cls)node.className=cls; if(text!==undefined)node.textContent=text; return node; };
  const guildQuery = path => `${path}${path.includes("?") ? "&" : "?"}guild_id=${encodeURIComponent(selected.id)}`;

  async function start() {
    try {
      const user = await request("/api/me");
      $("login-panel").hidden = true; $("app-panel").hidden = false; $("logout").hidden = false;
      $("account-name").textContent = user.username || "Discord account";
      const data = await request("/api/guilds"); guilds = data.guilds || [];
      const select = $("guild-select"); select.replaceChildren();
      if (!guilds.length) { const opt=el("option", "", "No manageable servers found"); opt.value=""; select.append(opt); setStatus("global-status", data.message || "No manageable servers with ONYX installed were found.", "error"); return; }
      for (const g of guilds) { const opt=el("option", "", g.name); opt.value=g.id; select.append(opt); }
      await selectGuild(guilds[0]);
      select.addEventListener("change", () => selectGuild(guilds.find(g=>g.id===select.value)));
    } catch (err) {
      $("login-panel").hidden = false; $("app-panel").hidden = true;
      if (err.message !== "Sign in with Discord first.") setStatus("global-status", err.message, "error");
    }
  }

  async function selectGuild(guild) {
    if (!guild) return; selected=guild; roleData=null;
    $("guild-select").value=guild.id;
    const permission = guild.owner ? "Server Owner" : guild.administrator ? "Administrator" : guild.manage_server ? "Manage Server" : "Manager";
    $("guild-permission").textContent=`Access: ${permission}`;
    setStatus("global-status", `Loading ${guild.name}…`);
    await Promise.allSettled([loadOverview(), loadModeration(), loadAnalytics(), loadRoles(), loadAudit()]);
    setStatus("global-status", `Showing management data for ${guild.name}.`, "success");
  }

  async function loadOverview() {
    try {
      const d=await request(guildQuery("/api/server/overview")); const s=d.server;
      const vals=[s.member_count,s.channel_count,d.moderation_cases_30d,d.automod_events_7d];
      const labels=["Server members","Channels","Moderation cases · 30d","AutoMod catches · 7d"];
      const metrics=$("metrics"); metrics.replaceChildren(); vals.forEach((v,i)=>{const box=el("div","metric");box.append(el("small","",labels[i]),el("strong","",Number(v).toLocaleString()));metrics.append(box);});
      const status=$("bot-status");status.textContent=s.bot_status==="online"?"ONYX online":"Status delayed";status.className=`status ${s.bot_status==="online"?"online":""}`;
      $("last-seen").textContent=`Last sync: ${date(s.last_seen)}`;
      $("server-summary").textContent=`${s.name} has ${Number(s.role_count).toLocaleString()} roles. Bot status is based on its latest database heartbeat.`;
      const host=$("overview-cases");host.replaceChildren();
      if(!d.recent_cases.length) return empty(host,"No moderation cases recorded yet.");
      d.recent_cases.forEach(c=>host.append(makeHistoryRow(c)));
    } catch(e) { setStatus("global-status",e.message,"error"); }
  }

  function makeHistoryRow(item) {
    const row=el("article","row-card"), left=el("div"), title=el("strong","",`#${item.id} · ${item.action || "warning"}`), sub=el("p","",`Member ${item.user_id} · Moderator ${item.moderator_id} · ${date(item.created_at)}`);
    left.append(title,sub); row.append(left,el("p","",item.reason || "No reason recorded"));
    if(item.kind==="case") { const b=el("button","btn secondary","Details");b.addEventListener("click",()=>showCase(item.id));row.append(b); }
    return row;
  }

  async function loadModeration() {
    const host=$("moderation-list"); empty(host,"Loading moderation history…"); $("case-detail").replaceChildren();
    try {
      const member=$("member-search").value.trim(); const data=await request(guildQuery(`/api/server/moderation?${qs({limit:50,...(member?{member_id:member}:{})})}`));
      host.replaceChildren(); if(!data.items.length)return empty(host,"No warnings or moderation cases found.");
      data.items.forEach(item=>host.append(makeHistoryRow(item)));
    } catch(e) { empty(host,e.message); }
  }
  async function showCase(id) {
    try { const d=await request(guildQuery(`/api/server/moderation/case?case_id=${encodeURIComponent(id)}`)); const c=d.case; const box=$("case-detail");box.replaceChildren();
      const panel=el("div","case-detail");panel.append(el("h3","",`Case #${c.id}`),el("p","",`Action: ${c.action}`),el("p","",`Member: ${c.user_id}`),el("p","",`Moderator: ${c.moderator_id}`),el("p","",`Reason: ${c.reason}`),el("p","",`Date: ${date(c.created_at)}`));box.append(panel);
    } catch(e) { setStatus("global-status",e.message,"error"); }
  }

  function renderBars(host, items, nameKey) {
    host.replaceChildren(); if(!items.length)return empty(host,"No activity recorded in this period.");
    const max=Math.max(...items.map(x=>x.total),1);
    items.forEach(item=>{const row=el("div","bar-item"),name=el("span","",item[nameKey]),track=el("div","bar-track"),fill=el("div","bar-fill");fill.style.width=`${Math.max(2,item.total/max*100)}%`;track.append(fill);row.append(name,track,el("strong","",String(item.total)));host.append(row);});
  }
  async function loadAnalytics() {
    try {
      const days=$("analytics-days").value;const d=await request(guildQuery(`/api/server/automod/analytics?days=${days}`));
      const host=$("automod-metrics");host.replaceChildren();[["Total triggers",d.total],["Successful actions",d.successful],["Unsuccessful actions",d.unsuccessful],["Reporting window",`${d.days}d`]].forEach(([label,value])=>{const box=el("div","metric");box.append(el("small","",label),el("strong","",Number.isFinite(value)?Number(value).toLocaleString():value));host.append(box);});
      renderBars($("filter-breakdown"),d.by_filter,"name");renderBars($("punishment-breakdown"),d.by_punishment,"name");
      const recent=$("automod-recent");recent.replaceChildren();if(!d.recent.length)empty(recent,"No AutoMod triggers have been recorded yet.");
      d.recent.forEach(r=>{const row=el("article","row-card"),left=el("div");left.append(el("strong","",`${r.filter} · ${r.punishment}`),el("p","",`Member ${r.user_id || "unknown"} · Channel ${r.channel_id || "unknown"} · ${date(r.created_at)}`));row.append(left,el("span",`status ${r.success?"online":""}`,r.success?"Action succeeded":"Action failed"));recent.append(row);});
    } catch(e) { empty($("automod-recent"),e.message); }
  }

  function roleName(id) { return roleData?.roles?.find(r=>r.id===String(id))?.name || `Deleted role (${id})`; }
  async function loadRoles() {
    try {
      roleData=await request(guildQuery("/api/server/roles"));
      const manageable=roleData.roles.filter(r=>r.manageable);
      for(const id of ["role-select","reward-role","reaction-role"]) { const sel=$(id);sel.replaceChildren(); manageable.forEach(r=>{const o=el("option","",`${r.name} · ${r.id}`);o.value=r.id;sel.append(o);}); if(!manageable.length)sel.append(el("option","","No manageable roles synced")); }
      renderRoleList("autorole-list",roleData.autoroles,"autorole_remove");renderRoleList("selfrole-list",roleData.selfroles,"selfrole_remove");
      renderRoleList("reward-list",roleData.level_rewards.map(r=>({...r, label:`Level ${r.level} → ${roleName(r.role_id)}`})),"reward_remove",true);
      const host=$("reaction-list");host.replaceChildren();if(!roleData.reaction_roles.length)empty(host,"No reaction roles configured.");
      roleData.reaction_roles.forEach(r=>{const row=el("article","row-card"),left=el("div");left.append(el("strong","",`${r.emoji} → ${roleName(r.role_id)}`),el("p","",`Channel ${r.channel_id} · Message ${r.message_id}`));const b=el("button","btn danger","Remove");b.addEventListener("click",()=>saveRole({action:"reactionrole_remove",message_id:r.message_id,emoji:r.emoji}));row.append(left,b);host.append(row);});
      setStatus("roles-status",`${manageable.length} roles are currently manageable by ONYX.`,"success");
    } catch(e) { setStatus("roles-status",e.message,"error"); }
  }
  function renderRoleList(hostId, ids, action, rewards=false) {
    const host=$(hostId);host.replaceChildren();if(!ids.length)return empty(host,"None configured.");
    ids.forEach(item=>{const id=rewards?item.role_id:item;const row=el("article","row-card"),label=rewards?item.label:roleName(id),left=el("div");left.append(el("strong","",label));const b=el("button","btn danger","Remove");b.addEventListener("click",()=>saveRole(rewards?{action,level:item.level}:{action,role_id:id}));row.append(left,b);host.append(row);});
  }
  async function saveRole(payload) {
    if(!selected)return;setStatus("roles-status","Saving…");
    try { await request("/api/server/roles",{method:"POST",body:JSON.stringify({...payload,guild_id:selected.id})});setStatus("roles-status","Role settings saved.","success");await loadRoles(); }
    catch(e){setStatus("roles-status",e.message,"error");}
  }

  async function loadAudit() {
    const host=$("audit-list");empty(host,"Loading activity…");
    try {const type=$("audit-filter").value;const d=await request(guildQuery(`/api/server/audit?${qs({limit:75,...(type?{event_type:type}:{})})}`));host.replaceChildren();if(!d.items.length)return empty(host,"No audit events captured yet. New events will appear here while the ONYX audit integration is running.");
      d.items.forEach(item=>{const row=el("article","row-card"),left=el("div");left.append(el("strong","",item.event_type.replaceAll("_"," ")),el("p","",item.summary),el("p","",`${date(item.created_at)} · Actor: ${item.actor_id||"Unavailable"} · Target: ${item.target_id||"—"}`));row.append(left);host.append(row);});
    } catch(e){empty(host,e.message);}
  }

  document.querySelectorAll("[data-tab]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id===`tab-${btn.dataset.tab}`));}));
  $("load-moderation").addEventListener("click",loadModeration);$("load-analytics").addEventListener("click",loadAnalytics);$("analytics-days").addEventListener("change",loadAnalytics);$("refresh-roles").addEventListener("click",loadRoles);$("load-audit").addEventListener("click",loadAudit);$("audit-filter").addEventListener("change",loadAudit);
  $("autorole-add").addEventListener("click",()=>saveRole({action:"autorole_add",role_id:$("role-select").value}));$("selfrole-add").addEventListener("click",()=>saveRole({action:"selfrole_add",role_id:$("role-select").value}));
  $("reward-save").addEventListener("click",()=>saveRole({action:"reward_set",level:$("reward-level").value,role_id:$("reward-role").value}));
  $("reaction-save").addEventListener("click",()=>saveRole({action:"reactionrole_add",channel_id:$("reaction-channel").value,message_id:$("reaction-message").value,emoji:$("reaction-emoji").value,role_id:$("reaction-role").value}));
  $("logout").addEventListener("click",async()=>{try{await request("/auth/logout",{method:"POST",body:"{}"});}catch{}location.reload();});
  start();
})();

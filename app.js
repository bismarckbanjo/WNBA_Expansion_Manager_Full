const DATA = window.GAME_DATA;
const LS_KEY = "wnbaExpansionFullBuild.v2";
const money = (n) => "$" + Math.round(n).toLocaleString();
const shortMoney = (n) =>
  n >= 1000000
    ? "$" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M"
    : "$" + Math.round(n / 1000) + "K";
const avg = (arr) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
const clone = (x) => JSON.parse(JSON.stringify(x));
let S = load() || migrate(freshState());
let tab = S.started ? "dashboard" : "setup";
let selectedCity = DATA.expansionCities[0];
let modal = null;
let draftFilters = { q: "", pos: "ALL", team: "ALL", risk: "ALL" };
let trade = {
  team: "ATL",
  userGive: [],
  otherGive: [],
  userPick: 0,
  otherPick: 0,
};
function freshState() {
  return {
    started: false,
    week: 1,
    phase: "Expansion Build",
    team: {
      city: "Philadelphia",
      nickname: "Foundry",
      abbr: "PHI",
      arena: "Independence Center",
      primary: "#f16622",
      secondary: "#101010",
    },
    teams: clone(DATA.teams),
    roster: [],
    waived: [],
    picks: { you: 3, league: 2 },
    season: null,
    year: 2026,
    offseason: null,
    customRookies: {},
    coaching: {
      weeklyFocus: "none",
      weeklyFocusWeek: 1,
      devFocus: { playerId: null, rating: "scoring" },
      gamePlans: {},
      pendingPress: null,
      pressLog: [],
    },
    gameDay: null,
    log: [],
    objectives: [
      { id: "roster11", text: "Draft at least 11 players", done: false },
      {
        id: "positions",
        text: "Carry every position group: G, F, C",
        done: false,
      },
      { id: "cap", text: "Stay below the simplified cap", done: false },
      {
        id: "future",
        text: "Preserve at least 2 future pick assets",
        done: false,
      },
    ],
    reports: [],
  };
}
function migrate(s) {
  if (!s) return s;
  if (typeof s.year !== "number") s.year = 2026;
  if (s.offseason === undefined) s.offseason = null;
  if (!s.customRookies || typeof s.customRookies !== "object")
    s.customRookies = {};
  if (!s.coaching) {
    s.coaching = {
      weeklyFocus: "none",
      weeklyFocusWeek: s.week || 1,
      devFocus: { playerId: null, rating: "scoring" },
      gamePlans: {},
      pendingPress: null,
      pressLog: [],
    };
  }
  if (s.gameDay === undefined) s.gameDay = null;
  // Ensure fatigue on every player record
  const ensureFatigue = (p) => {
    if (typeof p.fatigue !== "number") p.fatigue = 0;
  };
  (s.roster || []).forEach(ensureFatigue);
  (s.waived || []).forEach(ensureFatigue);
  (s.teams || []).forEach((t) => (t.players || []).forEach(ensureFatigue));
  return s;
}
function load() {
  try {
    return migrate(JSON.parse(localStorage.getItem(LS_KEY)));
  } catch {
    return null;
  }
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(S));
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.getElementById("toast").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function root() {
  return document.getElementById("app");
}
function allLeaguePlayers() {
  return S.teams.flatMap((t) =>
    t.players.map((p) => ({ ...p, teamName: t.name, teamObj: t })),
  );
}
function userSalary() {
  return S.roster.reduce((a, p) => a + p.salary, 0);
}
function teamSalary(team) {
  return team.players.reduce((a, p) => a + p.salary, 0);
}
function composite(p) {
  let r = p.ratings;
  return Math.round(
    r.scoring * 0.19 +
      r.shooting * 0.14 +
      r.playmaking * 0.14 +
      r.defense * 0.18 +
      r.rebounding * 0.12 +
      r.athleticism * 0.09 +
      r.iq * 0.09 +
      r.potential * 0.05,
  );
}
function visibleGrade(p) {
  const c = composite(p);
  if (c >= 90) return "MVP";
  if (c >= 84) return "Star";
  if (c >= 78) return "Starter";
  if (c >= 70) return "Rotation";
  if (c >= 62) return "Depth";
  return "Fringe";
}
function portraitHtml(player, size) {
  const id = DATA.playerPhotos && DATA.playerPhotos[player.name];
  const initials = player.name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const cls = "portrait" + (size ? " " + size : "");
  const img = id
    ? `<img src="https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png" alt="${player.name}" onerror="this.style.display='none'" loading="lazy">`
    : "";
  return `<div class="${cls}">${initials}${img}</div>`;
}
function tradeValue(p) {
  const r = p.ratings;
  return Math.round(
    composite(p) * 8 +
      r.potential * 5 -
      p.salary / 9000 +
      (p.protected ? 220 : 0) +
      (p.years > 2 ? 60 : 0),
  );
}
function checkObjectives() {
  const groups = {
    G: S.roster.some((p) => p.pos.includes("G")),
    F: S.roster.some((p) => p.pos.includes("F")),
    C: S.roster.some((p) => p.pos.includes("C")),
  };
  S.objectives.forEach((o) => {
    if (o.id === "roster11") o.done = S.roster.length >= 11;
    if (o.id === "positions") o.done = groups.G && groups.F && groups.C;
    if (o.id === "cap") o.done = userSalary() <= DATA.cap;
    if (o.id === "future") o.done = S.picks.you >= 2;
  });
}
function render() {
  ensureSeason();
  checkObjectives();
  document.documentElement.style.setProperty("--user1", S.team.primary);
  document.documentElement.style.setProperty("--user2", S.team.secondary);
  root().innerHTML = S.started ? shell() : setupPage();
  bind();
  save();
}
function shell() {
  return `<div class="appShell"><aside class="side"><div class="brand"><div class="logo"></div><div><h1>${S.team.city} ${S.team.nickname}</h1><p>Expansion Front Office</p></div></div><nav class="nav">${navBtn("dashboard", "Dashboard")} ${navBtn("draft", "Expansion Draft")} ${navBtn("roster", "Roster")} ${navBtn("schedule", "Season")} ${navBtn("trades", "Trade Desk")} ${navBtn("waivers", "Waivers")} ${navBtn("coaching", "Coaching")} ${navBtn("league", "League")} ${navBtn("admin", "Admin")}</nav><div class="sideCard"><div class="mini">Front Office Score</div><div class="big">${frontOfficeScore()}</div><p>${frontOfficeNote()}</p></div></aside><main class="main">${topbar()}${content()}${modalHtml()}</main></div>`;
}
function navBtn(id, label) {
  return `<button data-tab="${id}" class="${tab === id ? "active" : ""}"><span>${label}</span><b>${navBadge(id)}</b></button>`;
}
function navBadge(id) {
  if (id === "draft") return `${S.roster.length}/${DATA.expansionPickLimit}`;
  if (id === "schedule")
    return `${seasonRecord(S.team.abbr).w}-${seasonRecord(S.team.abbr).l}`;
  if (id === "trades") return S.picks.you;
  if (id === "waivers") return S.waived.length;
  if (id === "coaching" && S.coaching && S.coaching.pendingPress) return "!";
  return "";
}
function topbar() {
  const titles = {
    dashboard: "Command Center",
    draft: "Expansion Draft Room",
    roster: "Roster & Cap Sheet",
    schedule: "Season Command",
    trades: "Trade Desk",
    waivers: "Waiver Wire",
    league: "League Overview",
    offseason: "Offseason",
    coaching: "Coaching",
    admin: "Admin · Custom Rookies",
  };
  const title = S.offseason ? "Offseason " + S.year : titles[tab];
  const sub = S.offseason
    ? `Stage: ${S.offseason.stage === "aging" ? "Aging report" : S.offseason.stage === "draft" ? "Rookie draft" : "Complete"} · Year ${S.year} → ${S.year + 1}`
    : `${S.phase} · Year ${S.year} · Week ${S.week} · Simplified cap ${money(DATA.cap)}`;
  return `<div class="topbar"><div><h2>${title}</h2><p>${sub}</p></div><div class="actions"><button class="btn secondary" data-action="advance">Advance Week</button><button class="btn secondary" data-action="simNext">Sim Next Game</button><button class="btn secondary" data-action="reset">New Save</button></div></div>`;
}
function content() {
  if (S.offseason) return offseasonView();
  if (S.gameDay) return gameDayView();
  return {
    dashboard: dashboard(),
    draft: draft(),
    roster: roster(),
    schedule: schedulePage(),
    trades: trades(),
    waivers: waivers(),
    league: league(),
    coaching: coachingView(),
    admin: adminView(),
  }[tab];
}
function kpis() {
  const sal = userSalary();
  const talent = avg(S.roster.map(composite));
  const pot = avg(S.roster.map((p) => p.ratings.potential));
  const balance = rosterBalance();
  return `<div class="grid kpis"><div class="card kpi"><label>Roster</label><div class="value">${S.roster.length}/${DATA.rosterMax}</div><small>${DATA.rosterMin} needed for opening night</small></div><div class="card kpi"><label>Cap Room</label><div class="value">${shortMoney(DATA.cap - sal)}</div><small>${money(sal)} committed</small></div><div class="card kpi"><label>Team Grade</label><div class="value">${teamLetter(talent)}</div><small>${talent || 0} current talent · ${pot || 0} upside</small></div><div class="card kpi"><label>Build Identity</label><div class="value">${balance.identity}</div><small>${balance.note}</small></div></div>`;
}
function dashboard() {
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Owner Briefing</h3><span>visible systems, not placeholder text</span></div><div class="cardPad"><div class="layout3"><div><h3>${S.team.city} ${S.team.nickname}</h3><p class="muted">${S.team.arena}. You are building a one-season expansion roster under a simplified cap while protecting future optionality.</p><button class="btn" data-tab="draft">Open Draft Room</button></div><div class="impact">${impactBars()}</div><div class="log">${nextGameBrief()}${S.objectives.map((o) => `<div class="logItem"><span class="pill ${o.done ? "good" : "warn"}">${o.done ? "Complete" : "Open"}</span><div style="margin-top:8px;font-weight:800">${o.text}</div></div>`).join("")}</div></div></div></section><section class="card"><div class="sectionTitle"><h3>Front Office Feed</h3><span>${S.log.length} events</span></div><div class="cardPad log">${
    S.log
      .slice(0, 8)
      .map(
        (l) =>
          `<div class="logItem"><b>${l.title}</b><p class="muted">${l.body}</p><small>${l.when}</small></div>`,
      )
      .join("") ||
    '<div class="empty">No moves yet. Draft someone, waive someone, or attempt a trade.</div>'
  }</div></section></div><div class="layout2" style="margin-top:18px"><section class="card"><div class="sectionTitle"><h3>Current Rotation</h3><span>hidden ratings summarized as roles</span></div>${rosterTable(
    S.roster
      .slice()
      .sort((a, b) => composite(b) - composite(a))
      .slice(0, 8),
  )}</section><section class="card"><div class="sectionTitle"><h3>League Pressure</h3><span>trade market</span></div><div class="cardPad">${leaguePressure()}</div></section></div>`;
}
function impactBars() {
  const r = teamRatings();
  return [
    "Scoring",
    "Shooting",
    "Playmaking",
    "Defense",
    "Rebounding",
    "Upside",
  ]
    .map(
      (k) =>
        `<div class="impactRow"><b>${k}</b><div class="bar"><i style="width:${r[k]}%"></i></div><span>${r[k]}</span></div>`,
    )
    .join("");
}
function teamRatings() {
  const rs = S.roster.map((p) => p.ratings);
  const get = (k) => avg(rs.map((r) => r[k]));
  return {
    Scoring: get("scoring"),
    Shooting: get("shooting"),
    Playmaking: get("playmaking"),
    Defense: get("defense"),
    Rebounding: get("rebounding"),
    Upside: get("potential"),
  };
}
function frontOfficeScore() {
  let score = 45;
  score += S.roster.length * 3;
  if (userSalary() <= DATA.cap) score += 15;
  score += S.objectives.filter((o) => o.done).length * 6;
  score += Math.max(0, S.picks.you - 2) * 3;
  score += Math.round(avg(S.roster.map((p) => p.ratings.potential)) / 10) || 0;
  return Math.min(99, score);
}
function frontOfficeNote() {
  if (S.roster.length < 6)
    return "Ownership wants visible roster progress. The draft room is the fastest path to credibility.";
  if (userSalary() > DATA.cap)
    return "Cap room is the immediate problem. Waive salary or trade down.";
  if (S.objectives.every((o) => o.done))
    return "Opening-night requirements are met. Now optimize roles and trade value.";
  return "The foundation is forming, but the rotation still needs intentional balance.";
}
function rosterBalance() {
  const r = teamRatings();
  if (!S.roster.length)
    return { identity: "None", note: "Draft players to establish a style" };
  const pairs = Object.entries(r).sort((a, b) => b[1] - a[1]);
  return {
    identity: pairs[0][0],
    note: `Best area ${pairs[0][1]}, weakest ${pairs[pairs.length - 2][0]} ${pairs[pairs.length - 2][1]}`,
  };
}
function teamLetter(x) {
  if (!x) return "—";
  if (x >= 88) return "A+";
  if (x >= 82) return "A";
  if (x >= 76) return "B";
  if (x >= 70) return "C+";
  if (x >= 64) return "C";
  return "D";
}
function leaguePressure() {
  return S.teams
    .map((t) => {
      const need = teamNeed(t);
      const mood =
        t.status === "contender"
          ? "buying"
          : t.status === "rebuilding"
            ? "selling"
            : "selective";
      return `<div class="logItem"><b><span class="teamBadge" style="background:${t.primary}">${t.id}</span>${t.name}</b><p class="muted">Market posture: ${mood}. Biggest need: ${need}. Cap used: ${shortMoney(teamSalary(t))}.</p></div>`;
    })
    .join("");
}
function draft() {
  const pool = filteredDraftPool();
  return `${kpis()}<section class="card"><div class="sectionTitle"><h3>Available Expansion Pool</h3><span>protected stars are visible but locked unless acquired by trade</span></div><div class="filters"><input data-filter="q" placeholder="Search player/team/scouting" value="${draftFilters.q}"><select data-filter="pos"><option>ALL</option>${["G", "F", "C"].map((x) => `<option ${draftFilters.pos === x ? "selected" : ""}>${x}</option>`).join("")}</select><select data-filter="team"><option>ALL</option>${S.teams.map((t) => `<option value="${t.id}" ${draftFilters.team === t.id ? "selected" : ""}>${t.name}</option>`).join("")}</select><select data-filter="risk"><option value="ALL">All risk profiles</option><option ${draftFilters.risk === "upside" ? "selected" : ""} value="upside">Upside</option><option ${draftFilters.risk === "safe" ? "selected" : ""} value="safe">Safe veterans</option><option ${draftFilters.risk === "cheap" ? "selected" : ""} value="cheap">Cheap contracts</option></select></div><div class="board">${pool.map(playerDraftCard).join("") || '<div class="empty">No players match those filters.</div>'}</div></section>`;
}
function filteredDraftPool() {
  return allLeaguePlayers()
    .filter((p) => {
      const q = draftFilters.q.toLowerCase();
      if (
        q &&
        !(p.name + p.teamName + p.scouting + p.strengths + p.weaknesses)
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (draftFilters.pos !== "ALL" && !p.pos.includes(draftFilters.pos))
        return false;
      if (draftFilters.team !== "ALL" && p.team !== draftFilters.team)
        return false;
      if (draftFilters.risk === "upside" && p.ratings.potential < 80)
        return false;
      if (draftFilters.risk === "safe" && !(p.years <= 1 && p.ratings.iq > 78))
        return false;
      if (draftFilters.risk === "cheap" && p.salary > 500000) return false;
      return true;
    })
    .sort((a, b) => a.protected - b.protected || tradeValue(b) - tradeValue(a));
}
function playerDraftCard(p) {
  const disabled =
    p.protected ||
    S.roster.length >= DATA.expansionPickLimit ||
    userSalary() + p.salary > DATA.cap;
  return `<div class="playerCard">${portraitHtml(p)}<div><div><span class="playerName">${p.name}</span> <span class="pill">${p.pos}</span> <span class="pill" style="background:${p.teamObj.primary};color:white">${p.team}</span> ${p.protected ? '<span class="pill bad">Protected</span>' : ""}</div><div class="scout">${p.scouting}</div><div class="tags"><span class="tag">${visibleGrade(p)}</span><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${p.years} yr</span><span class="tag">Strength: ${p.strengths.split(",")[0]}</span><span class="tag">Concern: ${p.weaknesses.split(",")[0]}</span></div></div><div class="actions"><button class="btn secondary" data-view="${p.id}">Scout</button><button class="btn ${disabled ? "secondary" : ""}" ${disabled ? "disabled" : ""} data-draft="${p.id}">${p.protected ? "Locked" : userSalary() + p.salary > DATA.cap ? "No Cap" : "Draft"}</button></div></div>`;
}
function roster() {
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Cap Sheet</h3><span>${money(userSalary())} / ${money(DATA.cap)}</span></div>${rosterTable(S.roster)}</section><section class="card"><div class="sectionTitle"><h3>Roster Tools</h3><span>rotation control</span></div><div class="cardPad"><div class="impact">${impactBars()}</div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Position Balance</h3>${positionBalance()}<h3>Recommended Next Move</h3><p class="muted">${recommendation()}</p></div></section></div>`;
}
function rosterTable(players) {
  return `<table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Role</th><th>Salary</th><th>Contract</th><th></th></tr></thead><tbody>${players.map((p) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div><div class="playerName">${p.name}</div><div class="mini">${p.scouting.slice(0, 90)}...</div></div></div></td><td>${p.pos}</td><td><span class="pill">${visibleGrade(p)}</span></td><td>${shortMoney(p.salary)}</td><td>${p.years} yr</td><td><button class="btn secondary" data-view="${p.id}">Scout</button> ${S.roster.find((x) => x.id === p.id) ? `<button class="btn danger" data-waive="${p.id}">Waive</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6"><div class="empty">No players yet.</div></td></tr>`}</tbody></table>`;
}
function positionBalance() {
  return ["G", "F", "C"]
    .map((pos) => {
      const c = S.roster.filter((p) => p.pos.includes(pos)).length;
      return `<div class="meter"><span>${pos} depth</span><div class="bar"><i style="width:${Math.min(100, c * 28)}%"></i></div><b>${c}</b></div>`;
    })
    .join("");
}
function recommendation() {
  if (S.roster.length < DATA.rosterMin)
    return `Draft ${DATA.rosterMin - S.roster.length} more player(s), prioritizing playable guards and one defensive big.`;
  if (userSalary() > DATA.cap)
    return "You are over the cap. Waive a fringe salary or trade a veteran for a cheaper prospect.";
  const r = teamRatings();
  const low = Object.entries(r).sort((a, b) => a[1] - b[1])[0];
  return `Roster is legal. Improve ${low[0].toLowerCase()} before opening night.`;
}
function trades() {
  const other = S.teams.find((t) => t.id === trade.team) || S.teams[0];
  const evaln = evaluateTrade(other);
  return `${kpis()}<section class="card"><div class="sectionTitle"><h3>Trade Machine</h3><span>salary, value, team need, protected-player logic</span></div><div class="cardPad"><div class="field"><label>Trade partner</label><select data-trade-team>${S.teams.map((t) => `<option value="${t.id}" ${trade.team === t.id ? "selected" : ""}>${t.name} · ${t.status}</option>`).join("")}</select></div><div class="tradeBox"><div class="tradePanel"><div class="sectionTitle"><h3>${S.team.nickname} sends</h3><span>${shortMoney(sumSelected(S.roster, trade.userGive))}</span></div><div class="tradeList">${S.roster.map((p) => checkRow(p, "userGive")).join("") || '<div class="empty">No roster players to trade.</div>'}</div><div class="cardPad"><label><input type="checkbox" data-pick="user" ${trade.userPick ? "checked" : ""}> Include your future 1st-round pick</label></div></div><div class="tradePanel"><div class="sectionTitle"><h3>${other.name} sends</h3><span>${shortMoney(sumSelected(other.players, trade.otherGive))}</span></div><div class="tradeList">${other.players.map((p) => checkRow(p, "otherGive")).join("")}</div><div class="cardPad"><label><input type="checkbox" data-pick="other" ${trade.otherPick ? "checked" : ""}> Request their future 2nd-round pick</label></div></div></div><div class="layout2" style="margin-top:18px"><div class="logItem"><b>Trade Verdict: <span class="pill ${evaln.ok ? "good" : "warn"}">${evaln.label}</span></b><p class="muted">${evaln.reason}</p><div class="meter"><span>Your outgoing value</span><div class="bar"><i style="width:${Math.min(100, evaln.userValue / 20)}%"></i></div><b>${evaln.userValue}</b></div><div class="meter"><span>Partner outgoing value</span><div class="bar"><i style="width:${Math.min(100, evaln.otherValue / 20)}%"></i></div><b>${evaln.otherValue}</b></div></div><div class="actions"><button class="btn" data-action="submitTrade" ${evaln.ok ? "" : "disabled"}>Submit Trade</button><button class="btn secondary" data-action="clearTrade">Clear Selections</button></div></div></div></section>`;
}
function checkRow(p, side) {
  const checked = trade[side].includes(p.id);
  return `<label class="checkRow"><input type="checkbox" data-trade-side="${side}" value="${p.id}" ${checked ? "checked" : ""}>${portraitHtml(p, "sm")}<div><b>${p.name}</b> <span class="pill">${p.pos}</span> ${p.protected ? '<span class="pill bad">protected cost</span>' : ""}<div class="mini">${visibleGrade(p)} · ${shortMoney(p.salary)} · ${p.scouting.slice(0, 76)}...</div></div></label>`;
}
function sumSelected(players, ids) {
  return players
    .filter((p) => ids.includes(p.id))
    .reduce((a, p) => a + p.salary, 0);
}
function selectedValue(players, ids) {
  return players
    .filter((p) => ids.includes(p.id))
    .reduce((a, p) => a + tradeValue(p), 0);
}
function evaluateTrade(other) {
  const uPlayers = S.roster.filter((p) => trade.userGive.includes(p.id));
  const oPlayers = other.players.filter((p) => trade.otherGive.includes(p.id));
  if (!uPlayers.length && !oPlayers.length)
    return {
      ok: false,
      label: "No Deal",
      reason: "Select players or picks on both sides.",
      userValue: 0,
      otherValue: 0,
    };
  let userValue =
    selectedValue(S.roster, trade.userGive) + (trade.userPick ? 420 : 0);
  let otherValue =
    selectedValue(other.players, trade.otherGive) + (trade.otherPick ? 160 : 0);
  const salaryIn = sumSelected(other.players, trade.otherGive),
    salaryOut = sumSelected(S.roster, trade.userGive);
  const futureSalary = userSalary() - salaryOut + salaryIn;
  let reasons = [];
  let ok = true;
  if (futureSalary > DATA.cap) {
    ok = false;
    reasons.push("Your post-trade roster would exceed the simplified cap.");
  }
  if (S.roster.length - uPlayers.length + oPlayers.length > DATA.rosterMax) {
    ok = false;
    reasons.push("Your roster would exceed the maximum roster size.");
  }
  const protectedCount = oPlayers.filter((p) => p.protected).length;
  if (protectedCount && userValue < otherValue * 1.25) {
    ok = false;
    reasons.push("Protected/core players require a serious overpay.");
  }
  const partnerNeed = teamNeed(other);
  if (uPlayers.some((p) => p.pos.includes(partnerNeed))) userValue += 120;
  const ratio = userValue / (otherValue || 1);
  if (ratio < 0.92) {
    ok = false;
    reasons.push(`${other.name} believes the offer is light.`);
  }
  if (!ok)
    return {
      ok: false,
      label: "Rejected",
      reason: reasons.join(" "),
      userValue,
      otherValue,
    };
  if (ratio > 1.35)
    return {
      ok: true,
      label: "Likely Accepted",
      reason: `${other.name} likes the value, though your scouts warn you may be overpaying.`,
      userValue,
      otherValue,
    };
  return {
    ok: true,
    label: "Negotiable",
    reason: `The deal is close enough to submit. Team need, salary and value are within acceptable bands.`,
    userValue,
    otherValue,
  };
}
function teamNeed(t) {
  const counts = { G: 0, F: 0, C: 0 };
  t.players.forEach((p) => {
    if (p.pos.includes("G")) counts.G++;
    if (p.pos.includes("F")) counts.F++;
    if (p.pos.includes("C")) counts.C++;
  });
  return Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
}
function waivers() {
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Free Agents & Waivers</h3><span>cheap depth and regret board</span></div><div class="board">${waiverPool()
    .map(
      (p) =>
        `<div class="playerCard">${portraitHtml(p)}<div><span class="playerName">${p.name}</span> <span class="pill">${p.pos}</span><div class="scout">${p.scouting}</div><div class="tags"><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${visibleGrade(p)}</span><span class="tag">${p.strengths.split(",")[0]}</span></div></div><button class="btn" data-sign="${p.id}">${userSalary() + p.salary > DATA.cap ? "No Cap" : "Sign"}</button></div>`,
    )
    .join(
      "",
    )}</div></section><section class="card"><div class="sectionTitle"><h3>Your Waived Players</h3><span>${S.waived.length}</span></div><div class="board">${S.waived.map((p) => `<div class="playerCard">${portraitHtml(p, "sm")}<div><b>${p.name}</b><div class="mini">${p.pos} · ${shortMoney(p.salary)}</div></div><button class="btn secondary" data-sign="${p.id}">Re-sign</button></div>`).join("") || '<div class="empty">No waived players yet.</div>'}</div></section></div>`;
}
function waiverPool() {
  const base = [
    p(
      "Morgan Tuck",
      "F",
      "FA",
      290000,
      1,
      "Veteran practice-culture forward who can help young frontcourt players learn the league.",
      "IQ, leadership, positional defense",
      "Limited athletic ceiling",
      false,
      50,
      46,
      52,
      58,
      56,
      35,
      82,
      45,
      "veteran",
    ),
    p(
      "Destiny Slocum",
      "G",
      "FA",
      300000,
      1,
      "Depth guard with handle and scoring confidence.",
      "Handle, pull-up confidence, pace",
      "Efficiency, defense",
      false,
      58,
      60,
      59,
      48,
      34,
      67,
      61,
      58,
      "depth",
    ),
    p(
      "Charli Collier",
      "C",
      "FA",
      320000,
      1,
      "Former high pick with size and rebound upside as a buy-low big.",
      "Size, boards, touch flashes",
      "Speed, consistency",
      false,
      55,
      30,
      38,
      54,
      70,
      42,
      55,
      61,
      "big",
    ),
    p(
      "Rae Burrell",
      "G/F",
      "FA",
      310000,
      1,
      "Athletic wing flyer who can defend bench scorers.",
      "Athleticism, wing size, transition",
      "Shooting consistency, reads",
      false,
      56,
      55,
      44,
      61,
      47,
      74,
      54,
      64,
      "wing",
    ),
    p(
      "Crystal Dangerfield",
      "G",
      "FA",
      340000,
      1,
      "Small point guard who can stabilize second units.",
      "Handle, passing, experience",
      "Size, defense",
      false,
      58,
      58,
      70,
      48,
      32,
      70,
      77,
      56,
      "engine",
    ),
  ];
  return base
    .concat(S.waived)
    .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);
}
function league() {
  return `<div class="layout3">${S.teams
    .map(
      (t) =>
        `<section class="card"><div class="sectionTitle"><h3><span class="teamBadge" style="background:${t.primary}">${t.id}</span>${t.name}</h3><span>${t.status}</span></div><div class="cardPad"><div class="meter"><span>Roster</span><div class="bar"><i style="width:${Math.min(100, t.players.length * 8)}%"></i></div><b>${t.players.length}</b></div><div class="meter"><span>Payroll</span><div class="bar"><i style="width:${Math.min(100, (teamSalary(t) / DATA.cap) * 100)}%"></i></div><b>${shortMoney(teamSalary(t))}</b></div><p class="muted">Need: ${teamNeed(t)} · Core: ${
          t.players
            .filter((p) => p.protected)
            .map((p) => p.name.split(" ").slice(-1)[0])
            .join(", ") || "none"
        }</p><button class="btn secondary" data-teamview="${t.id}">Open Roster</button></div></section>`,
    )
    .join("")}</div>`;
}

function ensureSeason(force = false) {
  if (!S.started) return;
  if (!S.season || force) {
    S.season = {
      currentGameIndex: 0,
      schedule: generateSchedule(),
      records: {},
      results: [],
    };
  }
  leagueIds().forEach((id) => {
    if (!S.season.records[id])
      S.season.records[id] = { w: 0, l: 0, pf: 0, pa: 0, streak: "—" };
  });
}
function leagueIds() {
  return [S.team.abbr, ...S.teams.map((t) => t.id)];
}
function teamMeta(id) {
  if (id === S.team.abbr)
    return {
      id,
      name: `${S.team.city} ${S.team.nickname}`,
      primary: S.team.primary,
      players: S.roster,
    };
  const t = S.teams.find((x) => x.id === id);
  return { id, name: t.name, primary: t.primary, players: t.players };
}
function seasonRecord(id) {
  ensureSeason();
  return S.season.records[id] || { w: 0, l: 0, pf: 0, pa: 0, streak: "—" };
}
function generateSchedule() {
  const ids = leagueIds();
  const games = [];
  let n = 1;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i],
        b = ids[j];
      games.push({
        id: "G" + n++,
        week: 1 + ((n * 3 + i + j) % 16),
        home: a,
        away: b,
        played: false,
      });
      games.push({
        id: "G" + n++,
        week: 1 + ((n * 5 + i + j) % 16),
        home: b,
        away: a,
        played: false,
      });
    }
  const userOpp = ids.filter((x) => x !== S.team.abbr).slice(0, 8);
  userOpp.forEach((opp, k) =>
    games.push({
      id: "G" + n++,
      week: 1 + ((k * 2) % 16),
      home: k % 2 ? S.team.abbr : opp,
      away: k % 2 ? opp : S.team.abbr,
      played: false,
      showcase: true,
    }),
  );
  return games.sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}
function teamPower(id) {
  const meta = teamMeta(id);
  const players = meta.players
    .slice()
    .sort((a, b) => composite(b) - composite(a));
  if (!players.length)
    return {
      overall: 55,
      off: 55,
      def: 55,
      reb: 55,
      pace: 55,
      perO: 55,
      perD: 55,
      intO: 55,
      intD: 55,
      depth: 0,
    };
  const top = players.slice(0, 8);
  // Heavier top-player weighting: top 3 carry ~63% of the team rating,
  // so star concentration matters more than bench depth.
  const W = [2.0, 1.5, 1.2, 1.0, 0.8, 0.5, 0.4, 0.3];
  const w = top.map((_, i) => W[i] ?? 0.3);
  const wSum = w.reduce((a, b) => a + b, 0);
  // Fatigue multiplier: 0 fatigue = 1.0x, 100 fatigue = 0.5x output.
  const fmult = (p) => 1 - (p.fatigue || 0) / 200;
  const wavg = (k) =>
    Math.round(
      top.reduce((s, p, i) => s + p.ratings[k] * w[i] * fmult(p), 0) / wSum,
    );
  // Position-aware defensive share: guards defend the perimeter, bigs the paint.
  const defShare = (p) => {
    if (p.pos.includes("G")) return { per: 0.75, int: 0.25 };
    if (p.pos.includes("C")) return { per: 0.2, int: 0.8 };
    return { per: 0.5, int: 0.5 };
  };
  const posWeighted = (k, side) => {
    const num = top.reduce(
      (s, p, i) => s + p.ratings[k] * w[i] * defShare(p)[side] * fmult(p),
      0,
    );
    const den = top.reduce((s, p, i) => s + w[i] * defShare(p)[side], 0);
    return den ? Math.round(num / den) : 60;
  };
  const perO = Math.round(
    wavg("shooting") * 0.5 + wavg("playmaking") * 0.3 + wavg("iq") * 0.2,
  );
  const intO = Math.round(
    wavg("scoring") * 0.45 +
      wavg("rebounding") * 0.2 +
      wavg("athleticism") * 0.35,
  );
  const perD = Math.round(
    posWeighted("defense", "per") * 0.55 +
      posWeighted("athleticism", "per") * 0.25 +
      wavg("iq") * 0.2,
  );
  const intD = Math.round(
    posWeighted("defense", "int") * 0.5 +
      wavg("rebounding") * 0.3 +
      posWeighted("athleticism", "int") * 0.2,
  );
  const off = Math.round((perO + intO) / 2);
  const def = Math.round((perD + intD) / 2);
  const reb = wavg("rebounding");
  return {
    overall: Math.round(off * 0.45 + def * 0.4 + reb * 0.15),
    off,
    def,
    reb,
    pace: wavg("athleticism"),
    perO,
    perD,
    intO,
    intD,
    depth: meta.players.length,
  };
}
function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function simScore(home, away, game) {
  const hp = teamPower(home),
    ap = teamPower(away);
  // Coaching modifiers when user team is in this game.
  const mod = {
    h: { perO: 0, perD: 0, intO: 0, intD: 0 },
    a: { perO: 0, perD: 0, intO: 0, intD: 0 },
  };
  const userIs = home === S.team.abbr ? "h" : away === S.team.abbr ? "a" : null;
  if (userIs && S.coaching) {
    const m = mod[userIs];
    const f = S.coaching.weeklyFocus;
    if (f === "perO") m.perO += 2;
    else if (f === "perD") m.perD += 2;
    else if (f === "intO") m.intO += 2;
    else if (f === "intD") m.intD += 2;
    else if (f === "film") {
      m.perO += 1;
      m.perD += 1;
      m.intO += 1;
      m.intD += 1;
    }
    const gp = game && S.coaching.gamePlans && S.coaching.gamePlans[game.id];
    if (gp) {
      if (gp.scouted) {
        m.perD += 1;
        m.intD += 1;
      }
      if (gp.plan === "pack") {
        m.intD += 3;
        m.perD -= 1;
      } else if (gp.plan === "extend") {
        m.perD += 3;
        m.intD -= 1;
      }
    }
  }
  const hPerO = hp.perO + mod.h.perO;
  const hPerD = hp.perD + mod.h.perD;
  const hIntO = hp.intO + mod.h.intO;
  const hIntD = hp.intD + mod.h.intD;
  const aPerO = ap.perO + mod.a.perO;
  const aPerD = ap.perD + mod.a.perD;
  const aIntO = ap.intO + mod.a.intO;
  const aIntD = ap.intD + mod.a.intD;
  // Two head-to-head channels: perimeter scoring vs perimeter D, interior vs interior.
  const hPer = 38 + (hPerO - aPerD) * 0.45;
  const aPer = 37 + (aPerO - hPerD) * 0.45;
  const hInt = 38 + (hIntO - aIntD) * 0.45;
  const aInt = 37 + (aIntO - hIntD) * 0.45;
  const hRebEdge = (hp.reb - ap.reb) * 0.1;
  const aRebEdge = (ap.reb - hp.reb) * 0.1;
  // Roster-depth penalty: thin benches add late-game variance.
  const hThin = Math.max(0, 10 - hp.depth);
  const aThin = Math.max(0, 10 - ap.depth);
  const hBase = hPer + hInt + hRebEdge + 2.2; // 2.2 = home court
  const aBase = aPer + aInt + aRebEdge;
  let hs = Math.max(58, Math.round(hBase + rand(-7 - hThin, 8 + hThin)));
  let as = Math.max(55, Math.round(aBase + rand(-7 - aThin, 8 + aThin)));
  if (hs === as) hs += rand(1, 5);
  return { hs, as, hp, ap };
}
// Dev helper: run N seasons over the current schedule and print win-rate by team.
window.simTest = function (seasons = 20) {
  if (!S.season || !S.season.schedule)
    return console.log("Start a season first.");
  const ids = S.teams.map((t) => t.id);
  const wins = Object.fromEntries(ids.map((i) => [i, 0]));
  const games = Object.fromEntries(ids.map((i) => [i, 0]));
  const sched = S.season.schedule.map((g) => ({ home: g.home, away: g.away }));
  for (let s = 0; s < seasons; s++) {
    for (const g of sched) {
      const r = simScore(g.home, g.away);
      const winner = r.hs > r.as ? g.home : g.away;
      wins[winner]++;
      games[g.home]++;
      games[g.away]++;
    }
  }
  const rows = ids
    .map((id) => {
      const tp = teamPower(id);
      return {
        id,
        name: teamMeta(id).name,
        ovr: tp.overall,
        perO: tp.perO,
        perD: tp.perD,
        intO: tp.intO,
        intD: tp.intD,
        record: `${wins[id]}-${games[id] - wins[id]}`,
        pct: games[id] ? ((wins[id] / games[id]) * 100).toFixed(1) + "%" : "0%",
      };
    })
    .sort((a, b) => b.ovr - a.ovr);
  console.table(rows);
  return rows;
};
function topPerformers(id, ptsFor) {
  const players = teamMeta(id)
    .players.slice()
    .sort((a, b) => tradeValue(b) - tradeValue(a))
    .slice(0, 7);
  if (!players.length) return [];
  const out = [];
  let remaining = Math.max(40, ptsFor);
  players.slice(0, 3).forEach((p, i) => {
    const pts = i === 0 ? rand(16, 28) : i === 1 ? rand(11, 21) : rand(7, 16);
    remaining -= pts;
    out.push({
      name: p.name,
      pos: p.pos,
      pts,
      reb: rand(p.pos.includes("C") ? 5 : 2, p.pos.includes("G") ? 7 : 11),
      ast: rand(p.pos.includes("G") ? 4 : 1, p.pos.includes("C") ? 4 : 8),
    });
  });
  return out;
}
function simulateGame(g) {
  if (!g || g.played) return;
  const r = simScore(g.home, g.away, g);
  // Fatigue accumulates for top-8 rotation on both teams.
  const wear = (id) => {
    const players = teamMeta(id)
      .players.slice()
      .sort((a, b) => composite(b) - composite(a))
      .slice(0, 8);
    players.forEach((p) => {
      p.fatigue = Math.min(100, (p.fatigue || 0) + rand(5, 10));
    });
  };
  wear(g.home);
  wear(g.away);
  Object.assign(g, {
    played: true,
    homeScore: r.hs,
    awayScore: r.as,
    winner: r.hs > r.as ? g.home : g.away,
    box: {
      home: topPerformers(g.home, r.hs),
      away: topPerformers(g.away, r.as),
    },
  });
  [g.home, g.away].forEach((id) => {
    const rec = seasonRecord(id);
    const pf = id === g.home ? r.hs : r.as,
      pa = id === g.home ? r.as : r.hs;
    rec.pf += pf;
    rec.pa += pa;
    if (id === g.winner) {
      rec.w++;
      rec.streak =
        rec.streak && rec.streak.startsWith("W")
          ? "W" + (parseInt(rec.streak.slice(1) || "1") + 1)
          : "W1";
    } else {
      rec.l++;
      rec.streak =
        rec.streak && rec.streak.startsWith("L")
          ? "L" + (parseInt(rec.streak.slice(1) || "1") + 1)
          : "L1";
    }
  });
  S.season.results.unshift(g.id);
  addLog(
    g.home === S.team.abbr || g.away === S.team.abbr
      ? "Game final"
      : "League final",
    `${teamMeta(g.away).name} ${g.awayScore}, ${teamMeta(g.home).name} ${g.homeScore}. ${teamMeta(g.winner).name} win.`,
  );
  if (g.home === S.team.abbr || g.away === S.team.abbr) maybeTriggerPress(g);
}
function nextUnplayed() {
  return S.season.schedule.find((g) => !g.played);
}
function nextUserGame() {
  if (!S.season) return null;
  return S.season.schedule.find(
    (g) => !g.played && (g.home === S.team.abbr || g.away === S.team.abbr),
  );
}
// Fast-forward all NPC games chronologically up to (but not including) the user's next game,
// then queue the user's game in S.gameDay so the Game Day view appears.
function simNextGame() {
  ensureSeason();
  const mine = nextUserGame();
  if (!mine) {
    // No user game left — sim any remaining NPC games sequentially.
    const g = nextUnplayed();
    if (!g) return toast("Season complete.");
    simulateGame(g);
    S.week = Math.max(S.week, g.week);
    save();
    return render();
  }
  // Auto-bracket: sim every unplayed NPC game scheduled before mine (by week, then position).
  const mineIdx = S.season.schedule.indexOf(mine);
  S.season.schedule.forEach((g, i) => {
    if (g.played) return;
    if (i >= mineIdx) return;
    if (g.home === S.team.abbr || g.away === S.team.abbr) return; // safety
    simulateGame(g);
  });
  S.week = Math.max(S.week, mine.week);
  S.gameDay = { gameId: mine.id };
  save();
  render();
}
function playQueuedGame() {
  if (!S.gameDay) return;
  const g = S.season.schedule.find((x) => x.id === S.gameDay.gameId);
  if (!g) {
    S.gameDay = null;
    save();
    return render();
  }
  simulateGame(g);
  S.gameDay = null;
  save();
  render();
}
function closeGameDay() {
  S.gameDay = null;
  save();
  render();
}
function simWeek() {
  ensureSeason();
  const g = nextUnplayed();
  if (!g) return toast("Season complete.");
  const week = g.week;
  S.season.schedule
    .filter((x) => !x.played && x.week === week)
    .forEach(simulateGame);
  S.week = Math.max(S.week, week + 1);
  render();
}
function simSeason() {
  ensureSeason();
  S.season.schedule.filter((x) => !x.played).forEach(simulateGame);
  S.week = 17;
  render();
}
function nextGameBrief() {
  const g = nextUnplayed();
  if (!g)
    return `<div class="logItem"><b>Season complete</b><p class="muted">All scheduled games have been simulated. Review standings and recent finals in Season Command.</p></div>`;
  return `<div class="logItem"><b>Next Game · Week ${g.week}</b><p class="muted">${teamMeta(g.away).name} at ${teamMeta(g.home).name}. ${g.home === S.team.abbr || g.away === S.team.abbr ? "Your rotation, cap choices and roster balance feed the sim engine." : "League game will update standings."}</p><button class="btn secondary" data-tab="schedule">Open Season Command</button></div>`;
}
function standingsRows() {
  return leagueIds()
    .map((id) => {
      const r = seasonRecord(id);
      return {
        id,
        ...r,
        pct: r.w + r.l ? r.w / (r.w + r.l) : 0,
        diff:
          r.w + r.l ? Math.round(((r.pf - r.pa) / (r.w + r.l)) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct || b.diff - a.diff);
}
function schedulePage() {
  ensureSeason();
  const userRec = seasonRecord(S.team.abbr);
  const myGames = userUpcomingGames(8);
  const next = myGames[0];
  const allDone = S.season.schedule.every((g) => g.played);
  const offseasonBtn = allDone
    ? '<button class="btn" data-action="enterOffseason">Advance to Offseason →</button>'
    : "";
  const heroBlock = next
    ? nextGameHero(next)
    : `<section class="card"><div class="cardPad"><h3>Season complete</h3><p class="muted">All games played. Move on to the offseason.</p>${offseasonBtn}</div></section>`;
  const remaining = myGames.slice(1);
  const myList = remaining.length
    ? remaining.map(myGameCard).join("")
    : '<div class="empty">No more games on your schedule.</div>';
  const bulkSimBtns = allDone
    ? offseasonBtn +
      '<button class="btn ghost" data-action="regenSchedule">Regenerate Schedule</button>'
    : `<button class="btn secondary" data-action="simWeek">Sim Current Week</button><button class="btn secondary" data-action="simSeason">Sim Rest of Season</button><button class="btn ghost" data-action="regenSchedule">Regenerate Schedule</button>`;
  return `${seasonKpis()}${heroBlock}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>My Upcoming Games</h3><span>${myGames.length} game(s) remaining</span></div><div class="cardPad log">${myList}</div></section><section class="card"><div class="sectionTitle"><h3>Standings</h3><span>You: ${userRec.w}-${userRec.l}</span></div>${standingsTable()}</section></div><section class="card" style="margin-top:18px"><div class="sectionTitle"><h3>League Schedule</h3><span>${S.season.schedule.filter((g) => g.played).length}/${S.season.schedule.length} games final</span></div><div class="cardPad actions">${bulkSimBtns}</div><details><summary class="cardPad" style="cursor:pointer;font-weight:800;border-top:1px solid var(--line)">Show full league schedule</summary><div class="scheduleList">${S.season.schedule.map(gameRow).join("")}</div></details></section><section class="card" style="margin-top:18px"><div class="sectionTitle"><h3>Recent Finals</h3><span>box-score summaries</span></div><div class="cardPad log">${recentResults()}</div></section>`;
}
function nextGameHero(g) {
  const isHome = g.home === S.team.abbr;
  const oppId = isHome ? g.away : g.home;
  const opp = teamMeta(oppId);
  const oppRec = seasonRecord(oppId);
  const oppPower = teamPower(oppId);
  const gp = (S.coaching.gamePlans && S.coaching.gamePlans[g.id]) || {
    scouted: false,
    plan: null,
  };
  const focusLabel = currentFocusLabel();
  const scoutBlock = gp.scouted
    ? `<div class="impact" style="margin-top:10px"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><p class="muted" style="margin-top:8px">${oppPower.intO > oppPower.perO ? "Interior-heavy attack. Pack the Paint covers their best lane." : "Perimeter-driven offense. Extend Defense closes their shooters."}</p>`
    : `<div style="margin-top:10px"><button class="btn secondary" data-scout="${g.id}">Scout Opponent</button></div>`;
  const planBlock = gp.scouted
    ? `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear plan</button>` : ""}</div>`
    : "";
  return `<section class="card" style="margin-bottom:18px"><div class="sectionTitle"><h3>Next Game · Week ${g.week} · ${isHome ? "vs" : "at"} ${opp.name}</h3><span>${opp.id} ${oppRec.w}-${oppRec.l}</span></div><div class="cardPad"><div class="layout2"><div><h3 style="margin:0">${isHome ? "Home" : "Road"} · ${opp.name}</h3><p class="muted">Plan: <b>${gp.plan === "pack" ? "Pack the Paint" : gp.plan === "extend" ? "Extend Defense" : "Not set"}</b> · Weekly focus: <b>${focusLabel}</b></p>${scoutBlock}${planBlock}</div><div class="actions" style="justify-content:flex-end;align-items:flex-end;flex-direction:column;gap:10px"><button class="btn" data-action="simNext" style="font-size:15px;padding:14px 18px">Game Day →</button><button class="btn secondary" data-action="simWeek">Sim Current Week (skip prep)</button></div></div></div></section>`;
}
function myGameCard(g) {
  const isHome = g.home === S.team.abbr;
  const oppId = isHome ? g.away : g.home;
  const opp = teamMeta(oppId);
  const oppRec = seasonRecord(oppId);
  const gp = (S.coaching.gamePlans && S.coaching.gamePlans[g.id]) || {
    scouted: false,
    plan: null,
  };
  return `<div class="logItem"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>Week ${g.week} · ${isHome ? "vs" : "at"} <span class="teamBadge" style="background:${opp.primary}">${oppId}</span> ${opp.name}</b><span class="pill">${oppRec.w}-${oppRec.l}</span></div><div class="mini" style="margin-top:6px">${gp.scouted ? "Scouted" : "Unscouted"} · Plan: ${gp.plan === "pack" ? "Pack" : gp.plan === "extend" ? "Extend" : "—"}</div><div class="actions" style="margin-top:8px">${gp.scouted ? "" : `<button class="btn secondary" data-scout="${g.id}">Scout</button>`}<button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend</button></div></div>`;
}
function currentFocusLabel() {
  const f = (FOCUS_OPTIONS || []).find((o) => o.id === S.coaching.weeklyFocus);
  return f ? f.label : "—";
}
function gameDayView() {
  if (!S.gameDay) return `<div class="empty">No game queued.</div>`;
  const g = S.season.schedule.find((x) => x.id === S.gameDay.gameId);
  if (!g) {
    S.gameDay = null;
    return `<div class="empty">Game not found. <button class="btn secondary" data-action="closeGameDay">Back</button></div>`;
  }
  const isHome = g.home === S.team.abbr;
  const oppId = isHome ? g.away : g.home;
  const opp = teamMeta(oppId);
  const oppRec = seasonRecord(oppId);
  const oppPower = teamPower(oppId);
  const myPower = teamPower(S.team.abbr);
  const gp = (S.coaching.gamePlans && S.coaching.gamePlans[g.id]) || {
    scouted: false,
    plan: null,
  };
  const topRotation = S.roster
    .slice()
    .sort((a, b) => composite(b) - composite(a))
    .slice(0, 8);
  const fatigueAvg = topRotation.length
    ? Math.round(
        topRotation.reduce((s, p) => s + (p.fatigue || 0), 0) /
          topRotation.length,
      )
    : 0;
  const oppFocus = oppPower.intO > oppPower.perO ? "interior" : "perimeter";
  const recommendedPlan = oppPower.intO > oppPower.perO ? "pack" : "extend";
  const scoutBlock = gp.scouted
    ? `<div class="impact" style="margin-top:10px"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><p class="muted" style="margin-top:8px">Opponent leans <b>${oppFocus}</b>. Scouts recommend <b>${recommendedPlan === "pack" ? "Pack the Paint" : "Extend Defense"}</b>.</p>`
    : `<div style="margin-top:10px"><button class="btn" data-scout="${g.id}">Scout Opponent</button><p class="muted" style="margin-top:8px">Skipping the scout means flying blind. You can still set a plan, but you won't know which lane to defend.</p></div>`;
  const planBlock = `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear</button>` : ""}</div>`;
  const rotationTable = `<table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Fatigue</th><th>Mood</th></tr></thead><tbody>${topRotation.map((p) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div class="playerName">${p.name}</div></div></td><td>${p.pos}</td><td>${fatigueBadge(p)}</td><td>${p.mood || 60}</td></tr>`).join("")}</tbody></table>`;
  return `<section class="card"><div class="sectionTitle"><h3>Game Day · Week ${g.week} · ${isHome ? "vs" : "at"} ${opp.name}</h3><span>${opp.id} ${oppRec.w}-${oppRec.l}</span></div><div class="cardPad"><div class="layout2"><section><h3 style="margin-top:0">Opponent</h3><p class="muted">${opp.name} · ${oppRec.w}-${oppRec.l} · power index ${oppPower.overall}</p>${scoutBlock}<h3 style="margin-top:18px">Your Game Plan</h3>${planBlock}</section><section><h3 style="margin-top:0">Your Prep</h3><p class="muted">Weekly Focus: <b>${currentFocusLabel()}</b></p><p class="muted">Plan: <b>${gp.plan === "pack" ? "Pack the Paint" : gp.plan === "extend" ? "Extend Defense" : "Not set"}</b></p><p class="muted">Power Index: <b>${myPower.overall}</b> · Per ${myPower.perO}/${myPower.perD} · Int ${myPower.intO}/${myPower.intD}</p><p class="muted">Top-8 avg fatigue: <b>${fatigueAvg}</b></p></section></div><h3 style="margin-top:18px">Top-8 Rotation</h3>${rotationTable}<div class="actions" style="margin-top:18px"><button class="btn" data-action="playQueuedGame" style="font-size:15px;padding:14px 20px">Play Game →</button><button class="btn secondary" data-action="closeGameDay">Hold Off</button></div></div></section>`;
}
function seasonKpis() {
  const r = seasonRecord(S.team.abbr);
  const p = teamPower(S.team.abbr);
  const next = nextUnplayed();
  return `<div class="grid kpis"><div class="card kpi"><label>Record</label><div class="value">${r.w}-${r.l}</div><small>${r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0}% win rate</small></div><div class="card kpi"><label>Power Index</label><div class="value">${p.overall}</div><small>Per ${p.perO}/${p.perD} · Int ${p.intO}/${p.intD} · Reb ${p.reb}</small></div><div class="card kpi"><label>Next Game</label><div class="value">${next ? `W${next.week}` : "Done"}</div><small>${next ? `${teamMeta(next.away).id} at ${teamMeta(next.home).id}` : "Season complete"}</small></div><div class="card kpi"><label>Playoff Cut</label><div class="value">Top 8</div><small>${playoffStatus()}</small></div></div>`;
}
function playoffStatus() {
  const rows = standingsRows();
  const rank = rows.findIndex((r) => r.id === S.team.abbr) + 1;
  return rank <= 8
    ? `Currently ${rank}${ordinal(rank)} seed`
    : `Currently ${rank}${ordinal(rank)}, outside cut`;
}
function ordinal(n) {
  return n % 10 === 1 && n % 100 !== 11
    ? "st"
    : n % 10 === 2 && n % 100 !== 12
      ? "nd"
      : n % 10 === 3 && n % 100 !== 13
        ? "rd"
        : "th";
}
function gameRow(g) {
  const home = teamMeta(g.home),
    away = teamMeta(g.away);
  const user = g.home === S.team.abbr || g.away === S.team.abbr;
  return `<div class="gameRow ${g.played ? "played" : ""} ${user ? "userGame" : ""}"><div><b>Week ${g.week}</b><span class="mini">${g.showcase ? " · showcase matchup" : ""}</span></div><div><span class="teamBadge" style="background:${away.primary}">${away.id}</span>${away.name}</div><div class="scoreCell">${g.played ? g.awayScore : "—"}</div><div><span class="teamBadge" style="background:${home.primary}">${home.id}</span>${home.name}</div><div class="scoreCell">${g.played ? g.homeScore : "—"}</div><div>${g.played ? `<span class="pill ${g.winner === S.team.abbr ? "good" : ""}">${teamMeta(g.winner).id} win</span>` : '<span class="pill warn">upcoming</span>'}</div></div>`;
}
function standingsTable() {
  return `<table class="table"><thead><tr><th>Rank</th><th>Team</th><th>W-L</th><th>Pct</th><th>Diff</th><th>Streak</th></tr></thead><tbody>${standingsRows()
    .map(
      (r, i) =>
        `<tr class="${r.id === S.team.abbr ? "highlightRow" : ""}"><td>${i + 1}</td><td><span class="teamBadge" style="background:${teamMeta(r.id).primary}">${r.id}</span>${teamMeta(r.id).name}</td><td>${r.w}-${r.l}</td><td>${r.pct.toFixed(3)}</td><td>${r.diff > 0 ? "+" : ""}${r.diff}</td><td>${r.streak}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function recentResults() {
  const ids = S.season.results.slice(0, 6);
  if (!ids.length) return '<div class="empty">No games simulated yet.</div>';
  return ids
    .map((id) => {
      const g = S.season.schedule.find((x) => x.id === id);
      const top = [...(g.box?.away || []), ...(g.box?.home || [])].sort(
        (a, b) => b.pts - a.pts,
      )[0];
      return `<div class="logItem"><b>${teamMeta(g.away).id} ${g.awayScore} @ ${teamMeta(g.home).id} ${g.homeScore}</b><p class="muted">Winner: ${teamMeta(g.winner).name}. Top line: ${top?.name || "—"} · ${top?.pts || 0} pts, ${top?.reb || 0} reb, ${top?.ast || 0} ast.</p></div>`;
    })
    .join("");
}

function setupPage() {
  return `<div class="setup"><section class="hero"><div><h1>Build the next WNBA front office.</h1><p>Choose a market, name the expansion team, set the colors, then enter a live-feeling draft room with cap pressure, protected stars, hidden ratings, trades, waivers, and a real roster-building dashboard.</p></div><div><div class="previewJersey">${abbr(S.team.city, S.team.nickname)}</div><p class="mini">White/orange dashboard theme. Your selected colors drive team accents throughout the UI.</p></div></section><section class="card form"><h2>Expansion Setup</h2><div class="field"><label>Preset city</label><select id="citySelect">${DATA.expansionCities.map((c, i) => `<option value="${i}" ${S.team.city === c.city ? "selected" : ""}>${c.city} · suggested ${c.nickname}</option>`).join("")}</select></div><div class="tiles">${DATA.expansionCities.map((c, i) => `<div class="cityTile ${S.team.city === c.city ? "selected" : ""}" data-citytile="${i}"><strong>${c.city}</strong><small>Market ${c.market} · pressure ${c.pressure} · ${c.arena}</small></div>`).join("")}</div><br><div class="field"><label>Team nickname</label><input id="nickInput" value="${S.team.nickname}" placeholder="Foundry"></div><div class="field"><label>Arena</label><input id="arenaInput" value="${S.team.arena}"></div><div class="colorRow"><div class="field" style="flex:1"><label>Primary</label><input id="primaryInput" type="color" value="${S.team.primary}"></div><div class="field" style="flex:1"><label>Secondary</label><input id="secondaryInput" type="color" value="${S.team.secondary}"></div></div><div class="actions"><button class="btn" data-action="start">Enter Front Office</button><button class="btn secondary" data-action="randomize">Randomize Identity</button></div><p class="muted">Prototype includes 15 existing/franchise teams, expansion draft pool, trade engine, waivers, dashboard KPIs, scouting cards, hidden player ratings and local autosave.</p></section></div>`;
}
function abbr(city, nick) {
  return ((city || "").slice(0, 1) + (nick || "").slice(0, 2)).toUpperCase();
}
function modalHtml() {
  if (!modal) return "";
  if (modal.type === "player") {
    const p = findPlayer(modal.id);
    if (!p) return "";
    return `<div class="modalShade"><div class="modal"><div class="modalHeader"><div style="display:flex;gap:14px;align-items:center">${portraitHtml(p, "lg")}<h3>${p.name} <span class="pill">${p.pos}</span></h3></div><button class="close" data-close>Close</button></div><div class="modalBody"><p>${p.scouting}</p><div class="layout2"><div><h3>Strengths</h3><p class="muted">${p.strengths}</p><h3>Weaknesses</h3><p class="muted">${p.weaknesses}</p><h3>Contract</h3><p class="muted">${shortMoney(p.salary)} · ${p.years} year(s) · ${p.protected ? "protected/core asset" : "available/negotiable"}</p></div><div><h3>Scouting Department View</h3><p class="muted">Numerical ratings are intentionally hidden in normal play. This panel reveals directional grades only.</p>${["scoring", "shooting", "playmaking", "defense", "rebounding", "athleticism", "iq", "potential"].map((k) => gradeRow(k, p.ratings[k])).join("")}</div></div></div></div></div>`;
  }
  if (modal.type === "team") {
    const t = S.teams.find((x) => x.id === modal.id);
    return `<div class="modalShade"><div class="modal"><div class="modalHeader"><h3>${t.name}</h3><button class="close" data-close>Close</button></div><div class="modalBody">${rosterTable(t.players)}</div></div></div>`;
  }
  return "";
}
function gradeRow(k, v) {
  return `<div class="meter"><span>${k[0].toUpperCase() + k.slice(1)}</span><div class="bar"><i style="width:${v}%"></i></div><b>${v >= 90 ? "Elite" : v >= 80 ? "Plus" : v >= 70 ? "Solid" : v >= 60 ? "Playable" : "Risk"}</b></div>`;
}
function findPlayer(id) {
  return S.roster
    .concat(allLeaguePlayers())
    .concat(waiverPool())
    .find((p) => p.id === id);
}
function bind() {
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        render();
      }),
  );
  document
    .querySelectorAll("[data-action]")
    .forEach((b) => (b.onclick = () => actions(b.dataset.action)));
  document.querySelectorAll("[data-filter]").forEach(
    (el) =>
      (el.oninput = () => {
        draftFilters[el.dataset.filter] = el.value;
        render();
      }),
  );
  document.querySelectorAll("[data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        modal = { type: "player", id: b.dataset.view };
        render();
      }),
  );
  document.querySelectorAll("[data-teamview]").forEach(
    (b) =>
      (b.onclick = () => {
        modal = { type: "team", id: b.dataset.teamview };
        render();
      }),
  );
  document.querySelectorAll("[data-close]").forEach(
    (b) =>
      (b.onclick = () => {
        modal = null;
        render();
      }),
  );
  document
    .querySelectorAll("[data-draft]")
    .forEach((b) => (b.onclick = () => draftPlayer(b.dataset.draft)));
  document
    .querySelectorAll("[data-pick-rookie]")
    .forEach((b) => (b.onclick = () => userPickRookie(b.dataset.pickRookie)));
  document
    .querySelectorAll("[data-rm-rookie]")
    .forEach((b) => (b.onclick = () => removeCustomRookie(b.dataset.rmRookie)));
  document
    .querySelectorAll("[data-focus]")
    .forEach((b) => (b.onclick = () => setWeeklyFocus(b.dataset.focus)));
  document
    .querySelectorAll("[data-scout]")
    .forEach((b) => (b.onclick = () => scoutGame(b.dataset.scout)));
  document.querySelectorAll("[data-plan]").forEach(
    (b) =>
      (b.onclick = () => {
        const [gid, plan] = b.dataset.plan.split("|");
        setGamePlan(gid, plan === "none" ? null : plan);
      }),
  );
  document
    .querySelectorAll("[data-press]")
    .forEach((b) => (b.onclick = () => respondToPress(b.dataset.press)));
  document
    .querySelectorAll("[data-waive]")
    .forEach((b) => (b.onclick = () => waivePlayer(b.dataset.waive)));
  document
    .querySelectorAll("[data-sign]")
    .forEach((b) => (b.onclick = () => signPlayer(b.dataset.sign)));
  const city = document.getElementById("citySelect");
  if (city) city.onchange = () => applyCity(+city.value);
  document
    .querySelectorAll("[data-citytile]")
    .forEach((t) => (t.onclick = () => applyCity(+t.dataset.citytile)));
  ["nickInput", "arenaInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.oninput = () => {
        S.team.nickname = document.getElementById("nickInput").value;
        S.team.arena = document.getElementById("arenaInput").value;
        S.team.abbr = abbr(S.team.city, S.team.nickname);
        save();
      };
  });
  ["primaryInput", "secondaryInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.oninput = () => {
        S.team.primary = document.getElementById("primaryInput").value;
        S.team.secondary = document.getElementById("secondaryInput").value;
        document.documentElement.style.setProperty("--user1", S.team.primary);
        document.documentElement.style.setProperty("--user2", S.team.secondary);
        save();
      };
  });
  const tt = document.querySelector("[data-trade-team]");
  if (tt)
    tt.onchange = () => {
      trade.team = tt.value;
      trade.userGive = [];
      trade.otherGive = [];
      render();
    };
  document.querySelectorAll("[data-trade-side]").forEach(
    (cb) =>
      (cb.onchange = () => {
        const arr = trade[cb.dataset.tradeSide];
        cb.checked
          ? arr.push(cb.value)
          : (trade[cb.dataset.tradeSide] = arr.filter((x) => x !== cb.value));
        render();
      }),
  );
  document.querySelectorAll("[data-pick]").forEach(
    (cb) =>
      (cb.onchange = () => {
        trade[cb.dataset.pick === "user" ? "userPick" : "otherPick"] =
          cb.checked ? 1 : 0;
        render();
      }),
  );
}
function applyCity(i) {
  const c = DATA.expansionCities[i];
  S.team.city = c.city;
  S.team.nickname = c.nickname;
  S.team.arena = c.arena;
  S.team.abbr = abbr(c.city, c.nickname);
  render();
}
function actions(a) {
  if (a === "start") {
    S.started = true;
    S.team.abbr = abbr(S.team.city, S.team.nickname);
    S.season = null;
    addLog(
      "Franchise approved",
      `${S.team.city} ${S.team.nickname} begin expansion operations at ${S.team.arena}.`,
    );
    tab = "dashboard";
    render();
  }
  if (a === "randomize") {
    const i = Math.floor(Math.random() * DATA.expansionCities.length);
    applyCity(i);
  }
  if (a === "reset") {
    if (confirm("Start over and clear this save?")) {
      localStorage.removeItem(LS_KEY);
      S = freshState();
      tab = "setup";
      render();
    }
  }
  if (a === "advance") {
    S.week++;
    marketChurn();
    applyWeeklyTransition();
    addLog(
      "Week advanced",
      `Front office calendar moves to Week ${S.week}. Practice plan applied, fatigue recovered, development logged.`,
    );
    save();
    render();
  }
  if (a === "simNext") simNextGame();
  if (a === "simWeek") simWeek();
  if (a === "simSeason") simSeason();
  if (a === "regenSchedule") {
    if (
      confirm("Regenerate the season schedule and clear simulated results?")
    ) {
      S.season = null;
      ensureSeason(true);
      addLog(
        "Schedule regenerated",
        "League office issued a fresh expansion-season schedule.",
      );
      render();
    }
  }
  if (a === "clearTrade") {
    trade.userGive = [];
    trade.otherGive = [];
    trade.userPick = 0;
    trade.otherPick = 0;
    render();
  }
  if (a === "submitTrade") submitTrade();
  if (a === "enterOffseason") enterOffseason();
  if (a === "advanceToDraft") advanceToDraft();
  if (a === "startNextSeason") startNextSeason();
  if (a === "addCustomRookie") addCustomRookie();
  if (a === "commitDevFocus") {
    const pid = (document.getElementById("dev-player") || {}).value || null;
    const rk = (document.getElementById("dev-rating") || {}).value || "scoring";
    setDevFocus(pid || null, rk);
  }
  if (a === "playQueuedGame") playQueuedGame();
  if (a === "closeGameDay") closeGameDay();
}
function draftPlayer(id) {
  const team = S.teams.find((t) => t.players.some((p) => p.id === id));
  const p = team?.players.find((p) => p.id === id);
  if (!p) return;
  if (p.protected)
    return toast(
      "That player is protected. Use the trade desk if you want to chase a core asset.",
    );
  if (S.roster.length >= DATA.expansionPickLimit)
    return toast("Expansion draft limit reached.");
  if (userSalary() + p.salary > DATA.cap) return toast("Not enough cap room.");
  team.players = team.players.filter((x) => x.id !== id);
  p.team = S.team.abbr;
  S.roster.push(p);
  addLog(
    "Expansion pick submitted",
    `${S.team.nickname} selected ${p.name} from ${team.name}.`,
  );
  toast(`${p.name} drafted.`);
  render();
}
function waivePlayer(id) {
  const p = S.roster.find((x) => x.id === id);
  if (!p) return;
  S.roster = S.roster.filter((x) => x.id !== id);
  S.waived.push(p);
  addLog(
    "Player waived",
    `${p.name} was waived, clearing ${shortMoney(p.salary)} in cap.`,
  );
  render();
}
function signPlayer(id) {
  let p = waiverPool().find((x) => x.id === id);
  if (!p) return;
  if (S.roster.length >= DATA.rosterMax) return toast("Roster is full.");
  if (userSalary() + p.salary > DATA.cap) return toast("Not enough cap room.");
  S.waived = S.waived.filter((x) => x.id !== id);
  p.team = S.team.abbr;
  S.roster.push(p);
  addLog("Waiver signing", `${p.name} signed a one-year deal.`);
  render();
}
function submitTrade() {
  const other = S.teams.find((t) => t.id === trade.team);
  const ev = evaluateTrade(other);
  if (!ev.ok) return toast("Trade rejected.");
  const give = S.roster.filter((p) => trade.userGive.includes(p.id));
  const get = other.players.filter((p) => trade.otherGive.includes(p.id));
  S.roster = S.roster
    .filter((p) => !trade.userGive.includes(p.id))
    .concat(get.map((p) => ({ ...p, team: S.team.abbr, protected: false })));
  other.players = other.players
    .filter((p) => !trade.otherGive.includes(p.id))
    .concat(give.map((p) => ({ ...p, team: other.id, protected: false })));
  if (trade.userPick) {
    S.picks.you--;
    S.picks.league++;
  }
  if (trade.otherPick) {
    S.picks.you++;
    S.picks.league--;
  }
  addLog(
    "Trade completed",
    `${S.team.nickname} acquired ${get.map((p) => p.name).join(", ") || "pick assets"} from ${other.name}. Sent ${give.map((p) => p.name).join(", ") || "pick assets"}.`,
  );
  trade.userGive = [];
  trade.otherGive = [];
  trade.userPick = 0;
  trade.otherPick = 0;
  toast("Trade accepted.");
  render();
}
function addLog(title, body) {
  S.log.unshift({ title, body, when: `Week ${S.week}` });
}
function marketChurn() {
  S.teams.forEach((t) =>
    t.players.forEach((p) => {
      p.mood = Math.max(
        20,
        Math.min(99, p.mood + Math.floor(Math.random() * 11) - 5),
      );
    }),
  );
}

// =================== OFFSEASON: aging + rookie draft =====================
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN(arr, n) {
  const copy = arr.slice(),
    out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function clampRating(v) {
  return Math.max(35, Math.min(99, Math.round(v)));
}
const AGING_RATINGS = [
  "scoring",
  "shooting",
  "playmaking",
  "defense",
  "rebounding",
  "athleticism",
  "iq",
];
function ageOnePlayer(p) {
  const before = composite(p);
  const delta = p.ratings.potential - before;
  const deltas = {};
  if (delta > 10) {
    pickN(AGING_RATINGS, 3).forEach((k) => {
      const bump = rand(1, 3);
      const next = clampRating(p.ratings[k] + bump);
      if (next !== p.ratings[k]) {
        deltas[k] = next - p.ratings[k];
        p.ratings[k] = next;
      }
    });
  } else if (delta < -6) {
    pickN(AGING_RATINGS, 2).forEach((k) => {
      const drop = rand(1, 2);
      const next = clampRating(p.ratings[k] - drop);
      if (next !== p.ratings[k]) {
        deltas[k] = next - p.ratings[k];
        p.ratings[k] = next;
      }
    });
    p.ratings.potential = Math.max(40, p.ratings.potential - 2);
  } else {
    const k = pickOne(AGING_RATINGS);
    const drift = rand(-1, 1);
    if (drift) {
      const next = clampRating(p.ratings[k] + drift);
      if (next !== p.ratings[k]) {
        deltas[k] = next - p.ratings[k];
        p.ratings[k] = next;
      }
    }
  }
  p.years = Math.max(0, p.years - 1);
  return { name: p.name, team: p.team, before, after: composite(p), deltas };
}
function applyOffseasonAging() {
  const reports = [];
  S.roster.forEach((p) => {
    const r = ageOnePlayer(p);
    r.isUser = true;
    reports.push(r);
  });
  S.teams.forEach((t) =>
    t.players.forEach((p) => {
      reports.push(ageOnePlayer(p));
    }),
  );
  return reports;
}
const PROC_FIRST = [
  "Maya",
  "Aria",
  "Layla",
  "Sienna",
  "Zoe",
  "Olivia",
  "Camille",
  "Aaliyah",
  "Brooklyn",
  "Jordan",
  "Talia",
  "Kaela",
  "Nia",
  "Quinn",
  "Sophia",
  "Riley",
  "Imani",
  "Tessa",
  "Hailey",
  "Reese",
  "Mariah",
  "Vanessa",
  "Sydney",
  "Brielle",
  "Naya",
  "Asha",
  "Kaylee",
  "Mackenzie",
  "Skyla",
  "Jasmine",
  "Skylar",
  "Jada",
  "Amara",
  "Selah",
  "Aubree",
  "Kaia",
  "Mia",
  "Briana",
  "Mavis",
  "Kai",
];
const PROC_LAST = [
  "Carter",
  "Brooks",
  "Hill",
  "Jones",
  "Reed",
  "Cole",
  "Hayes",
  "Bennett",
  "Foster",
  "Wright",
  "Rivera",
  "Patel",
  "Nguyen",
  "Adams",
  "Reyes",
  "Coleman",
  "Spencer",
  "Watts",
  "Bowman",
  "Castillo",
  "Rhodes",
  "Vega",
  "Marsh",
  "Sutton",
  "Lyon",
  "Park",
  "Bell",
  "Wagner",
  "Pham",
  "Olsen",
  "Harper",
  "Sloan",
  "Frazier",
  "Burke",
  "Greer",
  "Mason",
  "Ruiz",
  "Dwyer",
  "Holland",
  "Estrada",
];
const PROC_COLLEGES = [
  "UConn",
  "South Carolina",
  "Stanford",
  "LSU",
  "Notre Dame",
  "Texas",
  "Iowa State",
  "UCLA",
  "USC",
  "Baylor",
  "Duke",
  "NC State",
  "Maryland",
  "Tennessee",
  "Ohio State",
  "Florida",
  "Oregon",
  "Kansas",
  "Mississippi State",
  "Louisville",
];
const PROC_POSITIONS = ["G", "G", "G", "G/F", "F", "F", "C", "F/C"];
function generateRookieClass(year) {
  const tiers = [
    { count: 1, base: [82, 88], pot: [92, 97], arch: "star" },
    { count: 3, base: [73, 82], pot: [85, 92], arch: "starter" },
    { count: 5, base: [64, 74], pot: [78, 88], arch: "starter" },
    { count: 5, base: [55, 66], pot: [70, 82], arch: "prospect" },
  ];
  const used = new Set();
  const out = [];
  let pickNo = 0;
  for (const t of tiers) {
    for (let i = 0; i < t.count; i++) {
      let name;
      do {
        name = `${pickOne(PROC_FIRST)} ${pickOne(PROC_LAST)}`;
      } while (used.has(name));
      used.add(name);
      const pos = pickOne(PROC_POSITIONS);
      const isC = pos.includes("C");
      const isG = pos.startsWith("G");
      const base = rand(t.base[0], t.base[1]);
      const pot = rand(Math.max(base + 2, t.pot[0]), t.pot[1]);
      const ratings = {
        scoring: clampRating(base + rand(-8, 10)),
        shooting: clampRating(base + rand(-12, 8) - (isC ? 8 : 0)),
        playmaking: clampRating(
          base + rand(-15, 8) - (isC ? 10 : 0) + (isG ? 6 : 0),
        ),
        defense: clampRating(base + rand(-12, 10)),
        rebounding: clampRating(base + rand(-15, 12) + (isC ? 10 : 0)),
        athleticism: clampRating(base + rand(-5, 12)),
        iq: clampRating(base + rand(-5, 12)),
        potential: pot,
      };
      const salary =
        200000 +
        (t.arch === "star" ? 500000 : t.arch === "starter" ? 250000 : 0) +
        rand(0, 80000);
      out.push({
        id: `rookie-${year}-${pickNo++}`,
        name,
        pos,
        team: pickOne(PROC_COLLEGES),
        salary,
        years: 4,
        scouting: rookieScout(t.arch, pos),
        strengths: ratingsTop(ratings),
        weaknesses: ratingsBottom(ratings),
        protected: false,
        ratings,
        archetype: t.arch,
        mood: 60 + Math.floor(Math.random() * 25),
        fatigue: 0,
      });
    }
  }
  return out;
}
function rookieScout(arch, pos) {
  if (arch === "star")
    return "Generational prospect with All-Star projection; expected day-one impact.";
  if (arch === "starter" && pos.includes("G"))
    return "Pro-ready guard with multi-year starter projection.";
  if (arch === "starter" && pos.includes("C"))
    return "Refined interior player with starting big projection.";
  if (arch === "starter")
    return "Versatile forward with starting-caliber tools.";
  return "Developmental prospect with carve-out role upside.";
}
const RATING_LABELS_HIGH = {
  scoring: "Scoring",
  shooting: "Shooting",
  playmaking: "Playmaking",
  defense: "Defense",
  rebounding: "Rebounding",
  athleticism: "Athleticism",
  iq: "Feel",
};
const RATING_LABELS_LOW = {
  scoring: "Scoring volume",
  shooting: "Range",
  playmaking: "Passing reads",
  defense: "Defensive engagement",
  rebounding: "Glass work",
  athleticism: "Burst",
  iq: "Decision speed",
};
function ratingsTop(r) {
  return Object.entries(r)
    .filter(([k]) => RATING_LABELS_HIGH[k])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => RATING_LABELS_HIGH[k])
    .join(", ");
}
function ratingsBottom(r) {
  return Object.entries(r)
    .filter(([k]) => RATING_LABELS_LOW[k])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k]) => RATING_LABELS_LOW[k])
    .join(", ");
}
function enterOffseason() {
  if (S.season && S.season.schedule.some((g) => !g.played)) {
    return toast("Finish all games before advancing to the offseason.");
  }
  const reports = applyOffseasonAging();
  const upcomingYear = S.year + 1;
  const base =
    S.year === 2026
      ? clone(DATA.rookieClass2027)
      : generateRookieClass(upcomingYear);
  const dataExtras =
    (DATA.rookieClassExtras && DATA.rookieClassExtras[upcomingYear]) || [];
  const userExtras = (S.customRookies && S.customRookies[upcomingYear]) || [];
  const rookieClass = base.concat(clone(dataExtras)).concat(clone(userExtras));
  const draftOrder = standingsRows()
    .slice()
    .reverse()
    .map((r) => r.id)
    .slice(0, rookieClass.length);
  S.offseason = {
    stage: "aging",
    agingReport: reports,
    rookieClass,
    draftOrder,
    picks: [],
    currentPickIdx: 0,
  };
  tab = "offseason";
  addLog(
    "Offseason opened",
    `Season ${S.year} closed. Aging applied to ${reports.length} players league-wide.`,
  );
  save();
  render();
}
function advanceToDraft() {
  if (!S.offseason || S.offseason.stage !== "aging") return;
  S.offseason.stage = "draft";
  save();
  render();
  setTimeout(processAiPicks, 250);
}
function processAiPicks() {
  if (!S.offseason || S.offseason.stage !== "draft") return;
  let pickedAny = false;
  while (S.offseason.currentPickIdx < S.offseason.draftOrder.length) {
    const teamId = S.offseason.draftOrder[S.offseason.currentPickIdx];
    if (teamId === S.team.abbr) break;
    const available = S.offseason.rookieClass.filter(
      (p) => !S.offseason.picks.some((pk) => pk.playerId === p.id),
    );
    const chosen = aiPickRookie(teamId, available);
    if (!chosen) break;
    S.offseason.picks.push({
      team: teamId,
      playerId: chosen.id,
      pickNo: S.offseason.currentPickIdx + 1,
    });
    const tm = S.teams.find((t) => t.id === teamId);
    if (tm) {
      const r = clone(chosen);
      r.team = teamId;
      tm.players.push(r);
    }
    S.offseason.currentPickIdx++;
    pickedAny = true;
  }
  if (S.offseason.currentPickIdx >= S.offseason.draftOrder.length) {
    S.offseason.stage = "done";
  }
  if (pickedAny || S.offseason.stage === "done") {
    save();
    render();
  }
}
function aiPickRookie(teamId, available) {
  if (!available.length) return null;
  return available
    .slice()
    .sort(
      (a, b) =>
        composite(b) +
        b.ratings.potential * 0.6 -
        (composite(a) + a.ratings.potential * 0.6),
    )[0];
}
function userPickRookie(playerId) {
  if (!S.offseason || S.offseason.stage !== "draft") return;
  if (S.offseason.draftOrder[S.offseason.currentPickIdx] !== S.team.abbr)
    return toast("Not your pick.");
  const p = S.offseason.rookieClass.find((x) => x.id === playerId);
  if (!p || S.offseason.picks.some((pk) => pk.playerId === playerId)) return;
  S.offseason.picks.push({
    team: S.team.abbr,
    playerId: p.id,
    pickNo: S.offseason.currentPickIdx + 1,
  });
  const r = clone(p);
  r.team = S.team.abbr;
  S.roster.push(r);
  addLog(
    "Rookie drafted",
    `${S.team.nickname} selected ${p.name} (${p.pos}, ${p.team}) with pick #${S.offseason.currentPickIdx + 1}.`,
  );
  S.offseason.currentPickIdx++;
  save();
  render();
  setTimeout(processAiPicks, 200);
}
function startNextSeason() {
  if (!S.offseason || S.offseason.stage !== "done") return;
  S.year++;
  S.season = null;
  ensureSeason(true);
  S.offseason = null;
  tab = "schedule";
  addLog(
    "New season begins",
    `Year ${S.year} schedule generated. Roster carries over with offseason changes baked in.`,
  );
  save();
  render();
}
function offseasonView() {
  if (!S.offseason) return '<div class="empty">No offseason in progress.</div>';
  if (S.offseason.stage === "aging") return offseasonAgingView();
  if (S.offseason.stage === "draft") return offseasonDraftView();
  return offseasonDoneView();
}
function offseasonAgingView() {
  const userReports = S.offseason.agingReport.filter((r) => r.isUser);
  const sortByImpact = (r) =>
    Math.abs(r.after - r.before) +
    Object.values(r.deltas).reduce((s, v) => s + Math.abs(v), 0);
  const leagueChangers = S.offseason.agingReport
    .filter((r) => !r.isUser)
    .slice()
    .sort((a, b) => sortByImpact(b) - sortByImpact(a))
    .slice(0, 12);
  const row = (r) => {
    const total = r.after - r.before;
    const arrow =
      total > 0
        ? `<span class="pill good">↑ ${total}</span>`
        : total < 0
          ? `<span class="pill bad">↓ ${Math.abs(total)}</span>`
          : '<span class="pill">·</span>';
    const ds = Object.entries(r.deltas)
      .map(([k, v]) => `<span class="tag">${k} ${v > 0 ? "+" + v : v}</span>`)
      .join("");
    return `<tr><td><b>${r.name}</b></td><td><span class="pill">${r.team}</span></td><td>${arrow}</td><td>${ds || '<span class="mini">no change</span>'}</td></tr>`;
  };
  return `<section class="card"><div class="sectionTitle"><h3>Year ${S.year} · Offseason Aging Report</h3><span>Year ${S.year + 1} rookie class is next</span></div><div class="cardPad"><h3>Your Roster</h3><table class="table"><thead><tr><th>Player</th><th>Team</th><th>Composite</th><th>Notable shifts</th></tr></thead><tbody>${userReports.map(row).join("") || '<tr><td colspan="4"><div class="empty">No roster players to age.</div></td></tr>'}</tbody></table><h3 style="margin-top:18px">Notable League Changes</h3><table class="table"><thead><tr><th>Player</th><th>Team</th><th>Composite</th><th>Notable shifts</th></tr></thead><tbody>${leagueChangers.map(row).join("")}</tbody></table><div class="actions" style="margin-top:18px"><button class="btn" data-action="advanceToDraft">Continue to Rookie Draft</button></div></div></section>`;
}
function offseasonDraftView() {
  const os = S.offseason;
  const onClock = os.draftOrder[os.currentPickIdx];
  const userOnClock = onClock === S.team.abbr;
  const onClockMeta = userOnClock
    ? {
        id: S.team.abbr,
        name: S.team.city + " " + S.team.nickname,
        primary: S.team.primary,
      }
    : S.teams.find((t) => t.id === onClock) || {
        id: onClock,
        name: onClock,
        primary: "#888",
      };
  const pickedIds = new Set(os.picks.map((p) => p.playerId));
  const available = os.rookieClass
    .filter((p) => !pickedIds.has(p.id))
    .sort(
      (a, b) =>
        composite(b) +
        b.ratings.potential * 0.5 -
        (composite(a) + a.ratings.potential * 0.5),
    );
  const orderHtml = os.draftOrder
    .map((id, i) => {
      const picked = os.picks[i];
      const meta =
        id === S.team.abbr
          ? { name: S.team.nickname, primary: S.team.primary }
          : S.teams.find((t) => t.id === id) || {
              name: id,
              primary: "#888",
            };
      const player = picked
        ? os.rookieClass.find((p) => p.id === picked.playerId)
        : null;
      const isUser = id === S.team.abbr;
      return `<div class="logItem" style="${i === os.currentPickIdx ? "border-color:var(--orange);background:#fff6ee" : ""}${isUser && !picked ? ";box-shadow:inset 4px 0 0 var(--orange)" : ""}"><b>Pick #${i + 1}</b> <span class="teamBadge" style="background:${meta.primary}">${id}</span> ${meta.name}${isUser ? ' <span class="pill good">YOU</span>' : ""}${player ? `<div class="mini">→ ${player.name} · ${player.pos} · ${player.team}</div>` : i === os.currentPickIdx ? '<div class="mini">on the clock</div>' : '<div class="mini">upcoming</div>'}</div>`;
    })
    .join("");
  const board = available
    .map((p) => {
      const photo = portraitHtml(p);
      return `<div class="playerCard">${photo}<div><div><span class="playerName">${p.name}</span> <span class="pill">${p.pos}</span> <span class="pill">${p.team}</span></div><div class="scout">${p.scouting}</div><div class="tags"><span class="tag">${visibleGrade(p)}</span><span class="tag">Upside ${p.ratings.potential}</span><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${p.strengths.split(",")[0]}</span></div></div><div class="actions"><button class="btn secondary" data-view="${p.id}">Scout</button><button class="btn ${userOnClock ? "" : "secondary"}" ${userOnClock ? "" : "disabled"} data-pick-rookie="${p.id}">${userOnClock ? "Draft" : "Wait"}</button></div></div>`;
    })
    .join("");
  return `<section class="card"><div class="sectionTitle"><h3>Rookie Draft · Year ${S.year + 1} Class</h3><span>${os.picks.length}/${os.draftOrder.length} picks made</span></div><div class="layout2"><div><div class="sectionTitle"><h3>On the Clock</h3><span><span class="teamBadge" style="background:${onClockMeta.primary}">${onClock}</span>${onClockMeta.name}${userOnClock ? " · YOUR PICK" : ""}</span></div><div class="board" style="max-height:720px">${board || '<div class="empty">Draft complete.</div>'}</div></div><div><div class="sectionTitle"><h3>Draft Order</h3><span>worst → best</span></div><div class="cardPad log" style="max-height:720px;overflow:auto">${orderHtml}</div></div></div></section>`;
}
function offseasonDoneView() {
  const os = S.offseason;
  const userPick = os.picks.find((p) => p.team === S.team.abbr);
  const userRookie = userPick
    ? os.rookieClass.find((r) => r.id === userPick.playerId)
    : null;
  const top5 = os.picks
    .slice()
    .sort((a, b) => a.pickNo - b.pickNo)
    .slice(0, 5);
  return `<section class="card"><div class="sectionTitle"><h3>Year ${S.year} Offseason Complete</h3><span>${os.picks.length} rookies drafted league-wide</span></div><div class="cardPad"><div class="logItem"><b>Your selection</b><p class="muted">${userRookie ? `You took ${userRookie.name} (${userRookie.pos}, ${userRookie.team}) at pick #${userPick.pickNo}. Welcome to the franchise.` : "You did not have a pick in this draft (you finished in the top 2 last season)."}</p></div><h3>Top 5 picks recap</h3><div class="log">${top5
    .map((pk) => {
      const r = os.rookieClass.find((x) => x.id === pk.playerId);
      return `<div class="logItem"><b>#${pk.pickNo} · ${pk.team}</b><div class="mini">${r.name} · ${r.pos} · ${r.team} · ${visibleGrade(r)}</div></div>`;
    })
    .join(
      "",
    )}</div><div class="actions" style="margin-top:18px"><button class="btn" data-action="startNextSeason">Start ${S.year + 1} Season</button></div></div></section>`;
}

// =================== COACHING: weekly focus, scouting, fatigue, dev, press =====================
const FOCUS_OPTIONS = [
  {
    id: "none",
    label: "No Focus",
    desc: "Maintenance week. Players neither gain nor regress.",
    icon: "—",
  },
  {
    id: "perO",
    label: "Perimeter Offense",
    desc: "Shooting, spacing, ball movement. +2 to your team's perimeter offense this week.",
    icon: "○",
  },
  {
    id: "intO",
    label: "Interior Offense",
    desc: "Post work, rim attacks, finishing. +2 to interior offense.",
    icon: "●",
  },
  {
    id: "perD",
    label: "Perimeter Defense",
    desc: "Closeouts, screen navigation. +2 to perimeter defense.",
    icon: "◇",
  },
  {
    id: "intD",
    label: "Interior Defense",
    desc: "Rim protection, weakside help. +2 to interior defense.",
    icon: "◆",
  },
  {
    id: "conditioning",
    label: "Conditioning",
    desc: "Sweat hard. Extra -4 fatigue recovery this week (no rating boost).",
    icon: "↻",
  },
  {
    id: "film",
    label: "Film Study",
    desc: "Watch tape. +1 to all four channels this week.",
    icon: "▶",
  },
  {
    id: "rest",
    label: "Rest Day",
    desc: "Step back. -8 fatigue recovery this week. No training stimulus.",
    icon: "z",
  },
];
function setWeeklyFocus(id) {
  if (!FOCUS_OPTIONS.some((f) => f.id === id)) return;
  S.coaching.weeklyFocus = id;
  S.coaching.weeklyFocusWeek = S.week;
  save();
  render();
}
function scoutGame(gameId) {
  if (!S.coaching.gamePlans[gameId])
    S.coaching.gamePlans[gameId] = { scouted: false, plan: null };
  S.coaching.gamePlans[gameId].scouted = true;
  save();
  render();
}
function setGamePlan(gameId, plan) {
  if (!S.coaching.gamePlans[gameId])
    S.coaching.gamePlans[gameId] = { scouted: false, plan: null };
  S.coaching.gamePlans[gameId].plan = plan;
  save();
  render();
}
function setDevFocus(playerId, ratingKey) {
  S.coaching.devFocus = { playerId, rating: ratingKey };
  save();
  render();
}
function userUpcomingGames(n) {
  if (!S.season) return [];
  return S.season.schedule
    .filter(
      (g) => !g.played && (g.home === S.team.abbr || g.away === S.team.abbr),
    )
    .slice(0, n || 3);
}
function applyWeeklyTransition() {
  // Natural recovery for all players (top-8 rotation absorbed heavier load earlier).
  const recover = (p, amt) => {
    p.fatigue = Math.max(0, (p.fatigue || 0) - amt);
  };
  S.roster.forEach((p) => recover(p, 3));
  // AI teams recover slightly more (they have their own coaching tools we abstract).
  S.teams.forEach((t) => t.players.forEach((p) => recover(p, 5)));
  // Practice focus side-effects on user roster.
  const f = S.coaching.weeklyFocus;
  if (f === "conditioning") S.roster.forEach((p) => recover(p, 4));
  else if (f === "rest") S.roster.forEach((p) => recover(p, 8));
  else if (f !== "none" && f !== "film")
    S.roster.forEach((p) => {
      p.fatigue = Math.min(100, (p.fatigue || 0) + 3);
    });
  // Player dev focus: +1 to chosen rating per week, capped at potential.
  const df = S.coaching.devFocus;
  if (df && df.playerId) {
    const target = S.roster.find((p) => p.id === df.playerId);
    if (target) {
      const k = df.rating;
      const cap = Math.min(99, target.ratings.potential);
      if (target.ratings[k] < cap) {
        target.ratings[k] = Math.min(cap, (target.ratings[k] || 0) + 1);
        addLog(
          "Development",
          `${target.name} improved +1 in ${k} after focused practice.`,
        );
      }
    }
  }
}
function maybeTriggerPress(g) {
  if (!S.coaching || S.coaching.pendingPress) return;
  const isUserHome = g.home === S.team.abbr;
  const oppId = isUserHome ? g.away : g.home;
  const won = g.winner === S.team.abbr;
  const oppRec = seasonRecord(oppId);
  const games = oppRec.w + oppRec.l;
  const oppPct = games ? oppRec.w / games : 0.5;
  let prompt = null;
  if (won && (oppPct > 0.6 || games < 5)) {
    prompt = {
      gameId: g.id,
      headline: `Statement win over ${teamMeta(oppId).name}`,
      body: "Reporters crowd the podium. What's the message?",
      options: [
        { id: "team", text: "Credit the entire roster — it was a team win." },
        { id: "stars", text: "Highlight star performances and clutch plays." },
        { id: "defense", text: "Talk up the defensive scheme and prep work." },
      ],
    };
  } else if (!won && oppPct < 0.45) {
    prompt = {
      gameId: g.id,
      headline: `Tough loss to ${teamMeta(oppId).name}`,
      body: "The press wants accountability. Choose your tone.",
      options: [
        { id: "responsible", text: "Take full responsibility yourself." },
        { id: "schedule", text: "Point to fatigue and the schedule." },
        { id: "honest", text: "Be honest — execution wasn't there." },
      ],
    };
  }
  if (prompt) S.coaching.pendingPress = prompt;
}
function respondToPress(optId) {
  const p = S.coaching.pendingPress;
  if (!p) return;
  const opt = p.options.find((o) => o.id === optId);
  if (!opt) return;
  const clampMood = (n) => Math.max(20, Math.min(99, n));
  if (optId === "team")
    S.roster.forEach((r) => (r.mood = clampMood((r.mood || 60) + 2)));
  else if (optId === "stars")
    S.roster
      .slice()
      .sort((a, b) => composite(b) - composite(a))
      .slice(0, 3)
      .forEach((r) => (r.mood = clampMood((r.mood || 60) + 4)));
  else if (optId === "defense")
    S.roster
      .slice()
      .sort((a, b) => b.ratings.defense - a.ratings.defense)
      .slice(0, 3)
      .forEach((r) => (r.mood = clampMood((r.mood || 60) + 3)));
  else if (optId === "responsible") {
    /* mood damage already absorbed by loss; coach takes hit silently */
  } else if (optId === "schedule")
    S.roster.forEach((r) => {
      r.fatigue = Math.max(0, (r.fatigue || 0) - 4);
    });
  else if (optId === "honest")
    S.roster.forEach((r) => (r.mood = clampMood((r.mood || 60) - 1)));
  S.coaching.pressLog.unshift({
    when: `Week ${S.week}`,
    headline: p.headline,
    choice: opt.text,
  });
  if (S.coaching.pressLog.length > 12) S.coaching.pressLog.length = 12;
  S.coaching.pendingPress = null;
  save();
  render();
}
function fatigueBadge(p) {
  const f = p.fatigue || 0;
  const cls = f >= 80 ? "bad" : f >= 60 ? "warn" : f >= 35 ? "" : "good";
  return `<span class="pill ${cls}">${f}</span>`;
}
function coachingView() {
  return `${kpis()}<div class="layout2"><div>${weeklyFocusSection()}${devFocusSection()}</div><div>${pressSection()}${fatigueSection()}</div></div><p class="muted" style="margin-top:14px;text-align:center">Pre-game scouting and game plans now live on the <b>Season</b> tab, alongside your upcoming opponents.</p>`;
}
function weeklyFocusSection() {
  const cur = S.coaching.weeklyFocus;
  const tiles = FOCUS_OPTIONS.map(
    (f) =>
      `<div class="cityTile ${cur === f.id ? "selected" : ""}" data-focus="${f.id}"><strong>${f.icon} ${f.label}</strong><small>${f.desc}</small></div>`,
  ).join("");
  return `<section class="card"><div class="sectionTitle"><h3>This Week's Focus</h3><span>Week ${S.week} · sets the tone for every game until you change it</span></div><div class="cardPad"><div class="tiles">${tiles}</div></div></section>`;
}
function nextGamesSection() {
  const games = userUpcomingGames(3);
  if (!games.length)
    return `<section class="card"><div class="sectionTitle"><h3>Upcoming Games</h3></div><div class="cardPad"><div class="empty">No upcoming games — season complete or not started.</div></div></section>`;
  const cards = games
    .map((g) => {
      const isHome = g.home === S.team.abbr;
      const oppId = isHome ? g.away : g.home;
      const opp = teamMeta(oppId);
      const oppPower = teamPower(oppId);
      const gp = S.coaching.gamePlans[g.id] || {
        scouted: false,
        plan: null,
      };
      const scoutBlock = gp.scouted
        ? `<div class="impact"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><div class="mini" style="margin-top:8px">Tip: ${oppPower.intO > oppPower.perO ? "Interior-heavy attack — Pack the Paint defends their best lane." : "Perimeter-driven offense — Extend Defense closes their shooters."}</div>`
        : `<button class="btn secondary" data-scout="${g.id}">Scout Opponent</button>`;
      const planBlock = gp.scouted
        ? `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear</button>` : ""}</div>`
        : "";
      return `<div class="logItem"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>Week ${g.week} · ${isHome ? "vs" : "at"} <span class="teamBadge" style="background:${opp.primary}">${oppId}</span> ${opp.name}</b><span class="pill">${gp.plan ? (gp.plan === "pack" ? "Pack" : "Extend") : gp.scouted ? "Plan?" : "Unscouted"}</span></div><div style="margin-top:10px">${scoutBlock}${planBlock}</div></div>`;
    })
    .join("");
  return `<section class="card"><div class="sectionTitle"><h3>Upcoming Games</h3><span>scout opponents, set defensive plans</span></div><div class="cardPad log">${cards}</div></section>`;
}
function devFocusSection() {
  const cur = S.coaching.devFocus || { playerId: null, rating: "scoring" };
  const roster = S.roster.slice().sort((a, b) => composite(b) - composite(a));
  const playerOpts =
    `<option value="">— No development focus —</option>` +
    roster
      .map(
        (p) =>
          `<option value="${p.id}" ${cur.playerId === p.id ? "selected" : ""}>${p.name} · ${p.pos} · pot ${p.ratings.potential}</option>`,
      )
      .join("");
  const ratingOpts = RATING_KEYS.filter((k) => k !== "potential")
    .map(
      (k) =>
        `<option value="${k}" ${cur.rating === k ? "selected" : ""}>${k}</option>`,
    )
    .join("");
  const target = cur.playerId
    ? S.roster.find((p) => p.id === cur.playerId)
    : null;
  const note = target
    ? `Currently developing <b>${target.name}</b> on <b>${cur.rating}</b> (${target.ratings[cur.rating]} → cap ${Math.min(99, target.ratings.potential)}). +1 per week until capped.`
    : "Pick a player and rating to give them focused individual work each week.";
  return `<section class="card"><div class="sectionTitle"><h3>Player Development</h3><span>+1 rating per week</span></div><div class="cardPad"><div class="field"><label>Player</label><select id="dev-player">${playerOpts}</select></div><div class="field"><label>Skill emphasis</label><select id="dev-rating">${ratingOpts}</select></div><div class="actions"><button class="btn" data-action="commitDevFocus">Set Development</button></div><p class="muted" style="margin-top:10px">${note}</p></div></section>`;
}
function fatigueSection() {
  if (!S.roster.length)
    return `<section class="card"><div class="sectionTitle"><h3>Roster Fatigue</h3></div><div class="cardPad"><div class="empty">Draft a roster first.</div></div></section>`;
  const rows = S.roster
    .slice()
    .sort((a, b) => (b.fatigue || 0) - (a.fatigue || 0))
    .map(
      (p) =>
        `<tr><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div><div class="playerName">${p.name}</div><div class="mini">${p.pos} · ${visibleGrade(p)}</div></div></div></td><td>${fatigueBadge(p)}</td><td>${p.mood || 60}</td></tr>`,
    )
    .join("");
  const avgF = Math.round(
    S.roster.reduce((s, p) => s + (p.fatigue || 0), 0) / S.roster.length,
  );
  return `<section class="card"><div class="sectionTitle"><h3>Roster Fatigue</h3><span>team avg ${avgF}</span></div><table class="table"><thead><tr><th>Player</th><th>Fatigue</th><th>Mood</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
function pressSection() {
  const pending = S.coaching.pendingPress;
  const log = S.coaching.pressLog || [];
  let pendingHtml = "";
  if (pending) {
    pendingHtml = `<div class="logItem" style="border-color:var(--orange);background:#fff6ee"><b>${pending.headline}</b><p class="muted">${pending.body}</p><div class="actions" style="flex-direction:column;align-items:stretch;gap:8px">${pending.options.map((o) => `<button class="btn secondary" data-press="${o.id}" style="text-align:left">${o.text}</button>`).join("")}</div></div>`;
  }
  const logHtml = log.length
    ? `<div class="log">${log.map((e) => `<div class="logItem"><b>${e.headline}</b><div class="mini">${e.when} · "${e.choice}"</div></div>`).join("")}</div>`
    : '<div class="empty">No press conferences yet.</div>';
  return `<section class="card"><div class="sectionTitle"><h3>Press &amp; Locker Room</h3><span>${pending ? "1 pending" : log.length + " on record"}</span></div><div class="cardPad">${pendingHtml || ""}<h3 style="margin-top:${pending ? "18px" : "0"}">Recent Briefings</h3>${logHtml}</div></section>`;
}

// =================== ADMIN: custom rookies =====================
const ARCHETYPE_OPTIONS = [
  "star",
  "engine",
  "creator",
  "scorer",
  "playmaker",
  "shooter",
  "defender",
  "twoWay",
  "anchor",
  "forward",
  "spark",
  "prospect",
];
const POSITION_OPTIONS = ["G", "G/F", "F", "F/C", "C"];
const RATING_KEYS = [
  "scoring",
  "shooting",
  "playmaking",
  "defense",
  "rebounding",
  "athleticism",
  "iq",
  "potential",
];
function adminView() {
  const nextYear = S.year + 1;
  const years = Object.keys(S.customRookies || {}).sort();
  const ratingFields = RATING_KEYS.map(
    (k) =>
      `<div class="field"><label>${k}</label><input id="cr-${k}" type="number" value="70" min="30" max="99"></div>`,
  ).join("");
  const list =
    years.length === 0
      ? '<div class="empty">No custom rookies yet. Add one above.</div>'
      : years
          .map(
            (y) =>
              `<div class="logItem"><b>${y} Class</b> <span class="pill">${S.customRookies[y].length} player(s)</span>${S.customRookies[
                y
              ]
                .map(
                  (r, i) =>
                    `<div class="checkRow"><div><b>${r.name}</b> <span class="pill">${r.pos}</span> <span class="pill">${r.archetype}</span><div class="mini">${r.team} · ${shortMoney(r.salary)} · upside ${r.ratings.potential}</div></div><button class="btn danger" data-rm-rookie="${y}|${i}">Remove</button></div>`,
                )
                .join("")}</div>`,
          )
          .join("");
  return `<section class="card"><div class="sectionTitle"><h3>Add Custom Rookie</h3><span>Players added here join the named class for their draft year</span></div><div class="cardPad"><div class="layout2"><div><div class="field"><label>Name</label><input id="cr-name" placeholder="Player Name"></div><div class="field"><label>Position</label><select id="cr-pos">${POSITION_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join("")}</select></div><div class="field"><label>College / Origin</label><input id="cr-college" placeholder="UConn"></div><div class="field"><label>Draft Year</label><input id="cr-year" type="number" value="${nextYear}" min="${nextYear}"></div><div class="field"><label>Archetype</label><select id="cr-arch">${ARCHETYPE_OPTIONS.map((a) => `<option value="${a}">${a}</option>`).join("")}</select></div><div class="field"><label>Salary ($)</label><input id="cr-salary" type="number" value="400000" min="80000" step="10000"></div><div class="field"><label>Contract Years</label><input id="cr-years" type="number" value="4" min="1" max="4"></div></div><div><div class="ratingGrid">${ratingFields}</div><div class="field"><label>Scouting (optional)</label><textarea id="cr-scouting" rows="2" placeholder="Auto-filled from archetype if blank"></textarea></div><div class="field"><label>Strengths (optional)</label><input id="cr-strengths" placeholder="Auto-derived from top ratings if blank"></div><div class="field"><label>Weaknesses (optional)</label><input id="cr-weaknesses" placeholder="Auto-derived from low ratings if blank"></div><div class="actions"><button class="btn" data-action="addCustomRookie">Add to Draft Class</button></div></div></div><hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><h3>Current Custom Rookies</h3>${list}</div></section>`;
}
function readField(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}
function addCustomRookie() {
  const name = readField("cr-name").trim();
  if (!name) return toast("Name is required.");
  const pos = readField("cr-pos");
  const college = readField("cr-college").trim() || "Free Agent";
  const year = parseInt(readField("cr-year"), 10);
  if (!year || year < S.year + 1)
    return toast(`Draft year must be ${S.year + 1} or later.`);
  const archetype = readField("cr-arch");
  const salary = Math.max(80000, parseInt(readField("cr-salary"), 10) || 0);
  const years = Math.max(
    1,
    Math.min(4, parseInt(readField("cr-years"), 10) || 4),
  );
  const ratings = {};
  RATING_KEYS.forEach(
    (k) => (ratings[k] = clampRating(parseInt(readField("cr-" + k), 10) || 60)),
  );
  const scouting =
    readField("cr-scouting").trim() || rookieScout(archetype, pos);
  const strengths = readField("cr-strengths").trim() || ratingsTop(ratings);
  const weaknesses =
    readField("cr-weaknesses").trim() || ratingsBottom(ratings);
  const id = "custom-" + year + "-" + slug(name + "-" + college);
  if (!S.customRookies[year]) S.customRookies[year] = [];
  if (S.customRookies[year].some((r) => r.id === id))
    return toast(`${name} is already in the ${year} class.`);
  S.customRookies[year].push({
    id,
    name,
    pos,
    team: college,
    salary,
    years,
    scouting,
    strengths,
    weaknesses,
    protected: false,
    ratings,
    archetype,
    mood: 65,
    fatigue: 0,
  });
  save();
  toast(`${name} added to ${year} draft class.`);
  render();
}
function removeCustomRookie(key) {
  const [yearStr, idxStr] = key.split("|");
  const arr = S.customRookies[yearStr];
  if (!arr) return;
  const removed = arr.splice(parseInt(idxStr, 10), 1)[0];
  if (arr.length === 0) delete S.customRookies[yearStr];
  if (removed) toast(`${removed.name} removed from ${yearStr} class.`);
  save();
  render();
}
render();

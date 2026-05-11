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
let S = load() || freshState();
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
function load() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY));
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
  return `<div class="appShell"><aside class="side"><div class="brand"><div class="logo"></div><div><h1>${S.team.city} ${S.team.nickname}</h1><p>Expansion Front Office</p></div></div><nav class="nav">${navBtn("dashboard", "Dashboard")} ${navBtn("draft", "Expansion Draft")} ${navBtn("roster", "Roster")} ${navBtn("schedule", "Season")} ${navBtn("trades", "Trade Desk")} ${navBtn("waivers", "Waivers")} ${navBtn("league", "League")}</nav><div class="sideCard"><div class="mini">Front Office Score</div><div class="big">${frontOfficeScore()}</div><p>${frontOfficeNote()}</p></div></aside><main class="main">${topbar()}${content()}${modalHtml()}</main></div>`;
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
  };
  return `<div class="topbar"><div><h2>${titles[tab]}</h2><p>${S.phase} · Week ${S.week} · Simplified cap ${money(DATA.cap)}</p></div><div class="actions"><button class="btn secondary" data-action="advance">Advance Week</button><button class="btn secondary" data-action="simNext">Sim Next Game</button><button class="btn secondary" data-action="reset">New Save</button></div></div>`;
}
function content() {
  return {
    dashboard: dashboard(),
    draft: draft(),
    roster: roster(),
    schedule: schedulePage(),
    trades: trades(),
    waivers: waivers(),
    league: league(),
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
  return `<div class="playerCard"><div><div><span class="playerName">${p.name}</span> <span class="pill">${p.pos}</span> <span class="pill" style="background:${p.teamObj.primary};color:white">${p.team}</span> ${p.protected ? '<span class="pill bad">Protected</span>' : ""}</div><div class="scout">${p.scouting}</div><div class="tags"><span class="tag">${visibleGrade(p)}</span><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${p.years} yr</span><span class="tag">Strength: ${p.strengths.split(",")[0]}</span><span class="tag">Concern: ${p.weaknesses.split(",")[0]}</span></div></div><div class="actions"><button class="btn secondary" data-view="${p.id}">Scout</button><button class="btn ${disabled ? "secondary" : ""}" ${disabled ? "disabled" : ""} data-draft="${p.id}">${p.protected ? "Locked" : userSalary() + p.salary > DATA.cap ? "No Cap" : "Draft"}</button></div></div>`;
}
function roster() {
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Cap Sheet</h3><span>${money(userSalary())} / ${money(DATA.cap)}</span></div>${rosterTable(S.roster)}</section><section class="card"><div class="sectionTitle"><h3>Roster Tools</h3><span>rotation control</span></div><div class="cardPad"><div class="impact">${impactBars()}</div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Position Balance</h3>${positionBalance()}<h3>Recommended Next Move</h3><p class="muted">${recommendation()}</p></div></section></div>`;
}
function rosterTable(players) {
  return `<table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Role</th><th>Salary</th><th>Contract</th><th></th></tr></thead><tbody>${players.map((p) => `<tr><td><div class="playerName">${p.name}</div><div class="mini">${p.scouting.slice(0, 90)}...</div></td><td>${p.pos}</td><td><span class="pill">${visibleGrade(p)}</span></td><td>${shortMoney(p.salary)}</td><td>${p.years} yr</td><td><button class="btn secondary" data-view="${p.id}">Scout</button> ${S.roster.find((x) => x.id === p.id) ? `<button class="btn danger" data-waive="${p.id}">Waive</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="6"><div class="empty">No players yet.</div></td></tr>`}</tbody></table>`;
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
  return `<label class="checkRow"><input type="checkbox" data-trade-side="${side}" value="${p.id}" ${checked ? "checked" : ""}><div><b>${p.name}</b> <span class="pill">${p.pos}</span> ${p.protected ? '<span class="pill bad">protected cost</span>' : ""}<div class="mini">${visibleGrade(p)} · ${shortMoney(p.salary)} · ${p.scouting.slice(0, 76)}...</div></div></label>`;
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
        `<div class="playerCard"><div><span class="playerName">${p.name}</span> <span class="pill">${p.pos}</span><div class="scout">${p.scouting}</div><div class="tags"><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${visibleGrade(p)}</span><span class="tag">${p.strengths.split(",")[0]}</span></div></div><button class="btn" data-sign="${p.id}">${userSalary() + p.salary > DATA.cap ? "No Cap" : "Sign"}</button></div>`,
    )
    .join(
      "",
    )}</div></section><section class="card"><div class="sectionTitle"><h3>Your Waived Players</h3><span>${S.waived.length}</span></div><div class="board">${S.waived.map((p) => `<div class="playerCard"><div><b>${p.name}</b><div class="mini">${p.pos} · ${shortMoney(p.salary)}</div></div><button class="btn secondary" data-sign="${p.id}">Re-sign</button></div>`).join("") || '<div class="empty">No waived players yet.</div>'}</div></section></div>`;
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
  const players = teamMeta(id)
    .players.slice()
    .sort((a, b) => composite(b) - composite(a));
  if (!players.length)
    return { overall: 55, off: 55, def: 55, reb: 55, pace: 55 };
  const top = players.slice(0, 8);
  const w = top.map((_, i) => (i < 5 ? 1.15 : 0.72));
  const wavg = (k) =>
    Math.round(
      top.reduce((s, p, i) => s + p.ratings[k] * w[i], 0) /
        w.reduce((a, b) => a + b, 0),
    );
  const off = Math.round(
    wavg("scoring") * 0.35 +
      wavg("shooting") * 0.27 +
      wavg("playmaking") * 0.24 +
      wavg("iq") * 0.14,
  );
  const def = Math.round(
    wavg("defense") * 0.48 +
      wavg("athleticism") * 0.18 +
      wavg("iq") * 0.17 +
      wavg("rebounding") * 0.17,
  );
  const reb = wavg("rebounding");
  return {
    overall: Math.round(off * 0.45 + def * 0.4 + reb * 0.15),
    off,
    def,
    reb,
    pace: wavg("athleticism"),
  };
}
function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function simScore(home, away) {
  const hp = teamPower(home),
    ap = teamPower(away);
  const hBase = 76 + (hp.off - ap.def) * 0.34 + (hp.reb - ap.reb) * 0.12 + 2.2;
  const aBase = 74 + (ap.off - hp.def) * 0.34 + (ap.reb - hp.reb) * 0.12;
  let hs = Math.max(58, Math.round(hBase + rand(-9, 12)));
  let as = Math.max(55, Math.round(aBase + rand(-10, 12)));
  if (hs === as) hs += rand(1, 5);
  return { hs, as, hp, ap };
}
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
  const r = simScore(g.home, g.away);
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
}
function nextUnplayed() {
  return S.season.schedule.find((g) => !g.played);
}
function simNextGame() {
  ensureSeason();
  const g = nextUnplayed();
  if (!g) return toast("Season complete.");
  simulateGame(g);
  S.week = Math.max(S.week, g.week);
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
  const next = nextUnplayed();
  return `${seasonKpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Schedule</h3><span>${S.season.schedule.filter((g) => g.played).length}/${S.season.schedule.length} games final</span></div><div class="cardPad actions"><button class="btn" data-action="simNext">Sim Next Game</button><button class="btn secondary" data-action="simWeek">Sim Current Week</button><button class="btn secondary" data-action="simSeason">Sim Season</button><button class="btn ghost" data-action="regenSchedule">Regenerate Schedule</button></div><div class="scheduleList">${S.season.schedule.map(gameRow).join("")}</div></section><section class="card"><div class="sectionTitle"><h3>Standings</h3><span>Your record ${userRec.w}-${userRec.l}</span></div>${standingsTable()}<div class="sectionTitle"><h3>Recent Finals</h3><span>box-score summaries</span></div><div class="cardPad log">${recentResults()}</div></section></div>`;
}
function seasonKpis() {
  const r = seasonRecord(S.team.abbr);
  const p = teamPower(S.team.abbr);
  const next = nextUnplayed();
  return `<div class="grid kpis"><div class="card kpi"><label>Record</label><div class="value">${r.w}-${r.l}</div><small>${r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0}% win rate</small></div><div class="card kpi"><label>Power Index</label><div class="value">${p.overall}</div><small>Off ${p.off} · Def ${p.def} · Reb ${p.reb}</small></div><div class="card kpi"><label>Next Game</label><div class="value">${next ? `W${next.week}` : "Done"}</div><small>${next ? `${teamMeta(next.away).id} at ${teamMeta(next.home).id}` : "Season complete"}</small></div><div class="card kpi"><label>Playoff Cut</label><div class="value">Top 8</div><small>${playoffStatus()}</small></div></div>`;
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
    return `<div class="modalShade"><div class="modal"><div class="modalHeader"><h3>${p.name} <span class="pill">${p.pos}</span></h3><button class="close" data-close>Close</button></div><div class="modalBody"><p>${p.scouting}</p><div class="layout2"><div><h3>Strengths</h3><p class="muted">${p.strengths}</p><h3>Weaknesses</h3><p class="muted">${p.weaknesses}</p><h3>Contract</h3><p class="muted">${shortMoney(p.salary)} · ${p.years} year(s) · ${p.protected ? "protected/core asset" : "available/negotiable"}</p></div><div><h3>Scouting Department View</h3><p class="muted">Numerical ratings are intentionally hidden in normal play. This panel reveals directional grades only.</p>${["scoring", "shooting", "playmaking", "defense", "rebounding", "athleticism", "iq", "potential"].map((k) => gradeRow(k, p.ratings[k])).join("")}</div></div></div></div></div>`;
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
    addLog(
      "Week advanced",
      `Front office calendar moves to Week ${S.week}. Scouts updated the waiver and trade boards.`,
    );
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
render();

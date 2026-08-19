const { test } = require("node:test");
const assert = require("node:assert");
const { loadGame } = require("./harness");

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
const ratings = (v) => Object.fromEntries(RATING_KEYS.map((k) => [k, v]));
const mkPlayer = (over, extra = {}) => ({
  id: "p" + Math.random(),
  name: "Test Player",
  pos: "G",
  team: "FA",
  salary: 200000,
  years: 2,
  scouting: "x",
  strengths: "shooting",
  weaknesses: "defense",
  protected: false,
  ratings: ratings(over),
  archetype: "scorer",
  mood: 60,
  injury: null,
  seasonStats: { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 },
  ...extra,
});

test("escapeHtml neutralizes HTML/script injection", () => {
  const g = loadGame(1);
  const out = g.escapeHtml('<img src=x onerror="alert(1)">');
  assert.ok(!out.includes("<img"), "angle brackets must be escaped");
  assert.ok(out.includes("&lt;img"));
  assert.strictEqual(g.escapeHtml(null), "");
});

test("composite weights sum to 1 (flat ratings map to themselves)", () => {
  const g = loadGame(1);
  assert.strictEqual(g.composite(mkPlayer(70)), 70);
  assert.strictEqual(g.composite(mkPlayer(85)), 85);
});

test("visibleGrade buckets by composite", () => {
  const g = loadGame(1);
  assert.strictEqual(g.visibleGrade(mkPlayer(92)), "MVP");
  assert.strictEqual(g.visibleGrade(mkPlayer(50)), "Fringe");
});

test("tradeValue increases with talent", () => {
  const g = loadGame(1);
  assert.ok(g.tradeValue(mkPlayer(88)) > g.tradeValue(mkPlayer(62)));
});

test("isValidSave rejects incomplete objects, accepts a fresh state", () => {
  const g = loadGame(1);
  assert.strictEqual(g.isValidSave({}), false);
  assert.strictEqual(g.isValidSave(null), false);
  assert.strictEqual(g.isValidSave({ team: {} }), false);
  assert.strictEqual(g.isValidSave(g.freshState()), true);
  assert.strictEqual(
    g.isValidSave({
      started: true,
      team: { city: "X" },
      roster: [],
      teams: [],
    }),
    false,
  );
});

test("migrate backfills missing fields on a sparse save", () => {
  const g = loadGame(1);
  const m = g.migrate({ team: { city: "X" }, roster: [], teams: [] });
  assert.strictEqual(typeof m.year, "number");
  assert.ok(m.coaching && typeof m.coaching === "object");
  assert.ok(Array.isArray(m.awards));
  assert.ok(m.coaches.head && m.coaches.assistant && m.coaches.dev);
});

test("uniqueUserAbbr never collides with an existing NPC team id", () => {
  const g = loadGame(1);
  const taken = new Set(g.S.teams.map((t) => t.id));
  // Force a city/nick whose natural abbr equals a real team id.
  const realId = g.S.teams[0].id; // e.g. "ATL"
  const city = realId[0];
  const nick = realId.slice(1);
  const abbr = g.uniqueUserAbbr(city, nick);
  assert.ok(!taken.has(abbr), `expected unique abbr, got ${abbr}`);
});

test("generateSchedule produces no self-games", () => {
  const g = loadGame(1);
  g.S.started = true;
  g.S.team.abbr = g.uniqueUserAbbr(g.S.team.city, g.S.team.nickname);
  const sched = g.generateSchedule();
  assert.ok(sched.length > 0);
  for (const game of sched) assert.notStrictEqual(game.home, game.away);
  const gamesByTeam = Object.fromEntries(g.leagueIds().map((id) => [id, 0]));
  sched.forEach((game) => {
    gamesByTeam[game.home]++;
    gamesByTeam[game.away]++;
  });
  assert.deepStrictEqual(
    new Set(Object.values(gamesByTeam)).size,
    1,
    "every team should play the same number of games",
  );
});

test("simScore is deterministic under a seed and never ties", () => {
  const a = loadGame(42);
  const b = loadGame(42);
  a.S.started = b.S.started = true;
  const [h, v] = [a.S.teams[0].id, a.S.teams[1].id];
  const r1 = a.simScore(h, v);
  const r2 = b.simScore(h, v);
  assert.deepStrictEqual(
    { hs: r1.hs, as: r1.as },
    { hs: r2.hs, as: r2.as },
    "same seed must give same score",
  );
  assert.notStrictEqual(r1.hs, r1.as, "scores should not tie");
  assert.ok(r1.hs >= 55 && r1.as >= 55);
});

test("distributeAndRecord: player points reconcile exactly to the team score", () => {
  const g = loadGame(7);
  g.S.started = true;
  const teamId = g.S.teams[0].id;
  const team = g.S.teams[0];
  team.players.forEach((p) => (p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 }));
  for (const ptsFor of [55, 72, 88, 101]) {
    team.players.forEach((p) => (p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 }));
    g.distributeAndRecord(teamId, ptsFor, true);
    const sum = team.players.reduce((a, p) => a + p.seasonStats.pts, 0);
    assert.strictEqual(sum, ptsFor, `points must sum to ${ptsFor}, got ${sum}`);
  }
});

test("evaluateTrade rejects an empty package", () => {
  const g = loadGame(1);
  const other = g.S.teams[0];
  g.trade = {
    team: other.id,
    userGive: [],
    otherGive: [],
    userPicks: [],
    otherPicks: [],
    userPick: 0,
    otherPick: 0,
    query: "",
  };
  const ev = g.evaluateTrade(other);
  assert.strictEqual(ev.ok, false);
});

test("evaluateTrade rejects a pick the user no longer owns", () => {
  const g = loadGame(1);
  const other = g.S.teams[0];
  g.S.pickBoard = [];
  g.trade = {
    team: other.id,
    userGive: [],
    otherGive: [other.players[0].id],
    userPicks: ["missing-pick"],
    otherPicks: [],
    userPick: 0,
    otherPick: 0,
    query: "",
  };
  const ev = g.evaluateTrade(other);
  assert.strictEqual(ev.ok, false);
  assert.match(ev.reason, /do not have a future pick/i);
});

test("ageOnePlayer invalidates composite cache after rating changes", () => {
  const g = loadGame(2);
  const player = mkPlayer(50, {
    ratings: { ...ratings(50), potential: 99 },
    years: 2,
  });
  const report = g.ageOnePlayer(player);
  g.clearComputeCaches();
  assert.strictEqual(report.after, g.composite(player));
  assert.strictEqual(player.years, 1);
});

test("weekly development applies at most once for the same week", () => {
  const g = loadGame(3);
  const player = mkPlayer(60, {
    id: "dev-target",
    ratings: { ...ratings(60), potential: 90 },
  });
  g.S.roster = [player];
  g.S.coaching.devFocus = { playerId: player.id, rating: "scoring" };
  const before = player.ratings.scoring;
  assert.strictEqual(g.applyWeeklyTransition(4), true);
  const afterFirst = player.ratings.scoring;
  assert.ok(afterFirst > before);
  assert.strictEqual(g.applyWeeklyTransition(4), false);
  assert.strictEqual(player.ratings.scoring, afterFirst);
});

test("expired contracts stay on roster until the player walks", () => {
  const g = loadGame(4);
  const expired = mkPlayer(60, { id: "expired", years: 0 });
  const active = mkPlayer(60, { id: "active", years: 1 });
  g.S.roster = [expired, active];
  const result = g.resolveExpiredContracts();
  assert.deepStrictEqual(
    g.S.roster.map((p) => p.id),
    ["expired", "active"],
  );
  assert.strictEqual(result.user.length, 1);
  g.S.offseason = { pendingResign: result.user };
  g.walkUserPlayer("expired");
  assert.deepStrictEqual(
    g.S.roster.map((p) => p.id),
    ["active"],
  );
  assert.ok(g.S.freeAgents.some((p) => p.id === "expired"));
});

test("expired league contracts enter free agency instead of vanishing", () => {
  const g = loadGame(4);
  const expired = mkPlayer(60, { id: "npc-expired", years: 0, name: "NPC Expired" });
  g.S.teams[0].players = [expired, mkPlayer(60, { id: "npc-active", years: 2 })];
  g.S.freeAgents = [];
  const result = g.resolveExpiredContracts();
  assert.ok(g.S.freeAgents.some((p) => p.id === "npc-expired"));
  assert.ok(!g.S.teams[0].players.some((p) => p.id === "npc-expired"));
  assert.strictEqual(result.leagueCount, 1);
});

test("isValidPlayer rejects missing scouting text", () => {
  const g = loadGame(1);
  const player = mkPlayer(70);
  delete player.scouting;
  assert.strictEqual(g.isValidPlayer(player), false);
});

test("isValidSave rejects an incomplete season object", () => {
  const g = loadGame(1);
  const s = g.freshState();
  s.started = true;
  s.season = {};
  assert.strictEqual(g.isValidSave(s), false);
});

test("migrate repairs a string year and an empty season object", () => {
  const g = loadGame(1);
  const s = g.migrate({ ...g.freshState(), year: "2026", season: {} });
  assert.strictEqual(s.year, 2026);
  assert.strictEqual(s.season, null);
});

test("normalizeSave uniquifies a colliding user abbreviation", () => {
  const g = loadGame(1);
  const incoming = g.freshState();
  incoming.team.abbr = incoming.teams[0].id;
  const normalized = g.normalizeSave(incoming);
  assert.ok(normalized);
  assert.notStrictEqual(normalized.team.abbr, incoming.teams[0].id);
});

test("resetFaBase rebuilds stock free agents without leftover injuries", () => {
  const g = loadGame(1);
  const pool = g.waiverPool();
  pool[0].injury = { games: 6, severity: "severe" };
  g.resetFaBase();
  assert.strictEqual(g.waiverPool()[0].injury, null);
});

test("signing a stock free agent clones the cached card", () => {
  const g = loadGame(1);
  const id = g.waiverPool()[0].id;
  g.signPlayer(id);
  assert.strictEqual(g.S.roster.filter((p) => p.id === id).length, 1);
  g.S.roster = [];
  g.resetFaBase();
  const restored = g.waiverPool().find((p) => p.id === id);
  assert.ok(restored);
  assert.strictEqual(restored.team, "FA");
});

test("playoff box scores do not accumulate regular-season stats", () => {
  const g = loadGame(7);
  g.S.started = true;
  const team = g.S.teams[0];
  team.players.forEach((p) => (p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 }));
  g.distributeAndRecord(team.id, 88, true, false);
  const sum = team.players.reduce((a, p) => a + p.seasonStats.pts, 0);
  assert.strictEqual(sum, 0);
  assert.strictEqual(
    team.players.reduce((a, p) => a + p.seasonStats.gp, 0),
    0,
  );
});

test("weekly focus bonus only applies during the focus week", () => {
  const g = loadGame(11);
  g.S.started = true;
  g.S.week = 3;
  g.S.coaching.weeklyFocus = "perO";
  g.S.coaching.focusWeek = 3;
  const [home, away] = [g.S.team.abbr, g.S.teams[0].id];
  g.S.roster = [mkPlayer(80, { id: "u1", pos: "G" })];
  g.S.rngState = 99;
  const withFocus = g.simScore(home, away, { id: "G-focus", week: 3 });
  g.S.rngState = 99;
  const withoutFocus = g.simScore(home, away, { id: "G-later", week: 4 });
  assert.notDeepStrictEqual(
    { hs: withFocus.hs, as: withFocus.as },
    { hs: withoutFocus.hs, as: withoutFocus.as },
  );
});

test("maybeResetWeeklyFocus clears last week's plan", () => {
  const g = loadGame(1);
  g.S.coaching.weeklyFocus = "intD";
  g.S.coaching.focusWeek = 2;
  g.maybeResetWeeklyFocus(3);
  assert.strictEqual(g.S.coaching.weeklyFocus, "none");
  assert.strictEqual(g.S.coaching.focusWeek, null);
});

test("opening-night gate does not block a season already underway", () => {
  const g = loadGame(1);
  g.S.started = true;
  g.S.offseason = null;
  g.S.roster = [];
  g.S.season = {
    schedule: [{ id: "G1", played: true, week: 1, home: "ATL", away: "CHI" }],
    records: {},
    results: ["G1"],
  };
  assert.strictEqual(g.requireOpeningNightReady(), true);
});

test("enterPlayoffs refuses an unfinished regular season", () => {
  const g = loadGame(1);
  g.S.started = true;
  g.S.season = {
    schedule: [
      { id: "G1", played: true, week: 1, home: "ATL", away: "CHI" },
      { id: "G2", played: false, week: 1, home: "CHI", away: "ATL" },
    ],
    records: {},
    results: ["G1"],
  };
  g.S.playoffs = null;
  g.enterPlayoffs();
  assert.strictEqual(g.S.playoffs, null);
});

test("startNextSeason clears leftover injuries", () => {
  const g = loadGame(1);
  const roster = [
    mkPlayer(70, { id: "g1", pos: "G", injury: { games: 9, severity: "severe" } }),
    mkPlayer(70, { id: "g2", pos: "G" }),
    mkPlayer(70, { id: "g3", pos: "G" }),
    mkPlayer(70, { id: "g4", pos: "G" }),
    mkPlayer(70, { id: "f1", pos: "F" }),
    mkPlayer(70, { id: "f2", pos: "F" }),
    mkPlayer(70, { id: "f3", pos: "F" }),
    mkPlayer(70, { id: "f4", pos: "F" }),
    mkPlayer(70, { id: "c1", pos: "C" }),
    mkPlayer(70, { id: "c2", pos: "C" }),
    mkPlayer(70, { id: "c3", pos: "C" }),
  ];
  g.S.started = true;
  g.S.roster = roster;
  g.S.offseason = { stage: "done", picks: [], draftOrder: [], rookieClass: [] };
  g.S.season = { schedule: [{ id: "G1", played: true }], records: {}, results: [] };
  g.startNextSeason();
  assert.ok(g.S.roster.every((p) => p.injury === null));
});

test("buildDraftOrder uses pick inventory", () => {
  const g = loadGame(1);
  g.S.started = true;
  g.S.season = {
    schedule: [],
    records: Object.fromEntries(
      [g.S.team.abbr, ...g.S.teams.map((t) => t.id)].map((id) => [
        id,
        { w: 0, l: 0, pf: 0, pa: 0, streak: "—" },
      ]),
    ),
    results: [],
  };
  g.S.pickBoard = g.S.teams.map((team) => ({
    id: `${team.id}-2027-1`,
    year: 2027,
    round: 1,
    original: team.id,
    owner: team.id,
  }));
  assert.ok(!g.buildDraftOrder(14).includes(g.S.team.abbr));
  g.S.pickBoard.push(
    {
      id: `${g.S.team.abbr}-2027-1`,
      year: 2027,
      round: 1,
      original: g.S.team.abbr,
      owner: g.S.team.abbr,
    },
    {
      id: `${g.S.team.abbr}-2027-2`,
      year: 2027,
      round: 2,
      original: g.S.team.abbr,
      owner: g.S.team.abbr,
    },
    { id: `ATL-2027-2`, year: 2027, round: 2, original: "ATL", owner: g.S.team.abbr },
  );
  const withExtras = g.buildDraftOrder(40);
  assert.strictEqual(withExtras.filter((id) => id === g.S.team.abbr).length, 3);
});

test("marketChurn does not NaN a missing mood", () => {
  const g = loadGame(1);
  g.S.teams[0].players[0].mood = undefined;
  g.marketChurn();
  assert.ok(Number.isFinite(g.S.teams[0].players[0].mood));
});

test("firstTag is safe on missing strength text", () => {
  const g = loadGame(1);
  assert.strictEqual(g.firstTag(undefined), "—");
  assert.strictEqual(g.firstTag("Shooting, Pace"), "Shooting");
});

test("trading a year-stamped pick changes who owns that draft slot", () => {
  const g = loadGame(1);
  const other = g.S.teams[0];
  g.ensurePickBoard(g.S);
  const pick = g.ownedPicks(g.S.team.abbr)[0];
  assert.ok(pick);
  g.S.roster = [mkPlayer(70, { id: "give-1", salary: 200000, protected: false })];
  other.players[0].salary = 200000;
  other.players[0].protected = false;
  g.trade = {
    team: other.id,
    userGive: ["give-1"],
    otherGive: [other.players[0].id],
    userPicks: [pick.id],
    otherPicks: [],
    userPick: 0,
    otherPick: 0,
    query: "",
  };
  g.executeTrade();
  assert.strictEqual(pick.owner, other.id);
  assert.ok(g.ownedPicks(other.id).some((item) => item.id === pick.id));
  assert.ok(!g.ownedPicks(g.S.team.abbr).some((item) => item.id === pick.id));
});

test("NPC free agency restocks thin rosters to 11-12", () => {
  const g = loadGame(5);
  const team = g.S.teams[0];
  const leftover = team.players.slice(0, 8);
  leftover.forEach((player) => {
    player.years = 2;
    player.salary = 200000;
  });
  team.players = leftover;
  g.S.freeAgents = [
    mkPlayer(62, { id: "fa-g", pos: "G", lastTeam: team.id, years: 1, salary: 200000 }),
    mkPlayer(60, { id: "fa-f", pos: "F", lastTeam: "FA", years: 1, salary: 200000 }),
    mkPlayer(58, { id: "fa-c", pos: "C", lastTeam: "FA", years: 1, salary: 200000 }),
    mkPlayer(57, { id: "fa-g2", pos: "G", lastTeam: "FA", years: 1, salary: 200000 }),
  ];
  g.runNpcFreeAgency();
  assert.ok(team.players.length >= 11);
  assert.ok(team.players.length <= 12);
});

test("refreshWaiverClass replaces the five-name base list", () => {
  const g = loadGame(8);
  const first = g
    .waiverPool()
    .slice(0, 5)
    .map((p) => p.id);
  g.refreshWaiverClass(2028);
  const next = g
    .waiverPool()
    .slice(0, 5)
    .map((p) => p.id);
  assert.notDeepStrictEqual(next, first);
  assert.ok(next.every((id) => String(id).includes("2028")));
});

test("signPlayer logs the contract length on the card", () => {
  const g = loadGame(3);
  const logs = [];
  const player = g.waiverPool()[0];
  player.years = 3;
  g.S.roster = [];
  g.S.log = logs;
  g.signPlayer(player.id);
  assert.ok(g.S.roster.some((item) => item.id === player.id));
  assert.match(g.S.log[0].body, /3-year deal/);
});

test("ageOnePlayer increments age and reports it", () => {
  const g = loadGame(2);
  const player = mkPlayer(70, { age: 27, years: 2, ratings: { ...ratings(70), potential: 70 } });
  const report = g.ageOnePlayer(player);
  assert.strictEqual(player.age, 28);
  assert.strictEqual(report.age, 28);
});

test("healthyRotation follows the user sit/start order", () => {
  const g = loadGame(1);
  const benchStar = mkPlayer(90, { id: "star", pos: "G" });
  const starter = mkPlayer(60, { id: "role", pos: "G" });
  g.S.roster = [benchStar, starter];
  g.S.rotation = ["role"];
  const rotation = g.healthyRotation(g.S.roster, 2, g.S.team.abbr);
  assert.strictEqual(rotation[0].id, "role");
  assert.strictEqual(rotation[1].id, "star");
});

test("mood changes simScore in a tiny, deterministic way", () => {
  const low = loadGame(11);
  const high = loadGame(11);
  const home = low.S.teams[0].id;
  const away = low.S.teams[1].id;
  low.S.teams[0].players.forEach((p) => (p.mood = 20));
  high.S.teams[0].players.forEach((p) => (p.mood = 99));
  const a = low.simScore(home, away);
  const b = high.simScore(home, away);
  assert.ok(b.hs > a.hs);
});

test("aiPickRookie prefers the calling team's positional need", () => {
  const g = loadGame(4);
  const team = g.S.teams[0];
  team.players = [
    mkPlayer(80, { id: "g1", pos: "G" }),
    mkPlayer(80, { id: "g2", pos: "G" }),
    mkPlayer(80, { id: "g3", pos: "G" }),
    mkPlayer(80, { id: "f1", pos: "F" }),
    mkPlayer(80, { id: "f2", pos: "F" }),
  ];
  const available = [
    mkPlayer(88, { id: "best-g", pos: "G", ratings: { ...ratings(88), potential: 90 } }),
    mkPlayer(80, { id: "need-c", pos: "C", ratings: { ...ratings(80), potential: 80 } }),
  ];
  const chosen = g.aiPickRookie(team.id, available);
  assert.strictEqual(chosen.id, "need-c");
});

test("undo stack keeps the last N recorded states", () => {
  const g = loadGame(1);
  g.undoStack = [];
  g.S.roster = [mkPlayer(70, { id: "keep" })];
  const id = g.waiverPool()[0].id;
  g.signPlayer(id);
  assert.ok(g.undoStack.length >= 1);
  assert.ok(g.undoStack[0].label.includes("signing"));
});

test("compact awards keep MIP, All-League, record, and playoff result", () => {
  const g = loadGame(1);
  g.S.started = true;
  g.S.season = {
    schedule: [],
    records: { [g.S.team.abbr]: { w: 22, l: 18, pf: 0, pa: 0, streak: "W1" } },
    results: [],
  };
  g.S.playoffs = { champion: g.S.team.abbr, rounds: [] };
  const player = mkPlayer(80, { id: "mvp", name: "Star" });
  player.seasonStats = { gp: 20, pts: 400, reb: 80, ast: 80, w: 14 };
  const packed = g.compactSeasonAwards({
    year: 2026,
    champion: g.S.team.abbr,
    mvp: { p: player, teamId: g.S.team.abbr },
    dpoy: { p: player, teamId: g.S.team.abbr },
    roy: null,
    mip: { p: player, teamId: g.S.team.abbr },
    allLeague: [{ p: player, teamId: g.S.team.abbr }],
  });
  assert.strictEqual(packed.userRecord.w, 22);
  assert.strictEqual(packed.playoffResult, "Champion");
  assert.strictEqual(packed.mip.name, "Star");
  assert.strictEqual(packed.allLeague[0].name, "Star");
});

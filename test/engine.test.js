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
  team.players.forEach(
    (p) => (p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 }),
  );
  for (const ptsFor of [55, 72, 88, 101]) {
    team.players.forEach(
      (p) => (p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 }),
    );
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
    userPick: 0,
    otherPick: 0,
    query: "",
  };
  const ev = g.evaluateTrade(other);
  assert.strictEqual(ev.ok, false);
});

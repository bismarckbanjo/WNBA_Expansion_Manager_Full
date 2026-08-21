const DATA = window.GAME_DATA;
const BALANCE = window.GAME_BALANCE;
const ENGINE = window.GAME_ENGINE;
const SCHEMA = window.GAME_SCHEMA;
const LS_KEY = "wnbaExpansionFullBuild.v2";
const ACTIVE_SLOT_KEY = "wnbaExpansion.activeSlot.v1";
const SAVE_INDEX_KEY = "wnbaExpansion.saveIndex.v1";
const SLOT_PREFIX = "wnbaExpansion.slot.v1.";
const SAVE_VERSION = 7;
function cbaValue(key, fallback) {
  const cba = DATA.cba || {};
  const value = cba[key];
  return Number.isFinite(value) ? value : fallback;
}
function rookieScaleSalary(pickNumber) {
  const scale = (DATA.cba && DATA.cba.rookieScale) || [];
  const idx = Math.max(0, pickNumber - 1);
  if (Number.isFinite(scale[idx])) return scale[idx];
  return cbaValue("minRookie", 270000);
}
const money = (n) => "$" + Math.round(n).toLocaleString();
const shortMoney = (n) =>
  n >= 1000000
    ? "$" + (n / 1000000).toFixed(n % 1000000 ? 1 : 0) + "M"
    : "$" + Math.round(n / 1000) + "K";
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
const clone = (x) => JSON.parse(JSON.stringify(x));
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
const escapeAttr = escapeHtml;
function firstTag(value) {
  return String(value || "").split(",")[0] || "—";
}
function contrastText(hex) {
  const value = String(hex || "").replace("#", "");
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#fff";
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 >= 145 ? "#111" : "#fff";
}
function badgeStyle(color) {
  return `background:${escapeAttr(color)};color:${contrastText(color)}`;
}
const PLAYER_RATING_KEYS = [
  "scoring",
  "shooting",
  "playmaking",
  "defense",
  "rebounding",
  "athleticism",
  "iq",
  "potential",
];
let activeSlotId = getActiveSlotId();
let S = load() || normalizeSave(freshState());
let tab = S.started ? "dashboard" : "setup";
let modal = null;
let draftFilters = {
  q: "",
  pos: "ALL",
  team: "ALL",
  risk: "ALL",
  strength: "",
  arch: "ALL",
};
let trade = {
  team: "ATL",
  userGive: [],
  otherGive: [],
  userPicks: [],
  otherPicks: [],
  userPick: 0,
  otherPick: 0,
  query: "",
};
let undoStack = [];
let modalReturnFocusSelector = null;
let pendingImport = null;
function freshState() {
  const rngSeed = Math.floor(Math.random() * 0xffffffff) || 1;
  return {
    started: false,
    saveName: "My Franchise",
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
    pickBoard: [],
    rotation: [],
    pendingOffers: [],
    faClassYear: 2026,
    season: null,
    year: 2026,
    saveVersion: SAVE_VERSION,
    balanceVersion: BALANCE.version,
    rngSeed,
    rngState: rngSeed,
    lastSaved: new Date().toISOString(),
    offseason: null,
    customRookies: {},
    freeAgents: [],
    coaching: {
      weeklyFocus: "none",
      focusWeek: null,
      lastTransitionWeek: 0,
      devFocus: { playerId: null, rating: "scoring" },
      gamePlans: {},
      pendingPress: null,
      pressLog: [],
    },
    gameDay: null,
    postGame: null,
    playoffs: null,
    awards: [],
    pendingAwards: null,
    coaches: {
      head: clone(DATA.userStaffDefaults.head),
      assistant: clone(DATA.userStaffDefaults.assistant),
      dev: clone(DATA.userStaffDefaults.dev),
      pendingBuff: null,
      devAccumulator: 0,
    },
    lockerRoom: {
      heat: 0,
      suppressedUntilWeek: 0,
      influence: 1,
      lastInfluenceWeek: 0,
      events: [],
      pairings: {},
      captainId: null,
      culture: null,
      cultureTrack: { grit: 0, lab: 0, star: 0 },
      campaignId: null,
      lastCoreIds: [],
      seasonHeatPeak: 0,
    },
    log: [],
    objectives: [
      { id: "roster11", text: "Draft at least 11 players", done: false },
      {
        id: "positions",
        text: "Carry every position group: G, F, C",
        done: false,
      },
      { id: "cap", text: "Stay below the 2026 salary cap", done: false },
      {
        id: "future",
        text: "Preserve at least 2 future pick assets",
        done: false,
      },
    ],
  };
}
function migrate(s) {
  if (!s) return s;
  if (typeof s.year !== "number" || !Number.isFinite(s.year)) {
    const parsedYear = parseInt(s.year, 10);
    s.year = Number.isFinite(parsedYear) ? parsedYear : 2026;
  }
  if (s.offseason === undefined) s.offseason = null;
  if (s.offseason && typeof s.offseason === "object") {
    if (!Array.isArray(s.offseason.picks)) s.offseason.picks = [];
    if (!Array.isArray(s.offseason.draftOrder)) s.offseason.draftOrder = [];
    if (!Array.isArray(s.offseason.rookieClass)) s.offseason.rookieClass = [];
    if (!Array.isArray(s.offseason.agingReport)) s.offseason.agingReport = [];
  }
  if (!s.customRookies || typeof s.customRookies !== "object") s.customRookies = {};
  Object.keys(s.customRookies).forEach((year) => {
    if (!Array.isArray(s.customRookies[year])) s.customRookies[year] = [];
  });
  if (!Array.isArray(s.freeAgents)) s.freeAgents = [];
  if (!Array.isArray(s.rotation)) s.rotation = [];
  if (!Array.isArray(s.pendingOffers)) s.pendingOffers = [];
  if (!Number.isFinite(s.faClassYear)) s.faClassYear = s.year || 2026;
  if (s.offseason && typeof s.offseason === "object" && !Array.isArray(s.offseason.pendingResign)) {
    s.offseason.pendingResign = [];
  }
  if (s.season && typeof s.season === "object") {
    if (!Array.isArray(s.season.schedule)) s.season = null;
    else {
      if (!s.season.records || typeof s.season.records !== "object") s.season.records = {};
      if (!Array.isArray(s.season.results)) s.season.results = [];
    }
  }
  if (s.playoffs && typeof s.playoffs === "object" && !Array.isArray(s.playoffs.rounds)) {
    s.playoffs = null;
  }
  if (!s.coaching) {
    s.coaching = {
      weeklyFocus: "none",
      focusWeek: null,
      lastTransitionWeek: 0,
      devFocus: { playerId: null, rating: "scoring" },
      gamePlans: {},
      pendingPress: null,
      pressLog: [],
    };
  }
  if (typeof s.coaching.lastTransitionWeek !== "number") s.coaching.lastTransitionWeek = 0;
  if (s.coaching.focusWeek === undefined) s.coaching.focusWeek = null;
  if (s.gameDay === undefined) s.gameDay = null;
  if (s.postGame === undefined) s.postGame = null;
  if (s.playoffs === undefined) s.playoffs = null;
  if (!Array.isArray(s.awards)) s.awards = [];
  if (s.pendingAwards === undefined) s.pendingAwards = null;
  if (!s.coaches) s.coaches = {};
  // Repair each role independently so a partial old save can't leave a coach undefined.
  if (!s.coaches.head) s.coaches.head = JSON.parse(JSON.stringify(DATA.userStaffDefaults.head));
  if (typeof s.saveVersion !== "number") s.saveVersion = 1;
  if (typeof s.balanceVersion !== "number") s.balanceVersion = BALANCE.version;
  if (!Number.isInteger(s.rngSeed)) s.rngSeed = Math.floor(Math.random() * 0xffffffff) || 1;
  if (!Number.isInteger(s.rngState)) s.rngState = s.rngSeed;
  if (!s.lastSaved) s.lastSaved = new Date().toISOString();
  if (s.saveVersion < SAVE_VERSION) s.saveVersion = SAVE_VERSION;
  if (!s.coaches.assistant)
    s.coaches.assistant = JSON.parse(JSON.stringify(DATA.userStaffDefaults.assistant));
  if (!s.coaches.dev) s.coaches.dev = JSON.parse(JSON.stringify(DATA.userStaffDefaults.dev));
  if (s.coaches.pendingBuff === undefined) s.coaches.pendingBuff = null;
  if (typeof s.coaches.devAccumulator !== "number") s.coaches.devAccumulator = 0;
  if (!s.lockerRoom || typeof s.lockerRoom !== "object") s.lockerRoom = {};
  if (!Number.isFinite(s.lockerRoom.heat)) s.lockerRoom.heat = 0;
  if (!Number.isFinite(s.lockerRoom.suppressedUntilWeek)) s.lockerRoom.suppressedUntilWeek = 0;
  if (!Number.isFinite(s.lockerRoom.influence)) s.lockerRoom.influence = 1;
  if (!Number.isFinite(s.lockerRoom.lastInfluenceWeek)) s.lockerRoom.lastInfluenceWeek = 0;
  if (!Array.isArray(s.lockerRoom.events)) s.lockerRoom.events = [];
  if (!s.lockerRoom.pairings || typeof s.lockerRoom.pairings !== "object")
    s.lockerRoom.pairings = {};
  if (s.lockerRoom.captainId === undefined) s.lockerRoom.captainId = null;
  if (s.lockerRoom.culture === undefined) s.lockerRoom.culture = null;
  if (!s.lockerRoom.cultureTrack || typeof s.lockerRoom.cultureTrack !== "object") {
    s.lockerRoom.cultureTrack = { grit: 0, lab: 0, star: 0 };
  }
  ["grit", "lab", "star"].forEach((key) => {
    if (!Number.isFinite(s.lockerRoom.cultureTrack[key])) s.lockerRoom.cultureTrack[key] = 0;
  });
  if (s.lockerRoom.campaignId === undefined) s.lockerRoom.campaignId = null;
  if (!Array.isArray(s.lockerRoom.lastCoreIds)) s.lockerRoom.lastCoreIds = [];
  if (!Number.isFinite(s.lockerRoom.seasonHeatPeak)) s.lockerRoom.seasonHeatPeak = 0;
  // Stats foundations for every player
  const ensureStats = (p) => {
    if (!p.seasonStats) p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 };
    if (p.compositeAtStart === undefined) p.compositeAtStart = null;
    if (p.rookieYear === undefined) p.rookieYear = null;
    if (!Number.isFinite(p.age)) {
      const factoryAge = window.GAME_FACTORIES && window.GAME_FACTORIES.stableAge;
      p.age = factoryAge ? factoryAge(p.name || "player", p.team || "FA") : 26;
    }
    if (p.lastTeam === undefined) p.lastTeam = p.team || null;
  };
  const stampPersonality = (p) => {
    ensureStats(p);
    if (window.GAME_FACTORIES && window.GAME_FACTORIES.ensurePersonality) {
      window.GAME_FACTORIES.ensurePersonality(p);
    }
  };
  (s.roster || []).forEach(stampPersonality);
  (s.waived || []).forEach(stampPersonality);
  (s.freeAgents || []).forEach(stampPersonality);
  (s.teams || []).forEach((t) => (t.players || []).forEach(stampPersonality));
  // Ensure injury field on every player record (fatigue field is left orphaned for backward compat)
  const ensureInjury = (p) => {
    if (p.injury === undefined) p.injury = null;
  };
  (s.roster || []).forEach(ensureInjury);
  (s.waived || []).forEach(ensureInjury);
  (s.freeAgents || []).forEach(ensureInjury);
  (s.teams || []).forEach((t) => (t.players || []).forEach(ensureInjury));
  ensurePickBoard(s);
  rehomeOrphanUserPicks(s);
  ensureUpcomingUserPick(s);
  return s;
}
function isRecord(value) {
  return SCHEMA.isRecord(value);
}
function isValidPlayer(player) {
  return SCHEMA.isValidPlayer(player, PLAYER_RATING_KEYS);
}
function isValidTeam(team) {
  return SCHEMA.isValidTeam(team, PLAYER_RATING_KEYS);
}
function isValidPick(pick) {
  return !!(
    isRecord(pick) &&
    typeof pick.id === "string" &&
    Number.isInteger(pick.year) &&
    (pick.round === 1 || pick.round === 2) &&
    typeof pick.original === "string" &&
    typeof pick.owner === "string"
  );
}
function buildDefaultPickBoard(year, userId, teams) {
  const board = [];
  const ids = [userId, ...(teams || []).map((team) => team.id)];
  ids.forEach((id) => {
    [1, 2].forEach((offset) => {
      const pickYear = year + offset;
      board.push({
        id: `${id}-${pickYear}-1`,
        year: pickYear,
        round: 1,
        original: id,
        owner: id,
      });
    });
  });
  board.push({
    id: `${userId}-${year + 1}-2`,
    year: year + 1,
    round: 2,
    original: userId,
    owner: userId,
  });
  return board;
}
function ownedPicks(ownerId, state) {
  const s = state || S;
  return (s.pickBoard || []).filter((pick) => pick.owner === ownerId);
}
function syncPickCounts(state) {
  const s = state || S;
  if (!isRecord(s.picks)) s.picks = { you: 0, league: 0 };
  const userId = s.team && s.team.abbr;
  s.picks.you = ownedPicks(userId, s).length;
  s.picks.league = (s.pickBoard || []).filter((pick) => pick.owner && pick.owner !== userId).length;
}
function ensurePickBoard(state) {
  const s = state || S;
  if (!s.team || !s.team.abbr) return;
  if (!Array.isArray(s.pickBoard) || !s.pickBoard.length) {
    s.pickBoard = buildDefaultPickBoard(s.year || 2026, s.team.abbr, s.teams || []);
    if (isRecord(s.picks) && Number.isInteger(s.picks.you)) {
      const userOwned = ownedPicks(s.team.abbr, s);
      if (s.picks.you < userOwned.length) {
        userOwned.slice(s.picks.you).forEach((pick) => {
          const fallback = (s.teams && s.teams[0] && s.teams[0].id) || pick.owner;
          pick.owner = fallback;
        });
      }
    }
  }
  syncPickCounts(s);
}
function grantUpcomingPicks(state) {
  const s = state || S;
  if (!Array.isArray(s.pickBoard)) s.pickBoard = [];
  const horizon = (s.year || 2026) + 2;
  const ids = [s.team.abbr, ...(s.teams || []).map((team) => team.id)];
  ids.forEach((id) => {
    if (
      !s.pickBoard.some((pick) => pick.original === id && pick.year === horizon && pick.round === 1)
    ) {
      s.pickBoard.push({
        id: `${id}-${horizon}-1`,
        year: horizon,
        round: 1,
        original: id,
        owner: id,
      });
    }
  });
  syncPickCounts(s);
}
function consumeDraftYearPicks(year, state) {
  const s = state || S;
  s.pickBoard = (s.pickBoard || []).filter((pick) => pick.year !== year);
  syncPickCounts(s);
}
function ensureUpcomingUserPick(state) {
  const s = state || S;
  if (!s.team || !s.team.abbr) return;
  if (!Array.isArray(s.pickBoard)) s.pickBoard = [];
  const draftYear = (s.year || 2026) + 1;
  const userId = s.team.abbr;
  const hasOriginal = s.pickBoard.some(
    (pick) => pick.original === userId && pick.year === draftYear,
  );
  if (!hasOriginal) {
    s.pickBoard.push({
      id: `${userId}-${draftYear}-1`,
      year: draftYear,
      round: 1,
      original: userId,
      owner: userId,
    });
  }
  syncPickCounts(s);
}
function campRosterLimit() {
  return S.offseason && (S.offseason.stage === "draft" || S.offseason.stage === "done")
    ? DATA.rosterMax + 1
    : DATA.rosterMax;
}
function findPick(id, state) {
  return (state || S).pickBoard.find((pick) => pick.id === id) || null;
}
function pickLabel(pick) {
  if (!pick) return "Pick";
  const round = pick.round === 1 ? "1st" : "2nd";
  return `${pick.year} ${round}${pick.original && pick.original !== pick.owner ? ` (via ${pick.original})` : ""}`;
}
function pickTradeValue(pick) {
  if (!pick) return 0;
  const yearsOut = Math.max(0, pick.year - ((S && S.year) || pick.year) - 1);
  const base = pick.round === 1 ? BALANCE.trade.pickRound1 : BALANCE.trade.pickRound2;
  return base + yearsOut * BALANCE.trade.pickYearBonus;
}
function selectedPicks(side) {
  const ids = trade[side === "user" ? "userPicks" : "otherPicks"] || [];
  if (ids.length) return ids.map((id) => findPick(id)).filter(Boolean);
  if (side === "user" && trade.userPick) return ownedPicks(S.team.abbr).slice(0, 1);
  if (side === "other" && trade.otherPick) {
    const partnerId = trade.team;
    return ownedPicks(partnerId).slice(0, 1);
  }
  return [];
}
function reassignUserPicks(oldId, newId, state) {
  const s = state || S;
  if (!oldId || !newId || oldId === newId) return;
  (s.pickBoard || []).forEach((pick) => {
    if (pick.owner === oldId) pick.owner = newId;
    if (pick.original === oldId) pick.original = newId;
    pick.id = `${pick.original}-${pick.year}-${pick.round}`;
  });
  syncPickCounts(s);
}
function rehomeOrphanUserPicks(state) {
  const s = state || S;
  if (!s.team || !s.team.abbr) return;
  const userId = s.team.abbr;
  const known = new Set((s.teams || []).map((team) => team.id));
  known.add(userId);
  let moved = false;
  (s.pickBoard || []).forEach((pick) => {
    const ownerMissing = pick.owner && !known.has(pick.owner);
    const originalMissing = pick.original && !known.has(pick.original);
    if (!ownerMissing && !originalMissing) return;
    if (ownerMissing) pick.owner = userId;
    if (originalMissing) pick.original = userId;
    pick.id = `${pick.original}-${pick.year}-${pick.round}`;
    moved = true;
  });
  if (moved) syncPickCounts(s);
}
function tradesLocked() {
  if (S.offseason) return false;
  if (!S.season || !Array.isArray(S.season.schedule)) return false;
  if (S.phase === "Expansion Build") return false;
  const deadline = BALANCE.tradeDeadlineWeek || 12;
  return S.week > deadline && S.season.schedule.some((game) => game.played);
}
// Validate the complete shape used by render and the simulation before imported
// state can replace the current save. This is intentionally stricter than a
// top-level presence check: malformed nested teams/players used to pass import.
function isValidSave(s) {
  return !!(
    isRecord(s) &&
    isRecord(s.team) &&
    typeof s.team.city === "string" &&
    typeof s.team.nickname === "string" &&
    typeof s.team.abbr === "string" &&
    typeof s.team.arena === "string" &&
    typeof s.team.primary === "string" &&
    typeof s.team.secondary === "string" &&
    Array.isArray(s.roster) &&
    s.roster.every(isValidPlayer) &&
    Array.isArray(s.waived) &&
    s.waived.every(isValidPlayer) &&
    Array.isArray(s.teams) &&
    s.teams.length > 0 &&
    s.teams.every(isValidTeam) &&
    new Set(s.teams.map((team) => team.id)).size === s.teams.length &&
    isRecord(s.picks) &&
    Number.isInteger(s.picks.you) &&
    s.picks.you >= 0 &&
    Number.isInteger(s.picks.league) &&
    s.picks.league >= 0 &&
    Array.isArray(s.objectives) &&
    isRecord(s.coaching) &&
    isRecord(s.coaches) &&
    Array.isArray(s.log) &&
    isRecord(s.customRookies) &&
    Object.values(s.customRookies).every((list) => Array.isArray(list)) &&
    Array.isArray(s.freeAgents) &&
    s.freeAgents.every(isValidPlayer) &&
    (!s.pickBoard || (Array.isArray(s.pickBoard) && s.pickBoard.every(isValidPick))) &&
    (!s.rotation || Array.isArray(s.rotation)) &&
    (!s.pendingOffers || Array.isArray(s.pendingOffers)) &&
    Number.isFinite(s.year) &&
    !s.teams.some((team) => team.id === s.team.abbr) &&
    isValidSeason(s.season) &&
    isValidPlayoffs(s.playoffs) &&
    isValidOffseason(s.offseason)
  );
}
function isValidSeason(season) {
  if (season === null || season === undefined) return true;
  return !!(
    isRecord(season) &&
    Array.isArray(season.schedule) &&
    isRecord(season.records) &&
    Array.isArray(season.results)
  );
}
function isValidPlayoffs(playoffs) {
  if (playoffs === null || playoffs === undefined) return true;
  return !!(isRecord(playoffs) && Array.isArray(playoffs.rounds));
}
function isValidOffseason(offseason) {
  if (offseason === null || offseason === undefined) return true;
  return !!(
    isRecord(offseason) &&
    typeof offseason.stage === "string" &&
    Array.isArray(offseason.picks) &&
    Array.isArray(offseason.draftOrder) &&
    Array.isArray(offseason.rookieClass)
  );
}
function normalizeSave(input) {
  if (!isRecord(input)) return null;
  const base = freshState();
  const s = migrate(input);
  s.saveName =
    typeof s.saveName === "string" && s.saveName.trim() ? s.saveName.trim() : base.saveName;
  s.team = { ...base.team, ...(isRecord(s.team) ? s.team : {}) };
  s.waived = Array.isArray(s.waived) ? s.waived : [];
  s.picks = { ...base.picks, ...(isRecord(s.picks) ? s.picks : {}) };
  s.objectives = Array.isArray(s.objectives) ? s.objectives : base.objectives;
  s.log = Array.isArray(s.log) ? s.log : [];
  s.coaching = {
    ...base.coaching,
    ...(isRecord(s.coaching) ? s.coaching : {}),
    devFocus: {
      ...base.coaching.devFocus,
      ...(isRecord(s.coaching && s.coaching.devFocus) ? s.coaching.devFocus : {}),
    },
    gamePlans: isRecord(s.coaching && s.coaching.gamePlans) ? s.coaching.gamePlans : {},
    pressLog: Array.isArray(s.coaching && s.coaching.pressLog) ? s.coaching.pressLog : [],
  };
  s.lockerRoom = {
    ...base.lockerRoom,
    ...(isRecord(s.lockerRoom) ? s.lockerRoom : {}),
    events: Array.isArray(s.lockerRoom && s.lockerRoom.events) ? s.lockerRoom.events : [],
    pairings: isRecord(s.lockerRoom && s.lockerRoom.pairings) ? s.lockerRoom.pairings : {},
    cultureTrack: {
      ...base.lockerRoom.cultureTrack,
      ...(isRecord(s.lockerRoom && s.lockerRoom.cultureTrack) ? s.lockerRoom.cultureTrack : {}),
    },
    lastCoreIds: Array.isArray(s.lockerRoom && s.lockerRoom.lastCoreIds)
      ? s.lockerRoom.lastCoreIds
      : [],
  };
  s.customRookies = isRecord(s.customRookies) ? s.customRookies : {};
  s.awards = Array.isArray(s.awards) ? s.awards : [];
  s.freeAgents = Array.isArray(s.freeAgents) ? s.freeAgents : [];
  s.rotation = Array.isArray(s.rotation) ? s.rotation : [];
  s.pendingOffers = Array.isArray(s.pendingOffers) ? s.pendingOffers : [];
  if (typeof s.year !== "number" || !Number.isFinite(s.year)) s.year = 2026;
  s.team.abbr = uniqueAbbrAgainst(s.team.abbr, s.team.city, s.team.nickname, s.teams);
  ensurePickBoard(s);
  return isValidSave(s) ? s : null;
}
function load() {
  try {
    const slotRaw = localStorage.getItem(slotStorageKey(activeSlotId));
    const legacyRaw = localStorage.getItem(LS_KEY);
    return normalizeSave(JSON.parse(slotRaw || legacyRaw));
  } catch {
    return null;
  }
}
function slotStorageKey(id) {
  return SLOT_PREFIX + id;
}
function getActiveSlotId() {
  try {
    return localStorage.getItem(ACTIVE_SLOT_KEY) || "default";
  } catch {
    return "default";
  }
}
function readSaveIndex() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_INDEX_KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
function writeSaveIndex(index) {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}
function updateSaveIndex() {
  const index = readSaveIndex().filter((slot) => slot.id !== activeSlotId);
  index.push({
    id: activeSlotId,
    name: S.saveName,
    year: S.year,
    updatedAt: S.lastSaved,
  });
  writeSaveIndex(index.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}
function save() {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
  }
  S.saveVersion = SAVE_VERSION;
  S.balanceVersion = BALANCE.version;
  S.lastSaved = new Date().toISOString();
  try {
    const serialized = JSON.stringify(S);
    localStorage.setItem(slotStorageKey(activeSlotId), serialized);
    localStorage.setItem(ACTIVE_SLOT_KEY, activeSlotId);
    if (activeSlotId === "default") localStorage.setItem(LS_KEY, serialized);
    updateSaveIndex();
    return true;
  } catch (error) {
    console.error("Unable to save franchise state", error);
    if (!storageErrorShown) {
      storageErrorShown = true;
      toast("Autosave failed. Export your save from Admin before closing.");
    }
    return false;
  }
}
// Debounced autosave used by render() so rapid UI updates don't each pay for a
// full serialize. Explicit save() calls (game actions) still persist immediately,
// and a beforeunload flush guarantees nothing is lost on exit.
let _saveTimer = null;
let storageErrorShown = false;
function queueSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    save();
  }, 400);
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("beforeunload", () => {
    if (_saveTimer) save();
  });
  window.addEventListener("visibilitychange", () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden" && _saveTimer)
      save();
  });
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("keydown", (event) => {
    if (!modal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      document.querySelectorAll(
        '.modal button:not([disabled]), .modal input:not([disabled]), .modal select:not([disabled]), .modal textarea:not([disabled]), .modal [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
function exportSave() {
  const text = JSON.stringify(S, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(S.saveName) || "wnba-expansion"}-${S.year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Save exported.");
}
function importSave() {
  const raw = (document.getElementById("saveImport") || {}).value || "";
  if (!raw.trim()) return toast("Paste JSON into the import box first.");
  try {
    const incoming = normalizeSave(JSON.parse(raw));
    if (!incoming) throw new Error("Save is missing required fields.");
    pendingImport = incoming;
    toast("Import validated. Review the preview before applying it.");
    render();
  } catch (error) {
    console.error(error);
    toast("Import failed: invalid or incomplete save JSON.");
  }
}
function confirmImport() {
  if (!pendingImport) return;
  recordUndo("save import");
  resetFaBase();
  S = pendingImport;
  pendingImport = null;
  tab = S.started ? "dashboard" : "setup";
  save();
  toast("Save imported successfully.");
  render();
  resumeOffseasonDraft();
}
function createSaveSlot() {
  const name = readField("save-slot-name").trim();
  if (!name) return toast("Enter a name for the new save slot.");
  save();
  activeSlotId = `${slug(name) || "franchise"}-${Date.now().toString(36)}`;
  S.saveName = name;
  undoStack = [];
  save();
  toast(`Saved a copy as “${name}”.`);
  render();
}
function loadSaveSlot(id) {
  if (!id || id === activeSlotId) return;
  save();
  try {
    const incoming = normalizeSave(JSON.parse(localStorage.getItem(slotStorageKey(id))));
    if (!incoming) throw new Error("Invalid save slot");
    activeSlotId = id;
    localStorage.setItem(ACTIVE_SLOT_KEY, id);
    resetFaBase();
    S = incoming;
    undoStack = [];
    tab = S.started ? "dashboard" : "setup";
    render();
    resumeOffseasonDraft();
    toast(`Loaded “${S.saveName}”.`);
  } catch (error) {
    console.error(error);
    toast("That save slot could not be loaded.");
  }
}
function deleteSaveSlot(id) {
  if (!id) return;
  if (id === activeSlotId) return toast("Load another slot before deleting this one.");
  if (!confirm("Delete this save slot? This cannot be undone.")) return;
  localStorage.removeItem(slotStorageKey(id));
  writeSaveIndex(readSaveIndex().filter((slot) => slot.id !== id));
  toast("Save slot deleted.");
  render();
}
function toast(msg) {
  const host = document.getElementById("toast");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
function root() {
  return document.getElementById("app");
}
function allLeaguePlayers() {
  if (_leaguePlayerCache) return _leaguePlayerCache;
  _leaguePlayerCache = S.teams.flatMap((t) =>
    t.players.map((p) => ({ ...p, teamName: t.name, teamObj: t })),
  );
  return _leaguePlayerCache;
}
function userSalary() {
  return S.roster.reduce((a, p) => a + p.salary, 0);
}
function teamSalary(team) {
  return team.players.reduce((a, p) => a + p.salary, 0);
}
// composite() is called thousands of times per render/sim (sorts, teamPower,
// stat leaders). Memoize per pass via a WeakMap keyed by the player object; the
// cache is reset at the start of render() and each simulateGame(), the only
// points where ratings can have changed.
let _compCache = new WeakMap();
// teamPower() is pure within a single render pass (rosters/injuries don't change
// mid-paint), so it's cached by team id only while rendering — _powerCacheOn is
// false during simulation, where per-game injuries make caching across games wrong.
let _powerCache = Object.create(null);
let _powerCacheOn = false;
let _teamMap = null;
let _playerMap = null;
let _leaguePlayerCache = null;
function clearComputeCaches() {
  _compCache = new WeakMap();
  _powerCache = Object.create(null);
  _teamMap = null;
  _playerMap = null;
  _leaguePlayerCache = null;
}
function composite(p) {
  const hit = _compCache.get(p);
  if (hit !== undefined) return hit;
  const v = ENGINE.compositeRating(p, PLAYER_RATING_KEYS, BALANCE.compositeWeights);
  _compCache.set(p, v);
  return v;
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
function personaEntry(kind, id) {
  const pack = DATA.personality && DATA.personality[kind];
  return pack && pack[id] ? pack[id] : null;
}
function personaLabel(id) {
  const hit = personaEntry("public", id);
  return hit ? hit.label : id || "";
}
function hiddenLabel(id) {
  const hit = personaEntry("hidden", id);
  return hit ? hit.label : id || "";
}
function helpMark(text) {
  const tip = escapeAttr(text);
  return `<span class="helpMark" tabindex="0" title="${tip}" aria-label="${tip}">?</span>`;
}
function personaHint(player) {
  const hit = personaEntry("public", player && player.persona);
  if (!hit) return "—";
  return `<span title="${escapeAttr(hit.desc)}">${escapeHtml(hit.label)}</span>`;
}
function personaChip(player) {
  if (!player || !player.persona) return "";
  const hit = personaEntry("public", player.persona);
  const label = hit ? hit.label : player.persona;
  const tip = hit && hit.desc ? ` title="${escapeAttr(hit.desc)}"` : "";
  return `<span class="pill info"${tip}>${escapeHtml(label)}</span>`;
}
function hiddenChip(player, owned) {
  if (!player || !player.hiddenTrait || !owned) return "";
  if (player.traitRevealed) {
    const hit = personaEntry("hidden", player.hiddenTrait);
    const tip = hit && hit.desc ? ` title="${escapeAttr(hit.desc)}"` : "";
    return `<span class="pill warn"${tip}>${escapeHtml(hiddenLabel(player.hiddenTrait))}</span>`;
  }
  return `<span class="pill" title="Something is off in the room, but it has not surfaced yet.">Unconfirmed</span>`;
}
function chemistryFitChips(player) {
  if (!player || !S.roster.length) return "";
  const report = ENGINE.tensionReport(S.roster.concat([player]), DATA.personality || {});
  const clashes = report.conflicts.filter((row) => row.aId === player.id || row.bId === player.id);
  const syns = report.synergies.filter((row) => row.aId === player.id || row.bId === player.id);
  const bits = [];
  if (syns[0]) {
    const other = syns[0].aId === player.id ? syns[0].b : syns[0].a;
    bits.push(`<span class="pill good">Synergy with ${escapeHtml(other)}</span>`);
  }
  const pairingBits = pairingChipsFor(player);
  if (pairingBits) bits.push(pairingBits);
  if (clashes[0]) {
    const other = clashes[0].aId === player.id ? clashes[0].b : clashes[0].a;
    bits.push(`<span class="pill warn">Clashes with ${escapeHtml(other)}</span>`);
  }
  return bits.join("");
}
function lockerKnobs() {
  return BALANCE.lockerRoom || {};
}
function teamTensionScore(teamId) {
  const players = healthyRotation(teamMeta(teamId).players, 8, teamId);
  const report = ENGINE.tensionReport(players, DATA.personality || {});
  const heat = teamId === S.team.abbr && S.lockerRoom ? S.lockerRoom.heat || 0 : 0;
  const relief =
    teamId === S.team.abbr
      ? ENGINE.pairingTensionRelief(
          players.map((player) => player.id),
          S.lockerRoom && S.lockerRoom.pairings,
          lockerKnobs(),
        )
      : 0;
  return Math.max(0, Math.min(100, report.tension + heat - relief));
}
function teamChemistryMult(teamId) {
  const knobs = lockerKnobs();
  const tension = teamTensionScore(teamId);
  const suppressed =
    teamId === S.team.abbr && S.lockerRoom && S.week < (S.lockerRoom.suppressedUntilWeek || 0);
  const traits = (S.coaches && S.coaches.assistant && S.coaches.assistant.traits) || [];
  const disciplinarian = teamId === S.team.abbr && traits.includes("disciplinarian");
  let scale = knobs.chemistryScale;
  if (teamId === S.team.abbr && S.lockerRoom && S.lockerRoom.culture === "star") {
    const star = rosterStar();
    const top = healthyRotation(S.roster, 8, S.team.abbr);
    if (star && top.some((player) => player.id === star.id)) scale *= 0.7;
  }
  return ENGINE.chemistryMultiplier(tension, {
    suppressed,
    disciplinarian,
    scale,
    disciplinarianFactor: knobs.disciplinarianFactor,
  });
}
function rosterStar() {
  if (!S.roster.length) return null;
  return S.roster.slice().sort((a, b) => composite(b) - composite(a))[0];
}
function pairingChipsFor(player) {
  if (!player || !S.lockerRoom || !S.lockerRoom.pairings) return "";
  const knobs = lockerKnobs();
  const hit = Object.keys(S.lockerRoom.pairings)
    .map((key) => {
      const [a, b] = key.split("|");
      if (a !== player.id && b !== player.id) return null;
      const otherId = a === player.id ? b : a;
      const other = S.roster.find((item) => item.id === otherId);
      if (!other) return null;
      const status = ENGINE.pairingStatus(
        S.lockerRoom.pairings[key].starts,
        knobs.pairStarts,
        knobs.pactStarts,
      );
      if (status === "forming") return null;
      return { other, status };
    })
    .find(Boolean);
  if (!hit) return "";
  const label = pairingStatusLabel(hit.status);
  const tip =
    hit.status === "pact"
      ? "Twelve shared starts. Splitting them (one plays, one sits) hurts both."
      : "Six shared starts. They calm the room a little when they share the floor.";
  return `<span class="pill good" title="${escapeAttr(tip)}">${escapeHtml(label)} ${escapeHtml(hit.other.name)}</span>`;
}
function pairingStatusNoun(status) {
  if (status === "pact") return "run-it-back pact";
  if (status === "paired") return "on-court pair";
  return "building chemistry";
}
function pairingStatusLabel(status) {
  const noun = pairingStatusNoun(status);
  return noun.charAt(0).toUpperCase() + noun.slice(1) + " with";
}
const CULTURE_HELP = {
  grit: {
    label: "Playoff Grit",
    earn: "Start 3+ Competitors in your eight.",
    effect: "The room stays tougher in tense games, but blowups happen more often.",
  },
  lab: {
    label: "Young Lab",
    earn: "Start a Mentor plus a Sponge or Gym Rat.",
    effect: "Young players grow faster around vets. Players 30 and up get a little restless.",
  },
  star: {
    label: "Star Vehicle",
    earn: "Keep your best player in the eight.",
    effect: "Her minutes settle chemistry damage. Sitting her crateres the room.",
  },
};
const INFLUENCE_HELP = {
  closedDoor:
    "Sit-down. Raises her mood and cools the room for 2 weeks (tension hurts play less). If she is not your star, the star may bristle.",
  campaign:
    "Front office pushes her for awards (MVP / Rookie of the Year). One campaign at a time.",
  bless:
    "Only works if she wants out. Lets you trade her without cratering a run-it-back pact, and the trade desk adds +160 value to the package.",
};
function lockerReadForPlayer(player) {
  if (!player) return "";
  const bond = Math.round(player.bond || 50);
  const bits = [
    `Bond ${bond}/100 — minutes in the eight raise it; sitting drops it. Mentors with high bond re-sign cheaper.`,
  ];
  if (player.wantsOut) bits.push("She has filed: she wants a bigger role, or a way out.");
  else if ((player.sitStreak || 0) >= 2) bits.push(`Sat the last ${player.sitStreak} games.`);
  if (player.tradeBlessed)
    bits.push(
      "You green-lit her exit. She can be moved without cratering a pact partner, and the trade desk adds extra value.",
    );
  return `<h3>With this franchise</h3><p class="muted">${escapeHtml(bits.join(" "))}</p>${pairingChipsFor(player)}`;
}
function userLockerReport() {
  const players = healthyRotation(S.roster, 8, S.team.abbr);
  const report = ENGINE.tensionReport(players, DATA.personality || {});
  const tension = teamTensionScore(S.team.abbr);
  const star = rosterStar();
  const flags = ENGINE.cultureFlags(players, tension, star && star.id);
  return {
    ...report,
    tension,
    chemistry: teamChemistryMult(S.team.abbr),
    calm: !!flags.calm,
  };
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
  const escapedName = escapeHtml(player.name);
  const img = id
    ? `<img src="https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png" alt="${escapedName}" data-portrait-image loading="lazy">`
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
    if (o.id === "future") o.done = ownedPicks(S.team.abbr).length >= 2;
  });
}
function rosterReadiness() {
  const groups = {
    G: S.roster.some((p) => p.pos.includes("G")),
    F: S.roster.some((p) => p.pos.includes("F")),
    C: S.roster.some((p) => p.pos.includes("C")),
  };
  const issues = [];
  if (S.roster.length < DATA.rosterMin)
    issues.push(`${DATA.rosterMin - S.roster.length} more player(s)`);
  if (!groups.G || !groups.F || !groups.C)
    issues.push(
      `position coverage (${Object.entries(groups)
        .filter(([, ready]) => !ready)
        .map(([group]) => group)
        .join(", ")})`,
    );
  if (userSalary() > DATA.cap) issues.push("cap compliance");
  if (S.roster.length > DATA.rosterMax)
    issues.push(`cut ${S.roster.length - DATA.rosterMax} to reach ${DATA.rosterMax}`);
  return { ready: issues.length === 0, issues };
}
function requireOpeningNightReady() {
  if (
    !S.offseason &&
    S.season &&
    Array.isArray(S.season.schedule) &&
    S.season.schedule.some((game) => game.played)
  )
    return true;
  const readiness = rosterReadiness();
  if (readiness.ready) return true;
  tab = expansionDraftOpen() ? "draft" : "roster";
  render();
  toast(`Opening night needs ${readiness.issues.join(" and ")}.`);
  return false;
}
function expansionDraftOpen() {
  return S.phase === "Expansion Build";
}
function offseasonStageLabel(stage) {
  if (stage === "aging") return "Aging report";
  if (stage === "contracts") return "Free agency";
  if (stage === "draft") return "Rookie draft";
  return "Complete";
}
function recordUndo(label) {
  undoStack.unshift({ label, state: clone(S) });
  if (undoStack.length > (BALANCE.undoLimit || 5)) undoStack.length = BALANCE.undoLimit || 5;
}
function undoLastMove() {
  const previous = undoStack.shift();
  if (!previous) return toast("There is no move to undo.");
  S = normalizeSave(previous.state) || S;
  toast(`${previous.label} undone.`);
  render();
}
function captureFocus() {
  const f = document.activeElement;
  if (!f || f === document.body) return null;
  if (!["INPUT", "TEXTAREA", "SELECT"].includes(f.tagName)) return null;
  let sel = null;
  if (f.id) sel = "#" + CSS.escape(f.id);
  else if (f.dataset && f.dataset.tradeQuery !== undefined) sel = "[data-trade-query]";
  else if (f.dataset && f.dataset.filter) sel = `[data-filter="${f.dataset.filter}"]`;
  if (!sel) return null;
  return {
    selector: sel,
    start: f.selectionStart,
    end: f.selectionEnd,
  };
}
function restoreFocus(info) {
  if (!info) return;
  const el = document.querySelector(info.selector);
  if (!el || !el.focus) return;
  el.focus();
  try {
    if (info.start !== null && info.start !== undefined && el.setSelectionRange)
      el.setSelectionRange(info.start, info.end);
  } catch {}
}
function render() {
  if (!root()) return;
  const focusInfo = captureFocus();
  // Caches are valid for the duration of a single paint only.
  clearComputeCaches();
  _powerCacheOn = true;
  ensureSeason();
  checkObjectives();
  document.documentElement.style.setProperty("--user1", S.team.primary);
  document.documentElement.style.setProperty("--user2", S.team.secondary);
  document.documentElement.style.setProperty("--userText", contrastText(S.team.primary));
  root().innerHTML = S.started ? shell() : setupPage();
  bind();
  restoreFocus(focusInfo);
  if (modal) {
    const closeButton = document.querySelector(".modal [data-close]");
    if (closeButton) closeButton.focus();
  }
  _powerCacheOn = false;
  // Persist off the hot path: a full JSON.stringify(S) + localStorage write on
  // every keystroke/tab click was the single biggest cost. Debounced instead.
  queueSave();
}
function renderView() {
  const view = document.getElementById("view-content");
  if (!view) return render();
  const focusInfo = captureFocus();
  clearComputeCaches();
  _powerCacheOn = true;
  ensureSeason();
  checkObjectives();
  view.innerHTML = content();
  bind();
  restoreFocus(focusInfo);
  _powerCacheOn = false;
  queueSave();
}
function shell() {
  return `<div class="appShell"><aside class="side"><div class="brand"><div class="logo"></div><div><h1>${escapeHtml(S.team.city)} ${escapeHtml(S.team.nickname)}</h1><p>Expansion Front Office</p></div></div><nav class="nav" aria-label="Primary navigation">${navBtn("dashboard", "Dashboard")} ${expansionDraftOpen() ? navBtn("draft", "Expansion Draft") : ""} ${navBtn("roster", "Roster")} ${navBtn("schedule", "Season")} ${navBtn("trades", "Trade Desk")} ${navBtn("waivers", "Waivers")} ${navBtn("coaching", "Coaching")} ${navBtn("league", "League")} ${navBtn("history", "History")} ${navBtn("admin", "Admin")}</nav><div class="sideCard"><div class="mini">Front Office Score</div><div class="big">${frontOfficeScore()}</div><p>${frontOfficeNote()}</p><p class="mini">${frontOfficeDrivers()}</p></div></aside><main class="main" id="main-content">${topbar()}<div id="view-content">${content()}</div>${modalHtml()}</main></div>`;
}
function navBtn(id, label) {
  return `<button data-tab="${id}" class="${tab === id ? "active" : ""}"><span>${label}</span><b>${navBadge(id)}</b></button>`;
}
function navBadge(id) {
  if (id === "draft") return `${S.roster.length}/${DATA.expansionPickLimit}`;
  if (id === "schedule") return `${seasonRecord(S.team.abbr).w}-${seasonRecord(S.team.abbr).l}`;
  if (id === "trades") return ownedPicks(S.team.abbr).length;
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
    history: "Franchise History",
    offseason: "Offseason",
    coaching: "Coaching",
    admin: "Admin · Custom Rookies",
    awards: "Season Awards",
  };
  const title = S.offseason
    ? "Offseason " + S.year
    : S.pendingAwards && tab === "schedule"
      ? "Season Awards"
      : titles[tab];
  const sub = S.offseason
    ? `Stage: ${offseasonStageLabel(S.offseason.stage)} · Year ${S.year} → ${S.year + 1}`
    : `${S.phase} · Year ${S.year} · Week ${S.week} · 2026 cap ${money(DATA.cap)}`;
  // Hide the topbar "Play Next Game" when the main pane already has a primary
  // action button (Game Day / post-game / offseason / awards) — avoids two
  // conflicting "advance" buttons that confused the flow.
  const hidePlayBtn =
    S.gameDay ||
    S.postGame ||
    S.offseason ||
    S.pendingAwards ||
    (S.playoffs && S.playoffs.complete) ||
    !S.started ||
    !S.season;
  const readiness = rosterReadiness();
  const playBtn = hidePlayBtn
    ? ""
    : readiness.ready
      ? `<button class="btn secondary" data-action="simNext">Play Next Game →</button>`
      : `<button class="btn secondary" data-tab="draft">Complete Roster · ${S.roster.length}/${DATA.rosterMin}</button>`;
  const undoBtn = undoStack[0]
    ? `<button class="btn ghost" data-action="undo">Undo ${escapeHtml(undoStack[0].label)}</button>`
    : "";
  return `<div class="topbar"><div><h2>${title}</h2><p>${sub}</p></div><div class="actions">${playBtn}${undoBtn}<button class="btn secondary" data-action="reset">New Save</button></div></div>`;
}
function content() {
  // Offseason takes over only the Schedule tab so the user can still navigate
  // to Roster, Trades, Coaching, etc. while in the aging / rookie draft flow.
  if (S.offseason && (tab === "schedule" || tab === "offseason" || tab === "awards"))
    return seasonStepper() + offseasonView();
  if (S.pendingAwards && (tab === "schedule" || tab === "awards"))
    return seasonStepper() + awardsView();
  if (S.postGame && tab === "schedule") return seasonStepper() + postGameView();
  if (S.gameDay && tab === "schedule") return seasonStepper() + gameDayView();
  if (S.playoffs && S.playoffs.active && tab === "schedule")
    return seasonStepper() + playoffsView();
  if (tab === "schedule") return seasonStepper() + schedulePage();
  return (
    {
      dashboard: dashboard(),
      draft: draft(),
      roster: roster(),
      schedule: seasonStepper() + schedulePage(),
      trades: trades(),
      waivers: waivers(),
      league: league(),
      history: historyView(),
      coaching: coachingView(),
      admin: adminView(),
    }[tab] || dashboard()
  );
}
function kpis() {
  const sal = userSalary();
  const talent = avg(S.roster.map(composite));
  const pot = avg(S.roster.map((p) => p.ratings.potential));
  const balance = rosterBalance();
  return `<div class="grid kpis"><div class="card kpi"><label>Roster</label><div class="value">${S.roster.length}/${DATA.rosterMax}</div><small>${DATA.rosterMin} needed for opening night</small></div><div class="card kpi"><label>Cap Room</label><div class="value">${shortMoney(DATA.cap - sal)}</div><small>${money(sal)} committed</small></div><div class="card kpi"><label>Team Grade</label><div class="value">${teamLetter(talent)}</div><small>${talent || 0} current talent · ${pot || 0} upside</small></div><div class="card kpi"><label>Build Identity</label><div class="value">${balance.identity}</div><small>${balance.note}</small></div></div>`;
}
function dashboard() {
  const best = bestPlayer();
  const weak = weakestPositionGroup();
  return `${kpis()}${nextGameBrief()}<div class="layout2" style="margin-top:18px"><section class="card"><div class="sectionTitle"><h3>Owner Briefing</h3><span>Visible franchise pulse and next actions</span></div><div class="cardPad"><div class="layout3"><div><h3>${escapeHtml(S.team.city)} ${escapeHtml(S.team.nickname)}</h3><p class="muted">${escapeHtml(S.team.arena)}. You are building a one-season expansion roster under the 2026 salary cap while protecting future optionality.</p><button class="btn" data-tab="${expansionDraftOpen() ? "draft" : "roster"}">${expansionDraftOpen() ? "Open Draft Room" : "Open Roster"}</button></div><div class="impact">${impactBars()}</div><div class="log"><div class="logItem"><b>Next opponent</b><p class="muted">${escapeHtml(nextOpponentSummary())}</p></div><div class="logItem"><b>Best player</b><p class="muted">${best ? escapeHtml(best.name) + " · " + escapeHtml(visibleGrade(best)) : "No roster yet."}</p></div><div class="logItem"><b>Weakest group</b><p class="muted">${escapeHtml(weak.pos)} depth · ${weak.count}</p></div><div class="logItem"><b>Recommended next move</b><p class="muted">${escapeHtml(recommendation())}</p></div><div class="logItem"><b>Locker room</b><p class="muted">${S.roster.length ? `Tension ${userLockerReport().tension} (lower is calmer) · chemistry ${Math.round(userLockerReport().chemistry * 100)}%. Open Coaching to manage the room.` : "Draft a roster to start reading the room."}</p></div></div></div></div></section><section class="card"><div class="sectionTitle"><h3>Front Office Feed</h3><span>${S.log.length} events</span></div><div class="cardPad log">${
    S.log
      .slice(0, 8)
      .map(
        (l) =>
          `<div class="logItem"><b>${escapeHtml(l.title)}</b><p class="muted">${escapeHtml(l.body)}</p><small>${escapeHtml(l.when)}</small></div>`,
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
  return ["Scoring", "Shooting", "Playmaking", "Defense", "Rebounding", "Upside"]
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
  score += Math.max(0, ownedPicks(S.team.abbr).length - 2) * 3;
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
function frontOfficeDrivers() {
  const drivers = [];
  drivers.push(`${S.roster.length} roster player${S.roster.length === 1 ? "" : "s"}`);
  drivers.push(userSalary() <= DATA.cap ? "Cap compliant" : "Over cap");
  const completed = S.objectives.filter((o) => o.done).length;
  drivers.push(`${completed} objective${completed === 1 ? "" : "s"} done`);
  const extraPicks = ownedPicks(S.team.abbr).length - 2;
  if (extraPicks > 0) drivers.push(`${extraPicks} extra draft pick${extraPicks === 1 ? "" : "s"}`);
  drivers.push(`Upside ${Math.round(avg(S.roster.map((p) => p.ratings.potential)) || 0)}`);
  return drivers.join(" · ");
}
function rosterBalance() {
  const r = teamRatings();
  if (!S.roster.length) return { identity: "None", note: "Draft players to establish a style" };
  const pairs = Object.entries(r).sort((a, b) => b[1] - a[1]);
  const last = pairs[pairs.length - 1];
  return {
    identity: pairs[0][0],
    note: `Best area ${pairs[0][1]}, weakest ${last[0]} ${last[1]}`,
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
        t.status === "contender" ? "buying" : t.status === "rebuilding" ? "selling" : "selective";
      return `<div class="logItem"><b><span class="teamBadge" style="${badgeStyle(t.primary)}">${t.id}</span>${t.name}</b><p class="muted">Market posture: ${mood}. Biggest need: ${need}. Cap used: ${shortMoney(teamSalary(t))}.</p></div>`;
    })
    .join("");
}
const STRENGTH_TAGS = [
  "shooting",
  "scoring",
  "defense",
  "rebound",
  "playmaking",
  "passing",
  "athleticism",
  "length",
  "iq",
  "motor",
  "post",
  "rim",
  "range",
  "transition",
];
function draft() {
  if (!expansionDraftOpen())
    return `<section class="card"><div class="sectionTitle"><h3>Expansion Draft Closed</h3><span>opening night has passed</span></div><div class="cardPad"><p class="muted">The expansion draft is closed. Year ${S.year + 1} rookies are selected during the offseason draft on the Season tab.</p><div class="actions"><button class="btn" data-tab="schedule">Open Season</button><button class="btn secondary" data-tab="roster">Roster</button></div></div></section>`;
  const pool = filteredDraftPool();
  const archOpts =
    `<option value="ALL">All archetypes</option>` +
    ARCHETYPE_OPTIONS.map(
      (a) => `<option value="${a}" ${draftFilters.arch === a ? "selected" : ""}>${a}</option>`,
    ).join("");
  const strengthOpts =
    `<option value="">Any strength</option>` +
    STRENGTH_TAGS.map(
      (s) => `<option value="${s}" ${draftFilters.strength === s ? "selected" : ""}>${s}</option>`,
    ).join("");
  return `${kpis()}<section class="card"><div class="sectionTitle"><h3>Available Expansion Pool</h3><span>protected stars are visible but locked unless acquired by trade</span></div><div class="filters"><input data-filter="q" placeholder="Search name/team/scouting" value="${escapeAttr(draftFilters.q)}"><select data-filter="strength">${strengthOpts}</select><select data-filter="pos"><option>ALL</option>${["G", "F", "C"].map((x) => `<option ${draftFilters.pos === x ? "selected" : ""}>${x}</option>`).join("")}</select><select data-filter="team"><option>ALL</option>${S.teams.map((t) => `<option value="${t.id}" ${draftFilters.team === t.id ? "selected" : ""}>${t.name}</option>`).join("")}</select><select data-filter="arch">${archOpts}</select><select data-filter="risk"><option value="ALL">All risk profiles</option><option ${draftFilters.risk === "upside" ? "selected" : ""} value="upside">Upside</option><option ${draftFilters.risk === "safe" ? "selected" : ""} value="safe">Safe veterans</option><option ${draftFilters.risk === "cheap" ? "selected" : ""} value="cheap">Cheap contracts</option></select><button class="btn secondary" style="height:42px;white-space:nowrap" data-action="resetDraftFilters">Reset filters</button></div><div class="cardPad callout"><strong>Draft tip:</strong> Use the filters to target upside, cheap veterans, or positional fit. Reset filters anytime to reopen the full expansion pool.</div><div class="board">${pool.map(playerDraftCard).join("") || '<div class="empty">No players match those filters. Clear filters or broaden your search to see more expansion prospects.</div>'}</div></section>`;
}
function filteredDraftPool() {
  return allLeaguePlayers()
    .filter((p) => {
      const q = draftFilters.q.toLowerCase();
      if (
        q &&
        !(
          p.name +
          p.teamName +
          p.scouting +
          p.strengths +
          p.weaknesses +
          (p.persona || "") +
          personaLabel(p.persona)
        )
          .toLowerCase()
          .includes(q)
      )
        return false;
      if (draftFilters.pos !== "ALL" && !p.pos.includes(draftFilters.pos)) return false;
      if (draftFilters.team !== "ALL" && p.team !== draftFilters.team) return false;
      if (draftFilters.risk === "upside" && p.ratings.potential < 80) return false;
      if (draftFilters.risk === "safe" && !(p.years <= 1 && p.ratings.iq > 78)) return false;
      if (draftFilters.risk === "cheap" && p.salary > 500000) return false;
      const s = draftFilters.strength.toLowerCase();
      if (s && !(p.strengths || "").toLowerCase().includes(s)) return false;
      if (draftFilters.arch !== "ALL" && p.archetype !== draftFilters.arch) return false;
      return true;
    })
    .sort((a, b) => a.protected - b.protected || tradeValue(b) - tradeValue(a));
}
function playerDraftCard(p) {
  const draftClosed = S.phase !== "Expansion Build";
  const disabled =
    draftClosed ||
    p.protected ||
    S.roster.length >= DATA.expansionPickLimit ||
    userSalary() + p.salary > DATA.cap;
  return `<div class="playerCard">${portraitHtml(p)}<div><div><span class="playerName">${escapeHtml(p.name)}</span> <span class="pill">${escapeHtml(p.pos)}</span> <span class="pill" style="${badgeStyle(p.teamObj.primary)}">${escapeHtml(p.team)}</span> ${p.protected ? '<span class="pill bad">Protected</span>' : ""} ${personaChip(p)}</div><div class="scout">${escapeHtml(p.scouting)}</div><div class="tags"><span class="tag">${visibleGrade(p)}</span><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${p.years} yr</span><span class="tag">${escapeHtml(p.archetype)}</span><span class="tag">Strength: ${escapeHtml(firstTag(p.strengths))}</span><span class="tag">Weakness: ${escapeHtml(firstTag(p.weaknesses))}</span>${chemistryFitChips(p)}</div></div><div class="actions"><button class="btn secondary" data-view="${escapeAttr(p.id)}">Scout</button><button class="btn ${disabled ? "secondary" : ""}" ${disabled ? "disabled" : ""} data-draft="${escapeAttr(p.id)}">${draftClosed ? "Draft Closed" : p.protected ? "Locked" : userSalary() + p.salary > DATA.cap ? "No Cap" : "Draft"}</button></div></div>`;
}
function roster() {
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Cap Sheet</h3><span>${money(userSalary())} / ${money(DATA.cap)}</span></div>${rosterTable(S.roster)}</section><section class="card"><div class="sectionTitle"><h3>Roster Tools</h3><span>rotation control</span></div><div class="cardPad"><div class="impact">${impactBars()}</div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><h3>Position Balance</h3>${positionBalance()}<h3>Recommended Next Move</h3><p class="muted">${recommendation()}</p></div></section></div>`;
}
function rosterTable(players) {
  return `<table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Role</th><th title="How much she trusts this franchise. Minutes in the eight raise it; sitting drops it.">Bond</th><th>Salary</th><th>Contract</th><th></th></tr></thead><tbody>${players.map((p) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div><div class="playerName">${escapeHtml(p.name)}</div><div class="mini">${escapeHtml(p.archetype)} · ${personaHint(p)} · ${escapeHtml(firstTag(p.strengths))}</div></div></div></td><td>${escapeHtml(p.pos)}</td><td><span class="pill">${visibleGrade(p)}</span></td><td title="Minutes in the eight raise bond; sitting drops it.">${Math.round(p.bond || 50)}</td><td>${shortMoney(p.salary)}</td><td>${p.years} yr</td><td><button class="btn secondary" data-view="${escapeAttr(p.id)}">Scout</button> ${S.roster.find((x) => x.id === p.id) ? `<button class="btn danger" data-waive="${escapeAttr(p.id)}">Waive</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7"><div class="empty">No players yet.</div></td></tr>`}</tbody></table>`;
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
function bestPlayer() {
  if (!S.roster.length) return null;
  return S.roster.reduce((best, p) => (composite(p) > composite(best) ? p : best), S.roster[0]);
}
function weakestPositionGroup() {
  const groups = ["G", "F", "C"].map((pos) => ({
    pos,
    count: S.roster.filter((p) => p.pos.includes(pos)).length,
  }));
  return groups.reduce((a, b) => (b.count < a.count ? b : a), groups[0]);
}
function nextOpponentSummary() {
  const g = nextUserGame();
  if (!g) return "No upcoming user games scheduled yet.";
  const home = teamMeta(g.home);
  const away = teamMeta(g.away);
  const isHome = g.home === S.team.abbr;
  const opponent = isHome ? away.name : home.name;
  const need = teamNeed(isHome ? away : home);
  return `${opponent} ${isHome ? "at home" : "on the road"} in Week ${g.week}. Opponent looks light on ${need} depth.`;
}
function trades() {
  if (S.teams.length && !S.teams.some((team) => team.id === trade.team)) trade.team = S.teams[0].id;
  const other = S.teams.find((t) => t.id === trade.team) || S.teams[0];
  const evaln = evaluateTrade(other);
  const q = (trade.query || "").toLowerCase();
  const matches = (p) =>
    !q ||
    (p.name || "").toLowerCase().includes(q) ||
    (p.strengths || "").toLowerCase().includes(q) ||
    (p.archetype || "").toLowerCase().includes(q) ||
    (p.pos || "").toLowerCase().includes(q);
  const userList = S.roster.filter(matches);
  const otherList = other.players.filter(matches);
  const partnerNeedLabel =
    {
      G: "guards",
      F: "forwards",
      C: "centers",
    }[teamNeed(other)] || "players";
  return `${kpis()}${tradeDeskHeader(other)}${npcOfferList()}<section class="card"><div class="sectionTitle"><h3>Trade Machine</h3><span>salary, value, team need, protected-player logic</span></div><div class="cardPad"><div class="layout2"><div class="field"><label>Trade partner</label><select data-trade-team>${S.teams.map((t) => `<option value="${t.id}" ${trade.team === t.id ? "selected" : ""}>${t.name} · ${t.status}</option>`).join("")}</select><div class="mini">Partner need: ${partnerNeedLabel}. Protected players are expensive; prioritize fit and future value.</div></div><div class="field"><label>Filter players (name, strength, archetype, position)</label><input data-trade-query placeholder="e.g. shooting" value="${escapeAttr(trade.query || "")}"></div></div><div class="tradeBox"><div class="tradePanel"><div class="sectionTitle"><h3>${escapeHtml(S.team.nickname)} sends</h3><span>${shortMoney(sumSelected(S.roster, trade.userGive))}</span></div><div class="tradeList">${userList.map((p) => checkRow(p, "userGive")).join("") || '<div class="empty">No roster players match.</div>'}</div><div class="cardPad">${pickAssetList(ownedPicks(S.team.abbr), "userPicks")}</div></div><div class="tradePanel"><div class="sectionTitle"><h3>${escapeHtml(other.name)} sends</h3><span>${shortMoney(sumSelected(other.players, trade.otherGive))}</span></div><div class="tradeList">${otherList.map((p) => checkRow(p, "otherGive")).join("") || '<div class="empty">No partner players match.</div>'}</div><div class="cardPad">${pickAssetList(ownedPicks(other.id), "otherPicks")}</div></div></div><div class="tradeSummary"><div class="logItem"><b>Trade Verdict: <span class="pill ${evaln.ok ? (evaln.label === "Strong Offer" ? "good" : evaln.label === "Good Offer" ? "info" : evaln.label === "Close Offer" ? "warn" : "good") : "warn"}">${evaln.label}</span></b><p class="muted">${evaln.reason}</p><div class="meter"><span>Your outgoing value</span><div class="bar"><i style="width:${Math.min(100, evaln.userValue / 20)}%"></i></div><b>${evaln.userValue}</b></div><div class="meter"><span>Partner outgoing value</span><div class="bar"><i style="width:${Math.min(100, evaln.otherValue / 20)}%"></i></div><b>${evaln.otherValue}</b></div></div>${evaln.advice && evaln.advice.length ? `<div class="tradeAdvice"><h4>Why this verdict?</h4><ul>${evaln.advice.map((item) => `<li>${item}</li>`).join("")}</ul></div>` : ""}</div><div class="actions"><button class="btn" data-action="submitTrade" ${evaln.ok ? "" : "disabled"}>Review Trade</button><button class="btn secondary" data-action="clearTrade">Clear Selections</button></div></div></section>`;
}
function tradeDeskHeader() {
  const deadline = BALANCE.tradeDeadlineWeek || 12;
  if (tradesLocked())
    return `<div class="callout"><b>Trade deadline passed (Week ${deadline}).</b><p class="muted">The desk is closed until the offseason. Incoming NPC offers are frozen.</p></div>`;
  if (S.phase === "Expansion Build")
    return `<div class="callout"><b>Preseason desk</b><p class="muted">Picks are real draft slots. The deadline is Week ${deadline}; NPC clubs will start calling once the season is underway.</p></div>`;
  return `<div class="callout"><b>Deadline: Week ${deadline}</b><p class="muted">Currently Week ${S.week}. Year-stamped picks change who is on the clock in that draft.</p></div>`;
}
function npcOfferList() {
  const offers = S.pendingOffers || [];
  if (!offers.length) return "";
  return `<section class="card" style="margin-bottom:18px"><div class="sectionTitle"><h3>Incoming Offers</h3><span>${offers.length}</span></div><div class="cardPad log">${offers
    .map((offer) => {
      const from = teamMeta(offer.from);
      const their = (offer.theirPlayers || [])
        .map((id) => findPlayer(id))
        .filter(Boolean)
        .map((p) => p.name)
        .join(", ");
      const want = (offer.wantPlayers || [])
        .map((id) => findPlayer(id))
        .filter(Boolean)
        .map((p) => p.name)
        .join(", ");
      const theirPicks = (offer.theirPicks || []).map((id) => pickLabel(findPick(id))).join(", ");
      const wantPicks = (offer.wantPicks || []).map((id) => pickLabel(findPick(id))).join(", ");
      return `<div class="logItem"><b>${escapeHtml(from.name)} offer</b><p class="muted">They send ${escapeHtml(their || theirPicks || "assets")}. They want ${escapeHtml(want || wantPicks || "assets")}.</p><div class="actions"><button class="btn" data-accept-offer="${escapeAttr(offer.id)}" ${tradesLocked() ? "disabled" : ""}>Accept</button><button class="btn secondary" data-decline-offer="${escapeAttr(offer.id)}">Decline</button></div></div>`;
    })
    .join("")}</div></section>`;
}
function checkRow(p, side) {
  const checked = trade[side].includes(p.id);
  return `<label class="checkRow"><input type="checkbox" data-trade-side="${side}" value="${escapeAttr(p.id)}" ${checked ? "checked" : ""}>${portraitHtml(p, "sm")}<div><b>${escapeHtml(p.name)}</b> <span class="pill">${escapeHtml(p.pos)}</span> ${p.protected ? '<span class="pill bad">protected cost</span>' : ""}${p.tradeBlessed ? `<span class="pill good" title="Green-lit exit. This package gets +${lockerKnobs().blessedTradeValue || 160} trade value.">Green-lit +${lockerKnobs().blessedTradeValue || 160}</span>` : ""}<div class="mini">${escapeHtml(visibleGrade(p))} · ${shortMoney(p.salary)} · bond ${Math.round(p.bond || 50)} · ${escapeHtml(String(p.scouting || "").slice(0, 76))}...</div></div></label>`;
}
function sumSelected(players, ids) {
  return players.filter((p) => ids.includes(p.id)).reduce((a, p) => a + p.salary, 0);
}
function selectedValue(players, ids) {
  return players.filter((p) => ids.includes(p.id)).reduce((a, p) => a + tradeValue(p), 0);
}
function pickAssetList(picks, side) {
  if (!picks.length) return '<div class="mini">No future picks to move.</div>';
  return picks
    .slice()
    .sort((a, b) => a.year - b.year || a.round - b.round)
    .map((pick) => {
      const checked = (trade[side] || []).includes(pick.id);
      return `<label class="checkRow"><input type="checkbox" data-trade-pick="${side}" value="${escapeAttr(pick.id)}" ${checked ? "checked" : ""}><div><b>${escapeHtml(pickLabel(pick))}</b><div class="mini">${pick.round === 1 ? "First-round slot" : "Second-round slot"} · ${pick.year} draft</div></div></label>`;
    })
    .join("");
}
function evaluateTrade(other) {
  const uPlayers = S.roster.filter((p) => trade.userGive.includes(p.id));
  const oPlayers = other.players.filter((p) => trade.otherGive.includes(p.id));
  const userPickAssets = selectedPicks("user");
  const otherPickAssets = selectedPicks("other");
  let userValue =
    selectedValue(S.roster, trade.userGive) +
    userPickAssets.reduce((sum, pick) => sum + pickTradeValue(pick), 0);
  let otherValue =
    selectedValue(other.players, trade.otherGive) +
    otherPickAssets.reduce((sum, pick) => sum + pickTradeValue(pick), 0);
  const salaryIn = sumSelected(other.players, trade.otherGive),
    salaryOut = sumSelected(S.roster, trade.userGive);
  const futureSalary = userSalary() - salaryOut + salaryIn;
  let reasons = [];
  let advice = [];
  let ok = true;
  const hasUserAssets = uPlayers.length || userPickAssets.length;
  const hasOtherAssets = oPlayers.length || otherPickAssets.length;
  if (tradesLocked()) {
    ok = false;
    reasons.push("The trade deadline has passed.");
    advice.push("Wait for the offseason to move players again.");
  }
  if (!hasUserAssets || !hasOtherAssets) {
    ok = false;
    if (!hasUserAssets) {
      reasons.push("Include a roster player or future pick from your side.");
      advice.push("Add a player or future pick to your side of the offer.");
    }
    if (!hasOtherAssets) {
      reasons.push("Request a player or pick from the partner side.");
      advice.push("Ask for a player or pick from your trade partner.");
    }
  }
  if ((trade.userPicks || []).some((id) => !findPick(id) || findPick(id).owner !== S.team.abbr)) {
    ok = false;
    reasons.push("You do not have a future pick available to trade.");
    advice.push("Remove the pick from your side of the offer.");
  }
  if ((trade.otherPicks || []).some((id) => !findPick(id) || findPick(id).owner !== other.id)) {
    ok = false;
    reasons.push("The partner has no available pick to send.");
    advice.push("Remove the requested pick from the package.");
  }
  if (trade.userPick && !userPickAssets.length) {
    ok = false;
    reasons.push("You do not have a future pick available to trade.");
    advice.push("Remove the pick from your side of the offer.");
  }
  if (trade.otherPick && !otherPickAssets.length) {
    ok = false;
    reasons.push("The partner has no available pick to send.");
    advice.push("Remove the requested pick from the package.");
  }
  if (futureSalary > DATA.cap) {
    ok = false;
    reasons.push("Salary structure fails to fit the cap.");
    advice.push("Keep your post-trade payroll under the cap by taking back cheaper salary.");
  }
  if (S.roster.length - uPlayers.length + oPlayers.length > DATA.rosterMax) {
    ok = false;
    reasons.push("This trade would violate roster limits.");
    advice.push("Trade fewer players or a single player to stay within roster limits.");
  }
  const protectedCount = oPlayers.filter((p) => p.protected).length;
  if (protectedCount && userValue < otherValue * BALANCE.trade.protectedRatio) {
    ok = false;
    reasons.push(
      "Protected players are core assets; this package needs a stronger overpay or future pick.",
    );
    advice.push("Protected talent usually requires extra value or a pick to land.");
  }
  const partnerNeed = teamNeed(other);
  if (uPlayers.some((p) => p.pos.includes(partnerNeed))) userValue += 120;
  const blessed = uPlayers.filter((p) => p.tradeBlessed);
  if (blessed.length) {
    const bump = lockerKnobs().blessedTradeValue || 160;
    userValue += blessed.length * bump;
    advice.push(
      `${blessed.map((p) => p.name).join(", ")} is green-lit — this offer gets +${bump} trade value because she asked out.`,
    );
  }
  const ratio = userValue / (otherValue || 1);
  if (hasUserAssets && hasOtherAssets && ratio < BALANCE.trade.minimumRatio) {
    ok = false;
    reasons.push("This offer is under market value.");
    advice.push("Raise the offer by adding another player, future pick, or fit asset.");
  }
  if (!ok)
    return {
      ok: false,
      label: "Rejected",
      reason: reasons.join(" "),
      advice: advice.length ? advice : ["Review the package and adjust the assets."],
      userValue,
      otherValue,
    };
  let label = "Fair Trade";
  let reason = `This package should be attractive to ${other.name}.`;
  if (ratio >= BALANCE.trade.strongRatio) {
    label = "Strong Offer";
    reason = `This looks like a strong proposal for ${other.name}.`;
    advice.push("This should be attractive to the partner and is worth submitting.");
  } else if (ratio >= BALANCE.trade.goodRatio) {
    label = "Good Offer";
    reason = `This is a clean, market-value trade that helps ${other.name}'s ${partnerNeed} depth.`;
    advice.push("Strong match; the partner's need is aligned with this package.");
  } else if (ratio >= BALANCE.trade.minimumRatio) {
    label = "Close Offer";
    reason = `This is close to a fair deal; a small sweetener could make it irresistible.`;
    advice.push("A small extra asset or pick will likely move this deal through.");
  }
  if (!advice.length)
    advice.push("This offer checks the main boxes and is worth next-step review.");
  return {
    ok: true,
    label,
    reason,
    advice,
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
  const pool = waiverPool();
  return `${kpis()}<div class="layout2"><section class="card"><div class="sectionTitle"><h3>Free Agents & Waivers</h3><span>cheap depth and regret board</span></div><div class="board">${
    pool.length
      ? pool
          .map(
            (p) =>
              `<div class="playerCard">${portraitHtml(p)}<div><span class="playerName">${escapeHtml(p.name)}</span> <span class="pill">${escapeHtml(p.pos)}</span> ${personaChip(p)}<div class="scout">${escapeHtml(p.scouting)}</div><div class="tags"><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${visibleGrade(p)}</span><span class="tag">${escapeHtml(firstTag(p.strengths))}</span>${chemistryFitChips(p)}</div></div><button class="btn" data-sign="${escapeAttr(p.id)}" ${userSalary() + p.salary > DATA.cap ? "disabled" : ""}>${userSalary() + p.salary > DATA.cap ? "No Cap" : "Sign"}</button></div>`,
          )
          .join("")
      : '<div class="empty">No available free agents right now. Check back after roster moves or widen your criteria.</div>'
  }</div></section><section class="card"><div class="sectionTitle"><h3>Your Waived Players</h3><span>${S.waived.length}</span></div><div class="board">${S.waived.map((p) => `<div class="playerCard">${portraitHtml(p, "sm")}<div><b>${escapeHtml(p.name)}</b><div class="mini">${escapeHtml(p.pos)} · ${shortMoney(p.salary)}</div></div><button class="btn secondary" data-sign="${escapeAttr(p.id)}">Re-sign</button></div>`).join("") || '<div class="empty">No waived players yet. Waive a player to open cap space or reshape your roster.</div>'}</div><div class="cardPad callout"><div class="actions" style="justify-content:flex-start;gap:10px"><button class="btn secondary" data-tab="roster">Review roster</button><button class="btn secondary" data-tab="draft">Browse draft pool</button></div><p class="muted" style="margin-top:12px">Use waivers to patch holes or re-sign waived talent for familiarity. A quick depth move can keep your roster flexible.</p></div></section></div>`;
}
let _faBase = null;
function waiverPool() {
  if (!_faBase)
    _faBase = [
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
  // A cached base free agent remains in _faBase after signing, so explicitly
  // exclude every player already owned by the user or another team.
  const owned = new Set([
    ...S.roster.map((player) => player.id),
    ...S.teams.flatMap((team) => team.players.map((player) => player.id)),
  ]);
  // Dedupe by id in O(n) (a waived player can match a base FA id).
  const seen = new Set();
  return _faBase.concat(S.waived, S.freeAgents || []).filter((v) => {
    if (owned.has(v.id)) return false;
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });
}
function league() {
  return `<div class="layout3">${S.teams
    .map(
      (t) =>
        `<section class="card"><div class="sectionTitle"><h3><span class="teamBadge" style="${badgeStyle(t.primary)}">${t.id}</span>${t.name}</h3><span>${t.status}</span></div><div class="cardPad"><div class="meter"><span>Roster</span><div class="bar"><i style="width:${Math.min(100, t.players.length * 8)}%"></i></div><b>${t.players.length}</b></div><div class="meter"><span>Payroll</span><div class="bar"><i style="width:${Math.min(100, (teamSalary(t) / DATA.cap) * 100)}%"></i></div><b>${shortMoney(teamSalary(t))}</b></div><p class="muted">Need: ${teamNeed(t)} · Core: ${
          t.players
            .filter((p) => p.protected)
            .map((p) => p.name.split(" ").slice(-1)[0])
            .join(", ") || "none"
        }</p><button class="btn secondary" data-teamview="${t.id}">Open Roster</button></div></section>`,
    )
    .join("")}</div>${statsLeadersSection()}`;
}
function statsLeadersSection() {
  const allPlayers = [
    ...S.roster.map((p) => ({ p, teamId: S.team.abbr })),
    ...S.teams.flatMap((t) => t.players.map((pl) => ({ p: pl, teamId: t.id }))),
  ];
  const withStats = allPlayers.filter((x) => x.p.seasonStats && x.p.seasonStats.gp > 0);
  if (!withStats.length)
    return `<section class="card" style="margin-top:18px"><div class="sectionTitle"><h3>Stats Leaders</h3><span>play games to populate</span></div><div class="cardPad"><div class="empty">No games played yet this season.</div></div></section>`;
  const per = (x, k) => x.p.seasonStats[k] / Math.max(1, x.p.seasonStats.gp);
  const leaderRows = (key, label, fmt) =>
    withStats
      .slice()
      .sort((a, b) => per(b, key) - per(a, key))
      .slice(0, 5)
      .map(
        (x, i) =>
          `<tr><td>${i + 1}</td><td><div style="display:flex;gap:8px;align-items:center">${portraitHtml(x.p, "sm")}<div><div class="playerName">${escapeHtml(x.p.name)}</div><div class="mini">${escapeHtml(x.teamId)} · ${x.p.seasonStats.gp} GP</div></div></div></td><td><b>${fmt(per(x, key))}</b></td></tr>`,
      )
      .join("");
  const table = (key, label, fmt) =>
    `<section class="card"><div class="sectionTitle"><h3>${label}</h3><span>per game</span></div><table class="table"><thead><tr><th>#</th><th>Player</th><th>${label.split(" ")[0]}</th></tr></thead><tbody>${leaderRows(key, label, fmt)}</tbody></table></section>`;
  const f = (v) => v.toFixed(1);
  return `<div style="margin-top:18px"><h3>Stats Leaders</h3><div class="layout3" style="margin-top:10px">${table("pts", "Points", f)}${table("reb", "Rebounds", f)}${table("ast", "Assists", f)}</div></div>`;
}

function resetFaBase() {
  _faBase = null;
}
function refreshWaiverClass(year) {
  const targetYear = year || S.year;
  _faBase = generateYearlyWaivers(targetYear);
  S.faClassYear = targetYear;
}
function generateYearlyWaivers(year) {
  const archetypes = ["veteran", "depth", "big", "wing", "engine"];
  const positions = ["F", "G", "C", "G/F", "G"];
  const names = [];
  const used = new Set();
  while (names.length < 5) {
    const name = `${pickOne(PROC_FIRST)} ${pickOne(PROC_LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push(name);
  }
  return names.map((name, index) => {
    const pos = positions[index];
    const base = rand(52, 64);
    const ratings = {
      scoring: clampRating(base + rand(-6, 8)),
      shooting: clampRating(base + rand(-8, 6)),
      playmaking: clampRating(base + rand(-8, 6)),
      defense: clampRating(base + rand(-6, 8)),
      rebounding: clampRating(base + rand(-8, 10)),
      athleticism: clampRating(base + rand(-10, 6)),
      iq: clampRating(base + rand(0, 10)),
      potential: clampRating(base + rand(-4, 4)),
    };
    const player = {
      id: `fa-${year}-${slug(name)}`,
      name,
      pos,
      team: "FA",
      salary: cbaValue("minVeteran", 277500) + rand(0, 80000),
      years: 1,
      scouting: "Yearly waiver addition — cheap veteran minutes and practice-body depth.",
      strengths: ratingsTop(ratings),
      weaknesses: ratingsBottom(ratings),
      protected: false,
      ratings,
      archetype: archetypes[index],
      mood: 55 + rand(0, 20),
      age: 28 + rand(0, 6),
      injury: null,
      lastTeam: "FA",
    };
    if (window.GAME_FACTORIES && window.GAME_FACTORIES.ensurePersonality) {
      window.GAME_FACTORIES.ensurePersonality(player);
    }
    return player;
  });
}
function ensureSeason(force = false) {
  if (!S.started) return;
  if (!S.season || !Array.isArray(S.season.schedule) || force) {
    S.week = 1;
    if (S.coaching) S.coaching.lastTransitionWeek = 0;
    resetSeasonStats();
    snapshotComposites();
    S.season = {
      schedule: generateSchedule(),
      records: {},
      results: [],
    };
  } else {
    if (!S.season.records || typeof S.season.records !== "object") S.season.records = {};
    if (!Array.isArray(S.season.results)) S.season.results = [];
  }
  leagueIds().forEach((id) => {
    if (!S.season.records[id]) S.season.records[id] = { w: 0, l: 0, pf: 0, pa: 0, streak: "—" };
  });
}
function leagueIds() {
  return [S.team.abbr, ...S.teams.map((t) => t.id)];
}
function leagueChannelAvg(key) {
  const ids = leagueIds();
  if (!ids.length) return 65;
  return Math.round(ids.reduce((s, id) => s + (teamPower(id)[key] || 0), 0) / ids.length);
}
function recommendPlan(oppPower) {
  const avgInt = leagueChannelAvg("intO");
  const avgPer = leagueChannelAvg("perO");
  const intLean = oppPower.intO - avgInt;
  const perLean = oppPower.perO - avgPer;
  if (intLean > perLean + 2) return "pack";
  if (perLean > intLean + 2) return "extend";
  return null;
}
function teamMeta(id) {
  if (id === S.team.abbr)
    return {
      id,
      name: `${S.team.city} ${S.team.nickname}`,
      primary: S.team.primary,
      players: S.roster,
    };
  if (!_teamMap) _teamMap = new Map(S.teams.map((team) => [team.id, team]));
  const t = _teamMap.get(id);
  if (!t) return { id, name: id || "Unknown", primary: "#777", players: [] };
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
  // Showcase games are labels on existing matchups, not extra fixtures. Adding
  // eight bonus user games previously produced 30-38 games per team and made
  // win-percentage standings depend on an uneven schedule.
  games
    .filter((g) => g.home === S.team.abbr || g.away === S.team.abbr)
    .slice(0, 8)
    .forEach((g) => (g.showcase = true));
  return games.sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}
// Shared helper: the available (non-injured) rotation, best-first, capped at n.
// Used by teamPower, distributeAndRecord, rollInjuries and the Game Day view.
function healthyRotation(players, n, ownerId) {
  const healthy = players.slice().filter((p) => !p.injury);
  const useUserOrder = ownerId === S.team.abbr || players === S.roster;
  if (useUserOrder && Array.isArray(S.rotation) && S.rotation.length) {
    const ordered = [];
    const seen = new Set();
    S.rotation.forEach((id) => {
      const player = healthy.find((item) => item.id === id);
      if (player && !seen.has(player.id)) {
        ordered.push(player);
        seen.add(player.id);
      }
    });
    healthy
      .slice()
      .sort((a, b) => composite(b) - composite(a))
      .forEach((player) => {
        if (!seen.has(player.id)) ordered.push(player);
      });
    return n === null || n === undefined ? ordered : ordered.slice(0, n);
  }
  const sorted = healthy.sort((a, b) => composite(b) - composite(a));
  return n === null || n === undefined ? sorted : sorted.slice(0, n);
}
function ensureUserRotation() {
  if (!Array.isArray(S.rotation)) S.rotation = [];
  const rosterIds = new Set(S.roster.map((p) => p.id));
  S.rotation = S.rotation.filter((id) => rosterIds.has(id));
  const seen = new Set(S.rotation);
  S.roster
    .slice()
    .sort((a, b) => composite(b) - composite(a))
    .forEach((p) => {
      if (!seen.has(p.id)) {
        S.rotation.push(p.id);
        seen.add(p.id);
      }
    });
  return S.rotation;
}
function moveRotation(id, delta) {
  ensureUserRotation();
  const idx = S.rotation.indexOf(id);
  if (idx < 0) return;
  const next = idx + delta;
  if (next < 0 || next >= S.rotation.length) return;
  const copy = S.rotation.slice();
  const [item] = copy.splice(idx, 1);
  copy.splice(next, 0, item);
  S.rotation = copy;
  renderView();
}
function sitPlayer(id) {
  ensureUserRotation();
  const idx = S.rotation.indexOf(id);
  if (idx < 0) return;
  const copy = S.rotation.slice();
  copy.splice(idx, 1);
  copy.push(id);
  S.rotation = copy;
  renderView();
}
function startPlayer(id) {
  ensureUserRotation();
  if (!S.roster.some((p) => p.id === id)) return;
  const copy = S.rotation.filter((item) => item !== id);
  copy.splice(Math.min(7, copy.length), 0, id);
  S.rotation = copy;
  renderView();
}
function teamPower(id) {
  if (_powerCacheOn && _powerCache[id]) return _powerCache[id];
  const meta = teamMeta(id);
  // Injured players are unavailable and don't contribute to the lineup.
  const players = healthyRotation(meta.players, null, id);
  if (!players.length) {
    const empty = {
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
    if (_powerCacheOn) _powerCache[id] = empty;
    return empty;
  }
  const top = players.slice(0, 8);
  // Heavier top-player weighting: top 3 carry ~63% of the team rating,
  // so star concentration matters more than bench depth.
  const W = BALANCE.rotationWeights;
  const w = top.map((_, i) => W[i] ?? 0.3);
  const wSum = w.reduce((a, b) => a + b, 0);
  const wavg = (k) => Math.round(top.reduce((s, p, i) => s + p.ratings[k] * w[i], 0) / wSum);
  // Position-aware defensive share: guards defend the perimeter, bigs the paint.
  const defShare = (p) => {
    if (p.pos.includes("G")) return { per: 0.75, int: 0.25 };
    if (p.pos.includes("C")) return { per: 0.2, int: 0.8 };
    return { per: 0.5, int: 0.5 };
  };
  const posWeighted = (k, side) => {
    const num = top.reduce((s, p, i) => s + p.ratings[k] * w[i] * defShare(p)[side], 0);
    const den = top.reduce((s, p, i) => s + w[i] * defShare(p)[side], 0);
    return den ? Math.round(num / den) : 60;
  };
  const perO = Math.round(wavg("shooting") * 0.5 + wavg("playmaking") * 0.3 + wavg("iq") * 0.2);
  const intO = Math.round(
    wavg("scoring") * 0.45 + wavg("rebounding") * 0.2 + wavg("athleticism") * 0.35,
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
  const chem = teamChemistryMult(id);
  const result = {
    overall: Math.round(
      (off * BALANCE.teamOverallWeights.offense +
        def * BALANCE.teamOverallWeights.defense +
        reb * BALANCE.teamOverallWeights.rebounding) *
        chem,
    ),
    off: Math.round(off * chem),
    def: Math.round(def * chem),
    reb: Math.round(reb * chem),
    pace: wavg("athleticism"),
    perO: Math.round(perO * chem),
    perD: Math.round(perD * chem),
    intO: Math.round(intO * chem),
    intD: Math.round(intD * chem),
    depth: meta.players.length,
    chemistry: chem,
    tension: teamTensionScore(id),
  };
  if (_powerCacheOn) _powerCache[id] = result;
  return result;
}
function rand(min, max) {
  return Math.floor(min + random() * (max - min + 1));
}
function random() {
  // Mulberry32: compact, deterministic, and persisted with the save so any
  // season can be reproduced from its seed and event sequence.
  const result = ENGINE.nextRandom(S.rngState);
  S.rngState = result.state;
  return result.value;
}
function hcSystemMods(teamId) {
  let systemId = null;
  if (teamId === S.team.abbr) {
    systemId = S.coaches && S.coaches.head && S.coaches.head.system;
  } else {
    const npc = DATA.npcHeadCoaches && DATA.npcHeadCoaches[teamId];
    if (npc) systemId = npc.system;
  }
  if (!systemId) return { perO: 0, perD: 0, intO: 0, intD: 0, reb: 0 };
  const sys = DATA.coachingSystems && DATA.coachingSystems[systemId];
  return sys ? sys.mods : { perO: 0, perD: 0, intO: 0, intD: 0, reb: 0 };
}
function hcTraitMods(teamId) {
  // Only user coach traits fire (NPC traits are flavor only).
  const out = { perO: 0, perD: 0, intO: 0, intD: 0 };
  if (teamId !== S.team.abbr) return out;
  const traits = (S.coaches && S.coaches.head && S.coaches.head.traits) || [];
  if (traits.includes("motion-offense")) out.perO += 1;
  if (traits.includes("defensive-mind")) {
    out.perD += 1;
    out.intD += 1;
  }
  return out;
}
function rotationMood(teamId) {
  const players = healthyRotation(teamMeta(teamId).players, 8, teamId);
  if (!players.length) return 60;
  return avg(players.map((p) => p.mood || 60));
}
function simScore(home, away, game) {
  const hp = teamPower(home),
    ap = teamPower(away);
  // Head-coach system biases apply to both teams (NPC + user).
  const hSys = hcSystemMods(home);
  const aSys = hcSystemMods(away);
  const hTrait = hcTraitMods(home);
  const aTrait = hcTraitMods(away);
  // Coaching modifiers when user team is in this game.
  const mod = {
    h: { perO: 0, perD: 0, intO: 0, intD: 0 },
    a: { perO: 0, perD: 0, intO: 0, intD: 0 },
  };
  const userIs = home === S.team.abbr ? "h" : away === S.team.abbr ? "a" : null;
  if (userIs && S.coaching) {
    const m = mod[userIs];
    const focusApplies = S.coaching.weeklyFocus && S.coaching.weeklyFocus !== "none";
    const f = focusApplies ? S.coaching.weeklyFocus : null;
    const asstTraits = (S.coaches && S.coaches.assistant && S.coaches.assistant.traits) || [];
    const filmBuff = asstTraits.includes("film-buff") ? 1 : 0;
    if (f === "perO") m.perO += 2;
    else if (f === "perD") m.perD += 2;
    else if (f === "intO") m.intO += 2;
    else if (f === "intD") m.intD += 2;
    else if (f === "film") {
      const bonus = 1 + filmBuff; // Film Buff trait makes Film Study +2 per channel
      m.perO += bonus;
      m.perD += bonus;
      m.intO += bonus;
      m.intD += bonus;
    }
    const gp = game && S.coaching.gamePlans && S.coaching.gamePlans[game.id];
    if (gp) {
      if (gp.scouted) {
        m.perD += 1;
        m.intD += 1;
      }
      // Veteran Tactician (HC) and Defensive Coordinator (Asst) both juice game plans.
      const hcTraits = (S.coaches && S.coaches.head && S.coaches.head.traits) || [];
      const vt = hcTraits.includes("veteran-tactician");
      const dc = asstTraits.includes("defensive-coordinator");
      const planBonus = vt || dc ? 4 : 3;
      const planPenalty = vt || dc ? 2 : 1;
      if (gp.plan === "pack") {
        m.intD += planBonus;
        m.perD -= planPenalty;
      } else if (gp.plan === "extend") {
        m.perD += planBonus;
        m.intD -= planPenalty;
      }
    }
    // Inspiring trait: pending buff from a prior loss.
    if (S.coaches && S.coaches.pendingBuff && S.coaches.pendingBuff.type === "inspiring") {
      const b = S.coaches.pendingBuff.channelBonus || 3;
      m.perO += b;
      m.perD += b;
      m.intO += b;
      m.intD += b;
    }
  }
  const hPerO = hp.perO + mod.h.perO + hSys.perO + hTrait.perO;
  const hPerD = hp.perD + mod.h.perD + hSys.perD + hTrait.perD;
  const hIntO = hp.intO + mod.h.intO + hSys.intO + hTrait.intO;
  const hIntD = hp.intD + mod.h.intD + hSys.intD + hTrait.intD;
  const aPerO = ap.perO + mod.a.perO + aSys.perO + aTrait.perO;
  const aPerD = ap.perD + mod.a.perD + aSys.perD + aTrait.perD;
  const aIntO = ap.intO + mod.a.intO + aSys.intO + aTrait.intO;
  const aIntD = ap.intD + mod.a.intD + aSys.intD + aTrait.intD;
  // Two head-to-head channels: perimeter scoring vs perimeter D, interior vs interior.
  const hPer = 38 + (hPerO - aPerD) * 0.45;
  const aPer = 37 + (aPerO - hPerD) * 0.45;
  const hInt = 38 + (hIntO - aIntD) * 0.45;
  const aInt = 37 + (aIntO - hIntD) * 0.45;
  const hReb = hp.reb + (hSys.reb || 0);
  const aReb = ap.reb + (aSys.reb || 0);
  const hRebEdge = (hReb - aReb) * 0.1;
  const aRebEdge = (aReb - hReb) * 0.1;
  // Roster-depth penalty: thin benches add late-game variance.
  const hThin = Math.max(0, 10 - hp.depth);
  const aThin = Math.max(0, 10 - ap.depth);
  const hBase = hPer + hInt + hRebEdge + BALANCE.homeAdvantage;
  const aBase = aPer + aInt + aRebEdge;
  const hcTraits = (S.coaches && S.coaches.head && S.coaches.head.traits) || [];
  let tight = 0;
  if (userIs && hcTraits.includes("clutch")) tight += 3;
  if (userIs && game && game.playoff && hcTraits.includes("championship-pedigree")) tight += 2;
  if (userIs && game && game.playoff && S.lockerRoom && S.lockerRoom.captainId) tight += 2;
  const moodScale = BALANCE.moodScoreScale || 0.04;
  const hMood = (rotationMood(home) - 60) * moodScale;
  const aMood = (rotationMood(away) - 60) * moodScale;
  let hs = Math.max(58, Math.round(hBase + hMood + rand(-7 - hThin + tight, 8 + hThin - tight)));
  let as = Math.max(55, Math.round(aBase + aMood + rand(-7 - aThin + tight, 8 + aThin - tight)));
  // Break ties without a systematic home bias: pick the winner randomly.
  if (hs === as) {
    if (random() < 0.5) hs += rand(1, 5);
    else as += rand(1, 5);
  }
  return { hs, as, hp, ap };
}
// Dev helper: run N seasons over the current schedule and print win-rate by team.
window.simTest = function (seasons = 20) {
  if (!S.season || !S.season.schedule) return console.log("Start a season first.");
  const rngBefore = S.rngState;
  const ids = leagueIds();
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
  S.rngState = rngBefore;
  return rows;
};
// Distribute game stats across top-8 rotation and accumulate season totals.
// Returns top-3 box-score lines for backward-compat display.
function distributeAndRecord(id, ptsFor, won, accumulate = true) {
  const team = teamMeta(id);
  const healthy = healthyRotation(team.players, 8, id);
  if (!healthy.length) return [];
  const total = Math.max(0, Math.round(ptsFor));
  // Weight each player's scoring share by rotation slot and scoring rating (plus
  // light noise), then apportion integer points that sum EXACTLY to the team's
  // score. The previous version handed stars fixed chunks and let the remainder
  // go negative, so the box score never reconciled to the scoreboard.
  const slotW = BALANCE.statShareWeights;
  const knobs = lockerKnobs();
  const tension = teamTensionScore(id);
  const freezeTension =
    id === S.team.abbr && S.lockerRoom && S.lockerRoom.culture === "grit"
      ? knobs.gritFreezeTension || 55
      : knobs.freezeTension;
  const weights = healthy.map((p, i) => {
    const sc = (p.ratings && p.ratings.scoring) || 60;
    const freeze = ENGINE.statShareFactor(p, tension, { ...knobs, freezeTension });
    return (slotW[i] ?? 0.14) * (0.6 + sc / 100) * (0.85 + random() * 0.3) * freeze;
  });
  const pts = ENGINE.allocateIntegerTotal(weights, total);
  const rotation = healthy.map((p, i) => ({
    player: p,
    pts: pts[i],
    reb: rand(p.pos.includes("C") ? 5 : 2, p.pos.includes("G") ? 7 : 11),
    ast: rand(p.pos.includes("G") ? 4 : 1, p.pos.includes("C") ? 4 : 8),
  }));
  if (accumulate) {
    rotation.forEach((r) => {
      if (!r.player.seasonStats) r.player.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 };
      r.player.seasonStats.gp += 1;
      r.player.seasonStats.pts += r.pts;
      r.player.seasonStats.reb += r.reb;
      r.player.seasonStats.ast += r.ast;
      if (won) r.player.seasonStats.w += 1;
    });
  }
  // Box score shows the top three scorers (not just the highest-rated players).
  return rotation
    .slice()
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 3)
    .map((r) => ({
      name: r.player.name,
      pos: r.player.pos,
      pts: r.pts,
      reb: r.reb,
      ast: r.ast,
    }));
}
function resetSeasonStats() {
  const z = (p) => {
    p.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 };
  };
  S.roster.forEach(z);
  S.waived.forEach(z);
  S.teams.forEach((t) => t.players.forEach(z));
}
function snapshotComposites() {
  const snap = (p) => {
    p.compositeAtStart = composite(p);
  };
  S.roster.forEach(snap);
  S.teams.forEach((t) => t.players.forEach(snap));
}
function simulateGame(g) {
  if (!g || g.played) return;
  // Ratings can change between games (dev growth), so the composite cache from a
  // prior game must be dropped before this one.
  clearComputeCaches();
  const existingInjuries = {
    [g.home]: new Set(
      teamMeta(g.home)
        .players.filter((p) => p.injury)
        .map((p) => p.id),
    ),
    [g.away]: new Set(
      teamMeta(g.away)
        .players.filter((p) => p.injury)
        .map((p) => p.id),
    ),
  };
  const r = simScore(g.home, g.away, g);
  const winner = r.hs > r.as ? g.home : g.away;
  const accumulate = !g.playoff;
  const homeBox = distributeAndRecord(g.home, r.hs, winner === g.home, accumulate);
  const awayBox = distributeAndRecord(g.away, r.as, winner === g.away, accumulate);
  // Existing injuries miss this game and count it down afterward. New injuries
  // are rolled last so a one-game injury actually misses the next game.
  rollInjuries(g);
  tickTeamInjuries(g.home, existingInjuries[g.home]);
  tickTeamInjuries(g.away, existingInjuries[g.away]);
  Object.assign(g, {
    played: true,
    homeScore: r.hs,
    awayScore: r.as,
    winner,
    box: { home: homeBox, away: awayBox },
  });
  // Standings updates are regular-season only; playoff series tracked separately.
  if (!g.playoff) {
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
  } else {
    onPlayoffGameComplete(g);
  }
  S.season.results.unshift(g.id);
  addLog(
    g.home === S.team.abbr || g.away === S.team.abbr ? "Game final" : "League final",
    `${teamMeta(g.away).name} ${g.awayScore}, ${teamMeta(g.home).name} ${g.homeScore}. ${teamMeta(g.winner).name} win.`,
  );
  if (g.home === S.team.abbr || g.away === S.team.abbr) {
    // Each user game advances the calendar: dev growth, market churn, injury healing, press.
    applyWeeklyTransition(g.week);
    tickMinutesAndCulture();
    tickLockerRoom(g.week);
    marketChurn();
    maybeTriggerPress(g);
    // Consume Inspiring buff if it was set (it applied this game).
    if (S.coaches && S.coaches.pendingBuff) S.coaches.pendingBuff = null;
    // Inspiring trait: a loss sets the buff for the NEXT user game.
    const hcTraits = (S.coaches && S.coaches.head && S.coaches.head.traits) || [];
    if (g.winner !== S.team.abbr && hcTraits.includes("inspiring")) {
      S.coaches.pendingBuff = { type: "inspiring", channelBonus: 3 };
      addLog(
        "Coach speech",
        `${S.coaches.head.name} rallied the locker room. Team gets a boost next game.`,
      );
    }
    // Motivator (assistant): mood bump after each user game.
    const asstTraits = (S.coaches && S.coaches.assistant && S.coaches.assistant.traits) || [];
    if (asstTraits.includes("motivator")) {
      S.roster.forEach((p) => (p.mood = Math.max(20, Math.min(99, (p.mood || 60) + 2))));
    }
    // Scout Genius (assistant): auto-scout the next user opponent.
    if (asstTraits.includes("scout-genius")) {
      const upcoming = userUpcomingGames(1)[0];
      if (upcoming && S.coaching.gamePlans) {
        if (!S.coaching.gamePlans[upcoming.id])
          S.coaching.gamePlans[upcoming.id] = { scouted: false, plan: null };
        S.coaching.gamePlans[upcoming.id].scouted = true;
      }
    }
  }
  // Keep S.week in sync with the schedule.
  const next = S.season.schedule.find((x) => !x.played);
  if (next) S.week = next.week;
  else S.week = Math.max(...S.season.schedule.map((x) => x.week), S.week) + 1;
  maybeResetWeeklyFocus(S.week);
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
  if (S.playoffs && S.playoffs.active && !S.playoffs.complete) {
    return simNextPlayoffGame();
  }
  if (!requireOpeningNightReady()) return;
  S.phase = `${S.year} Regular Season`;
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
  tab = "schedule";
  save();
  render();
}
function playQueuedGame() {
  if (!S.gameDay) return;
  let g = null;
  if (S.gameDay.source === "playoff") {
    const found = findPlayoffGame(S.gameDay.gameId);
    g = found ? found.game : null;
  } else {
    g = S.season.schedule.find((x) => x.id === S.gameDay.gameId);
  }
  if (!g) {
    S.gameDay = null;
    save();
    return render();
  }
  simulateGame(g);
  S.gameDay = null;
  S.postGame = { gameId: g.id, source: g.playoff ? "playoff" : "season" };
  save();
  render();
}
function closePostGame() {
  S.postGame = null;
  save();
  render();
}
function closeGameDay() {
  S.gameDay = null;
  save();
  render();
}
function simWeek() {
  if (!requireOpeningNightReady()) return;
  S.phase = `${S.year} Regular Season`;
  ensureSeason();
  const g = nextUnplayed();
  if (!g) return toast("Season complete.");
  const week = g.week;
  S.season.schedule.filter((x) => !x.played && x.week === week).forEach(simulateGame);
  S.week = Math.max(S.week, week + 1);
  render();
}
function applyBulkCoaching() {
  if (!S.season || !S.coaching) return;
  const remaining = S.season.schedule.filter(
    (g) => !g.played && (g.home === S.team.abbr || g.away === S.team.abbr),
  );
  const next = remaining[0];
  const template = next && S.coaching.gamePlans && S.coaching.gamePlans[next.id];
  remaining.forEach((g) => {
    if (template)
      S.coaching.gamePlans[g.id] = { scouted: !!template.scouted, plan: template.plan || null };
  });
  if (S.coaching.weeklyFocus && S.coaching.weeklyFocus !== "none") S.coaching.bulkFocus = true;
}
function simSeason() {
  if (!requireOpeningNightReady()) return;
  S.phase = `${S.year} Regular Season`;
  ensureSeason();
  applyBulkCoaching();
  S.season.schedule.filter((x) => !x.played).forEach(simulateGame);
  // Derive the week from the schedule rather than hardcoding 17, so the topbar
  // stays correct regardless of schedule length.
  S.week = Math.max(...S.season.schedule.map((x) => x.week), S.week) + 1;
  if (S.coaching) S.coaching.bulkFocus = false;
  render();
}
function nextGameBrief() {
  const g = nextUserGame();
  if (!g)
    return `<div class="logItem"><b>Season complete</b><p class="muted">All scheduled games have been simulated. Review standings and recent finals in Season Command.</p></div>`;
  const home = teamMeta(g.home);
  const away = teamMeta(g.away);
  const isHome = g.home === S.team.abbr;
  return `<div class="logItem"><b>Next Game · Week ${g.week}</b><p class="muted">${escapeHtml(isHome ? away.name + " visits" : home.name + " hosts")} ${isHome ? "at home" : "on the road"}. ${escapeHtml(isHome ? "Use the crowd and matchups to your advantage." : "Travel and rotations will matter.")}</p><button class="btn secondary" data-tab="schedule">Open Season Command</button></div>`;
}
function standingsRows() {
  return leagueIds()
    .map((id) => {
      const r = seasonRecord(id);
      return {
        id,
        ...r,
        pct: r.w + r.l ? r.w / (r.w + r.l) : 0,
        diff: r.w + r.l ? Math.round(((r.pf - r.pa) / (r.w + r.l)) * 10) / 10 : 0,
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
    ? '<button class="btn" data-action="enterPlayoffs">Enter Playoffs →</button>'
    : "";
  const heroBlock = next
    ? nextGameHero(next)
    : `<section class="card"><div class="cardPad"><h3>Season complete</h3><p class="muted">All regular-season games are final. Enter the playoffs next; the offseason follows awards.</p>${offseasonBtn}</div></section>`;
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
    ? `<div class="impact" style="margin-top:10px"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><p class="muted" style="margin-top:8px">${(() => {
        const r = recommendPlan(oppPower);
        return r === "pack"
          ? "Interior-leaning attack — Pack the Paint covers their best lane."
          : r === "extend"
            ? "Perimeter-leaning attack — Extend Defense closes their shooters."
            : "Balanced opponent — neither plan offers a clear edge.";
      })()}</p>`
    : `<div style="margin-top:10px"><button class="btn secondary" data-scout="${g.id}">Scout Opponent</button></div>`;
  const planBlock = gp.scouted
    ? `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear plan</button>` : ""}</div>`
    : "";
  return `<section class="card" style="margin-bottom:18px"><div class="sectionTitle"><h3>Next Game · Week ${g.week} · ${isHome ? "vs" : "at"} ${opp.name}</h3><span>${opp.id} ${oppRec.w}-${oppRec.l}</span></div><div class="cardPad"><div class="layout2"><div><h3 style="margin:0">${isHome ? "Home" : "Road"} · ${opp.name}</h3><p class="muted">Plan: <b>${gp.plan === "pack" ? "Pack the Paint" : gp.plan === "extend" ? "Extend Defense" : "Not set"}</b> · Coaching focus: <b>${focusLabel}</b></p>${scoutBlock}${planBlock}</div><div class="actions" style="justify-content:flex-end;align-items:flex-end;flex-direction:column;gap:10px"><button class="btn" data-action="simNext" style="font-size:15px;padding:14px 18px">Game Day →</button><button class="btn secondary" data-action="simWeek">Sim Current Week (skip prep)</button></div></div></div></section>`;
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
  return `<div class="logItem"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>Week ${g.week} · ${isHome ? "vs" : "at"} <span class="teamBadge" style="${badgeStyle(opp.primary)}">${oppId}</span> ${opp.name}</b><span class="pill">${oppRec.w}-${oppRec.l}</span></div><div class="mini" style="margin-top:6px">${gp.scouted ? "Scouted" : "Unscouted"} · Plan: ${gp.plan === "pack" ? "Pack" : gp.plan === "extend" ? "Extend" : "—"}</div><div class="actions" style="margin-top:8px">${gp.scouted ? "" : `<button class="btn secondary" data-scout="${g.id}">Scout</button>`}<button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend</button></div></div>`;
}
function currentFocusLabel() {
  const f = (FOCUS_OPTIONS || []).find((o) => o.id === S.coaching.weeklyFocus);
  return f ? f.label : "—";
}
function gameDayView() {
  if (!S.gameDay) return `<div class="empty">No game queued.</div>`;
  const g =
    S.gameDay.source === "playoff"
      ? (findPlayoffGame(S.gameDay.gameId) || {}).game
      : S.season.schedule.find((x) => x.id === S.gameDay.gameId);
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
  ensureUserRotation();
  const ordered = healthyRotation(S.roster, null, S.team.abbr);
  const topRotation = ordered.slice(0, 8);
  const bench = ordered.slice(8);
  const injuredRotation = S.roster.filter((p) => p.injury);
  const injuredCount = injuredRotation.length;
  const lastHealthyIdx = Math.max(0, ordered.length - 1);
  const recommendedPlan = recommendPlan(oppPower);
  const recLine =
    recommendedPlan === "pack"
      ? "Opponent leans <b>interior</b>. Scouts recommend <b>Pack the Paint</b>."
      : recommendedPlan === "extend"
        ? "Opponent leans <b>perimeter</b>. Scouts recommend <b>Extend Defense</b>."
        : "Opponent is <b>balanced</b>. Neither plan offers a clear edge — coach's call.";
  const scoutBlock = gp.scouted
    ? `<div class="impact" style="margin-top:10px"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><p class="muted" style="margin-top:8px">${recLine}</p>`
    : `<div style="margin-top:10px"><button class="btn" data-scout="${g.id}">Scout Opponent</button><p class="muted" style="margin-top:8px">Skipping the scout means flying blind. You can still set a plan, but you won't know which lane to defend.</p></div>`;
  const planBlock = `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear</button>` : ""}</div>`;
  const rotationRow = (p, role, idx) =>
    `<tr ${role === "injured" ? 'style="opacity:.5"' : ""}><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div class="playerName">${escapeHtml(p.name)}</div></div></td><td>${escapeHtml(p.pos)}</td><td>${injuryBadge(p)}</td><td>${p.mood || 60}</td><td title="Minutes in the eight raise bond; sitting drops it.">${Math.round(p.bond || 50)}</td><td>${p.age || "—"}</td><td class="actions">${
      role === "injured"
        ? ""
        : `${`<button class="btn ghost" data-rotate-up="${escapeAttr(p.id)}" ${idx === 0 ? "disabled" : ""}>Up</button><button class="btn ghost" data-rotate-down="${escapeAttr(p.id)}" ${idx === lastHealthyIdx ? "disabled" : ""}>Down</button>`}${
            role === "start"
              ? `<button class="btn secondary" data-sit="${escapeAttr(p.id)}" title="Move her out of the eight. Competitors who sit three games in a row may file to leave.">Sit</button>`
              : `<button class="btn secondary" data-start="${escapeAttr(p.id)}" title="Put her in the eight. Shared starts build on-court pairs and raise bond.">Start</button>`
          }`
    }</td></tr>`;
  const rotationTable = `<table class="table"><thead><tr><th>Player</th><th>Pos</th><th>Status</th><th>Mood</th><th title="How much she trusts this franchise">Bond</th><th>Age</th><th></th></tr></thead><tbody>${topRotation.map((p, idx) => rotationRow(p, "start", idx)).join("")}${bench.map((p, i) => rotationRow(p, "bench", i + topRotation.length)).join("")}${injuredRotation
    .map((p) => rotationRow(p, "injured"))
    .join("")}</tbody></table>`;
  return `<section class="card"><div class="sectionTitle"><h3>Game Day · Week ${g.week} · ${isHome ? "vs" : "at"} ${opp.name}</h3><span>${opp.id} ${oppRec.w}-${oppRec.l}</span></div><div class="cardPad"><div class="layout2"><section><h3 style="margin-top:0">Opponent</h3><p class="muted">${opp.name} · ${oppRec.w}-${oppRec.l} · power index ${oppPower.overall}</p>${scoutBlock}<h3 style="margin-top:18px">Your Game Plan</h3>${planBlock}</section><section><h3 style="margin-top:0">Your Prep</h3><p class="muted">Coaching Focus: <b>${currentFocusLabel()}</b></p><p class="muted">Plan: <b>${gp.plan === "pack" ? "Pack the Paint" : gp.plan === "extend" ? "Extend Defense" : "Not set"}</b></p><p class="muted">Power Index: <b>${myPower.overall}</b> · Per ${myPower.perO}/${myPower.perD} · Int ${myPower.intO}/${myPower.intD}</p><p class="muted">Injured players: <b>${injuredCount}</b></p></section></div><h3 style="margin-top:18px">Your Rotation</h3><p class="muted">Reorder the full depth chart. The first eight healthy names play. Minutes there raise bond and grow on-court pairs. Sit a Competitor three games in a row and she may file to leave. Injured players cannot be activated.</p>${rotationTable}<div class="actions" style="margin-top:18px"><button class="btn" data-action="playQueuedGame" style="font-size:15px;padding:14px 20px">Play Game →</button><button class="btn secondary" data-action="closeGameDay">Hold Off</button></div></div></section>`;
}
function findAnyGame(gameId) {
  const reg = S.season && S.season.schedule.find((x) => x.id === gameId);
  if (reg) return reg;
  const p = findPlayoffGame(gameId);
  return p ? p.game : null;
}
function postGameView() {
  if (!S.postGame) return '<div class="empty">No recent game.</div>';
  const g = findAnyGame(S.postGame.gameId);
  if (!g) {
    S.postGame = null;
    return '<div class="empty">Game not found.</div>';
  }
  const isHome = g.home === S.team.abbr;
  const oppId = isHome ? g.away : g.home;
  const opp = teamMeta(oppId);
  const userScore = isHome ? g.homeScore : g.awayScore;
  const oppScore = isHome ? g.awayScore : g.homeScore;
  const won = g.winner === S.team.abbr;
  const margin = Math.abs(userScore - oppScore);
  const userBox = isHome ? g.box.home : g.box.away;
  const oppBox = isHome ? g.box.away : g.box.home;
  const oppName = escapeHtml(opp.name);
  const headline = won
    ? margin >= 15
      ? `Statement win over ${oppName}!`
      : margin <= 4
        ? `Hard-fought win over ${oppName}`
        : `Win over ${oppName}`
    : margin >= 15
      ? `Blowout loss to ${oppName}`
      : margin <= 4
        ? `Heartbreaking loss to ${oppName}`
        : `Loss to ${oppName}`;
  const bannerBg = won ? "#fff6ee" : "#fde8e6";
  const bannerBorder = won ? "var(--orange)" : "var(--red)";
  const press = S.coaching.pendingPress;
  const pressBlock = press
    ? `<div class="logItem" style="border-color:var(--orange);background:#fff6ee;margin-top:18px"><b>${press.headline}</b><p class="muted">${press.body}</p><div class="actions" style="flex-direction:column;align-items:stretch;gap:8px">${press.options.map((o) => `<button class="btn secondary" data-press="${o.id}" style="text-align:left">${o.text}</button>`).join("")}</div></div>`
    : "";
  const boxRow = (p) =>
    `<div class="checkRow"><div><b>${escapeHtml(p.name)}</b> <span class="pill">${escapeHtml(p.pos)}</span><div class="mini">${p.pts} pts · ${p.reb} reb · ${p.ast} ast</div></div></div>`;
  return `<section class="card"><div class="sectionTitle"><h3>${headline}</h3><span>Week ${g.week}</span></div><div class="cardPad"><div style="display:flex;gap:24px;justify-content:center;align-items:center;padding:24px;background:${bannerBg};border:2px solid ${bannerBorder};border-radius:18px;margin-bottom:18px"><div style="text-align:center;min-width:140px"><div style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:800">${isHome ? "Home" : "Away"}</div><div style="font-size:18px;font-weight:800">${escapeHtml(S.team.nickname)}</div><div style="font-size:56px;font-weight:900;letter-spacing:-.04em;color:${won ? "var(--green)" : "var(--ink)"}">${userScore}</div></div><div style="font-size:22px;color:var(--muted);font-weight:800">vs</div><div style="text-align:center;min-width:140px"><div style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:800">${isHome ? "Away" : "Home"}</div><div style="font-size:18px;font-weight:800">${oppName}</div><div style="font-size:56px;font-weight:900;letter-spacing:-.04em;color:${!won ? "var(--green)" : "var(--ink)"}">${oppScore}</div></div></div>${pressBlock}<div class="layout2" style="margin-top:18px"><section><h3>${escapeHtml(S.team.nickname)} top performers</h3>${userBox.map(boxRow).join("")}</section><section><h3>${opp.name} top performers</h3>${oppBox.map(boxRow).join("")}</section></div><div class="actions" style="margin-top:20px"><button class="btn" data-action="closePostGame" style="font-size:15px;padding:14px 20px">Continue →</button></div></div></section>`;
}
function seasonKpis() {
  const r = seasonRecord(S.team.abbr);
  const p = teamPower(S.team.abbr);
  const next = nextUserGame();
  return `<div class="grid kpis"><div class="card kpi"><label>Record</label><div class="value">${r.w}-${r.l}</div><small>${r.w + r.l ? Math.round((r.w / (r.w + r.l)) * 100) : 0}% win rate</small></div><div class="card kpi"><label>Power Index</label><div class="value">${p.overall}</div><small>Per ${p.perO}/${p.perD} · Int ${p.intO}/${p.intD} · Reb ${p.reb}</small></div><div class="card kpi"><label>Next Game</label><div class="value">${next ? `W${next.week}` : "Done"}</div><small>${next ? `${teamMeta(next.away).id} at ${teamMeta(next.home).id}` : "Season complete"}</small></div><div class="card kpi"><label>Playoff Cut</label><div class="value">Top 8</div><small>${playoffStatus()}</small></div></div><details class="ratingGlossary"><summary>How to read the ratings</summary><p><b>Per O / Per D</b> are perimeter offense and defense. <b>Int O / Int D</b> are interior offense and defense. <b>Reb</b> is rebounding. <b>Power Index</b> combines those channels; <b>Diff</b> is average point differential.</p></details>`;
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
  return `<div class="gameRow ${g.played ? "played" : ""} ${user ? "userGame" : ""}"><div><b>Week ${g.week}</b><span class="mini">${g.showcase ? " · showcase matchup" : ""}</span></div><div><span class="teamBadge" style="${badgeStyle(away.primary)}">${away.id}</span>${away.name}</div><div class="scoreCell">${g.played ? g.awayScore : "—"}</div><div><span class="teamBadge" style="${badgeStyle(home.primary)}">${home.id}</span>${home.name}</div><div class="scoreCell">${g.played ? g.homeScore : "—"}</div><div>${g.played ? `<span class="pill ${g.winner === S.team.abbr ? "good" : ""}">${teamMeta(g.winner).id} win</span>` : '<span class="pill warn">upcoming</span>'}</div></div>`;
}
function standingsTable() {
  return `<table class="table"><thead><tr><th>Rank</th><th>Team</th><th>W-L</th><th>Pct</th><th>Diff</th><th>Streak</th></tr></thead><tbody>${standingsRows()
    .map(
      (r, i) =>
        `<tr class="${r.id === S.team.abbr ? "highlightRow" : ""}"><td>${i + 1}</td><td><span class="teamBadge" style="${badgeStyle(teamMeta(r.id).primary)}">${escapeHtml(r.id)}</span>${escapeHtml(teamMeta(r.id).name)}</td><td>${r.w}-${r.l}</td><td>${r.pct.toFixed(3)}</td><td>${r.diff > 0 ? "+" : ""}${r.diff}</td><td>${r.streak}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function recentResults() {
  const ids = S.season.results.slice(0, 6);
  if (!ids.length) return '<div class="empty">No games simulated yet.</div>';
  return ids
    .map((id) => {
      // Results can include playoff game ids, which live outside S.season.schedule —
      // findAnyGame resolves both regular-season and playoff games.
      const g = findAnyGame(id);
      if (!g) return "";
      const top = [...(g.box?.away || []), ...(g.box?.home || [])].sort((a, b) => b.pts - a.pts)[0];
      return `<div class="logItem"><b>${escapeHtml(teamMeta(g.away).id)} ${g.awayScore} @ ${escapeHtml(teamMeta(g.home).id)} ${g.homeScore}</b><p class="muted">Winner: ${escapeHtml(teamMeta(g.winner).name)}. Top line: ${top?.name ? escapeHtml(top.name) : "—"} · ${top?.pts || 0} pts, ${top?.reb || 0} reb, ${top?.ast || 0} ast.</p></div>`;
    })
    .join("");
}

function setupPage() {
  return `<div class="setup"><section class="hero"><div><h1>Build the next WNBA front office.</h1><p>Choose a market, name the expansion team, set the colors, then enter a live-feeling draft room with cap pressure, protected stars, hidden ratings, trades, waivers, and a real roster-building dashboard.</p></div><div><div class="previewJersey">${abbr(S.team.city, S.team.nickname)}</div><p class="mini">White/orange dashboard theme. Your selected colors drive team accents throughout the UI.</p></div></section>${setupSavePanel()}<section class="card form"><h2>Expansion Setup</h2><div class="field"><label for="citySelect">Preset city</label><select id="citySelect">${DATA.expansionCities.map((c, i) => `<option value="${i}" ${S.team.city === c.city ? "selected" : ""}>${c.city} · suggested ${c.nickname}</option>`).join("")}</select></div><div class="tiles" role="radiogroup" aria-label="Expansion city presets">${DATA.expansionCities.map((c, i) => `<button type="button" class="cityTile ${S.team.city === c.city ? "selected" : ""}" data-citytile="${i}" role="radio" aria-checked="${S.team.city === c.city}"><strong>${c.city}</strong><small>Market ${c.market} · pressure ${c.pressure} · ${c.arena}</small></button>`).join("")}</div><br><div class="field"><label for="nickInput">Team nickname</label><input id="nickInput" value="${escapeAttr(S.team.nickname)}" placeholder="Foundry"></div><div class="field"><label for="arenaInput">Arena</label><input id="arenaInput" value="${escapeAttr(S.team.arena)}"></div><div class="colorRow"><div class="field" style="flex:1"><label for="primaryInput">Primary</label><input id="primaryInput" type="color" value="${escapeAttr(S.team.primary)}"></div><div class="field" style="flex:1"><label for="secondaryInput">Secondary</label><input id="secondaryInput" type="color" value="${escapeAttr(S.team.secondary)}"></div></div><div class="actions"><button class="btn" data-action="start">Enter Front Office</button><button class="btn secondary" data-action="randomize">Randomize Identity</button></div><p class="muted">Prototype includes 15 existing/franchise teams, expansion draft pool, trade engine, waivers, dashboard KPIs, scouting cards, hidden player ratings and local autosave.</p></section></div>`;
}
function setupSavePanel() {
  const slots = readSaveIndex();
  const slotList = slots.length
    ? slots
        .map(
          (slot) =>
            `<div class="checkRow"><div><b>${escapeHtml(slot.name)}</b>${slot.id === activeSlotId ? ' <span class="pill good">Active</span>' : ""}<div class="mini">Year ${slot.year} · ${slot.updatedAt ? new Date(slot.updatedAt).toLocaleString() : "unknown"}</div></div>${slot.id === activeSlotId ? "" : `<button class="btn secondary" data-load-slot="${escapeAttr(slot.id)}">Load</button>`}</div>`,
        )
        .join("")
    : '<div class="empty">No saved franchises in this browser yet.</div>';
  const importPreview = pendingImport
    ? `<div class="logItem importPreview"><b>Ready to import: ${escapeHtml(pendingImport.saveName)}</b><p class="muted">${escapeHtml(pendingImport.team.city)} ${escapeHtml(pendingImport.team.nickname)} · Year ${pendingImport.year}</p><div class="actions"><button class="btn" data-action="confirmImport">Apply Import</button><button class="btn secondary" data-action="cancelImport">Cancel</button></div></div>`
    : "";
  return `<section class="card form"><h2>Continue a franchise</h2><p class="muted">Load a slot from this browser, or import an exported JSON. Progress stays on this device unless you export.</p><div class="log">${slotList}</div><div class="field"><label for="saveImport">Import save JSON</label><textarea id="saveImport" rows="3" placeholder="Paste exported save JSON"></textarea></div><div class="actions"><button class="btn secondary" data-action="importSave">Validate Import</button></div>${importPreview}</section>`;
}
function seasonStepper() {
  const stages = [
    { id: "regular", label: "Regular" },
    { id: "playoffs", label: "Playoffs" },
    { id: "awards", label: "Awards" },
    { id: "aging", label: "Aging" },
    { id: "draft", label: "Draft" },
    { id: "next", label: "Next Year" },
  ];
  let current = "regular";
  if (S.offseason && S.offseason.stage === "done") current = "next";
  else if (S.offseason && S.offseason.stage === "draft") current = "draft";
  else if (S.offseason && (S.offseason.stage === "aging" || S.offseason.stage === "contracts"))
    current = "aging";
  else if (S.pendingAwards) current = "awards";
  else if (S.playoffs) current = "playoffs";
  const currentIdx = stages.findIndex((stage) => stage.id === current);
  return `<nav class="seasonStepper" aria-label="Season progress"><ol>${stages
    .map((stage, index) => {
      const state = index < currentIdx ? "done" : index === currentIdx ? "current" : "todo";
      return `<li class="${state}"><span>${escapeHtml(stage.label)}</span></li>`;
    })
    .join("")}</ol></nav>`;
}
function abbr(city, nick) {
  return ((city || "").slice(0, 1) + (nick || "").slice(0, 2)).toUpperCase();
}
// Guarantee the user team id can't collide with an existing NPC team id, which
// would make leagueIds()/teamMeta()/standings conflate two teams (self-games,
// double-counted records). Falls back through letters then a numeric suffix.
function uniqueUserAbbr(city, nick, teams) {
  return uniqueAbbrAgainst(abbr(city, nick), city, nick, teams || DATA.teams);
}
function uniqueAbbrAgainst(proposed, city, nick, teams) {
  const taken = new Set((teams || DATA.teams || []).map((t) => t.id));
  let base = (proposed || abbr(city, nick) || "EXP").toUpperCase();
  if (!taken.has(base)) return base;
  const cityLetter = (city || "X").slice(0, 1).toUpperCase();
  for (let i = 0; i < 26; i++) {
    const cand = (cityLetter + String.fromCharCode(65 + i) + "X").slice(0, 3);
    if (!taken.has(cand)) return cand;
  }
  let n = 1;
  while (taken.has(base.slice(0, 2) + n)) n++;
  return base.slice(0, 2) + n;
}
function modalHtml() {
  if (!modal) return "";
  if (modal.type === "player") {
    const p = findPlayer(modal.id);
    if (!p) return "";
    const owned = S.roster.some((player) => player.id === p.id);
    const persona = personaEntry("public", p.persona);
    const hidden =
      p.hiddenTrait && owned && p.traitRevealed ? personaEntry("hidden", p.hiddenTrait) : null;
    return `<div class="modalShade" data-modal-shade><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modalHeader"><div style="display:flex;gap:14px;align-items:center">${portraitHtml(p, "lg")}<h3 id="modal-title">${escapeHtml(p.name)} <span class="pill">${escapeHtml(p.pos)}</span> ${personaChip(p)} ${hiddenChip(p, owned)}</h3></div><button class="close" data-close aria-label="Close player scout">Close</button></div><div class="modalBody"><p>${escapeHtml(p.scouting)}</p><div class="layout2"><div><h3>Persona</h3><p class="muted">${persona ? escapeHtml(persona.desc) : "Scouts have not tagged a public persona yet."}</p>${owned ? `<h3>Locker-room read</h3><p class="muted">${hidden ? escapeHtml(hidden.desc) : p.hiddenTrait ? "Something is off in the room, but it has not surfaced yet." : "No hidden flags on this player."}</p>` : ""}<h3>Strengths</h3><p class="muted">${escapeHtml(p.strengths)}</p><h3>Weaknesses</h3><p class="muted">${escapeHtml(p.weaknesses)}</p><h3>Contract</h3><p class="muted">${shortMoney(p.salary)} · ${p.years} year(s) · ${p.protected ? "protected/core asset" : "available/negotiable"}</p>${owned ? lockerReadForPlayer(p) : ""}${chemistryFitChips(p)}</div><div><h3>Scouting Department View</h3><p class="muted">Numerical ratings are intentionally hidden in normal play. This panel reveals directional grades only.</p>${["scoring", "shooting", "playmaking", "defense", "rebounding", "athleticism", "iq", "potential"].map((k) => gradeRow(k, p.ratings[k])).join("")}</div></div></div></div></div>`;
  }
  if (modal.type === "team") {
    const t = S.teams.find((x) => x.id === modal.id);
    if (!t) return "";
    return `<div class="modalShade" data-modal-shade><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modalHeader"><h3 id="modal-title">${escapeHtml(t.name)}</h3><button class="close" data-close aria-label="Close team roster">Close</button></div><div class="modalBody">${rosterTable(t.players)}</div></div></div>`;
  }
  if (modal.type === "trade-confirm") {
    const spec = currentTradePackage();
    if (!spec) return "";
    const salaryOut = spec.give.reduce((sum, p) => sum + p.salary, 0);
    const salaryIn = spec.get.reduce((sum, p) => sum + p.salary, 0);
    const before = userSalary();
    const after = before - salaryOut + salaryIn;
    const sendNames =
      spec.give
        .map((p) => p.name)
        .concat(spec.userPickAssets.map(pickLabel))
        .join(", ") || "—";
    const getNames =
      spec.get
        .map((p) => p.name)
        .concat(spec.otherPickAssets.map(pickLabel))
        .join(", ") || "—";
    return `<div class="modalShade" data-modal-shade><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modalHeader"><h3 id="modal-title">Confirm trade with ${escapeHtml(spec.other.name)}</h3><button class="close" data-close aria-label="Cancel trade">Close</button></div><div class="modalBody"><p class="muted">This move is destructive. Undo can reverse the last ${BALANCE.undoLimit || 5} transactions.</p><div class="layout2"><div class="logItem"><b>You send</b><p class="muted">${escapeHtml(sendNames)}</p></div><div class="logItem"><b>You receive</b><p class="muted">${escapeHtml(getNames)}</p></div></div><div class="meter"><span>Payroll before</span><div class="bar"><i style="width:${Math.min(100, (before / DATA.cap) * 100)}%"></i></div><b>${shortMoney(before)}</b></div><div class="meter"><span>Payroll after</span><div class="bar"><i style="width:${Math.min(100, (after / DATA.cap) * 100)}%"></i></div><b>${shortMoney(after)}</b></div><div class="actions" style="margin-top:18px"><button class="btn" data-action="confirmTrade">Confirm Trade</button><button class="btn secondary" data-close>Cancel</button></div></div></div></div>`;
  }
  if (modal.type === "hire-coach") {
    const role = modal.role;
    const roleLabel =
      role === "head"
        ? "Head Coach"
        : role === "assistant"
          ? "Assistant Coach"
          : "Player Development Coach";
    const current = S.coaches[role];
    const pool = faCoachPool(role);
    const currentCard = current
      ? `<h3 style="margin-top:0">Currently Hired</h3>${coachCard(current, role, true)}`
      : "";
    const poolHtml = pool.length
      ? pool.map((c) => coachCard(c, role, false)).join("")
      : '<div class="empty">No available coaches.</div>';
    return `<div class="modalShade" data-modal-shade><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style="width:min(820px,100%)"><div class="modalHeader"><h3 id="modal-title">Hire ${roleLabel}</h3><button class="close" data-close aria-label="Close coach hiring">Close</button></div><div class="modalBody">${currentCard}<h3 style="margin-top:18px">Free Agent Pool</h3><div class="log">${poolHtml}</div></div></div></div>`;
  }
  return "";
}
function closeModal() {
  const selector = modalReturnFocusSelector;
  modal = null;
  modalReturnFocusSelector = null;
  render();
  if (selector) {
    const trigger = document.querySelector(selector);
    if (trigger && trigger.focus) trigger.focus();
  }
}
function gradeRow(k, v) {
  return `<div class="meter"><span>${k[0].toUpperCase() + k.slice(1)}</span><div class="bar"><i style="width:${v}%"></i></div><b>${v >= 90 ? "Elite" : v >= 80 ? "Plus" : v >= 70 ? "Solid" : v >= 60 ? "Playable" : "Risk"}</b></div>`;
}
function findPlayer(id) {
  if (!_playerMap) {
    const offRookies = S.offseason && S.offseason.rookieClass ? S.offseason.rookieClass : [];
    _playerMap = new Map(
      S.roster
        .concat(allLeaguePlayers())
        .concat(waiverPool())
        .concat(offRookies)
        .map((player) => [player.id, player]),
    );
  }
  return _playerMap.get(id);
}
function bind() {
  document.querySelectorAll(".field").forEach((field, index) => {
    const label = field.querySelector("label");
    const control = field.querySelector("input, select, textarea");
    if (!label || !control) return;
    if (!control.id) control.id = `field-${tab}-${index}`;
    label.htmlFor = control.id;
  });
  const filterLabels = {
    q: "Search expansion players",
    strength: "Filter by strength",
    pos: "Filter by position",
    team: "Filter by current team",
    arch: "Filter by archetype",
    risk: "Filter by risk profile",
  };
  document.querySelectorAll("[data-filter]").forEach((control) => {
    control.setAttribute("aria-label", filterLabels[control.dataset.filter] || "Filter players");
  });
  bindDelegatedEvents();
}
function bindDelegatedEvents() {
  const appRoot = root();
  if (appRoot.dataset.eventsBound) return;
  appRoot.dataset.eventsBound = "true";
  appRoot.addEventListener("click", (event) => {
    const target = event.target.closest(
      "button, [data-tab], [data-action], [data-teamview], [data-modal-shade]",
    );
    if (!target || target.disabled) return;
    if (target.matches("[data-modal-shade]")) {
      if (event.target === target) closeModal();
      return;
    }
    if (target.dataset.tab) {
      tab = target.dataset.tab;
      render();
    } else if (target.dataset.action) actions(target.dataset.action);
    else if (target.dataset.view) {
      modalReturnFocusSelector = `[data-view="${CSS.escape(target.dataset.view)}"]`;
      modal = { type: "player", id: target.dataset.view };
      render();
    } else if (target.dataset.teamview) {
      modalReturnFocusSelector = `[data-teamview="${CSS.escape(target.dataset.teamview)}"]`;
      modal = { type: "team", id: target.dataset.teamview };
      render();
    } else if (target.dataset.close !== undefined) closeModal();
    else if (target.dataset.draft) draftPlayer(target.dataset.draft);
    else if (target.dataset.pickRookie) userPickRookie(target.dataset.pickRookie);
    else if (target.dataset.rmRookie) removeCustomRookie(target.dataset.rmRookie);
    else if (target.dataset.focus) setWeeklyFocus(target.dataset.focus);
    else if (target.dataset.scout) scoutGame(target.dataset.scout);
    else if (target.dataset.plan) {
      const [gameId, plan] = target.dataset.plan.split("|");
      setGamePlan(gameId, plan === "none" ? null : plan);
    } else if (target.dataset.press) respondToPress(target.dataset.press);
    else if (target.dataset.hireOpen) {
      modalReturnFocusSelector = `[data-hire-open="${CSS.escape(target.dataset.hireOpen)}"]`;
      openHireModal(target.dataset.hireOpen);
    } else if (target.dataset.hireCoach) {
      const [role, id] = target.dataset.hireCoach.split("|");
      hireCoach(role, id);
    } else if (target.dataset.waive) waivePlayer(target.dataset.waive);
    else if (target.dataset.sign) signPlayer(target.dataset.sign);
    else if (target.dataset.loadSlot) loadSaveSlot(target.dataset.loadSlot);
    else if (target.dataset.deleteSlot) deleteSaveSlot(target.dataset.deleteSlot);
    else if (target.dataset.citytile) applyCity(+target.dataset.citytile);
    else if (target.dataset.acceptOffer) acceptNpcOffer(target.dataset.acceptOffer);
    else if (target.dataset.declineOffer) declineNpcOffer(target.dataset.declineOffer);
    else if (target.dataset.resign) resignUserPlayer(target.dataset.resign);
    else if (target.dataset.walk) walkUserPlayer(target.dataset.walk);
    else if (target.dataset.rotateUp) moveRotation(target.dataset.rotateUp, -1);
    else if (target.dataset.rotateDown) moveRotation(target.dataset.rotateDown, 1);
    else if (target.dataset.sit) sitPlayer(target.dataset.sit);
    else if (target.dataset.start) startPlayer(target.dataset.start);
    else if (target.dataset.culture) claimCulture(target.dataset.culture);
  });
  appRoot.addEventListener("input", (event) => {
    const control = event.target;
    if (control.dataset.filter) {
      draftFilters[control.dataset.filter] = control.value;
      renderView();
    } else if (control.dataset.tradeQuery !== undefined) {
      trade.query = control.value;
      renderView();
    } else if (control.id === "nickInput" || control.id === "arenaInput") {
      const nick = document.getElementById("nickInput");
      const arena = document.getElementById("arenaInput");
      const previousAbbr = S.team.abbr;
      if (nick) S.team.nickname = nick.value;
      if (arena) S.team.arena = arena.value;
      S.team.abbr = abbr(S.team.city, S.team.nickname);
      reassignUserPicks(previousAbbr, S.team.abbr);
      rehomeOrphanUserPicks(S);
      save();
    } else if (control.id === "primaryInput" || control.id === "secondaryInput") {
      const primary = document.getElementById("primaryInput");
      const secondary = document.getElementById("secondaryInput");
      if (primary) S.team.primary = primary.value;
      if (secondary) S.team.secondary = secondary.value;
      document.documentElement.style.setProperty("--user1", S.team.primary);
      document.documentElement.style.setProperty("--user2", S.team.secondary);
      document.documentElement.style.setProperty("--userText", contrastText(S.team.primary));
      save();
    }
  });
  appRoot.addEventListener("change", (event) => {
    const control = event.target;
    if (control.id === "citySelect") applyCity(+control.value);
    else if (control.dataset.tradeTeam !== undefined) {
      trade.team = control.value;
      trade.userGive = [];
      trade.otherGive = [];
      renderView();
    } else if (control.dataset.tradeSide) {
      const side = control.dataset.tradeSide;
      const selected = new Set(trade[side]);
      if (control.checked) selected.add(control.value);
      else selected.delete(control.value);
      trade[side] = Array.from(selected);
      renderView();
    } else if (control.dataset.pick) {
      trade[control.dataset.pick === "user" ? "userPick" : "otherPick"] = control.checked ? 1 : 0;
      renderView();
    } else if (control.dataset.tradePick) {
      const side = control.dataset.tradePick;
      const selected = new Set(trade[side] || []);
      if (control.checked) selected.add(control.value);
      else selected.delete(control.value);
      trade[side] = Array.from(selected);
      trade.userPick = 0;
      trade.otherPick = 0;
      renderView();
    }
  });
  appRoot.addEventListener(
    "error",
    (event) => {
      if (event.target.matches && event.target.matches("[data-portrait-image]"))
        event.target.style.display = "none";
    },
    true,
  );
}
function applyCity(i) {
  const c = DATA.expansionCities[i];
  const previousAbbr = S.team.abbr;
  S.team.city = c.city;
  S.team.nickname = c.nickname;
  S.team.arena = c.arena;
  S.team.abbr = abbr(c.city, c.nickname);
  reassignUserPicks(previousAbbr, S.team.abbr);
  rehomeOrphanUserPicks(S);
  render();
}
function actions(a) {
  if (a === "start") {
    S.started = true;
    const previousAbbr = S.team.abbr;
    S.team.abbr = uniqueUserAbbr(S.team.city, S.team.nickname);
    reassignUserPicks(previousAbbr, S.team.abbr);
    rehomeOrphanUserPicks(S);
    ensurePickBoard(S);
    ensureUpcomingUserPick(S);
    S.season = null;
    addLog(
      "Franchise approved",
      `${S.team.city} ${S.team.nickname} begin expansion operations at ${S.team.arena}.`,
    );
    tab = "dashboard";
    render();
  }
  if (a === "randomize") {
    const i = Math.floor(random() * DATA.expansionCities.length);
    applyCity(i);
  }
  if (a === "reset") {
    if (confirm("Start over and clear this save?")) {
      const saveName = S.saveName;
      resetFaBase();
      S = normalizeSave(freshState());
      S.saveName = saveName;
      undoStack = [];
      tab = "setup";
      save();
      render();
    }
  }
  if (a === "exportSave") exportSave();
  if (a === "importSave") importSave();
  if (a === "confirmImport") confirmImport();
  if (a === "cancelImport") {
    pendingImport = null;
    render();
  }
  if (a === "createSaveSlot") createSaveSlot();
  if (a === "simNext") simNextGame();
  if (a === "simWeek") simWeek();
  if (a === "simSeason") simSeason();
  if (a === "regenSchedule") {
    if (confirm("Regenerate the season schedule and clear simulated results?")) {
      S.season = null;
      ensureSeason(true);
      addLog("Schedule regenerated", "League office issued a fresh expansion-season schedule.");
      render();
    }
  }
  if (a === "clearTrade") {
    resetTradeSelections();
    render();
  }
  if (a === "resetDraftFilters") {
    draftFilters = {
      q: "",
      pos: "ALL",
      team: "ALL",
      risk: "ALL",
      strength: "",
      arch: "ALL",
    };
    render();
  }
  if (a === "submitTrade") submitTrade();
  if (a === "confirmTrade") {
    closeModal();
    executeTrade();
  }
  if (a === "enterOffseason") enterOffseason();
  if (a === "advanceToDraft") advanceToDraft();
  if (a === "startNextSeason") startNextSeason();
  if (a === "nominateCaptain") {
    const id = (document.getElementById("lr-captain") || {}).value;
    nominateCaptain(id);
  }
  if (a === "closedDoor") spendInfluence("closed-door", influenceTargetId());
  if (a === "campaignPlayer") spendInfluence("campaign", influenceTargetId());
  if (a === "blessExit") spendInfluence("bless", influenceTargetId());
  if (a === "addCustomRookie") addCustomRookie();
  if (a === "commitDevFocus") {
    const pid = (document.getElementById("dev-player") || {}).value || null;
    const rk = (document.getElementById("dev-rating") || {}).value || "scoring";
    setDevFocus(pid || null, rk);
  }
  if (a === "playQueuedGame") playQueuedGame();
  if (a === "closeGameDay") closeGameDay();
  if (a === "closePostGame") closePostGame();
  if (a === "enterPlayoffs") enterPlayoffs();
  if (a === "simNextPlayoffGame") simNextPlayoffGame();
  if (a === "simPlayoffsToEnd") simPlayoffsToEnd();
  if (a === "openAwards") openAwards();
  if (a === "acceptAwards") acceptAwards();
  if (a === "closeAwards") closeAwards();
  if (a === "undo") undoLastMove();
}
function draftPlayer(id) {
  if (S.phase !== "Expansion Build")
    return toast("The expansion draft is closed for this franchise.");
  const team = S.teams.find((t) => t.players.some((p) => p.id === id));
  const p = team?.players.find((p) => p.id === id);
  if (!p) return;
  if (p.protected)
    return toast("That player is protected. Use the trade desk if you want to chase a core asset.");
  if (S.roster.length >= DATA.expansionPickLimit) return toast("Expansion draft limit reached.");
  if (userSalary() + p.salary > DATA.cap) return toast("Not enough cap room.");
  recordUndo("draft pick");
  team.players = team.players.filter((x) => x.id !== id);
  p.team = S.team.abbr;
  S.roster.push(p);
  addLog("Expansion pick submitted", `${S.team.nickname} selected ${p.name} from ${team.name}.`);
  toast(`${p.name} drafted.`);
  render();
}
function waivePlayer(id) {
  const p = S.roster.find((x) => x.id === id);
  if (!p) return;
  recordUndo("waiver move");
  S.roster = S.roster.filter((x) => x.id !== id);
  S.waived.push(p);
  addLog("Player waived", `${p.name} was waived, clearing ${shortMoney(p.salary)} in cap.`);
  render();
}
function signPlayer(id) {
  if (S.roster.some((player) => player.id === id))
    return toast("That player is already on your roster.");
  let p = waiverPool().find((x) => x.id === id);
  if (!p) return;
  if (S.roster.length >= DATA.rosterMax) return toast("Roster is full.");
  if (userSalary() + p.salary > DATA.cap) return toast("Not enough cap room.");
  recordUndo("free-agent signing");
  S.waived = S.waived.filter((x) => x.id !== id);
  S.freeAgents = (S.freeAgents || []).filter((x) => x.id !== id);
  p = clone(p);
  p.team = S.team.abbr;
  p.lastTeam = p.lastTeam || "FA";
  p.injury = null;
  p.years = Math.max(1, Number.isFinite(p.years) ? p.years : 1);
  S.roster.push(p);
  addLog("Waiver signing", `${p.name} signed a ${p.years}-year deal.`);
  render();
}
function submitTrade() {
  if (S.teams.length && !S.teams.some((team) => team.id === trade.team)) trade.team = S.teams[0].id;
  const other = S.teams.find((t) => t.id === trade.team);
  if (!other) return toast("No trade partner available.");
  const ev = evaluateTrade(other);
  if (!ev.ok) return toast(ev.reason || "Trade rejected.");
  modalReturnFocusSelector = '[data-action="submitTrade"]';
  modal = { type: "trade-confirm" };
  render();
}
function executeTrade(packageSpec) {
  const spec = packageSpec || currentTradePackage();
  if (!spec || !spec.other) return toast("No trade partner available.");
  const ev = evaluateTrade(spec.other);
  if (!ev.ok) return toast(ev.reason || "Trade rejected.");
  recordUndo("trade");
  breakPairingsForPlayers(
    spec.give.map((p) => p.id),
    spec.give.some((p) => p.tradeBlessed),
  );
  applyTradePackage(spec);
  addLog(
    "Trade completed",
    `${S.team.nickname} acquired ${spec.get.map((p) => p.name).join(", ") || spec.otherPickAssets.map(pickLabel).join(", ") || "assets"} from ${spec.other.name}. Sent ${spec.give.map((p) => p.name).join(", ") || spec.userPickAssets.map(pickLabel).join(", ") || "assets"}.`,
  );
  resetTradeSelections();
  S.pendingOffers = (S.pendingOffers || []).filter(
    (offer) => offer.from !== spec.other.id && offer.id !== spec.offerId,
  );
  toast("Trade accepted.");
  render();
}
function currentTradePackage() {
  const other = S.teams.find((t) => t.id === trade.team);
  if (!other) return null;
  return {
    other,
    give: S.roster.filter((p) => trade.userGive.includes(p.id)),
    get: other.players.filter((p) => trade.otherGive.includes(p.id)),
    userPickAssets: selectedPicks("user"),
    otherPickAssets: selectedPicks("other"),
  };
}
function applyTradePackage(spec) {
  S.roster = S.roster
    .filter((p) => !spec.give.some((player) => player.id === p.id))
    .concat(
      spec.get.map((p) => ({
        ...p,
        team: S.team.abbr,
        lastTeam: spec.other.id,
        bond: 50,
        startsThisSeason: 0,
        sitStreak: 0,
        wantsOut: false,
        tradeBlessed: false,
      })),
    );
  spec.other.players = spec.other.players
    .filter((p) => !spec.get.some((player) => player.id === p.id))
    .concat(
      spec.give.map((p) => ({
        ...p,
        team: spec.other.id,
        lastTeam: S.team.abbr,
        wantsOut: false,
        tradeBlessed: false,
      })),
    );
  spec.userPickAssets.forEach((pick) => {
    pick.owner = spec.other.id;
  });
  spec.otherPickAssets.forEach((pick) => {
    pick.owner = S.team.abbr;
  });
  S.rotation = (S.rotation || []).filter((id) => S.roster.some((p) => p.id === id));
  syncPickCounts(S);
}
function resetTradeSelections() {
  trade.userGive = [];
  trade.otherGive = [];
  trade.userPicks = [];
  trade.otherPicks = [];
  trade.userPick = 0;
  trade.otherPick = 0;
}
function generateNpcOffer() {
  if (tradesLocked() || S.phase === "Expansion Build") return null;
  if ((S.pendingOffers || []).length >= 2) return null;
  if (!S.roster.length || !S.teams.length) return null;
  const partner = S.teams[Math.floor(random() * S.teams.length)];
  const need = teamNeed(partner);
  const userFits = S.roster.filter((p) => !p.protected && p.pos.includes(need));
  const want = (userFits.length ? userFits : S.roster.filter((p) => !p.protected))
    .slice()
    .sort((a, b) => tradeValue(a) - tradeValue(b))[0];
  if (!want) return null;
  const their = partner.players
    .filter((p) => !p.protected)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(tradeValue(a) - tradeValue(want)) - Math.abs(tradeValue(b) - tradeValue(want)),
    )[0];
  if (!their) return null;
  if (
    (S.pendingOffers || []).some(
      (offer) => offer.from === partner.id && offer.wantPlayers.includes(want.id),
    )
  )
    return null;
  const offer = {
    id: `offer-${S.year}-${S.week}-${partner.id}-${want.id}`,
    from: partner.id,
    theirPlayers: [their.id],
    wantPlayers: [want.id],
    theirPicks: [],
    wantPicks: [],
  };
  if (!Array.isArray(S.pendingOffers)) S.pendingOffers = [];
  S.pendingOffers.push(offer);
  addLog("Trade offer", `${partner.name} inquired about ${want.name}.`);
  return offer;
}
function acceptNpcOffer(offerId) {
  const offer = (S.pendingOffers || []).find((item) => item.id === offerId);
  if (!offer) return toast("That offer is gone.");
  if (tradesLocked()) return toast("The trade deadline has passed.");
  trade.team = offer.from;
  trade.userGive = offer.wantPlayers.slice();
  trade.otherGive = offer.theirPlayers.slice();
  trade.userPicks = (offer.wantPicks || []).slice();
  trade.otherPicks = (offer.theirPicks || []).slice();
  trade.userPick = 0;
  trade.otherPick = 0;
  const spec = currentTradePackage();
  if (!spec) return;
  spec.offerId = offer.id;
  executeTrade(spec);
}
function declineNpcOffer(offerId) {
  S.pendingOffers = (S.pendingOffers || []).filter((offer) => offer.id !== offerId);
  toast("Offer declined.");
  render();
}
function addLog(title, body) {
  S.log.unshift({ title, body, when: `Week ${S.week}` });
  if (S.log.length > 80) S.log.length = 80;
}
function marketChurn() {
  S.teams.forEach((t) =>
    t.players.forEach((p) => {
      p.mood = Math.max(20, Math.min(99, (p.mood || 60) + Math.floor(random() * 11) - 5));
    }),
  );
  S.roster.forEach((p) => {
    p.mood = Math.max(20, Math.min(99, (p.mood || 60) + Math.floor(random() * 7) - 3));
  });
  if (random() < 0.35) generateNpcOffer();
}

// =================== OFFSEASON: aging + rookie draft =====================
function pickOne(arr) {
  return arr[Math.floor(random() * arr.length)];
}
function pickN(arr, n) {
  const copy = arr.slice(),
    out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(random() * copy.length), 1)[0]);
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
function ageOnePlayer(p, teammates) {
  _compCache.delete(p);
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
  const lockerBonus =
    (ENGINE.mentorDevBonus([p].concat(teammates || []), S.year, DATA.personality || {})[p.id] ||
      0) * (S.lockerRoom && S.lockerRoom.culture === "lab" ? 2 : 1);
  if (lockerBonus) {
    const k = pickOne(AGING_RATINGS);
    const next = clampRating(p.ratings[k] + (lockerBonus >= 0.8 ? 2 : 1));
    if (next !== p.ratings[k]) {
      deltas[k] = (deltas[k] || 0) + (next - p.ratings[k]);
      p.ratings[k] = next;
    }
  }
  p.years = Math.max(0, p.years - 1);
  if (!Number.isFinite(p.age)) p.age = 26;
  p.age += 1;
  _compCache.delete(p);
  return { name: p.name, team: p.team, age: p.age, before, after: composite(p), deltas };
}
function resolveExpiredContracts() {
  const expiredUser = S.roster.filter((player) => player.years <= 0);
  expiredUser.forEach((player) => {
    player.lastTeam = S.team.abbr;
  });
  if (!Array.isArray(S.freeAgents)) S.freeAgents = [];
  const known = new Set([
    ...S.roster.map((player) => player.id),
    ...S.waived.map((player) => player.id),
    ...S.freeAgents.map((player) => player.id),
  ]);
  let expiredLeague = 0;
  S.teams.forEach((team) => {
    const expired = team.players.filter((player) => player.years <= 0);
    expired.forEach((player) => {
      if (known.has(player.id)) return;
      player.lastTeam = team.id;
      player.team = "FA";
      S.freeAgents.push(player);
      known.add(player.id);
    });
    const before = team.players.length;
    team.players = team.players.filter((player) => player.years > 0);
    expiredLeague += before - team.players.length;
  });
  return { user: expiredUser, leagueCount: expiredLeague };
}
function signNpcPlayer(team, player) {
  if (!player || team.players.some((item) => item.id === player.id)) return false;
  if (team.players.length >= DATA.rosterMax) return false;
  if (teamSalary(team) + player.salary > DATA.cap) return false;
  player.team = team.id;
  player.lastTeam = team.id;
  player.injury = null;
  player.years = Math.max(1, Number.isFinite(player.years) && player.years > 0 ? player.years : 1);
  team.players.push(player);
  S.freeAgents = (S.freeAgents || []).filter((item) => item.id !== player.id);
  S.waived = S.waived.filter((item) => item.id !== player.id);
  return true;
}
function runNpcFreeAgency() {
  S.teams.forEach((team) => {
    const alumni = (S.freeAgents || [])
      .filter((player) => player.lastTeam === team.id)
      .slice()
      .sort((a, b) => composite(b) - composite(a));
    alumni.forEach((player) => {
      if (team.players.length >= DATA.rosterMax) return;
      if (team.players.length >= DATA.rosterMin && random() > 0.55) return;
      signNpcPlayer(team, player);
    });
    let guard = 0;
    while (team.players.length < DATA.rosterMin && guard++ < 20) {
      const need = teamNeed(team);
      const pool = waiverPool()
        .filter((player) => !team.players.some((item) => item.id === player.id))
        .slice()
        .sort((a, b) => {
          const bonusA = a.pos.includes(need) ? 12 : 0;
          const bonusB = b.pos.includes(need) ? 12 : 0;
          return composite(b) + bonusB - (composite(a) + bonusA);
        });
      const next = pool.find((player) => teamSalary(team) + player.salary <= DATA.cap);
      if (!next) break;
      if (!signNpcPlayer(team, clone(next))) break;
    }
    while (team.players.length > DATA.rosterMax) {
      const extra = team.players
        .slice()
        .sort((a, b) => composite(a) - composite(b))
        .find((player) => !player.protected);
      if (!extra) break;
      team.players = team.players.filter((player) => player.id !== extra.id);
      extra.team = "FA";
      extra.lastTeam = team.id;
      S.freeAgents.push(extra);
    }
  });
}
function resignUserPlayer(id) {
  if (!S.offseason || !Array.isArray(S.offseason.pendingResign)) return;
  const player = S.offseason.pendingResign.find((item) => item.id === id);
  if (!player) return;
  if (userSalary() > DATA.cap) return toast("Not enough cap room to re-sign.");
  recordUndo("re-sign");
  player.years = 2;
  const mult = Number.isFinite(player.harvestSalaryMult) ? player.harvestSalaryMult : 1;
  if (mult !== 1) player.salary = Math.round(player.salary * mult);
  player.team = S.team.abbr;
  player.lastTeam = S.team.abbr;
  if (!S.roster.some((item) => item.id === id)) S.roster.push(player);
  S.offseason.pendingResign = S.offseason.pendingResign.filter((item) => item.id !== id);
  const dealNote =
    player.harvestTag === "hometown"
      ? " at a hometown rate"
      : player.harvestTag === "poisoned"
        ? " after the room made it expensive"
        : "";
  addLog("Re-signed", `${player.name} agreed to a ${player.years}-year deal${dealNote}.`);
  render();
}
function walkUserPlayer(id) {
  if (!S.offseason || !Array.isArray(S.offseason.pendingResign)) return;
  const player = S.offseason.pendingResign.find((item) => item.id === id);
  if (!player) return;
  recordUndo("walk");
  S.roster = S.roster.filter((item) => item.id !== id);
  S.rotation = (S.rotation || []).filter((item) => item !== id);
  player.team = "FA";
  player.lastTeam = S.team.abbr;
  if (!Array.isArray(S.freeAgents)) S.freeAgents = [];
  if (!S.freeAgents.some((item) => item.id === id)) S.freeAgents.push(player);
  S.offseason.pendingResign = S.offseason.pendingResign.filter((item) => item.id !== id);
  addLog("Contract ended", `${player.name} hit unrestricted free agency.`);
  render();
}
function applyOffseasonAging() {
  const reports = [];
  S.roster.forEach((p) => {
    const r = ageOnePlayer(p, S.roster);
    r.isUser = true;
    reports.push(r);
  });
  S.teams.forEach((t) =>
    t.players.forEach((p) => {
      reports.push(ageOnePlayer(p, t.players));
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
        playmaking: clampRating(base + rand(-15, 8) - (isC ? 10 : 0) + (isG ? 6 : 0)),
        defense: clampRating(base + rand(-12, 10)),
        rebounding: clampRating(base + rand(-15, 12) + (isC ? 10 : 0)),
        athleticism: clampRating(base + rand(-5, 12)),
        iq: clampRating(base + rand(-5, 12)),
        potential: pot,
      };
      const salary = rookieScaleSalary(pickNo + 1);
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
        mood: 60 + Math.floor(random() * 25),
        age: 21 + rand(0, 2),
        injury: null,
      });
      if (window.GAME_FACTORIES && window.GAME_FACTORIES.ensurePersonality) {
        window.GAME_FACTORIES.ensurePersonality(out[out.length - 1]);
      }
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
  if (arch === "starter") return "Versatile forward with starting-caliber tools.";
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
function stampPlayerPersonality(player) {
  if (window.GAME_FACTORIES && window.GAME_FACTORIES.ensurePersonality) {
    window.GAME_FACTORIES.ensurePersonality(player);
  }
  return player;
}
function padRookieClass(rookieClass, draftOrder, year) {
  let padded = rookieClass;
  let guard = 0;
  while (padded.length < draftOrder.length && guard++ < 6) {
    const offset = padded.length;
    const need = draftOrder.length - padded.length;
    const batch = generateRookieClass(year)
      .slice(0, need)
      .map((player, i) => {
        const copy = clone(player);
        copy.id = `rookie-${year}-pad${offset + i}`;
        stampPlayerPersonality(copy);
        return copy;
      });
    if (!batch.length) break;
    padded = padded.concat(batch);
  }
  padded.forEach(stampPlayerPersonality);
  return padded;
}
function enterOffseason() {
  if (S.season && S.season.schedule.some((g) => !g.played)) {
    return toast("Finish all games before advancing to the offseason.");
  }
  const reports = applyOffseasonAging();
  S.phase = `${S.year} Offseason`;
  const expirations = resolveExpiredContracts();
  refreshWaiverClass(S.year + 1);
  runNpcFreeAgency();
  rehomeOrphanUserPicks(S);
  ensureUpcomingUserPick(S);
  const upcomingYear = S.year + 1;
  const draftOrder = buildDraftOrder();
  const base = S.year === 2026 ? clone(DATA.rookieClass2027) : generateRookieClass(upcomingYear);
  const dataExtras = (DATA.rookieClassExtras && DATA.rookieClassExtras[upcomingYear]) || [];
  const userExtras = (S.customRookies && S.customRookies[upcomingYear]) || [];
  const rookieClass = padRookieClass(
    base.concat(clone(dataExtras)).concat(clone(userExtras)),
    draftOrder,
    upcomingYear,
  );
  S.offseason = {
    stage: "aging",
    agingReport: reports,
    rookieClass,
    draftOrder,
    picks: [],
    currentPickIdx: 0,
    expirations,
    pendingResign: expirations.user.slice(),
  };
  applyOffseasonHarvest();
  tab = "schedule";
  addLog(
    "Offseason opened",
    `Season ${S.year} closed. Aging applied to ${reports.length} players league-wide.`,
  );
  save();
  render();
}
function advanceToDraft() {
  if (!S.offseason) return;
  if (S.offseason.stage === "aging") {
    S.offseason.stage =
      S.offseason.pendingResign && S.offseason.pendingResign.length ? "contracts" : "draft";
  } else if (S.offseason.stage === "contracts") {
    if (S.offseason.pendingResign && S.offseason.pendingResign.length)
      return toast("Resolve re-sign decisions first.");
    S.offseason.stage = "draft";
  } else return;
  save();
  render();
  if (S.offseason.stage === "draft") setTimeout(processAiPicks, 250);
}
function buildDraftOrder(_classSize) {
  const draftYear = S.year + 1;
  const standings = standingsRows().slice().reverse();
  const rank = Object.fromEntries(standings.map((row, index) => [row.id, index]));
  const picks = (S.pickBoard || []).filter((pick) => pick.year === draftYear);
  picks.sort(
    (a, b) =>
      a.round - b.round ||
      (rank[a.original] ?? 99) - (rank[b.original] ?? 99) ||
      String(a.id).localeCompare(String(b.id)),
  );
  const order = picks.map((pick) => pick.owner);
  if (order.length) return order;
  return standings.map((row) => row.id);
}
function resumeOffseasonDraft() {
  if (!S.offseason || S.offseason.stage !== "draft") return;
  const onClock = S.offseason.draftOrder[S.offseason.currentPickIdx];
  if (onClock && onClock !== S.team.abbr) processAiPicks();
}
function seedOffseason(os) {
  S.offseason = os;
}
function processAiPicks() {
  if (!S.offseason || S.offseason.stage !== "draft") return;
  let pickedAny = false;
  while (S.offseason.currentPickIdx < S.offseason.draftOrder.length) {
    const teamId = S.offseason.draftOrder[S.offseason.currentPickIdx];
    if (teamId === S.team.abbr) break;
    let available = S.offseason.rookieClass.filter(
      (p) => !S.offseason.picks.some((pk) => pk.playerId === p.id),
    );
    let chosen = aiPickRookie(teamId, available);
    if (!chosen) {
      S.offseason.rookieClass = padRookieClass(
        S.offseason.rookieClass,
        S.offseason.draftOrder,
        S.year + 1,
      );
      available = S.offseason.rookieClass.filter(
        (p) => !S.offseason.picks.some((pk) => pk.playerId === p.id),
      );
      chosen = aiPickRookie(teamId, available);
    }
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
      r.rookieYear = S.year + 1;
      r.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 };
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
  const team = S.teams.find((item) => item.id === teamId);
  const need = team ? teamNeed(team) : "G";
  return available.slice().sort((a, b) => {
    const score = (player) =>
      composite(player) + player.ratings.potential * 0.6 + (player.pos.includes(need) ? 20 : 0);
    return score(b) - score(a);
  })[0];
}
function userPickRookie(playerId) {
  if (!S.offseason || S.offseason.stage !== "draft") return;
  if (S.offseason.draftOrder[S.offseason.currentPickIdx] !== S.team.abbr)
    return toast("Not your pick.");
  if (S.roster.length >= campRosterLimit())
    return toast(
      `Training camp is full (${campRosterLimit()}). Waive a player before making this pick.`,
    );
  const p = S.offseason.rookieClass.find((x) => x.id === playerId);
  if (!p || S.offseason.picks.some((pk) => pk.playerId === playerId)) return;
  recordUndo("rookie selection");
  S.offseason.picks.push({
    team: S.team.abbr,
    playerId: p.id,
    pickNo: S.offseason.currentPickIdx + 1,
  });
  const r = clone(p);
  r.team = S.team.abbr;
  r.rookieYear = S.year + 1;
  r.seasonStats = { gp: 0, pts: 0, reb: 0, ast: 0, w: 0 };
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
  if (!requireOpeningNightReady())
    return toast("Resolve roster and cap requirements before starting the season.");
  S.year++;
  S.phase = `${S.year} Regular Season`;
  consumeDraftYearPicks(S.year);
  grantUpcomingPicks(S);
  refreshWaiverClass(S.year);
  S.season = null;
  S.pendingOffers = [];
  S.gameDay = null;
  S.postGame = null;
  S.playoffs = null;
  clearAllInjuries();
  resetSeasonIntimacy();
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
  if (S.offseason.stage === "contracts") return offseasonContractsView();
  if (S.offseason.stage === "draft") return offseasonDraftView();
  return offseasonDoneView();
}
function offseasonAgingView() {
  const userReports = S.offseason.agingReport.filter((r) => r.isUser);
  const sortByImpact = (r) =>
    Math.abs(r.after - r.before) + Object.values(r.deltas).reduce((s, v) => s + Math.abs(v), 0);
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
    return `<tr><td><b>${escapeHtml(r.name)}</b></td><td><span class="pill">${escapeHtml(r.team)}</span></td><td>${r.age || "—"}</td><td>${arrow}</td><td>${ds || '<span class="mini">no change</span>'}</td></tr>`;
  };
  const expired =
    S.offseason.pendingResign || (S.offseason.expirations && S.offseason.expirations.user) || [];
  const expirationBlock = expired.length
    ? `<div class="callout" style="margin-bottom:18px"><b>${expired.length} contract(s) expired</b><p class="muted">${expired.map((player) => escapeHtml(player.name)).join(", ")} need a re-sign or walk decision before the draft.</p></div>`
    : "";
  const continueLabel = expired.length ? "Continue to Free Agency" : "Continue to Rookie Draft";
  return `<section class="card"><div class="sectionTitle"><h3>Year ${S.year} · Offseason Aging Report</h3><span>Year ${S.year + 1} rookie class is next</span></div><div class="cardPad">${expirationBlock}<h3>Your Roster</h3><table class="table"><thead><tr><th>Player</th><th>Team</th><th>Age</th><th>Composite</th><th>Notable shifts</th></tr></thead><tbody>${userReports.map(row).join("") || '<tr><td colspan="5"><div class="empty">No roster players to age.</div></td></tr>'}</tbody></table><h3 style="margin-top:18px">Notable League Changes</h3><table class="table"><thead><tr><th>Player</th><th>Team</th><th>Age</th><th>Composite</th><th>Notable shifts</th></tr></thead><tbody>${leagueChangers.map(row).join("")}</tbody></table><div class="actions" style="margin-top:18px"><button class="btn" data-action="advanceToDraft">${continueLabel}</button></div></div></section>`;
}
function offseasonContractsView() {
  const pending = S.offseason.pendingResign || [];
  if (!pending.length) {
    return `<section class="card"><div class="cardPad"><p class="muted">No remaining contract decisions.</p><div class="actions"><button class="btn" data-action="advanceToDraft">Continue to Rookie Draft</button></div></div></section>`;
  }
  const cards = pending
    .map((player) => {
      const overCap = userSalary() > DATA.cap;
      const harvestNote =
        player.harvestTag === "hometown"
          ? `<span class="pill good" title="High bond. She will re-sign cheaper to stay.">Hometown discount</span>`
          : player.harvestTag === "loyal-kid"
            ? `<span class="pill good" title="A Sponge with enough bond is happy to come back.">Wants to stay</span>`
            : player.harvestTag === "poisoned"
              ? `<span class="pill warn" title="An Instigator in the room made this deal more expensive.">Wants more after the room</span>`
              : "";
      const ask = Number.isFinite(player.harvestSalaryMult)
        ? Math.round(player.salary * player.harvestSalaryMult)
        : player.salary;
      return `<div class="playerCard">${portraitHtml(player)}<div><span class="playerName">${escapeHtml(player.name)}</span> <span class="pill">${escapeHtml(player.pos)}</span> ${harvestNote}<div class="scout">${escapeHtml(player.scouting || "")}</div><div class="tags"><span class="tag">${shortMoney(ask)}</span><span class="tag">Age ${player.age || "—"}</span><span class="tag">${visibleGrade(player)}</span><span class="tag" title="How much she trusts this franchise. High-bond mentors re-sign cheaper. Competitors with low bond may walk.">Bond ${Math.round(player.bond || 50)}</span></div></div><div class="actions"><button class="btn" data-resign="${escapeAttr(player.id)}" ${overCap ? "disabled" : ""}>Re-sign 2 years</button><button class="btn secondary" data-walk="${escapeAttr(player.id)}">Let walk</button></div></div>`;
    })
    .join("");
  return `<section class="card"><div class="sectionTitle"><h3>Re-sign or walk</h3><span>${pending.length} expired</span></div><div class="cardPad"><p class="muted">League free agents are in the same pool as waivers. NPC clubs already re-signed or replaced down to 11–12. Walks join that pool.</p><div class="board">${cards}</div><div class="actions" style="margin-top:18px"><button class="btn" data-action="advanceToDraft" ${pending.length ? "disabled" : ""}>Continue to Rookie Draft</button><button class="btn secondary" data-tab="waivers">Open Free Agency</button></div></div></section>`;
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
        composite(b) + b.ratings.potential * 0.5 - (composite(a) + a.ratings.potential * 0.5),
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
      const player = picked ? os.rookieClass.find((p) => p.id === picked.playerId) : null;
      const isUser = id === S.team.abbr;
      return `<div class="logItem" style="${i === os.currentPickIdx ? "border-color:var(--orange);background:#fff6ee" : ""}${isUser && !picked ? ";box-shadow:inset 4px 0 0 var(--orange)" : ""}"><b>Pick #${i + 1}</b> <span class="teamBadge" style="${badgeStyle(meta.primary)}">${id}</span> ${escapeHtml(meta.name)}${isUser ? ' <span class="pill good">YOU</span>' : ""}${player ? `<div class="mini">→ ${escapeHtml(player.name)} · ${escapeHtml(player.pos)} · ${escapeHtml(player.team)}</div>` : i === os.currentPickIdx ? '<div class="mini">on the clock</div>' : '<div class="mini">upcoming</div>'}</div>`;
    })
    .join("");
  const campFull = S.roster.length >= campRosterLimit();
  const overOpening = S.roster.length >= DATA.rosterMax;
  const canDraft = userOnClock && !campFull;
  const board = available
    .map((p) => {
      const photo = portraitHtml(p);
      return `<div class="playerCard">${photo}<div><div><span class="playerName">${escapeHtml(p.name)}</span> <span class="pill">${escapeHtml(p.pos)}</span> <span class="pill">${escapeHtml(p.team)}</span> ${personaChip(p)}</div><div class="scout">${escapeHtml(p.scouting)}</div><div class="tags"><span class="tag">${visibleGrade(p)}</span><span class="tag">Upside ${p.ratings.potential}</span><span class="tag">${shortMoney(p.salary)}</span><span class="tag">${escapeHtml(firstTag(p.strengths))}</span>${chemistryFitChips(p)}</div></div><div class="actions"><button class="btn secondary" data-view="${escapeAttr(p.id)}">Scout</button><button class="btn ${canDraft ? "" : "secondary"}" ${canDraft ? "" : "disabled"} data-pick-rookie="${escapeAttr(p.id)}">${userOnClock ? (campFull ? "Camp full" : overOpening ? "Draft (cut later)" : "Draft") : "Wait"}</button></div></div>`;
    })
    .join("");
  const rosterNote = userOnClock
    ? overOpening && !campFull
      ? `<div class="callout" style="margin-bottom:18px"><b>Opening-night roster is full (${DATA.rosterMax})</b><p class="muted">You can still add one training-camp body with this pick. Cut back to ${DATA.rosterMax} before starting the next season.</p></div>`
      : campFull
        ? `<div class="callout" style="margin-bottom:18px"><b>Training camp is full (${campRosterLimit()})</b><p class="muted">Waive a player on the Roster tab, then come back to make this pick.</p><div class="actions"><button class="btn secondary" data-tab="roster">Open Roster</button></div></div>`
        : ""
    : "";
  return `<section class="card"><div class="sectionTitle"><h3>Rookie Draft · Year ${S.year + 1} Class</h3><span>${os.picks.length}/${os.draftOrder.length} picks made</span></div>${rosterNote}<div class="layout2"><div><div class="sectionTitle"><h3>On the Clock</h3><span><span class="teamBadge" style="${badgeStyle(onClockMeta.primary)}">${escapeHtml(onClock)}</span>${escapeHtml(onClockMeta.name)}${userOnClock ? " · YOUR PICK" : ""}</span></div><div class="board" style="max-height:720px">${board || '<div class="empty">Draft complete.</div>'}</div></div><div><div class="sectionTitle"><h3>Draft Order</h3><span>worst → best</span></div><div class="cardPad log" style="max-height:720px;overflow:auto">${orderHtml}</div></div></div></section>`;
}
function offseasonDoneView() {
  const os = S.offseason;
  const userPick = os.picks.find((p) => p.team === S.team.abbr);
  const userRookie = userPick ? os.rookieClass.find((r) => r.id === userPick.playerId) : null;
  const top5 = os.picks
    .slice()
    .sort((a, b) => a.pickNo - b.pickNo)
    .slice(0, 5);
  const readiness = rosterReadiness();
  const readinessBlock = readiness.ready
    ? '<div class="callout"><b>Opening-night roster ready.</b></div>'
    : `<div class="callout"><b>Roster work remains</b><p class="muted">Resolve ${escapeHtml(readiness.issues.join(" and "))} through Waivers, Trades, or roster moves.</p><div class="actions"><button class="btn secondary" data-tab="waivers">Free Agency</button><button class="btn secondary" data-tab="trades">Trade Desk</button><button class="btn secondary" data-tab="roster">Roster</button></div></div>`;
  return `<section class="card"><div class="sectionTitle"><h3>Year ${S.year} Offseason Complete</h3><span>${os.picks.length} rookies drafted league-wide</span></div><div class="cardPad"><div class="logItem"><b>Your selection</b><p class="muted">${userRookie ? `You took ${escapeHtml(userRookie.name)} (${escapeHtml(userRookie.pos)}, ${escapeHtml(userRookie.team)}) at pick #${userPick.pickNo}. Welcome to the franchise.` : "You did not have a pick in this draft."}</p></div><h3>Top 5 picks recap</h3><div class="log">${top5
    .map((pk) => {
      const r = os.rookieClass.find((x) => x.id === pk.playerId);
      return `<div class="logItem"><b>#${pk.pickNo} · ${escapeHtml(pk.team)}</b><div class="mini">${escapeHtml(r.name)} · ${escapeHtml(r.pos)} · ${escapeHtml(r.team)} · ${visibleGrade(r)}</div></div>`;
    })
    .join(
      "",
    )}</div>${readinessBlock}<div class="actions" style="margin-top:18px"><button class="btn" data-action="startNextSeason" ${readiness.ready ? "" : "disabled"}>Start ${S.year + 1} Season</button></div></div></section>`;
}

// =================== PLAYOFFS: bracket + series + sim =====================
const HOME_PATTERNS = {
  3: ["top", "bot", "top"],
  5: ["top", "top", "bot", "bot", "top"],
  7: ["top", "top", "bot", "bot", "top", "bot", "top"],
};
function makeSeries(id, round, bestOf, top, bot, topSeed, botSeed) {
  const pattern = HOME_PATTERNS[bestOf] || HOME_PATTERNS[3];
  const games = pattern.map((h, i) => ({
    id: `${id}-G${i + 1}`,
    home: h === "top" ? top : bot,
    away: h === "top" ? bot : top,
    week: 17 + round, // playoff weeks: 18, 19, 20
    played: false,
    homeScore: null,
    awayScore: null,
    winner: null,
    box: null,
    playoff: true,
    seriesId: id,
    gameNum: i + 1,
  }));
  return {
    id,
    round,
    bestOf,
    top,
    bot,
    topSeed,
    botSeed,
    topWins: 0,
    botWins: 0,
    games,
    winner: null,
  };
}
function enterPlayoffs() {
  if (!S.season) return toast("No regular season to seed from.");
  if (S.season.schedule.some((game) => !game.played))
    return toast("Finish the regular season before entering the playoffs.");
  const standings = standingsRows();
  if (standings.length < 8) return toast("Need at least 8 teams to run a playoff.");
  const top8 = standings.slice(0, 8);
  const pairs = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
  ];
  const r1 = pairs.map((p, i) =>
    makeSeries(`R1-${i + 1}`, 1, 3, top8[p[0]].id, top8[p[1]].id, p[0] + 1, p[1] + 1),
  );
  S.playoffs = {
    active: true,
    currentRound: 1,
    rounds: [
      { round: 1, bestOf: 3, series: r1 },
      { round: 2, bestOf: 5, series: [] },
      { round: 3, bestOf: 7, series: [] },
    ],
    champion: null,
    complete: false,
    seedMap: Object.fromEntries(top8.map((t, i) => [t.id, i + 1])),
  };
  S.phase = `${S.year} Playoffs`;
  tab = "schedule";
  addLog("Playoffs", `${S.year} regular season closed. Top 8 seeded. Round 1 underway.`);
  save();
  render();
}
function findPlayoffGame(gameId) {
  if (!S.playoffs) return null;
  for (const round of S.playoffs.rounds) {
    for (const s of round.series) {
      const g = s.games.find((x) => x.id === gameId);
      if (g) return { game: g, series: s, round };
    }
  }
  return null;
}
function onPlayoffGameComplete(g) {
  if (!S.playoffs || !g.seriesId) return;
  const found = findPlayoffGame(g.id);
  if (!found) return;
  const series = found.series;
  if (g.winner === series.top) series.topWins++;
  else series.botWins++;
  const winsNeeded = Math.ceil(series.bestOf / 2);
  if (series.topWins >= winsNeeded) series.winner = series.top;
  else if (series.botWins >= winsNeeded) series.winner = series.bot;
  if (series.winner) {
    addLog(
      "Series final",
      `${teamMeta(series.winner).name} won the series vs ${teamMeta(series.winner === series.top ? series.bot : series.top).name} ${series.topWins}-${series.botWins}.`,
    );
    advancePlayoffRound();
  }
}
function advancePlayoffRound() {
  if (!S.playoffs) return;
  const curIdx = S.playoffs.currentRound - 1;
  const cur = S.playoffs.rounds[curIdx];
  if (cur.series.some((s) => !s.winner)) return; // not all done yet
  if (S.playoffs.currentRound === 3) {
    S.playoffs.champion = cur.series[0].winner;
    S.playoffs.complete = true;
    S.pendingAwards = computeAwards();
    addLog("Champion", `${teamMeta(S.playoffs.champion).name} are the ${S.year} champions.`);
    save();
    return;
  }
  S.playoffs.currentRound += 1;
  const nextR = S.playoffs.rounds[S.playoffs.currentRound - 1];
  const seedOf = (id) => S.playoffs.seedMap[id] || 99;
  const orderTopBot = (a, b) => {
    const sa = seedOf(a),
      sb = seedOf(b);
    return sa < sb ? [a, b, sa, sb] : [b, a, sb, sa];
  };
  if (S.playoffs.currentRound === 2) {
    const w1 = cur.series.find((s) => s.id === "R1-1").winner; // 1v8
    const w2 = cur.series.find((s) => s.id === "R1-2").winner; // 4v5
    const w3 = cur.series.find((s) => s.id === "R1-3").winner; // 2v7
    const w4 = cur.series.find((s) => s.id === "R1-4").winner; // 3v6
    const [a, b, sa, sb] = orderTopBot(w1, w2);
    const [c, d, sc, sd] = orderTopBot(w3, w4);
    nextR.series = [makeSeries("R2-1", 2, 5, a, b, sa, sb), makeSeries("R2-2", 2, 5, c, d, sc, sd)];
  } else if (S.playoffs.currentRound === 3) {
    const w1 = cur.series.find((s) => s.id === "R2-1").winner;
    const w2 = cur.series.find((s) => s.id === "R2-2").winner;
    const [a, b, sa, sb] = orderTopBot(w1, w2);
    nextR.series = [makeSeries("R3-1", 3, 7, a, b, sa, sb)];
  }
  addLog(
    "Round complete",
    `Round ${S.playoffs.currentRound - 1} finished. Round ${S.playoffs.currentRound} begins.`,
  );
}
function nextUserPlayoffGame() {
  if (!S.playoffs || !S.playoffs.active) return null;
  const cur = S.playoffs.rounds[S.playoffs.currentRound - 1];
  const userSeries = cur.series.find(
    (s) => !s.winner && (s.top === S.team.abbr || s.bot === S.team.abbr),
  );
  if (!userSeries) return null;
  return userSeries.games.find((g) => !g.played) || null;
}
function simNextPlayoffGame() {
  if (!S.playoffs || !S.playoffs.active || S.playoffs.complete) return;
  const cur = S.playoffs.rounds[S.playoffs.currentRound - 1];
  const userGame = nextUserPlayoffGame();
  if (userGame) {
    // Auto-sim all other series' next unplayed games first
    cur.series.forEach((s) => {
      if (s.winner) return;
      if (s.top === S.team.abbr || s.bot === S.team.abbr) return;
      const g = s.games.find((x) => !x.played);
      if (g) simulateGame(g);
    });
    if (S.playoffs.complete) {
      tab = "schedule";
      save();
      return render();
    }
    S.gameDay = { gameId: userGame.id, source: "playoff" };
    tab = "schedule";
    save();
    return render();
  }
  // User has no series in this round (eliminated or bye) — sim one game per series.
  cur.series.forEach((s) => {
    if (s.winner) return;
    const g = s.games.find((x) => !x.played);
    if (g) simulateGame(g);
  });
  save();
  render();
}
function simPlayoffsToEnd() {
  let safety = 200;
  while (S.playoffs && !S.playoffs.complete && safety-- > 0) {
    const cur = S.playoffs.rounds[S.playoffs.currentRound - 1];
    if (!cur) break;
    cur.series.forEach((s) => {
      if (s.winner) return;
      const g = s.games.find((x) => !x.played);
      if (g) simulateGame(g);
    });
  }
  save();
  render();
}
function playoffsView() {
  if (!S.playoffs) return `<div class="empty">No playoffs in progress.</div>`;
  const cur = S.playoffs.rounds[S.playoffs.currentRound - 1];
  const userGame = nextUserPlayoffGame();
  const userSeries = cur
    ? cur.series.find((s) => s.top === S.team.abbr || s.bot === S.team.abbr)
    : null;
  const userEliminated = userSeries && userSeries.winner && userSeries.winner !== S.team.abbr;
  const heroBlock = S.playoffs.complete
    ? `<section class="card"><div class="cardPad" style="text-align:center;padding:32px"><div class="mini" style="text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:800">Champion · ${S.year}</div><h1 style="font-size:48px;margin:10px 0;letter-spacing:-.05em">${escapeHtml(teamMeta(S.playoffs.champion).name)}</h1><div class="actions" style="justify-content:center;margin-top:18px"><button class="btn" data-action="openAwards" style="font-size:15px;padding:14px 20px">View Season Awards →</button></div></div></section>`
    : userGame
      ? `<section class="card"><div class="sectionTitle"><h3>Your Next Playoff Game · Round ${S.playoffs.currentRound}</h3><span>Game ${userGame.gameNum} of ${userSeries.bestOf}</span></div><div class="cardPad"><div class="layout2"><div><b>${userGame.home === S.team.abbr ? "Home" : "Away"} vs ${teamMeta(userGame.home === S.team.abbr ? userGame.away : userGame.home).name}</b><p class="muted">Series: ${userSeries.topWins}-${userSeries.botWins} (${userSeries.top === S.team.abbr ? "you" : teamMeta(userSeries.top).name} lead)</p></div><div class="actions" style="justify-content:flex-end;align-items:flex-end"><button class="btn" data-action="simNextPlayoffGame" style="font-size:15px;padding:14px 18px">Game Day →</button></div></div></div></section>`
      : userEliminated
        ? `<section class="card"><div class="cardPad"><b>You were eliminated.</b><p class="muted">Watch the rest of the bracket play out, then collect your season awards.</p><div class="actions"><button class="btn" data-action="simNextPlayoffGame">Sim Next Round Games</button><button class="btn secondary" data-action="simPlayoffsToEnd">Sim to Finals</button></div></div></section>`
        : `<section class="card"><div class="cardPad"><b>Round ${S.playoffs.currentRound} in progress.</b><div class="actions"><button class="btn" data-action="simNextPlayoffGame">Sim Next Round Games</button><button class="btn secondary" data-action="simPlayoffsToEnd">Sim to Finals</button></div></div></section>`;
  const bracketCards = S.playoffs.rounds
    .map((round, ri) => {
      const roundLabel =
        ri === 0
          ? "Round 1 (Best of 3)"
          : ri === 1
            ? "Semifinals (Best of 5)"
            : "Finals (Best of 7)";
      const seriesHtml = round.series.length
        ? round.series.map(seriesCard).join("")
        : `<div class="empty">Pending Round ${ri + 1} winners.</div>`;
      return `<section class="card" style="margin-bottom:14px"><div class="sectionTitle"><h3>${roundLabel}</h3><span>${round.series.filter((s) => s.winner).length}/${round.series.length} series final</span></div><div class="cardPad log">${seriesHtml}</div></section>`;
    })
    .join("");
  return `${seasonKpis()}${heroBlock}${bracketCards}`;
}
function seriesCard(s) {
  const top = teamMeta(s.top);
  const bot = teamMeta(s.bot);
  const isUser = s.top === S.team.abbr || s.bot === S.team.abbr;
  const winLine = s.winner
    ? `<span class="pill good">${teamMeta(s.winner).name} win ${s.topWins}-${s.botWins}</span>`
    : `<span class="pill">${s.topWins}-${s.botWins}</span>`;
  const gameLines = s.games
    .map((g) => {
      if (!g.played)
        return s.winner
          ? ""
          : `<div class="mini">G${g.gameNum}: ${escapeHtml(teamMeta(g.away).id)} @ ${escapeHtml(teamMeta(g.home).id)} — upcoming</div>`;
      return `<div class="mini">G${g.gameNum}: ${escapeHtml(teamMeta(g.away).id)} ${g.awayScore} @ ${escapeHtml(teamMeta(g.home).id)} ${g.homeScore} · ${escapeHtml(teamMeta(g.winner).id)} win</div>`;
    })
    .join("");
  return `<div class="logItem" style="${isUser ? "border-color:var(--orange);box-shadow:inset 4px 0 0 var(--orange)" : ""}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>(${s.topSeed}) <span class="teamBadge" style="${badgeStyle(top.primary)}">${escapeHtml(s.top)}</span> ${escapeHtml(top.name)} vs (${s.botSeed}) <span class="teamBadge" style="${badgeStyle(bot.primary)}">${escapeHtml(s.bot)}</span> ${escapeHtml(bot.name)}</b>${winLine}</div><div style="margin-top:8px">${gameLines}</div></div>`;
}

// =================== AWARDS =====================
function computeAwards() {
  const allPlayers = [
    ...S.roster.map((p) => ({ p, teamId: S.team.abbr })),
    ...S.teams.flatMap((t) => t.players.map((pl) => ({ p: pl, teamId: t.id }))),
  ];
  const withStats = allPlayers.filter((x) => x.p.seasonStats && x.p.seasonStats.gp > 0);
  if (!withStats.length) return null;
  const score = (x) => {
    const s = x.p.seasonStats;
    const gp = Math.max(1, s.gp);
    const base = (s.pts / gp) * 1.0 + (s.reb / gp) * 0.55 + (s.ast / gp) * 0.7 + (s.w / gp) * 8;
    const boost =
      S.lockerRoom && S.lockerRoom.campaignId === x.p.id
        ? 1 + (lockerKnobs().campaignBoost || 0.15)
        : 1;
    return base * boost;
  };
  const ordered = withStats.slice().sort((a, b) => score(b) - score(a));
  const mvp = ordered[0];
  const dpoy = withStats
    .filter((x) => x.p.seasonStats.gp >= 8)
    .slice()
    .sort((a, b) => b.p.ratings.defense - a.p.ratings.defense)[0];
  const rookies = withStats.filter((x) => x.p.rookieYear === S.year);
  const roy = rookies.length ? rookies.slice().sort((a, b) => score(b) - score(a))[0] : null;
  const mipPool = withStats.filter(
    (x) =>
      x.p.compositeAtStart !== null &&
      x.p.compositeAtStart !== undefined &&
      x.p.compositeAtStart > 0 &&
      composite(x.p) > x.p.compositeAtStart,
  );
  const mip = mipPool.length
    ? mipPool
        .slice()
        .sort(
          (a, b) => composite(b.p) - b.p.compositeAtStart - (composite(a.p) - a.p.compositeAtStart),
        )[0]
    : null;
  const allLeague = ordered.slice(0, 5);
  return {
    year: S.year,
    champion: S.playoffs ? S.playoffs.champion : null,
    mvp,
    dpoy,
    roy,
    mip,
    allLeague,
  };
}
function compactAwardEntry(entry) {
  if (!entry) return null;
  if (!entry.p) return clone(entry);
  return {
    playerId: entry.p.id,
    name: entry.p.name,
    pos: entry.p.pos,
    teamId: entry.teamId,
    stats: clone(entry.p.seasonStats || {}),
    defense: entry.p.ratings.defense,
    compositeStart: entry.p.compositeAtStart,
    compositeEnd: composite(entry.p),
  };
}
function userPlayoffResult() {
  if (!S.playoffs) return "Missed playoffs";
  if (S.playoffs.champion === S.team.abbr) return "Champion";
  const rounds = S.playoffs.rounds || [];
  const played = (round) =>
    round &&
    round.series &&
    round.series.some((series) => series.top === S.team.abbr || series.bot === S.team.abbr);
  if (played(rounds[2])) return "Finals";
  if (played(rounds[1])) return "Semifinals";
  if (played(rounds[0])) return "Round 1";
  return "Missed playoffs";
}
function compactSeasonAwards(awards) {
  const record = seasonRecord(S.team.abbr);
  return {
    year: awards.year,
    champion: awards.champion,
    mvp: compactAwardEntry(awards.mvp),
    dpoy: compactAwardEntry(awards.dpoy),
    roy: compactAwardEntry(awards.roy),
    mip: compactAwardEntry(awards.mip),
    allLeague: (awards.allLeague || []).map(compactAwardEntry),
    userRecord: { w: record.w, l: record.l },
    playoffResult: userPlayoffResult(),
  };
}
function historyView() {
  const seasons = (S.awards || []).slice().sort((a, b) => b.year - a.year);
  if (!seasons.length)
    return `<section class="card"><div class="sectionTitle"><h3>Franchise History</h3><span>No completed seasons</span></div><div class="empty">Complete a season and accept its awards to build your permanent history.</div></section>`;
  const entryName = (entry) =>
    entry ? escapeHtml(entry.name || (entry.p && entry.p.name) || "—") : "—";
  return `<section class="card"><div class="sectionTitle"><h3>Franchise History</h3><span>${seasons.length} season(s)</span></div><div class="cardPad log">${seasons
    .map((season) => {
      const champion = season.champion ? escapeHtml(teamMeta(season.champion).name) : "—";
      const record = season.userRecord ? `${season.userRecord.w}-${season.userRecord.l}` : "—";
      const allLeague = (season.allLeague || []).map(entryName).filter((name) => name !== "—");
      return `<div class="logItem"><div class="sectionTitle"><h3>${season.year} Season</h3><span>${escapeHtml(season.playoffResult || "—")} · ${record}</span></div><p class="muted">${champion} champions</p><div class="layout3 historyAwards"><p><b>MVP</b><br>${entryName(season.mvp)}</p><p><b>DPOY</b><br>${entryName(season.dpoy)}</p><p><b>Rookie of the Year</b><br>${entryName(season.roy)}</p><p><b>MIP</b><br>${entryName(season.mip)}</p><p><b>Your record</b><br>${record}</p><p><b>Playoff result</b><br>${escapeHtml(season.playoffResult || "—")}</p></div>${allLeague.length ? `<p class="mini" style="margin-top:8px"><b>All-League:</b> ${allLeague.join(", ")}</p>` : ""}</div>`;
    })
    .join("")}</div></section>`;
}
function awardsView() {
  const a = S.pendingAwards;
  if (!a)
    return `<div class="empty">No awards pending. <button class="btn secondary" data-action="closeAwards">Back</button></div>`;
  const row = (label, x, extra) => {
    if (!x) return "";
    const team = x.teamId;
    const s = x.p.seasonStats;
    const gp = Math.max(1, s.gp);
    return `<div class="logItem" style="display:flex;gap:14px;align-items:center">${portraitHtml(x.p)}<div style="flex:1"><div class="mini" style="text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800">${label}</div><div style="font-size:18px;font-weight:900">${escapeHtml(x.p.name)}</div><div class="mini">${escapeHtml(team)} · ${(s.pts / gp).toFixed(1)} pts · ${(s.reb / gp).toFixed(1)} reb · ${(s.ast / gp).toFixed(1)} ast${extra ? " · " + extra : ""}</div></div></div>`;
  };
  const mipExtra = a.mip ? `+${composite(a.mip.p) - a.mip.p.compositeAtStart} composite` : null;
  const allLeagueHtml = a.allLeague
    .map((x, i) => {
      const s = x.p.seasonStats;
      const gp = Math.max(1, s.gp);
      return `<div class="checkRow">${portraitHtml(x.p, "sm")}<div><b>${i + 1}. ${escapeHtml(x.p.name)}</b> <span class="pill">${escapeHtml(x.p.pos)}</span><div class="mini">${escapeHtml(x.teamId)} · ${(s.pts / gp).toFixed(1)} / ${(s.reb / gp).toFixed(1)} / ${(s.ast / gp).toFixed(1)}</div></div></div>`;
    })
    .join("");
  return `<section class="card"><div class="sectionTitle"><h3>${a.year} Season Awards</h3>${a.champion ? `<span class="pill good">${teamMeta(a.champion).id} Champions</span>` : ""}</div><div class="cardPad"><div class="layout2"><div>${row("Most Valuable Player", a.mvp)}${row("Defensive Player of the Year", a.dpoy, "def " + (a.dpoy ? a.dpoy.p.ratings.defense : ""))}</div><div>${row("Rookie of the Year", a.roy)}${row("Most Improved", a.mip, mipExtra)}</div></div><h3 style="margin-top:18px">All-League Team</h3><div class="log">${allLeagueHtml}</div><div class="actions" style="margin-top:18px"><button class="btn" data-action="acceptAwards">Continue to Offseason →</button></div></div></section>`;
}
function openAwards() {
  if (!S.pendingAwards) S.pendingAwards = computeAwards();
  tab = "schedule";
  save();
  render();
}
function acceptAwards() {
  if (S.pendingAwards) {
    S.awards.push(compactSeasonAwards(S.pendingAwards));
    S.pendingAwards = null;
  }
  S.playoffs = null;
  tab = "schedule";
  save();
  // Jump straight into offseason flow
  enterOffseason();
}
function closeAwards() {
  tab = "schedule";
  save();
  render();
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
    desc: "Shooting, spacing, ball movement. +2 to your team's perimeter offense.",
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
    id: "film",
    label: "Film Study",
    desc: "Watch tape. +1 to all four channels.",
    icon: "▶",
  },
];
function setWeeklyFocus(id) {
  if (!FOCUS_OPTIONS.some((f) => f.id === id)) return;
  S.coaching.weeklyFocus = id;
  S.coaching.focusWeek = id === "none" ? null : S.week;
  save();
  render();
}
function maybeResetWeeklyFocus(_week) {
  // Coaching focus stays until the user changes it.
}
function clearAllInjuries() {
  const clear = (player) => {
    player.injury = null;
  };
  S.roster.forEach(clear);
  S.waived.forEach(clear);
  (S.freeAgents || []).forEach(clear);
  S.teams.forEach((team) => team.players.forEach(clear));
}
function scoutGame(gameId) {
  if (!S.coaching.gamePlans[gameId]) S.coaching.gamePlans[gameId] = { scouted: false, plan: null };
  S.coaching.gamePlans[gameId].scouted = true;
  save();
  render();
}
function setGamePlan(gameId, plan) {
  if (!S.coaching.gamePlans[gameId]) S.coaching.gamePlans[gameId] = { scouted: false, plan: null };
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
    .filter((g) => !g.played && (g.home === S.team.abbr || g.away === S.team.abbr))
    .slice(0, n || 3);
}
function applyWeeklyTransition(week = S.week) {
  if (S.coaching.lastTransitionWeek === week) return false;
  S.coaching.lastTransitionWeek = week;
  // Player dev focus: gains per game scaled by dev coach skill multipliers.
  const df = S.coaching.devFocus;
  if (df && df.playerId) {
    const target = S.roster.find((p) => p.id === df.playerId);
    if (target) {
      const k = df.rating;
      const cap = Math.min(99, target.ratings.potential);
      const dev = S.coaches && S.coaches.dev;
      const mult = (dev && dev.devMultipliers && dev.devMultipliers[k]) || 1.0;
      const mentorBonus = dev && dev.traits && dev.traits.includes("mentor") ? 0.3 : 0;
      const youngDev =
        dev &&
        dev.traits &&
        dev.traits.includes("young-developer") &&
        target.rookieYear !== null &&
        target.rookieYear !== undefined
          ? 0.2
          : 0;
      const lockerBonus =
        (ENGINE.mentorDevBonus(S.roster, S.year, DATA.personality || {})[target.id] || 0) *
        (S.lockerRoom && S.lockerRoom.culture === "lab" ? 2 : 1);
      S.coaches.devAccumulator =
        (S.coaches.devAccumulator || 0) + mult + mentorBonus + youngDev + lockerBonus;
      let pts = 0;
      while (S.coaches.devAccumulator >= 1 && target.ratings[k] < cap) {
        target.ratings[k] = Math.min(cap, (target.ratings[k] || 0) + 1);
        S.coaches.devAccumulator -= 1;
        pts++;
      }
      if (pts > 0) {
        addLog(
          "Development",
          `${target.name} improved +${pts} in ${k} (${dev ? dev.name : "dev"}, ${mult.toFixed(1)}x).`,
        );
      } else if (S.coaches.devAccumulator < 1 && target.ratings[k] < cap) {
        // Sub-1.0 multiplier — show progress without a level-up
        addLog(
          "Development",
          `${target.name} working on ${k} (${S.coaches.devAccumulator.toFixed(1)}/1.0 toward next bump).`,
        );
      }
    }
  }
  return true;
}
function pushLockerEvent(text) {
  if (!S.lockerRoom) return;
  S.lockerRoom.events.unshift({ week: S.week, year: S.year, text });
  if (S.lockerRoom.events.length > 8) S.lockerRoom.events.length = 8;
}
function clampMood(n) {
  return Math.max(20, Math.min(99, n));
}
function clampBond(n) {
  return Math.max(0, Math.min(100, n));
}
function influenceTargetId() {
  return (document.getElementById("lr-player") || {}).value || null;
}
function tickMinutesAndCulture() {
  if (!S.lockerRoom) return;
  const knobs = lockerKnobs();
  ensureUserRotation();
  const top = healthyRotation(S.roster, 8, S.team.abbr);
  const topIds = top.map((player) => player.id);
  const topSet = new Set(topIds);
  const star = rosterStar();
  applyCoreShift(topIds);
  S.roster.forEach((player) => {
    if (player.injury) return;
    if (topSet.has(player.id)) {
      player.startsThisSeason = (player.startsThisSeason || 0) + 1;
      player.sitStreak = 0;
      player.bond = clampBond((player.bond || 50) + ENGINE.startBondDelta());
    } else {
      player.sitStreak = (player.sitStreak || 0) + 1;
      player.bond = clampBond((player.bond || 50) + ENGINE.sitBondDelta(player));
      const fileAt = player.hiddenTrait === "loyal" ? 99 : knobs.sitFile || 3;
      if (player.persona === "competitor" && player.sitStreak >= fileAt && !player.wantsOut) {
        player.wantsOut = true;
        player.mood = clampMood((player.mood || 60) - 8);
        S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 6);
        addLog("Minutes complaint", `${player.name} wants a bigger role — or out.`);
        pushLockerEvent(`${player.name} filed over minutes.`);
      }
    }
  });
  if (S.lockerRoom.captainId && !topSet.has(S.lockerRoom.captainId)) {
    S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 8);
    const captain = S.roster.find((player) => player.id === S.lockerRoom.captainId);
    if (captain) {
      captain.mood = clampMood((captain.mood || 60) - 6);
      pushLockerEvent(`Captain ${captain.name} sat. The room noticed.`);
    }
  }
  if (S.lockerRoom.culture === "star" && star && !topSet.has(star.id)) {
    S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 15);
    star.mood = clampMood((star.mood || 60) - 12);
    pushLockerEvent(`${star.name} is the franchise. Sitting her cratered the room.`);
  }
  if (S.lockerRoom.culture === "lab") {
    S.roster.forEach((player) => {
      if ((player.age || 0) >= 30) player.mood = clampMood((player.mood || 60) - 1);
    });
  }
  if (!S.lockerRoom.pairings || typeof S.lockerRoom.pairings !== "object")
    S.lockerRoom.pairings = {};
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const key = ENGINE.pairKey(top[i].id, top[j].id);
      const entry = S.lockerRoom.pairings[key] || { starts: 0 };
      const before = ENGINE.pairingStatus(entry.starts, knobs.pairStarts, knobs.pactStarts);
      entry.starts = (entry.starts || 0) + 1;
      S.lockerRoom.pairings[key] = entry;
      const after = ENGINE.pairingStatus(entry.starts, knobs.pairStarts, knobs.pactStarts);
      if (before !== after && after === "paired") {
        pushLockerEvent(`${top[i].name} + ${top[j].name} are a pairing.`);
      }
      if (before !== after && after === "pact") {
        pushLockerEvent(`${top[i].name} + ${top[j].name} locked in a run-it-back pact.`);
      }
    }
  }
  Object.keys(S.lockerRoom.pairings).forEach((key) => {
    const [a, b] = key.split("|");
    const aIn = topSet.has(a);
    const bIn = topSet.has(b);
    if (aIn === bIn) return;
    const entry = S.lockerRoom.pairings[key];
    const status = ENGINE.pairingStatus(entry.starts, knobs.pairStarts, knobs.pactStarts);
    if (status === "pact") {
      entry.starts = knobs.pairStarts || 6;
      const stayed = S.roster.find((player) => player.id === (aIn ? a : b));
      const sat = S.roster.find((player) => player.id === (aIn ? b : a));
      if (stayed) stayed.mood = clampMood((stayed.mood || 60) - 12);
      if (sat) sat.mood = clampMood((sat.mood || 60) - 12);
      if (stayed && sat)
        pushLockerEvent(`Pact broken on the floor: ${sat.name} sat, ${stayed.name} felt it.`);
    } else if (status === "paired") {
      entry.starts = Math.max(0, (entry.starts || 0) - 2);
    }
  });
  const tension = teamTensionScore(S.team.abbr);
  const flags = ENGINE.cultureFlags(top, tension, star && star.id);
  const track = S.lockerRoom.cultureTrack || { grit: 0, lab: 0, star: 0 };
  if (flags.grit) track.grit += 1;
  if (flags.lab) track.lab += 1;
  if (flags.star) track.star += 1;
  S.lockerRoom.cultureTrack = track;
  S.lockerRoom.seasonHeatPeak = Math.max(
    S.lockerRoom.seasonHeatPeak || 0,
    S.lockerRoom.heat || 0,
    tension,
  );
}
function applyCoreShift(nextIds) {
  const prev = S.lockerRoom.lastCoreIds || [];
  if (!prev.length) {
    S.lockerRoom.lastCoreIds = nextIds.slice();
    return;
  }
  const prevSet = new Set(prev);
  const newcomers = nextIds.filter((id) => !prevSet.has(id));
  if (newcomers.length) {
    S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 6 * newcomers.length);
    S.roster.forEach((player) => {
      if (prevSet.has(player.id) && player.persona === "quiet-pro") {
        player.mood = clampMood((player.mood || 60) - 3);
      }
    });
    const names = newcomers
      .map((id) => {
        const player = S.roster.find((item) => item.id === id);
        return player ? player.name : id;
      })
      .join(", ");
    pushLockerEvent(`Core shuffle: ${names} entered the eight.`);
  }
  S.lockerRoom.lastCoreIds = nextIds.slice();
}
function breakPairingsForPlayers(ids, blessed) {
  if (!S.lockerRoom || !S.lockerRoom.pairings) return;
  const knobs = lockerKnobs();
  const leaving = new Set(ids || []);
  Object.keys(S.lockerRoom.pairings).forEach((key) => {
    const [a, b] = key.split("|");
    if (!leaving.has(a) && !leaving.has(b)) return;
    const status = ENGINE.pairingStatus(
      S.lockerRoom.pairings[key].starts,
      knobs.pairStarts,
      knobs.pactStarts,
    );
    const stayedId = leaving.has(a) ? b : a;
    const stayed = S.roster.find((player) => player.id === stayedId);
    if (status === "pact" && stayed && !blessed) {
      stayed.mood = clampMood((stayed.mood || 60) - 12);
      stayed.wantsOut = true;
      S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 10);
      pushLockerEvent(`Pact broken in a trade. ${stayed.name} wants out.`);
    }
    delete S.lockerRoom.pairings[key];
  });
}
function nominateCaptain(id) {
  if (!S.started) return toast("Start a franchise first.");
  if (!S.lockerRoom) return;
  const knobs = lockerKnobs();
  if ((S.week || 1) < (knobs.captainWeek || 6))
    return toast(`The room will not accept a captain before week ${knobs.captainWeek || 6}.`);
  if (S.lockerRoom.captainId) return toast("You already have a captain.");
  if (teamTensionScore(S.team.abbr) > (knobs.captainTensionMax || 40))
    return toast("Tension is too high to elect a captain.");
  const nominee = S.roster.find((player) => player.id === id);
  if (!nominee) return toast("Pick a captain.");
  recordUndo("captain vote");
  const approval = ENGINE.captainApproval(nominee, S.roster, DATA.personality || {});
  if (approval >= (knobs.captainApproval || 0.5)) {
    S.lockerRoom.captainId = nominee.id;
    S.lockerRoom.heat = Math.max(0, (S.lockerRoom.heat || 0) - 8);
    addLog("Captain", `${nominee.name} is the voice in the room.`);
    pushLockerEvent(`${nominee.name} elected captain.`);
    toast(`${nominee.name} is captain.`);
  } else {
    S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 12);
    const snubbed = S.roster
      .filter((player) => player.id !== nominee.id)
      .slice()
      .sort((a, b) => composite(b) - composite(a))
      .find(
        (player) =>
          player.persona === "vocal-leader" ||
          player.hiddenTrait === "instigator" ||
          player.persona === "media-darling",
      );
    if (snubbed) {
      snubbed.mood = clampMood((snubbed.mood || 60) - 6);
      if (snubbed.hiddenTrait) snubbed.traitRevealed = true;
      pushLockerEvent(`${snubbed.name} leaked after the failed captain vote.`);
    }
    addLog("Captain vote failed", `The room would not get behind ${nominee.name}.`);
    toast("Captain vote failed. The room split.");
  }
  save();
  render();
}
function spendInfluence(kind, playerId) {
  if (!S.started) return toast("Start a franchise first.");
  if (!S.lockerRoom) return;
  if ((S.lockerRoom.influence || 0) < 1) return toast("No influence left this week.");
  const player = S.roster.find((item) => item.id === playerId);
  if (!player) return toast("Pick a player to spend influence on.");
  if (kind === "bless" && !player.wantsOut) return toast(`${player.name} is not asking out.`);
  recordUndo("locker-room influence");
  const knobs = lockerKnobs();
  S.lockerRoom.influence -= 1;
  if (kind === "closed-door") {
    player.mood = clampMood((player.mood || 60) + 8);
    S.lockerRoom.heat = Math.max(0, (S.lockerRoom.heat || 0) - 8);
    const star = rosterStar();
    if (star && star.id !== player.id) {
      star.mood = clampMood((star.mood || 60) - 4);
      if (star.hiddenTrait === "fragile-ego")
        S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 4);
    }
    const hold = knobs.suppressWeeks || 2;
    S.lockerRoom.suppressedUntilWeek = Math.max(
      S.lockerRoom.suppressedUntilWeek || 0,
      (S.week || 1) + hold,
    );
    addLog(
      "Closed door",
      `Sat down with ${player.name}. Tension will sting less for ${hold} weeks.`,
    );
    pushLockerEvent(
      `Closed door with ${player.name}. Chemistry penalty softened for ${hold} weeks.`,
    );
    toast(`Closed door with ${player.name}.`);
  } else if (kind === "campaign") {
    S.lockerRoom.campaignId = player.id;
    player.mood = clampMood((player.mood || 60) + 2);
    addLog("Campaign", `Front office is pushing ${player.name} for awards.`);
    pushLockerEvent(`Campaigning for ${player.name}.`);
    toast(`Campaigning for ${player.name}.`);
  } else if (kind === "bless") {
    player.tradeBlessed = true;
    player.mood = clampMood((player.mood || 60) + 4);
    S.lockerRoom.heat = Math.max(0, (S.lockerRoom.heat || 0) - 6);
    addLog(
      "Exit granted",
      `${player.name} can be moved without cratering a pact partner, and the trade desk values her +${knobs.blessedTradeValue || 160}.`,
    );
    pushLockerEvent(`Green-lit ${player.name}'s exit.`);
    toast(`${player.name} is available to trade.`);
  }
  save();
  render();
}
function claimCulture(id) {
  if (!S.lockerRoom || S.lockerRoom.culture) return toast("Identity already locked this season.");
  const knobs = lockerKnobs();
  const need = knobs.cultureWeeks || 8;
  const track = S.lockerRoom.cultureTrack || {};
  if (!["grit", "lab", "star"].includes(id)) return;
  if ((track[id] || 0) < need) return toast("That identity is not earned yet.");
  recordUndo("culture identity");
  S.lockerRoom.culture = id;
  const labels = { grit: "Playoff Grit", lab: "Young Lab", star: "Star Vehicle" };
  addLog("Identity", `This franchise is ${labels[id]}.`);
  pushLockerEvent(`Identity locked: ${labels[id]}.`);
  toast(`${labels[id]} locked in.`);
  save();
  render();
}
function applyOffseasonHarvest() {
  if (!S.offseason || !Array.isArray(S.offseason.pendingResign)) return;
  const knobs = lockerKnobs();
  const hasInstigator = S.roster.some(
    (player) => player.hiddenTrait === "instigator" && player.traitRevealed,
  );
  const kept = [];
  S.offseason.pendingResign.forEach((player) => {
    const outcome = ENGINE.harvestOutcome(player, {
      seasonHeat: S.lockerRoom ? S.lockerRoom.seasonHeatPeak || 0 : 0,
      dramaWalkHeat: knobs.dramaWalkHeat,
      hometownBond: knobs.hometownBond,
      spongeBond: knobs.spongeBond,
      hasInstigator,
    });
    player.harvestTag = outcome.tag;
    player.harvestSalaryMult = outcome.salaryMult;
    if (outcome.walk) {
      S.roster = S.roster.filter((item) => item.id !== player.id);
      S.rotation = (S.rotation || []).filter((item) => item !== player.id);
      player.team = "FA";
      player.lastTeam = S.team.abbr;
      if (!Array.isArray(S.freeAgents)) S.freeAgents = [];
      if (!S.freeAgents.some((item) => item.id === player.id)) S.freeAgents.push(player);
      const why =
        outcome.tag === "drama" ? "walked after a hot locker room" : "walked after a minutes snub";
      addLog("Walked", `${player.name} ${why}.`);
      pushLockerEvent(`${player.name} walked (${why}).`);
    } else kept.push(player);
  });
  S.offseason.pendingResign = kept;
}
function resetSeasonIntimacy() {
  if (!S.lockerRoom) return;
  (S.roster || []).forEach((player) => {
    player.startsThisSeason = 0;
    player.sitStreak = 0;
    player.wantsOut = false;
    player.tradeBlessed = false;
  });
  S.lockerRoom.pairings = {};
  S.lockerRoom.captainId = null;
  S.lockerRoom.culture = null;
  S.lockerRoom.cultureTrack = { grit: 0, lab: 0, star: 0 };
  S.lockerRoom.campaignId = null;
  S.lockerRoom.lastCoreIds = [];
  S.lockerRoom.seasonHeatPeak = 0;
  S.lockerRoom.suppressedUntilWeek = 0;
}
function tickLockerRoom(week = S.week) {
  if (!S.lockerRoom) return;
  const knobs = lockerKnobs();
  if (S.lockerRoom.lastInfluenceWeek !== week) {
    S.lockerRoom.influence = knobs.influencePerWeek || 1;
    S.lockerRoom.lastInfluenceWeek = week;
    let cool = 4;
    if (S.lockerRoom.captainId) cool += 3;
    if (S.lockerRoom.culture === "grit") cool += 3;
    S.lockerRoom.heat = Math.max(0, (S.lockerRoom.heat || 0) - cool);
  }
  const report = userLockerReport();
  const tension = report.tension;
  S.roster.forEach((player) => {
    if (
      ENGINE.shouldRevealHidden(
        player.hiddenTrait,
        player.traitRevealed,
        tension,
        random(),
        knobs.revealBase,
      )
    ) {
      player.traitRevealed = true;
      const label = hiddenLabel(player.hiddenTrait);
      addLog("Locker room", `${player.name}'s ${label} is showing in the room.`);
      pushLockerEvent(`${player.name}: ${label} revealed.`);
    }
  });
  const blowupChance =
    (knobs.blowupChance || 0.14) *
    (S.lockerRoom.culture === "grit" ? knobs.gritBlowupMult || 1.6 : 1);
  if (ENGINE.shouldBlowup(tension, random(), knobs.blowupTension, blowupChance)) {
    const troublemakers = S.roster.filter((player) =>
      ["drama-prone", "fragile-ego", "instigator", "selfish"].includes(player.hiddenTrait),
    );
    const pool = troublemakers.length ? troublemakers : S.roster;
    const culprit = pool[Math.floor(random() * pool.length)];
    if (culprit) {
      if (culprit.hiddenTrait) culprit.traitRevealed = true;
      culprit.mood = Math.max(20, (culprit.mood || 60) - 10);
      S.roster.forEach((player) => {
        if (player.id !== culprit.id) player.mood = Math.max(20, (player.mood || 60) - 2);
      });
      S.lockerRoom.heat = Math.min(40, (S.lockerRoom.heat || 0) + 12);
      const label = culprit.hiddenTrait
        ? hiddenLabel(culprit.hiddenTrait)
        : personaLabel(culprit.persona);
      addLog("Locker room blowup", `${culprit.name} (${label}) set the room on edge.`);
      pushLockerEvent(`Blowup: ${culprit.name} (${label}).`);
    }
  }
}
function rollInjuries(g) {
  const checkTeam = (id) => {
    const team = teamMeta(id);
    const top = healthyRotation(team.players, 8, id);
    top.forEach((p) => {
      if (random() < BALANCE.injuryRate) {
        const r = random();
        let games, severity;
        if (r < 0.6) {
          games = rand(1, 2);
          severity = "minor";
        } else if (r < 0.9) {
          games = rand(3, 5);
          severity = "moderate";
        } else {
          games = rand(6, 15);
          severity = "severe";
        }
        p.injury = { games, severity };
        if (id === S.team.abbr) {
          addLog(
            "Injury report",
            `${p.name} suffered a ${severity} injury — out approx ${games} game(s).`,
          );
        }
      }
    });
  };
  checkTeam(g.home);
  checkTeam(g.away);
}
function tickTeamInjuries(teamId, eligibleIds) {
  const dec = (p) => {
    if (!p.injury) return;
    if (eligibleIds && !eligibleIds.has(p.id)) return;
    p.injury.games -= 1;
    if (p.injury.games <= 0) {
      const wasUser = p.team === S.team.abbr;
      const name = p.name;
      p.injury = null;
      if (wasUser) addLog("Return from injury", `${name} cleared and back in rotation.`);
    }
  };
  teamMeta(teamId).players.forEach(dec);
}
function injuryBadge(p) {
  if (!p.injury) return `<span class="pill good">healthy</span>`;
  const sev = p.injury.severity;
  const cls = sev === "severe" ? "bad" : sev === "moderate" ? "warn" : "";
  return `<span class="pill ${cls}">Out ${p.injury.games} (${sev})</span>`;
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
        { id: "schedule", text: "Point to the schedule and travel." },
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
  if (optId === "team") S.roster.forEach((r) => (r.mood = clampMood((r.mood || 60) + 2)));
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
  } else if (optId === "schedule") {
    /* deflect to schedule — mild mood neutralizer */
    S.roster.forEach((r) => (r.mood = clampMood((r.mood || 60) + 1)));
  } else if (optId === "honest") S.roster.forEach((r) => (r.mood = clampMood((r.mood || 60) - 1)));
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
function lockerRoomSection() {
  const report = userLockerReport();
  const knobs = lockerKnobs();
  const influence = S.lockerRoom ? S.lockerRoom.influence || 0 : 0;
  const need = knobs.cultureWeeks || 8;
  const track = (S.lockerRoom && S.lockerRoom.cultureTrack) || { grit: 0, lab: 0, star: 0 };
  const captain =
    S.lockerRoom && S.lockerRoom.captainId
      ? S.roster.find((player) => player.id === S.lockerRoom.captainId)
      : null;
  const campaign =
    S.lockerRoom && S.lockerRoom.campaignId
      ? S.roster.find((player) => player.id === S.lockerRoom.campaignId)
      : null;
  const playerOpts = S.roster
    .slice()
    .sort((a, b) => composite(b) - composite(a))
    .map(
      (player) =>
        `<option value="${escapeAttr(player.id)}">${escapeHtml(player.name)} · bond ${Math.round(player.bond || 50)}${player.wantsOut ? " · wants out" : ""}</option>`,
    )
    .join("");
  const pairingHtml = Object.keys((S.lockerRoom && S.lockerRoom.pairings) || {})
    .map((key) => {
      const [a, b] = key.split("|");
      const pa = S.roster.find((player) => player.id === a);
      const pb = S.roster.find((player) => player.id === b);
      if (!pa || !pb) return "";
      const starts = S.lockerRoom.pairings[key].starts || 0;
      const status = ENGINE.pairingStatus(starts, knobs.pairStarts, knobs.pactStarts);
      return `<div class="mini">${escapeHtml(pa.name)} + ${escapeHtml(pb.name)} · ${escapeHtml(pairingStatusNoun(status))} (${starts}/${knobs.pactStarts} shared starts)</div>`;
    })
    .filter(Boolean)
    .slice(0, 4)
    .join("");
  const locked = S.lockerRoom && S.lockerRoom.culture;
  const lockedHelp = locked ? CULTURE_HELP[S.lockerRoom.culture] : null;
  const cultureLine = lockedHelp
    ? `<p class="muted">Identity: <b>${escapeHtml(lockedHelp.label)}</b> (locked this season). ${escapeHtml(lockedHelp.effect)}</p>`
    : `<p class="muted">Play ${need} weeks in a style, then claim one identity. Grit, Lab, and Star can all tick in the same week if the eight qualifies for more than one — you still pick only one to lock.</p>
       <div class="tiles" style="margin-top:8px">${["grit", "lab", "star"]
         .map((id) => {
           const help = CULTURE_HELP[id];
           const ready = (track[id] || 0) >= need;
           const title = `${help.earn} After ${need} weeks: ${help.effect}`;
           return `<button type="button" class="cityTile" data-culture="${id}" title="${escapeAttr(title)}" ${ready ? "" : "disabled"}><strong>${escapeHtml(help.label)}</strong><small>${escapeHtml(help.earn)} ${track[id] || 0}/${need} weeks. ${escapeHtml(help.effect)}</small></button>`;
         })
         .join("")}</div>`;
  const captainWeek = knobs.captainWeek || 6;
  const captainMax = knobs.captainTensionMax || 40;
  const captainBlock = captain
    ? `<p class="muted">Captain: <b>${escapeHtml(captain.name)}</b>. She cools the room a little every week. In the playoffs she tightens games by +2 (less random blowout variance). Sitting her heats the room back up.</p>`
    : S.week >= captainWeek
      ? `<div class="field"><label>Nominate captain ${helpMark(`After week ${captainWeek}, if tension is under ${captainMax}. Teammates vote; clashes and low bond can sink it. A captain also tightens playoff games by +2.`)}</label><select id="lr-captain">${playerOpts}</select></div>
         <div class="actions"><button class="btn secondary" data-action="nominateCaptain" title="The room votes. Glue, loyal vets, and high-bond teammates tend to say yes. Winner also tightens playoff scoring by +2." ${teamTensionScore(S.team.abbr) > captainMax ? "disabled" : ""}>Hold the vote</button></div>`
      : `<p class="muted">Captain vote opens week ${captainWeek} if tension is under ${captainMax}. A captain cools the room weekly and tightens playoff games by +2 (fewer random blowouts).</p>`;
  const events = ((S.lockerRoom && S.lockerRoom.events) || [])
    .slice(0, 4)
    .map(
      (event) =>
        `<div class="logItem"><b>Week ${event.week}</b><p class="muted">${escapeHtml(event.text)}</p></div>`,
    )
    .join("");
  const campaignLine = campaign
    ? `Currently campaigning <b>${escapeHtml(campaign.name)}</b> for awards.`
    : "Pick a player, then Campaign to push her for MVP or Rookie of the Year.";
  const suppressLeft =
    S.lockerRoom && S.week < (S.lockerRoom.suppressedUntilWeek || 0)
      ? S.lockerRoom.suppressedUntilWeek - S.week
      : 0;
  const calmLine = report.calm
    ? `<span class="pill good" title="Tension is under 25. Hidden traits stay quieter and blowups are off the table.">Room is calm</span>`
    : "";
  const suppressLine = suppressLeft
    ? `<p class="muted">Closed-door hangover: tension hurts play less for ${suppressLeft} more week${suppressLeft === 1 ? "" : "s"}.</p>`
    : "";
  return `<section class="card"><div class="sectionTitle"><h3>Locker Room</h3><span>tension ${report.tension} · chemistry ${Math.round(report.chemistry * 100)}%${report.calm ? " · calm" : ""}</span></div><div class="cardPad"><details class="ratingGlossary"><summary>How the locker room works</summary><p><b>Bond</b> is how much she trusts this franchise. Minutes in the top eight raise it; sitting drops it. High-bond mentors re-sign cheaper. Competitors who sit too often may file or walk.</p><p><b>Tension</b> is how on-edge the eight are. Clashing personalities raise it. On-court pairs and a captain lower it. Under 25 is calm. High tension makes the team play worse.</p><p><b>Influence</b> is one sit-down per week: Closed door cools her and softens tension's hit on play for 2 weeks, Campaign pushes awards, Green-light exit lets a restless player be traded with a +160 value bump.</p><p><b>Identity</b> is a season-long culture claim after ${need} weeks. Playoff Grit, Young Lab, and Star Vehicle can all tick in the same week; you still lock only one.</p></details>
    <div class="meter"><span>Team tension ${helpMark("How on-edge the top eight are. Clashes raise it. Pairs and a captain lower it. Under 25 is calm. High tension hurts play and can freeze drama players out of the box score.")} ${calmLine}</span><div class="bar"><i style="width:${report.tension}%"></i></div><b>${report.tension}</b></div>${suppressLine}
    ${captainBlock}${cultureLine}
    <div class="layout2" style="margin-top:12px"><div><h3>On-court pairs ${helpMark("Players who share the eight build chemistry. 6 starts = pair (calms the room). 12 = run-it-back pact (bigger calm; splitting them hurts both).")}</h3>${pairingHtml || `<div class="mini">Share the floor for ${knobs.pairStarts || 6} starts to become a pair; ${knobs.pactStarts || 12} for a run-it-back pact.</div>`}</div><div><h3>Clashes ${helpMark("Personality matchups that raise tension when both are in the eight. Hover a persona chip on a player card to see what it means.")}</h3>${
      report.conflicts.length
        ? report.conflicts
            .slice(0, 3)
            .map((row) => `<div class="mini">${escapeHtml(row.a)} vs ${escapeHtml(row.b)}</div>`)
            .join("")
        : '<div class="mini">No active clashes in the top eight.</div>'
    }</div></div>
    <div class="field" style="margin-top:12px"><label>Spend influence (1 / week) ${helpMark("Bond is listed next to each name. Higher bond means she trusts the franchise more.")}</label><select id="lr-player">${playerOpts}</select></div>
    <div class="actions"><button class="btn" data-action="closedDoor" title="${escapeAttr(INFLUENCE_HELP.closedDoor)}" ${influence < 1 ? "disabled" : ""}>Closed door</button><button class="btn secondary" data-action="campaignPlayer" title="${escapeAttr(INFLUENCE_HELP.campaign)}" ${influence < 1 ? "disabled" : ""}>Campaign</button><button class="btn secondary" data-action="blessExit" title="${escapeAttr(INFLUENCE_HELP.bless)}" ${influence < 1 ? "disabled" : ""}>Green-light exit</button></div>
    <p class="muted" style="margin-top:8px">Influence this week: ${influence}/${knobs.influencePerWeek || 1}. ${campaignLine}</p>
    <p class="mini" style="margin-top:6px"><b>Closed door</b> — ${escapeHtml(INFLUENCE_HELP.closedDoor)} <b>Campaign</b> — ${escapeHtml(INFLUENCE_HELP.campaign)} <b>Green-light exit</b> — ${escapeHtml(INFLUENCE_HELP.bless)}</p>
    <div class="log" style="margin-top:14px">${events || '<div class="empty">Play games. Minutes, pairings, and files show up here.</div>'}</div></div></section>`;
}
function coachingView() {
  return `${kpis()}${coachingStaffSection()}<div style="margin-top:18px">${lockerRoomSection()}</div><div style="margin-top:18px">${nextGamesSection()}</div><div class="layout2" style="margin-top:18px"><div>${weeklyFocusSection()}${devFocusSection()}</div><div>${pressSection()}${injurySection()}</div></div>`;
}
function faCoachPool(role) {
  const pool = (DATA.coachCandidates && DATA.coachCandidates[role]) || [];
  const current = S.coaches[role];
  return pool.filter((c) => !current || c.id !== current.id);
}
function hireCoach(role, candidateId) {
  const pool = (DATA.coachCandidates && DATA.coachCandidates[role]) || [];
  const candidate = pool.find((c) => c.id === candidateId);
  if (!candidate) return;
  recordUndo("coaching change");
  const prev = S.coaches[role] ? S.coaches[role].name : "the previous coach";
  S.coaches[role] = JSON.parse(JSON.stringify(candidate));
  if (role === "dev") S.coaches.devAccumulator = 0;
  const roleLabel =
    role === "head"
      ? "Head Coach"
      : role === "assistant"
        ? "Assistant Coach"
        : "Player Development Coach";
  addLog("Coaching staff change", `${candidate.name} replaces ${prev} as ${roleLabel}.`);
  toast(`${candidate.name} hired.`);
  modal = null;
  save();
  render();
}
function openHireModal(role) {
  modal = { type: "hire-coach", role };
  render();
}
function coachCard(c, role, isCurrent) {
  const sys = c.system && DATA.coachingSystems && DATA.coachingSystems[c.system];
  const sysLine = sys
    ? `<div class="mini" style="margin-top:4px"><b>${sys.label}</b> — ${sys.desc}</div>`
    : "";
  const traitChips = (c.traits || [])
    .map((t) => {
      const label = (DATA.coachTraitLabels && DATA.coachTraitLabels[t]) || t;
      return `<span class="tag">${label}</span>`;
    })
    .join("");
  const mults = c.devMultipliers
    ? Object.entries(c.devMultipliers)
        .map(
          ([k, v]) =>
            `<span class="tag" style="${v > 1.1 ? "background:#e8f7ef;color:#116442" : v < 0.9 ? "background:#ffe9e5;color:#9b2419" : ""}">${k} ${v.toFixed(1)}x</span>`,
        )
        .join("")
    : "";
  const action = isCurrent
    ? `<span class="pill good">Currently hired</span>`
    : `<button class="btn" data-hire-coach="${role}|${c.id}">Hire</button>`;
  return `<div class="logItem"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div style="flex:1"><div style="font-size:16px;font-weight:900">${c.name}</div>${sysLine}<div class="tags" style="margin-top:8px">${traitChips}</div>${mults ? `<div class="tags" style="margin-top:6px">${mults}</div>` : ""}</div><div style="flex-shrink:0">${action}</div></div></div>`;
}
function coachingStaffSection() {
  const c = S.coaches || {};
  const hc = c.head;
  const asst = c.assistant;
  const dev = c.dev;
  const traitChips = (traits) =>
    (traits || [])
      .map((t) => {
        const label = (DATA.coachTraitLabels && DATA.coachTraitLabels[t]) || t;
        return `<span class="tag">${label}</span>`;
      })
      .join("");
  const sys = hc && DATA.coachingSystems && DATA.coachingSystems[hc.system];
  const sysLine = sys
    ? `<div class="mini" style="margin-top:4px"><b>${sys.label}</b> — ${sys.desc}</div>`
    : "";
  const buffLine =
    c.pendingBuff && c.pendingBuff.type === "inspiring"
      ? `<div class="mini" style="margin-top:6px;color:var(--orange);font-weight:800">Inspiring buff queued for next game (+3 all channels).</div>`
      : "";
  const devMults =
    dev && dev.devMultipliers
      ? Object.entries(dev.devMultipliers)
          .map(([k, v]) => `<span class="tag">${k} ${v.toFixed(1)}x</span>`)
          .join("")
      : "";
  const devProgress =
    c.devAccumulator > 0
      ? `<div class="mini" style="margin-top:4px">In progress: ${c.devAccumulator.toFixed(2)}/1.0 toward next rating bump</div>`
      : "";
  const hireBtn = (role) =>
    `<button class="btn secondary" data-hire-open="${role}" style="margin-top:8px">Hire New</button>`;
  return `<section class="card"><div class="sectionTitle"><h3>Coaching Staff</h3><span>your sideline brain trust</span></div><div class="cardPad"><div class="layout3"><div><div class="mini" style="text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800">Head Coach</div><div style="font-size:18px;font-weight:900;margin-top:4px">${hc ? hc.name : "—"}</div>${sysLine}<div class="tags" style="margin-top:8px">${hc ? traitChips(hc.traits) : ""}</div>${buffLine}${hireBtn("head")}</div><div><div class="mini" style="text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800">Assistant Coach</div><div style="font-size:18px;font-weight:900;margin-top:4px">${asst ? asst.name : "—"}</div><div class="tags" style="margin-top:8px">${asst ? traitChips(asst.traits) : ""}</div>${hireBtn("assistant")}</div><div><div class="mini" style="text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800">Player Development</div><div style="font-size:18px;font-weight:900;margin-top:4px">${dev ? dev.name : "—"}</div><div class="tags" style="margin-top:8px">${dev ? traitChips(dev.traits) : ""}</div><div class="tags" style="margin-top:6px">${devMults}</div>${devProgress}${hireBtn("dev")}</div></div></div></section>`;
}
function weeklyFocusSection() {
  const cur = S.coaching.weeklyFocus;
  const tiles = FOCUS_OPTIONS.map(
    (f) =>
      `<button type="button" class="cityTile ${cur === f.id ? "selected" : ""}" data-focus="${f.id}" role="radio" aria-checked="${cur === f.id}"><strong>${f.icon} ${f.label}</strong><small>${f.desc}</small></button>`,
  ).join("");
  return `<section class="card"><div class="sectionTitle"><h3>Coaching Focus</h3><span>stays until you change it</span></div><div class="cardPad"><div class="tiles" role="radiogroup" aria-label="Coaching focus">${tiles}</div></div></section>`;
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
        ? `<div class="impact"><div class="impactRow"><span>Per O</span><div class="bar"><i style="width:${oppPower.perO}%"></i></div><b>${oppPower.perO}</b></div><div class="impactRow"><span>Per D</span><div class="bar"><i style="width:${oppPower.perD}%"></i></div><b>${oppPower.perD}</b></div><div class="impactRow"><span>Int O</span><div class="bar"><i style="width:${oppPower.intO}%"></i></div><b>${oppPower.intO}</b></div><div class="impactRow"><span>Int D</span><div class="bar"><i style="width:${oppPower.intD}%"></i></div><b>${oppPower.intD}</b></div></div><div class="mini" style="margin-top:8px">Tip: ${(() => {
            const r = recommendPlan(oppPower);
            return r === "pack"
              ? "Interior-leaning — Pack the Paint defends their best lane."
              : r === "extend"
                ? "Perimeter-leaning — Extend Defense closes their shooters."
                : "Balanced opponent — neither plan stands out.";
          })()}</div>`
        : `<button class="btn secondary" data-scout="${g.id}">Scout Opponent</button>`;
      const planBlock = gp.scouted
        ? `<div class="actions" style="margin-top:10px"><button class="btn ${gp.plan === "pack" ? "" : "secondary"}" data-plan="${g.id}|pack">Pack the Paint</button><button class="btn ${gp.plan === "extend" ? "" : "secondary"}" data-plan="${g.id}|extend">Extend Defense</button>${gp.plan ? `<button class="btn ghost" data-plan="${g.id}|none">Clear</button>` : ""}</div>`
        : "";
      return `<div class="logItem"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>Week ${g.week} · ${isHome ? "vs" : "at"} <span class="teamBadge" style="${badgeStyle(opp.primary)}">${oppId}</span> ${opp.name}</b><span class="pill">${gp.plan ? (gp.plan === "pack" ? "Pack" : "Extend") : gp.scouted ? "Plan?" : "Unscouted"}</span></div><div style="margin-top:10px">${scoutBlock}${planBlock}</div></div>`;
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
          `<option value="${p.id}" ${cur.playerId === p.id ? "selected" : ""}>${escapeHtml(p.name)} · ${escapeHtml(p.pos)} · pot ${p.ratings.potential}</option>`,
      )
      .join("");
  const ratingOpts = RATING_KEYS.filter((k) => k !== "potential")
    .map((k) => `<option value="${k}" ${cur.rating === k ? "selected" : ""}>${k}</option>`)
    .join("");
  const target = cur.playerId ? S.roster.find((p) => p.id === cur.playerId) : null;
  const note = target
    ? `Currently developing <b>${escapeHtml(target.name)}</b> on <b>${escapeHtml(cur.rating)}</b> (${target.ratings[cur.rating]} → cap ${Math.min(99, target.ratings.potential)}). +1 per week until capped.`
    : "Pick a player and rating to give them focused individual work each week.";
  return `<section class="card"><div class="sectionTitle"><h3>Player Development</h3><span>+1 rating per week</span></div><div class="cardPad"><div class="field"><label>Player</label><select id="dev-player">${playerOpts}</select></div><div class="field"><label>Skill emphasis</label><select id="dev-rating">${ratingOpts}</select></div><div class="actions"><button class="btn" data-action="commitDevFocus">Set Development</button></div><p class="muted" style="margin-top:10px">${note}</p></div></section>`;
}
function injurySection() {
  if (!S.roster.length)
    return `<section class="card"><div class="sectionTitle"><h3>Injury Report</h3></div><div class="cardPad"><div class="empty">Draft a roster first.</div></div></section>`;
  const injured = S.roster.filter((p) => p.injury);
  const healthy = S.roster.length - injured.length;
  const rows = S.roster
    .slice()
    .sort((a, b) => {
      const ai = a.injury ? a.injury.games : -1;
      const bi = b.injury ? b.injury.games : -1;
      return bi - ai;
    })
    .map(
      (p) =>
        `<tr><td><div style="display:flex;gap:10px;align-items:center">${portraitHtml(p, "sm")}<div><div class="playerName">${escapeHtml(p.name)}</div><div class="mini">${escapeHtml(p.pos)} · ${visibleGrade(p)}</div></div></div></td><td>${injuryBadge(p)}</td><td>${p.mood || 60}</td></tr>`,
    )
    .join("");
  return `<section class="card"><div class="sectionTitle"><h3>Injury Report</h3><span>${healthy} healthy · ${injured.length} out</span></div><table class="table"><thead><tr><th>Player</th><th>Status</th><th>Mood</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
function pressSection() {
  const pending = S.coaching.pendingPress;
  const log = S.coaching.pressLog || [];
  let pendingHtml = "";
  if (pending) {
    pendingHtml = `<div class="logItem" style="border-color:var(--orange);background:#fff6ee"><b>${escapeHtml(pending.headline)}</b><p class="muted">${escapeHtml(pending.body)}</p><div class="actions" style="flex-direction:column;align-items:stretch;gap:8px">${pending.options.map((o) => `<button class="btn secondary" data-press="${escapeAttr(o.id)}" style="text-align:left">${escapeHtml(o.text)}</button>`).join("")}</div></div>`;
  }
  const logHtml = log.length
    ? `<div class="log">${log.map((e) => `<div class="logItem"><b>${e.headline}</b><div class="mini">${e.when} · "${e.choice}"</div></div>`).join("")}</div>`
    : '<div class="empty">No press conferences yet.</div>';
  return `<section class="card"><div class="sectionTitle"><h3>Press Conference</h3><span>${pending ? "1 pending" : log.length + " on record"}</span></div><div class="cardPad">${pendingHtml || ""}<h3 style="margin-top:${pending ? "18px" : "0"}">Recent Briefings</h3>${logHtml}</div></section>`;
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
                    `<div class="checkRow"><div><b>${escapeHtml(r.name)}</b> <span class="pill">${escapeHtml(r.pos)}</span> <span class="pill">${escapeHtml(r.archetype)}</span><div class="mini">${escapeHtml(r.team)} · ${shortMoney(r.salary)} · upside ${r.ratings.potential}</div></div><button class="btn danger" data-rm-rookie="${y}|${i}">Remove</button></div>`,
                )
                .join("")}</div>`,
          )
          .join("");
  const slots = readSaveIndex();
  const importPreview = pendingImport
    ? `<div class="logItem importPreview"><b>Ready to import: ${escapeHtml(pendingImport.saveName)}</b><p class="muted">${escapeHtml(pendingImport.team.city)} ${escapeHtml(pendingImport.team.nickname)} · Year ${pendingImport.year} · ${pendingImport.roster.length} roster players</p><div class="actions"><button class="btn" data-action="confirmImport">Apply Import</button><button class="btn secondary" data-action="cancelImport">Cancel</button></div></div>`
    : "";
  const slotList = slots.length
    ? slots
        .map(
          (slot) =>
            `<div class="checkRow"><div><b>${escapeHtml(slot.name)}</b> ${slot.id === activeSlotId ? '<span class="pill good">Active</span>' : ""}<div class="mini">Year ${slot.year} · ${slot.updatedAt ? new Date(slot.updatedAt).toLocaleString() : "unknown"}</div></div><div class="actions">${slot.id === activeSlotId ? "" : `<button class="btn secondary" data-load-slot="${escapeAttr(slot.id)}">Load</button><button class="btn danger" data-delete-slot="${escapeAttr(slot.id)}">Delete</button>`}</div></div>`,
        )
        .join("")
    : '<div class="empty">Your current franchise will appear here after autosave.</div>';
  return `<section class="card"><div class="sectionTitle"><h3>Add Custom Rookie</h3><span>Players added here join the named class for their draft year</span></div><div class="cardPad"><div class="layout2"><div><div class="field"><label>Name</label><input id="cr-name" placeholder="Player Name"></div><div class="field"><label>Position</label><select id="cr-pos">${POSITION_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join("")}</select></div><div class="field"><label>College / Origin</label><input id="cr-college" placeholder="UConn"></div><div class="field"><label>Draft Year</label><input id="cr-year" type="number" value="${nextYear}" min="${nextYear}"></div><div class="field"><label>Archetype</label><select id="cr-arch">${ARCHETYPE_OPTIONS.map((a) => `<option value="${a}">${a}</option>`).join("")}</select></div><div class="field"><label>Salary ($)</label><input id="cr-salary" type="number" value="400000" min="270000" step="10000"></div><div class="field"><label>Contract Years</label><input id="cr-years" type="number" value="4" min="1" max="4"></div></div><div><div class="ratingGrid">${ratingFields}</div><div class="field"><label>Scouting (optional)</label><textarea id="cr-scouting" rows="2" placeholder="Auto-filled from archetype if blank"></textarea></div><div class="field"><label>Strengths (optional)</label><input id="cr-strengths" placeholder="Auto-derived from top ratings if blank"></div><div class="field"><label>Weaknesses (optional)</label><input id="cr-weaknesses" placeholder="Auto-derived from low ratings if blank"></div><div class="actions"><button class="btn" data-action="addCustomRookie">Add to Draft Class</button></div></div></div><hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><h3>Current Custom Rookies</h3>${list}<hr style="border:0;border-top:1px solid var(--line);margin:24px 0"><div class="sectionTitle"><h3>Save Slots</h3><span>Current: ${escapeHtml(S.saveName)}</span></div><div class="cardPad"><div class="field"><label>Name this copy</label><input id="save-slot-name" maxlength="60" placeholder="My second franchise"></div><div class="actions"><button class="btn" data-action="createSaveSlot">Save Current Franchise As…</button></div><div class="log" style="margin-top:16px">${slotList}</div></div><div class="sectionTitle"><h3>Backup &amp; Recovery</h3><span>Export, import, or reset the active save.</span></div><div class="cardPad"><div class="layout2"><button class="btn" data-action="exportSave">Export Save</button><button class="btn secondary" data-action="importSave">Validate Import</button><button class="btn ghost" data-action="reset">Reset Active Save</button></div><div class="field"><label>Paste save JSON here</label><textarea id="saveImport" rows="4" placeholder="Paste exported save JSON"></textarea></div>${importPreview}<div class="logItem">Save version <b>${S.saveVersion}</b> · Balance version <b>${S.balanceVersion}</b> · Seed <b>${S.rngSeed}</b> · Last saved <b>${S.lastSaved ? new Date(S.lastSaved).toLocaleString() : "unknown"}</b></div></div></div></section>`;
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
  if (!year || year < S.year + 1) return toast(`Draft year must be ${S.year + 1} or later.`);
  const archetype = readField("cr-arch");
  const salary = Math.max(cbaValue("minRookie", 270000), parseInt(readField("cr-salary"), 10) || 0);
  const years = Math.max(1, Math.min(4, parseInt(readField("cr-years"), 10) || 4));
  const ratings = {};
  RATING_KEYS.forEach((k) => (ratings[k] = clampRating(parseInt(readField("cr-" + k), 10) || 60)));
  const scouting = readField("cr-scouting").trim() || rookieScout(archetype, pos);
  const strengths = readField("cr-strengths").trim() || ratingsTop(ratings);
  const weaknesses = readField("cr-weaknesses").trim() || ratingsBottom(ratings);
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
    age: 22,
    injury: null,
  });
  stampPlayerPersonality(S.customRookies[year][S.customRookies[year].length - 1]);
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
// Skip the initial paint under the test harness (no real DOM).
if (typeof window === "undefined" || !window.__WNBA_TEST__) {
  render();
  resumeOffseasonDraft();
}

if (
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  location.protocol !== "file:"
) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((reg) => {
      if (reg.waiting && navigator.serviceWorker.controller)
        toast("A new version is ready. Refresh to update.");
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller)
            toast("A new version is ready. Refresh to update.");
        });
      });
    })
    .catch((error) => {
      console.warn("Offline cache registration failed", error);
    });
}

// Node-only export surface for unit tests. `module` is undefined in the browser,
// so this block is inert there and has zero effect on the shipped app.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    escapeHtml,
    composite,
    tradeValue,
    visibleGrade,
    teamLetter,
    abbr,
    uniqueUserAbbr,
    uniqueAbbrAgainst,
    ordinal,
    migrate,
    normalizeSave,
    freshState,
    isValidSave,
    isValidPlayer,
    generateSchedule,
    teamPower,
    simScore,
    evaluateTrade,
    distributeAndRecord,
    ageOnePlayer,
    resolveExpiredContracts,
    applyWeeklyTransition,
    tickTeamInjuries,
    waiverPool,
    userPickRookie,
    healthyRotation,
    leagueIds,
    clearComputeCaches,
    resetFaBase,
    requireOpeningNightReady,
    buildDraftOrder,
    resumeOffseasonDraft,
    seedOffseason,
    processAiPicks,
    startNextSeason,
    enterPlayoffs,
    signPlayer,
    setWeeklyFocus,
    maybeResetWeeklyFocus,
    clearAllInjuries,
    marketChurn,
    firstTag,
    ownedPicks,
    executeTrade,
    aiPickRookie,
    refreshWaiverClass,
    generateYearlyWaivers,
    generateRookieClass,
    runNpcFreeAgency,
    resignUserPlayer,
    walkUserPlayer,
    userPlayoffResult,
    compactSeasonAwards,
    generateNpcOffer,
    tradesLocked,
    pickTradeValue,
    ensurePickBoard,
    grantUpcomingPicks,
    consumeDraftYearPicks,
    enterOffseason,
    sitPlayer,
    startPlayer,
    moveRotation,
    ensureUserRotation,
    expansionDraftOpen,
    applyBulkCoaching,
    rotationMood,
    DATA,
    ENGINE,
    personaLabel,
    hiddenLabel,
    personaChip,
    helpMark,
    pairingStatusNoun,
    pairingStatusLabel,
    lockerRoomSection,
    lockerReadForPlayer,
    rosterTable,
    userLockerReport,
    teamChemistryMult,
    teamTensionScore,
    tickMinutesAndCulture,
    nominateCaptain,
    spendInfluence,
    claimCulture,
    applyOffseasonHarvest,
    resetSeasonIntimacy,
    tickLockerRoom,
    ensureUpcomingUserPick,
    rehomeOrphanUserPicks,
    reassignUserPicks,
    applyCity,
    campRosterLimit,
    padRookieClass,
    get S() {
      return S;
    },
    set S(v) {
      S = v;
    },
    get trade() {
      return trade;
    },
    set trade(v) {
      trade = v;
    },
    get draftFilters() {
      return draftFilters;
    },
    get undoStack() {
      return undoStack;
    },
    set undoStack(v) {
      undoStack = v;
    },
  };
}

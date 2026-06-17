# wnba-manager — Code Review

Vanilla-JS single-page game. `app.js` (3,449 lines), `data.js` (5,399 lines), `index.html`, `styles.css`. No build step, no tests. Global state `S`, a `render()` that rebuilds the whole DOM on every action, localStorage autosave.

Overall: coherent and thoughtfully seamed for a prototype (banner comments, view/action split, defensive `migrate`, a `simTest` harness). The highest-leverage work is fixing a handful of real bugs, then lifting the pure engine out from under the `S` global so it's testable, and breaking the render-everything-per-keystroke loop.

---

## Correctness & bugs

### High
- **XSS via unescaped free-text fields** — `playerDraftCard` (app.js:566) interpolates `p.name`, `p.scouting`, `p.strengths`, `p.weaknesses` raw; the team-sends trade header (~line 632) interpolates `S.team.nickname` and partner name raw; waiver cards (~747) and the offseason draft board (~2529) the same. Custom rookies (Admin tab, ~3392) accept free-text name/scouting/strengths/weaknesses that flow into these unescaped, so `<img src=x onerror=...>` executes. `escapeHtml` already exists and is used in ~8 spots — apply it consistently to every interpolated player/team string. **Only true security issue.**
- **"Recent Finals" crashes after any playoff game** — line 1325 unshifts *all* game ids (including playoff games) into `S.season.results`, but `recentResults` (1669) looks them up only in `S.season.schedule.find(...)`. Playoff ids aren't in `schedule`, so `g` is `undefined` and `teamMeta(g.away)` (1673) throws. Fix: use `findAnyGame(id)` in `recentResults`, or don't push playoff ids into `results`.

### Medium
- **User team abbreviation can collide with an NPC team id** — `abbr(city, nick)` (1681) takes first letter of city + first 2 of nickname with no uniqueness guard against `DATA.teams[].id`. A collision makes `leagueIds`/`teamMeta`/`seasonRecord` conflate two teams (self-games, double-counted standings). Validate/uniquify `S.team.abbr` on start.
- **Importing a malformed-but-parseable save bricks the app** — `importSave` (181) runs `migrate` then assigns `S`, but `migrate({})` tolerates missing top-level fields (`team`, `roster`, `teams`), so `render()`→`setupPage()` then throws on `S.team.city`, leaving a blank app until reset. Validate required fields before assigning `S`.
- **Box score points don't reconcile to the team score** — `distributeAndRecord` (1219) sets `remaining = Math.max(40, ptsFor)` and hands stars fixed random chunks; on low scores `remaining` goes negative and bench gets 0. Awards/stat-leaders (MVP via `score()`) are computed off these fabricated numbers, not the actual sim result.
- **`protected` flag is wiped league-wide on trade** — `submitTrade` (~2005-2008) forces `protected:false` on both incoming and outgoing players. Once any protected star is traded, it can never be re-protected and downstream logic (`leaguePressure`, `teamNeed`, draft "Locked") silently shifts. At minimum the outgoing side shouldn't be forced false.

### Low
- Tie-break `if (hs===as) hs+=rand(1,5)` (1178) always favors home — systematic home bias beyond the intended +2.2.
- `rosterBalance` "weakest area" uses `pairs[length-2]` (475) — second-weakest, off-by-one (display only).
- `simSeason` hard-sets `S.week = 17` regardless of playoff weeks 18-20 — topbar week display can read wrong (harmless).

### Verified non-issues
No duplicate player ids; `load()` JSON.parse is try/caught; `avg()` guards empty arrays; playoff series can't deadlock; `clone()` via JSON is safe here (no functions/dates).

---

## Performance

### High
- **`save()` runs a full `JSON.stringify(S)` inside every `render()`** (163, 313) — a ~100KB serialize + synchronous localStorage write on every tab click, filter keystroke, and checkbox toggle. Debounce save (300-500ms) and/or decouple it from render so only real mutations persist.
- **`simSeason` redundantly recomputes ratings tens of thousands of times** — each of ~248 games calls `teamPower()` for both teams, which does `slice().filter().sort()` and calls `composite()` per player (and again inside the sort comparator); `distributeAndRecord` repeats the same sort. Ratings don't change within a sim. Memoize `composite` on the player (`p._composite`, bust on change) and cache `teamPower` per id per sim batch; cache the healthy top-8.
- **`allLeaguePlayers()` spreads 210 new objects every call** (206) — invoked on every draft-search keystroke (via full `render()`) and inside `findPlayer` (O(n) scan per modal open), then sorted by `tradeValue`→`composite`. Build a flat id→player Map once, rebuild only on roster change; gives O(1) `findPlayer`.

### Medium
- `render()` rebuilds the entire app `innerHTML` + re-runs `bind()` (~20 `querySelectorAll` passes) on every interaction (304-311). The `captureFocus`/`restoreFocus` workaround is a symptom. Re-render only the active pane + modal, or use event delegation on a stable parent to drop `bind()`.
- `recommendPlan` calls `leagueChannelAvg` twice, each looping all 16 teams' `teamPower` → 32 full power computations to open Game Day (926, 919). Cache one league-power snapshot.
- `teamMeta`/`seasonRecord` do O(n) `S.teams.find` per standings row and per schedule row (~496 finds for the 248-game list, rendered even when collapsed). Use a Map; render the collapsed schedule lazily; don't call `ensureSeason()` from inside `seasonRecord`.
- `waiverPool()` recreates 5 FA objects via `p(...)` and dedupes O(n²) every call (752). Build base FAs once; dedupe with a `Set`.

### Low
- `kpis()`/`teamRatings()`/`checkObjectives()` recompute per render even on pure tab switches (small arrays, low impact). `clone()` deep-copies all players on cold start (one-time).

---

## Architecture & maintainability

The seams exist conceptually but aren't enforced — ~150 top-level functions and ~10 module globals share one namespace; everything is reachable and mutable everywhere.

Priorities:
1. **Extract a pure engine module.** `composite`, `teamPower`, `simScore`, `distributeAndRecord`, `evaluateTrade`, `generateSchedule`, `generateRookieClass`, `ageOnePlayer`, `computeAwards` are almost pure but reach into `S` (e.g. `simScore` reads `S.coaching`/`S.coaches`). Make them take inputs as arguments and an injectable `rng`. `window.simTest` already proves this is feasible.
2. **State/persistence module.** `freshState`/`migrate`/`load`/`save`/`exportSave`/`importSave` + `SAVE_VERSION`/`LS_KEY` form a clean `state.js`. Decouple `save()` from `render()` (mutate → persist → render).
3. **Break the render-everything loop** (see Performance Medium) — split rendering per tab, or move to event delegation.
4. **Move UI state out of domain scope** — `tab`, `modal`, `trade`, `draftFilters` into a `ui` object; route mutations through named transition functions instead of inline deep-path edits scattered across actions.
5. **Pull tuning constants into one balance table** — composite weights (220-227), `teamPower` weights (1009), home court +2.2 (1174), injury rate 0.022 (3028), trade thresholds (693-721), `tradeValue` constants (257-261).
6. **Data hygiene** — `data.js` ends with functions `team()`/`p()`/`slug()`, and `p()` calls `Math.random()` at load (non-deterministic "data"). Move them to a `factories.js`; keep `data.js` literal-only. `slug` is defined in `data.js` but called from `app.js` — a hidden cross-file global dependency.
7. **De-duplicate** the repeated opponent scout-block markup (`nextGameHero`/`gameDayView`/`nextGamesSection`), the recommend-plan advice strings, and the healthy-top-8 sort idiom (`teamPower`/`distributeAndRecord`/`rollInjuries`/`gameDayView` → extract `healthyRotation(players, n)`).

Suggested structure: `data.js` (pure) · `factories.js` · `state.js` · `engine.js` (pure, injectable rng) · `actions.js` · `views/` · `ui.js` · `balance.js`.

---

## Tests & quality

Currently zero unit-testable surface: no runner, and every interesting function reads `S` or calls `render()`/`save()`. Enabling path:
1. Add `package.json` + a test runner (node:test or vitest).
2. Split `engine.js`/`state.js` as modules with functions taking inputs instead of reading `S`.
3. Make `rand`/`Math.random` an injectable `rng` so `simScore`/`simSeason` are deterministic and reproducible.

First high-value tests once extracted: `migrate` (defensive, easy to break), `composite`, `simScore`, `teamPower`, `evaluateTrade`, `generateRookieClass`, `ageOnePlayer`, `advancePlayoffRound`.

---

## Suggested fix order
1. XSS escaping (security) and the Recent-Finals playoff crash (real crash).
2. Abbreviation collision + malformed-save validation (data integrity).
3. Decouple/debounce `save()` and memoize `composite`/`teamPower` (perf wins, low risk).
4. Extract `engine.js` + `state.js` and add the first tests.
5. Break the render loop; pull constants into a balance table.

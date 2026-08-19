# WNBA Expansion Manager — Full Build + Season Sim

Play at https://wnba.meehanyou.com — progress stays in that browser. Export a save from Admin (or the setup screen) before switching devices or clearing site data.

Launch directly by opening `index.html`, or run the local server below to enable offline installation:

```sh
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Included systems

- Expansion team setup with preset cities, custom nickname, arena, and color inputs
- Expansion draft room with protected players, cap checks, scouting notes, and hidden ratings
- Roster/cap dashboard with position balance and recommended next move
- Trade desk with multi-player trades, year-stamped draft picks, NPC offers, a deadline, salary validation, team needs, and protected-player logic
- Waiver wire with low-cost players and re-signing logic
- Season Command tab with generated schedule, standings, next-game simulation, week simulation, full-season simulation, and recent finals
- Sim engine using hidden roster ratings for offense, defense, rebounding, top-player weighting, home advantage, and random variance
- Local browser autosave
- Multiple named save slots, validated import preview, export, and transaction Undo
- Deterministic season seeds and compact franchise award history
- Keyboard-accessible setup, dialogs, filters, and responsive mobile layouts
- Installable offline web app shell when served over HTTP

## Notes

The roster scaffold is grounded in publicly available 2026 WNBA opening-roster reporting, but ratings, salaries, contract years, player protections, trade values, and scouting notes are game abstractions for prototype gameplay.

The simplified cap is set at $7.0M for game balance.

See `DATA_SOURCES.md` for the factual/fictional data boundary and refresh procedure.

## Quality checks

```sh
npm install
npm run check
```

This runs linting, formatting verification, unit/integration tests, and automated accessibility checks.

## Suggested first playthrough

1. Pick a city and team identity.
2. Draft 11-12 players while staying under the cap.
3. Use the Roster tab to identify weak areas.
4. Attempt one trade before the season.
5. Open Season Command and simulate games.
6. Watch standings and roster quality change based on your build.

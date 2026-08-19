# Data provenance

Last reviewed: 2026-08-18

## What is factual

Player and team names in the initial 2026 roster scaffold were assembled from public WNBA team and roster reporting. Player portrait IDs resolve images from ESPN at runtime.

## What is fictionalized

All ratings, salaries, contract terms, protection status, trade value, mood, scouting language, coaching effects, injuries, and simulation results are game abstractions. Expansion markets, arenas, and generated rookies are fictionalized for gameplay.

## Refresh procedure

1. Verify team and player names against current league/team roster pages.
2. Record the retrieval date in this file and the header comment in `data.js`.
3. Keep factual identity fields separate from fictional ratings and contracts.
4. Run `npm run check` and a seeded balance simulation after changing roster data.
5. Confirm portrait usage and hosting terms before distributing bundled image assets.

Owner: project maintainer.

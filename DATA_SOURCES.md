# Data provenance

Last reviewed: 2026-08-21

## What is factual

Player and team names in the initial 2026 roster scaffold were assembled from public WNBA team and roster reporting. Player portrait IDs resolve images from ESPN at runtime.

2026 salaries: named roster players use [Her Hoop Stats 2026 cap sheet](https://herhoopstats.com/salary-cap-sheet/wnba/players/salary_2026/stats_2025/) where the name matches (retrieved 2026-08-21). Hardship / 7-day deals below the CBA floor are raised to the $270,000 rookie minimum so the game does not treat two-way chips as real cap relief. 2026 first-round draftees without an HHS row use the published year-1 rookie scale (#1 $500,000, #2 $466,913; later top-eight picks interpolated). Team cap $7,000,000, supermax $1,400,000, standard max $1,190,000, veteran minimum $277,500 — [WNBA CBA announcement](https://www.wnba.com/news/wnba-wnbpa-tentative-cba-deal-2026) and Her Hoop Stats key numbers.

## What is fictionalized

Ratings, contract years, protection status, trade value, mood, scouting language, coaching effects, injuries, and simulation results are game abstractions. Expansion markets, arenas, and generated future rookies are fictionalized. Unmatched roster names (international depth, some 2026 draftees) get inferred bands: veteran minimum unless a documented pick/slot exists. 2027+ draft classes use the 2026 year-1 rookie scale by rank.

## Refresh procedure

1. Verify team and player names against current league/team roster pages.
2. Record the retrieval date in this file and the header comment in `data.js`.
3. Keep factual identity fields (and matched 2026 salaries) separate from fictional ratings and contract years.
4. Run `npm run check` after changing roster or salary data. Confirm no player is below `cba.minRookie` or above `cba.supermax`.
5. Confirm portrait usage and hosting terms before distributing bundled image assets.

Owner: project maintainer.

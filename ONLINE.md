# Online v1 cutline — WNBA Expansion Manager

**Accepted direction (2026-08-07):** web-accessible single-player. Saves stay in the browser. No server database, accounts, or multiplayer.

## In scope (v1)

| Item | Status |
|---|---|
| Public URL anyone can open | **Done** — `https://wnba.meehanyou.com` (GitHub Pages, `main` → `/`) |
| Custom domain | **Done** — DNS → `bismarckbanjo.github.io`, Pages CNAME + cert approved |
| Static assets only (`index.html`, `app.js`, `data.js`, `styles.css`) | **Done** — no build step |
| Franchise save in **localStorage** (this browser/device) | **Done** — key `wnbaExpansionFullBuild.v2` |
| Export / import / reset save (move save by hand) | **Done** — Admin → Save Management |
| Push to `main` = redeploy | **Done** — Pages source `main` `/` |

## Out of scope (v1)

- Accounts / login
- Cloud saves / shared database
- Multiplayer or shared leagues
- Backend API
- App stores / native wrappers
- Real-time multiplayer sim

## How saves work (honest)

- One save per browser profile on that device.
- Clearing site data = lose progress unless you **Export Save** first.
- New phone/laptop: use Export → Import (or start fresh).
- That is intentional for v1.

## Hosting notes

- Repo: `github.com/bismarckbanjo/WNBA_Expansion_Manager_Full` (public)
- Host: GitHub Pages (not Vercel). Fits pure static; CNAME already in repo.
- HTTPS cert: approved. `https_enforced` currently **false** — optional follow-up: force HTTPS in Pages settings.
- Local dev: Concierge / `python3 -m http.server 8016` via `launch.toml`.

## Done means for this cutline

Someone who is not Michael can open the public URL, start an expansion franchise, play, close the tab, come back on the **same browser**, and still have their save — with no account and no backend.

**That is already the product shape.** Remaining work is smoke-proof + optional polish, not a new architecture.

## Optional follow-ups (not required for “online”)

1. Smoke playthrough on the live URL (draft → one week sim → reload → save still there).
2. Enforce HTTPS in GitHub Pages.
3. README: “Play at …” + one-line export/import note.
4. Mobile layout check (if friends will play on phones).
5. Anything product (balance, UI) — separate from “is it online?”

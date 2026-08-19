// Integration smoke test: loads data.js + app.js into a real DOM (jsdom), lets
// render() run for real, then drives a full season + playoffs and checks the
// render paths that pure unit tests can't reach (recentResults after playoffs,
// nickname escaping in the live DOM).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// jsdom is a dev dependency (npm install). If it's absent, skip rather than fail.
let JSDOM;
try {
  ({ JSDOM } = require("jsdom"));
} catch {
  test("integration suite (jsdom not installed — run `npm install`)", { skip: true }, () => {});
}

const ROOT = path.join(__dirname, "..");

function boot() {
  const dom = new JSDOM(
    `<!DOCTYPE html><html><body><div id="app"></div><div id="toast"></div></body></html>`,
    { runScripts: "outside-only", url: "https://localhost/" },
  );
  const { window } = dom;
  // Run the shipped files in the page context, exactly as the <script> tags would.
  window.eval(fs.readFileSync(path.join(ROOT, "factories.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "engine.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "state-schema.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "app.js"), "utf8"));
  return window;
}

function buildOpeningRoster(window) {
  window.document.querySelector('[data-tab="draft"]').click();
  let safety = 20;
  while (safety-- > 0) {
    const countText = window.document.querySelector(".kpi .value").textContent;
    if (Number(countText.split("/")[0]) >= 11) return;
    const available = Array.from(window.document.querySelectorAll("[data-draft]:not([disabled])"));
    assert.ok(available.length, "expected an affordable expansion pick");
    available[0].click();
  }
  assert.fail("could not build an opening-night roster");
}

const itDom = JSDOM ? test : (name, fn) => test(name, { skip: true }, () => {});

itDom("app boots and renders the setup screen without errors", () => {
  const w = boot();
  const html = w.document.getElementById("app").innerHTML;
  assert.ok(html.length > 0);
  assert.match(html, /Continue a franchise/);
  assert.ok(w.document.getElementById("saveImport"), "setup should expose import");
});

itDom("full season + playoffs sim runs and renders without throwing", () => {
  const w = boot();
  w.actions("start"); // begin franchise → dashboard
  buildOpeningRoster(w);
  w.simSeason(); // simulate every scheduled game
  // Drive into the playoffs and finish them.
  assert.doesNotThrow(() => w.enterPlayoffs());
  w.document.querySelector('[data-tab="schedule"]').click();
  assert.match(w.document.getElementById("app").innerHTML, /Semifinals/);
  assert.doesNotThrow(() => w.simPlayoffsToEnd());
  // Switch to the Season tab — this renders recentResults(), which previously
  // crashed because playoff game ids are pushed into S.season.results but were
  // only looked up in the regular-season schedule.
  const scheduleBtn = w.document.querySelector('[data-tab="schedule"]');
  assert.ok(scheduleBtn, "schedule tab button should exist");
  assert.doesNotThrow(() => scheduleBtn.click());
  const html = w.document.getElementById("app").innerHTML;
  assert.ok(html.length > 0);
  assert.ok(
    !w.document.querySelector('[data-tab="draft"]'),
    "expansion draft nav should hide after opening night",
  );
  assert.match(html, /seasonStepper/);
  assert.match(html, /Awards/);
});

itDom("a malicious team nickname is HTML-escaped in the live DOM", () => {
  const w = boot();
  const payload = 'PWN"><img src=x onerror=hack()>';
  const nick = w.document.getElementById("nickInput");
  nick.value = payload;
  nick.dispatchEvent(new w.Event("input", { bubbles: true }));
  w.actions("start");
  const html = w.document.getElementById("app").innerHTML;
  assert.ok(
    !html.includes("<img src=x onerror=hack()>"),
    "raw injected markup must not appear in the DOM",
  );
  assert.ok(html.includes("&lt;img"), "payload should be escaped");
});

itDom("custom-rookie free text is escaped in the admin list", () => {
  const w = boot();
  w.actions("start");
  w.document.querySelector('[data-tab="admin"]').click();
  w.document.getElementById("cr-name").value = "<script>hack()</script>";
  const yr = w.document.getElementById("cr-year");
  yr.value = String(Number(yr.value)); // keep the valid default year
  w.addCustomRookie();
  const html = w.document.getElementById("app").innerHTML;
  assert.ok(!html.includes("<script>hack()"), "script tag must not be raw");
  assert.ok(html.includes("&lt;script&gt;hack()"));
});

itDom("a base free agent cannot be signed more than once", () => {
  const w = boot();
  w.actions("start");
  w.document.querySelector('[data-tab="waivers"]').click();
  const firstButton = w.document.querySelector("[data-sign]");
  const playerId = firstButton.dataset.sign;
  firstButton.click();
  w.document.querySelector('[data-tab="waivers"]').click();
  assert.strictEqual(
    w.document.querySelector(`[data-sign="${playerId}"]`),
    null,
    "signed free agent should leave the available pool",
  );
  w.document.querySelector('[data-tab="roster"]').click();
  assert.strictEqual(w.document.querySelectorAll(`[data-view="${playerId}"]`).length, 1);
});

itDom("setup and filter values cannot break out of HTML attributes", () => {
  const w = boot();
  const payload = 'x" autofocus onfocus="hack()';
  const nick = w.document.getElementById("nickInput");
  nick.value = payload;
  nick.dispatchEvent(new w.Event("input", { bubbles: true }));
  w.render();
  const replacement = w.document.getElementById("nickInput");
  assert.strictEqual(replacement.value, payload);
  assert.strictEqual(replacement.hasAttribute("autofocus"), false);
  assert.strictEqual(replacement.hasAttribute("onfocus"), false);

  w.actions("start");
  w.document.querySelector('[data-tab="draft"]').click();
  const query = w.document.querySelector('[data-filter="q"]');
  query.value = payload;
  query.dispatchEvent(new w.Event("input", { bubbles: true }));
  const nextQuery = w.document.querySelector('[data-filter="q"]');
  assert.strictEqual(nextQuery.value, payload);
  assert.strictEqual(nextQuery.hasAttribute("autofocus"), false);
  assert.strictEqual(nextQuery.hasAttribute("onfocus"), false);
});

itDom("player dialogs trap the workflow and close with Escape", () => {
  const w = boot();
  w.CSS = { escape: (value) => String(value) };
  w.actions("start");
  w.document.querySelector('[data-tab="draft"]').click();
  w.document.querySelector("[data-view]").click();
  assert.ok(w.document.querySelector('[role="dialog"][aria-modal="true"]'));
  assert.strictEqual(w.document.activeElement.hasAttribute("data-close"), true);
  w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.strictEqual(w.document.querySelector('[role="dialog"]'), null);
});

itDom("save imports require preview confirmation", () => {
  const w = boot();
  w.actions("start");
  w.save();
  const exported = w.localStorage.getItem("wnbaExpansionFullBuild.v2");
  w.document.querySelector('[data-tab="admin"]').click();
  w.document.getElementById("saveImport").value = exported;
  w.document.querySelector('[data-action="importSave"]').click();
  assert.ok(w.document.querySelector(".importPreview"));
  assert.ok(w.document.querySelector('[data-action="confirmImport"]'));
});

itDom("rookie draft resumes AI picks after a mid-draft reload", () => {
  const w = boot();
  w.actions("start");
  const npcId = w.GAME_DATA.teams[0].id;
  const userId = w.leagueIds()[0];
  w.seedOffseason({
    stage: "draft",
    agingReport: [],
    rookieClass: [
      {
        id: "rookie-test-0",
        name: "Test Rookie",
        pos: "G",
        team: "UConn",
        salary: 200000,
        years: 4,
        scouting: "x",
        strengths: "Shooting",
        weaknesses: "Defense",
        protected: false,
        ratings: {
          scoring: 70,
          shooting: 70,
          playmaking: 70,
          defense: 70,
          rebounding: 70,
          athleticism: 70,
          iq: 70,
          potential: 80,
        },
        archetype: "starter",
        mood: 60,
        injury: null,
      },
    ],
    draftOrder: [npcId, userId],
    picks: [],
    currentPickIdx: 0,
  });
  w.resumeOffseasonDraft();
  w.document.querySelector('[data-tab="schedule"]').click();
  const os = w.document.getElementById("app").textContent;
  assert.match(os, /Test Rookie/);
  assert.match(os, /YOUR PICK|on the clock|Draft complete/);
});

itDom("trade desk lists year-stamped picks instead of a flavor checkbox", () => {
  const w = boot();
  w.actions("start");
  buildOpeningRoster(w);
  const tradeBtn = w.document.querySelector('[data-tab="trades"]');
  assert.ok(tradeBtn);
  tradeBtn.click();
  const html = w.document.getElementById("app").innerHTML;
  assert.match(html, /1st|First-round slot/);
  assert.ok(!html.includes("Request their future 2nd-round pick"));
  assert.match(html, /Review Trade/);
});

itDom("named save slots can be created without losing the current franchise", () => {
  const w = boot();
  w.actions("start");
  w.document.querySelector('[data-tab="admin"]').click();
  w.document.getElementById("save-slot-name").value = "Second Franchise";
  w.document.querySelector('[data-action="createSaveSlot"]').click();
  assert.match(w.document.getElementById("app").textContent, /Current: Second Franchise/);
  const index = JSON.parse(w.localStorage.getItem("wnbaExpansion.saveIndex.v1"));
  assert.ok(index.some((slot) => slot.name === "Second Franchise"));
});

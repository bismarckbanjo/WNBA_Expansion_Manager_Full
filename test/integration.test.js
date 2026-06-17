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
  window.eval(fs.readFileSync(path.join(ROOT, "data.js"), "utf8"));
  window.eval(fs.readFileSync(path.join(ROOT, "app.js"), "utf8"));
  return window;
}

const itDom = JSDOM ? test : (name, fn) => test(name, { skip: true }, () => {});

itDom("app boots and renders the setup screen without errors", () => {
  const w = boot();
  assert.ok(w.document.getElementById("app").innerHTML.length > 0);
});

itDom("full season + playoffs sim runs and renders without throwing", () => {
  const w = boot();
  w.actions("start"); // begin franchise → dashboard
  w.simSeason(); // simulate every scheduled game
  // Drive into the playoffs and finish them.
  assert.doesNotThrow(() => w.enterPlayoffs());
  assert.doesNotThrow(() => w.simPlayoffsToEnd());
  // Switch to the Season tab — this renders recentResults(), which previously
  // crashed because playoff game ids are pushed into S.season.results but were
  // only looked up in the regular-season schedule.
  const scheduleBtn = w.document.querySelector('[data-tab="schedule"]');
  assert.ok(scheduleBtn, "schedule tab button should exist");
  assert.doesNotThrow(() => scheduleBtn.click());
  assert.ok(w.document.getElementById("app").innerHTML.length > 0);
});

itDom("a malicious team nickname is HTML-escaped in the live DOM", () => {
  const w = boot();
  const payload = 'PWN"><img src=x onerror=hack()>';
  const nick = w.document.getElementById("nickInput");
  nick.value = payload;
  nick.dispatchEvent(new w.Event("input"));
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
  w.document.getElementById("cr-name").value = '<script>hack()</script>';
  const yr = w.document.getElementById("cr-year");
  yr.value = String(Number(yr.value)); // keep the valid default year
  w.addCustomRookie();
  const html = w.document.getElementById("app").innerHTML;
  assert.ok(!html.includes("<script>hack()"), "script tag must not be raw");
  assert.ok(html.includes("&lt;script&gt;hack()"));
});

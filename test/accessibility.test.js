const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const axe = require("axe-core");

const ROOT = path.join(__dirname, "..");
const SCRIPTS = ["factories.js", "config.js", "engine.js", "state-schema.js", "data.js", "app.js"];

function boot() {
  const dom = new JSDOM(
    '<!doctype html><html lang="en"><head><title>Baseline</title></head><body><main><div id="app"></div></main><div id="toast" role="status" aria-live="polite"></div></body></html>',
    { runScripts: "outside-only", url: "https://localhost/" },
  );
  dom.window.CSS = { escape: (value) => String(value) };
  SCRIPTS.forEach((file) => dom.window.eval(fs.readFileSync(path.join(ROOT, file), "utf8")));
  dom.window.eval(axe.source);
  return dom.window;
}

async function criticalViolations(window) {
  const result = await window.axe.run(window.document, {
    runOnly: {
      type: "rule",
      values: [
        "aria-allowed-role",
        "aria-required-children",
        "button-name",
        "duplicate-id",
        "form-field-multiple-labels",
        "label",
      ],
    },
  });
  return result.violations;
}

test("setup has no critical automated accessibility violations", async () => {
  const window = boot();
  assert.strictEqual((await criticalViolations(window)).length, 0);
});

test("dashboard and player dialog have no critical automated accessibility violations", async () => {
  const window = boot();
  window.actions("start");
  window.document.querySelector('[data-tab="draft"]').click();
  window.document.querySelector("[data-view]").click();
  const dialog = window.document.querySelector('[role="dialog"][aria-modal="true"]');
  assert.ok(dialog, "player scout should render as a modal dialog");
  assert.strictEqual((await criticalViolations(window)).length, 0);
});

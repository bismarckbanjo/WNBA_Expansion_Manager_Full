// Test harness: loads the real data.js + app.js into an isolated VM context with
// minimal window/document/localStorage stubs, so the shipped code runs unmodified
// and its Node-only export surface (see bottom of app.js) becomes testable.
// Math.random can be seeded for deterministic simulation tests.
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DATA = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
const APP = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

function makeEl() {
  const el = {
    value: "",
    innerHTML: "",
    checked: false,
    dataset: {},
    style: { setProperty() {} },
    classList: { add() {}, remove() {} },
    focus() {},
    setSelectionRange() {},
    appendChild() {},
    remove() {},
    click() {},
    addEventListener() {},
    querySelectorAll: () => [],
  };
  return el;
}

// seed: integer for a deterministic PRNG, or null/undefined for real Math.random.
function loadGame(seed) {
  const store = {};
  const ctx = {
    module: { exports: {} },
    console,
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
  };
  ctx.window = { __WNBA_TEST__: true, addEventListener() {} };
  ctx.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl(),
    documentElement: { style: { setProperty() {} } },
    body: { appendChild() {} },
    visibilityState: "visible",
    activeElement: null,
  };
  ctx.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
  };
  ctx.CSS = { escape: (s) => s };
  ctx.Math = Object.create(Math);
  if (seed != null) {
    let s = seed >>> 0 || 1;
    ctx.Math.random = () => {
      // Mulberry32 — small, fast, deterministic.
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(DATA, ctx, { filename: "data.js" });
  vm.runInContext(APP, ctx, { filename: "app.js" });
  return ctx.module.exports;
}

module.exports = { loadGame };

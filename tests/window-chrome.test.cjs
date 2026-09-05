const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { buildSync } = require("esbuild");
const code = buildSync({
  entryPoints: ["src/lib/window-chrome.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "Chrome",
}).outputFiles[0].text;
function fixture(platform, fail = false) {
  const dom = new JSDOM("", { runScripts: "outside-only" }),
    w = dom.window,
    calls = [],
    timers = new Map();
  let id = 0;
  Object.defineProperty(w.navigator, "platform", { value: platform });
  w.setTimeout = (fn) => {
    timers.set(++id, fn);
    return id;
  };
  w.clearTimeout = (id) => timers.delete(id);
  w.Spicetify = {
    CosmosAsync: {
      post: async (url, body) => {
        calls.push({ url, body });
        if (fail) throw Error("Unavailable");
      },
    },
  };
  w.console.warn = () => {};
  w.eval(code + "; Chrome.setupWindowsTitlebar();");
  return {
    dom,
    w,
    calls,
    timers,
    flush: () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((fn) => fn());
    },
  };
}
test("Mac does not change native chrome or schedule work", () => {
  const f = fixture("MacIntel");
  try {
    assert.equal(f.calls.length, 0);
    assert.equal(f.timers.size, 0);
  } finally {
    f.dom.window.close();
  }
});
test("Windows collapses frame and F8 restores it", async () => {
  const f = fixture("Win32");
  try {
    await new Promise(setImmediate);
    assert.equal(f.calls[0].body.height, "1px");
    assert.ok(
      f.w.document.documentElement.classList.contains("aurora-hide-titlebar"),
    );
    f.w.document.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "F8" }));
    f.flush();
    await new Promise(setImmediate);
    assert.equal(f.calls.at(-1).body.height, "30px");
    assert.equal(
      f.w.document.documentElement.classList.contains("aurora-hide-titlebar"),
      false,
    );
  } finally {
    f.dom.window.close();
  }
});
test("unsupported native interface keeps the titlebar visible", async () => {
  const f = fixture("Win32", true);
  try {
    await new Promise(setImmediate);
    assert.equal(
      f.w.document.documentElement.classList.contains("aurora-hide-titlebar"),
      false,
    );
  } finally {
    f.dom.window.close();
  }
});
test("resize bursts coalesce into one update", async () => {
  const f = fixture("Win32");
  try {
    f.flush();
    f.flush();
    await new Promise(setImmediate);
    const before = f.calls.length;
    for (let i = 0; i < 20; i++) f.w.dispatchEvent(new f.w.Event("resize"));
    assert.equal(f.timers.size, 1);
    f.flush();
    await new Promise(setImmediate);
    assert.equal(f.calls.length, before + 1);
  } finally {
    f.dom.window.close();
  }
});

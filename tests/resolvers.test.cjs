const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { buildSync } = require("esbuild");
const bundle = buildSync({
  entryPoints: ["src/lib/resolvers.ts"],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "Resolvers",
}).outputFiles[0].text;
let dom, w, r;
beforeEach(() => {
  dom = new JSDOM("", { runScripts: "outside-only", pretendToBeVisual: true });
  w = dom.window;
  r = w.eval(bundle + "; Resolvers;");
});
afterEach(() => dom.window.close());
test("main anchor prefers test id over legacy class", () => {
  w.document.body.innerHTML =
    '<main class="Root__main-view"></main><main data-testid="main"></main>';
  assert.equal(r.getMainView(), w.document.querySelector("[data-testid]"));
});
test("legacy main anchor survives absence of test id", () => {
  w.document.body.innerHTML = '<main class="Root__main-view"></main>';
  assert.ok(r.getMainView());
});
test("missing anchors fail explicitly", () => {
  assert.equal(r.getMainView(), null);
  assert.equal(r.getRightSidebar(), null);
});
test("right panel mounts outside hidden native aside", () => {
  w.document.body.innerHTML =
    '<div class="Root__right-sidebar"><aside aria-label="Now playing view"></aside></div>';
  assert.equal(r.getRightSidebar().tagName, "DIV");
  w.document.body.innerHTML = '<aside aria-label="Now playing view"></aside>';
  assert.equal(r.getRightSidebar(), null);
});
test("lyrics detection is scoped to main content", () => {
  w.document.body.innerHTML =
    '<button data-testid="lyrics-button"></button><main data-testid="main"></main>';
  assert.equal(r.getSpotifyLyricsContainer(), null);
  w.document.querySelector("main").innerHTML =
    '<div data-testid="lyrics-container"></div>';
  assert.ok(r.getSpotifyLyricsContainer());
});
test("fiber traversal tolerates throwing predicates and cycles", () => {
  const el = w.document.body;
  const fiber = {};
  fiber.return = fiber;
  el.__reactFiber$changed = fiber;
  let calls = 0;
  assert.equal(
    r.walkFiberUp(
      el,
      () => {
        calls++;
        throw Error();
      },
      3,
    ),
    null,
  );
  assert.equal(calls, 3);
});
test("module lookup works when Spicetify has not loaded", () => {
  assert.equal(
    r.findModule(() => true),
    null,
  );
  assert.equal(r.findModuleByProps("TrackRow"), null);
});
test("webpack helper failure falls back to nested exports", () => {
  w.Spicetify = {
    Webpack: {
      find() {
        throw Error();
      },
      moduleCache: { 42: { exports: { nested: { TrackRow: true } } } },
    },
  };
  assert.equal(r.findModuleByProps("TrackRow").TrackRow, true);
});
test("waitFor observes late mounts and times out missing anchors", async () => {
  const pending = r.waitFor(r.getMainView, { timeoutMs: 100 });
  w.document.body.innerHTML = '<main data-testid="main"></main>';
  assert.equal(await pending, r.getMainView());
  assert.equal(await r.waitFor(() => null, { timeoutMs: 5 }), null);
});
test("injection remounts after React removes it", async () => {
  w.document.body.innerHTML = "<main></main>";
  let mounts = 0;
  const stop = r.maintainInjection({
    target: () => w.document.querySelector("main"),
    exists: () => w.document.getElementById("injected"),
    mount: (parent) => {
      mounts++;
      const el = w.document.createElement("div");
      el.id = "injected";
      parent.append(el);
    },
  });
  w.document.getElementById("injected").remove();
  await new Promise((resolve) => w.setTimeout(resolve, 40));
  assert.equal(mounts, 2);
  stop();
});
test("observer teardown cancels scheduled callbacks", async () => {
  let calls = 0;
  const stop = r.onSubtreeMutation(w.document.body, () => calls++);
  w.document.body.append(w.document.createElement("div"));
  await Promise.resolve();
  stop();
  await new Promise((resolve) => w.setTimeout(resolve, 40));
  assert.equal(calls, 0);
});

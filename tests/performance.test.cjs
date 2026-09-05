const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { buildSync } = require("esbuild");
const compile = (file, name) =>
  buildSync({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: "iife",
    ...(name ? { globalName: name } : {}),
  }).outputFiles[0].text;
test("600 unchanged player frames produce only one text mutation", () => {
  const dom = new JSDOM("<span></span>", { runScripts: "outside-only" });
  try {
    const w = dom.window,
      el = w.document.querySelector("span");
    const { setTextIfChanged } = w.eval(
      compile("src/lib/dom.ts", "DOM") + "; DOM;",
    );
    const observer = new w.MutationObserver(() => {});
    observer.observe(el, { childList: true });
    for (let frame = 0; frame < 600; frame++) setTextIfChanged(el, "0:10");
    assert.equal(observer.takeRecords().length, 1);
    setTextIfChanged(el, "0:11");
    assert.equal(observer.takeRecords().length, 1);
  } finally {
    dom.window.close();
  }
});
test("artwork extraction is shared across album tracks and stale loads cannot repaint", async () => {
  const dom = new JSDOM("", { runScripts: "outside-only" });
  try {
    const w = dom.window,
      images = [],
      callbacks = {};
    let scheduled;
    w.setTimeout = (fn) => {
      scheduled = fn;
      return 1;
    };
    w.clearTimeout = () => {};
    w.Image = class {
      constructor() {
        images.push(this);
      }
      set src(value) {
        this.url = value;
      }
    };
    w.HTMLCanvasElement.prototype.getContext = () => ({
      drawImage() {},
      getImageData() {
        return { data: new Uint8ClampedArray([255, 0, 0, 255]) };
      },
    });
    w.Spicetify = {
      Player: {
        data: {
          item: {
            uri: "track:1",
            metadata: { image_url: "https://example.test/album-a" },
          },
        },
        addEventListener: (event, fn) => (callbacks[event] = fn),
      },
    };
    w.eval(compile("src/dynamic-theme.ts"));
    const first = scheduled();
    w.Spicetify.Player.data.item = {
      uri: "track:2",
      metadata: { image_url: "https://example.test/album-b" },
    };
    callbacks.songchange();
    const second = scheduled();
    images[1].onerror();
    await second;
    const before =
      w.document.documentElement.style.getPropertyValue("--lyrics-accent");
    images[0].onload();
    await first;
    assert.equal(
      w.document.documentElement.style.getPropertyValue("--lyrics-accent"),
      before,
    );
    w.Spicetify.Player.data.item = {
      uri: "track:3",
      metadata: { image_url: "https://example.test/album-a" },
    };
    callbacks.songchange();
    await scheduled();
    assert.equal(images.length, 2, "same album must reuse extracted palette");
    assert.notEqual(
      w.document.documentElement.style.getPropertyValue("--lyrics-accent"),
      before,
    );
  } finally {
    dom.window.close();
  }
});

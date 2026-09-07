const { JSDOM } = require("jsdom");
const { buildSync } = require("esbuild");
const bundles = new Map();
function compile(file) {
  if (!bundles.has(file))
    bundles.set(
      file,
      buildSync({
        entryPoints: [file],
        bundle: true,
        write: false,
        format: "iife",
      }).outputFiles[0].text,
    );
  return bundles.get(file);
}
const settle = () => new Promise(setImmediate);
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
function fixture(html = "") {
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://xpui.app.spotify.com/",
  });
  const w = dom.window,
    events = {},
    timers = new Map(),
    intervals = [],
    frames = new Map();
  let id = 0;
  w.setTimeout = (fn) => {
    timers.set(++id, fn);
    return id;
  };
  w.clearTimeout = (n) => timers.delete(n);
  w.setInterval = (fn, delay) => {
    intervals.push({ fn, delay });
    return ++id;
  };
  w.requestAnimationFrame = (fn) => {
    frames.set(++id, fn);
    return id;
  };
  w.cancelAnimationFrame = (n) => frames.delete(n);
  w.HTMLElement.prototype.scrollIntoView = () => {};
  const calls = [];
  const player = {
    data: {
      item: {
        uri: "spotify:track:a",
        metadata: {
          title: "Track A",
          artist_name: "Artist",
          duration: "120000",
        },
      },
      isPaused: true,
    },
    addEventListener(name, fn) {
      (events[name] ??= []).push(fn);
    },
    getProgress: () => 1000,
    getDuration: () => 120000,
    getVolume: () => 0.5,
    getMute: () => false,
    getShuffle: () => false,
    getRepeat: () => 0,
    playUri: async (uri) => calls.push(["play", uri]),
    seek: (pos) => calls.push(["seek", pos]),
    togglePlay() {},
    back() {},
    next() {},
    toggleShuffle() {},
    setRepeat() {},
    toggleMute() {},
    setVolume() {},
  };
  w.Spicetify = {
    Player: player,
    CosmosAsync: { get: async () => null },
    Platform: { History: { push: (path) => calls.push(["navigate", path]) } },
  };
  return {
    dom,
    w,
    events,
    timers,
    intervals,
    frames,
    calls,
    player,
    run: (file) => w.eval(compile(file)),
    emit: async (event) => {
      for (const fn of events[event] ?? []) fn();
      await settle();
    },
    key: (key, extras = {}) =>
      w.document.dispatchEvent(
        new w.KeyboardEvent("keydown", { key, bubbles: true, ...extras }),
      ),
    timersRun: async () => {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach((fn) => fn());
      await settle();
    },
    frame: async () => {
      await settle();
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn());
      await settle();
    },
  };
}
module.exports = { fixture, compile, settle, deferred };

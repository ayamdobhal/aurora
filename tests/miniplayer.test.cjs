const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, settle, deferred } = require("./helpers/runtime.cjs");
function setup(t) {
  const f = fixture('<button data-testid="mini-player-button"></button>'),
    windows = [];
  t.after(() => {
    f.dom.window.close();
    windows.forEach((p) => p.dom.window.close());
  });
  f.w.fetch = async (url) => url.includes("githubusercontent") ? {ok:false,status:404} : ({
    ok: true,
    json: async () => ({ syncedLyrics: "[00:00.00]hello" }),
  });
  f.w.Spicetify.Platform.PlayerAPI = {
    getQueue: async () => ({
      nextUp: [{ uri: "spotify:track:b", metadata: { title: "Queued track" } }],
    }),
  };
  f.w.documentPictureInPicture = {
    requestWindow: async () => {
      const p = fixture();
      windows.push(p);
      p.w.HTMLElement.prototype.scrollIntoView = () => {};
      p.w.close = () => p.w.dispatchEvent(new p.w.Event("pagehide"));
      return p.w;
    },
  };
  f.run("src/miniplayer.ts");
  return {
    ...f,
    windows,
    open: async () => {
      f.w.document.dispatchEvent(new f.w.CustomEvent("toggle-miniplayer"));
      await settle();
      return windows.at(-1);
    },
  };
}
test("reopening restores the selected Queue tab and its content", async (t) => {
  const f = setup(t);
  let p = await f.open();
  p.w.document.querySelector("[data-tab=queue]").click();
  await settle();
  p.w.document.querySelector(".mp-close").click();
  p = await f.open();
  assert.equal(
    p.w.document.querySelector(".mp-tab.active").dataset.tab,
    "queue",
  );
  assert.match(
    p.w.document.querySelector(".mp-tab-pane.active").textContent,
    /Queued track/,
  );
});
test("PiP copies dynamic root variables and tracks changes only while open", async (t) => {
  const f = setup(t),
    root = f.w.document.documentElement;
  root.style.setProperty("--lyrics-accent", "#123456");
  root.style.setProperty("--image_url", 'url("art-a")');
  const p = await f.open(),
    target = p.w.document.documentElement.style;
  assert.equal(target.getPropertyValue("--lyrics-accent"), "#123456");
  assert.equal(target.getPropertyValue("--image_url"), 'url("art-a")');
  root.style.setProperty("--lyrics-accent", "#654321");
  root.style.removeProperty("--image_url");
  await settle();
  assert.equal(target.getPropertyValue("--lyrics-accent"), "#654321");
  assert.equal(target.getPropertyValue("--image_url"), "");
  p.w.document.querySelector(".mp-close").click();
  root.style.setProperty("--lyrics-accent", "#abcdef");
  await settle();
  assert.equal(target.getPropertyValue("--lyrics-accent"), "#654321");
  assert.equal(p.frames.size, 0);
});
test("late lyrics from a closed window do not suppress lyrics in a reopened window", async (t) => {
  const f = setup(t),
    requests = [];
  f.w.fetch = (url) => {
    if (url.includes("githubusercontent")) return Promise.resolve({ok:false,status:404});
    const d = deferred();
    requests.push(d);
    return d.promise;
  };
  let p = await f.open();
  p.w.document.querySelector(".mp-close").click();
  const response = {
    ok: true,
    json: async () => ({ syncedLyrics: "[00:00.00]fresh lyrics" }),
  };
  requests[0].resolve(response);
  await settle();
  p = await f.open();
  assert.match(
    p.w.document.querySelector("[data-pane=lyrics]").textContent,
    /fresh lyrics/,
  );
});
test("concurrent open clicks create one window; rejection uses native fallback", async (t) => {
  const f = setup(t),
    pending = deferred();
  let count = 0,
    nativeClicks = 0;
  f.w.document
    .querySelector("button")
    .addEventListener("click", () => nativeClicks++);
  f.w.documentPictureInPicture.requestWindow = () => {
    count++;
    return pending.promise;
  };
  f.w.document.dispatchEvent(new f.w.CustomEvent("toggle-miniplayer"));
  f.w.document.dispatchEvent(new f.w.CustomEvent("toggle-miniplayer"));
  assert.equal(count, 1);
  // Resolve first open, close, then test a rejected request independently.
  const p = fixture();
  f.windows.push(p);
  p.w.close = () => p.w.dispatchEvent(new p.w.Event("pagehide"));
  pending.resolve(p.w);
  await settle();
  p.w.document.querySelector(".mp-close").click();
  f.w.documentPictureInPicture.requestWindow = async () => {
    throw Error("Unavailable");
  };
  await f.open();
  assert.equal(nativeClicks, 1);
});

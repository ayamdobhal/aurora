const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, deferred, settle } = require("./helpers/runtime.cjs");
function setup(t) {
  const f = fixture('<div id="lyrics-slot"></div>');
  t.after(() => f.dom.window.close());
  return f;
}
const ttml = (text) => ({
  ok: true,
  text: async () =>
    `<tt><body><p begin="00:01.00"><span begin="00:01.00" end="00:02.00">${text}</span></p></body></tt>`,
});
test("AMLL word timing renders and clicking a line seeks", async (t) => {
  const f = setup(t);
  f.w.fetch = async () => ttml("Hello &amp; goodbye");
  f.run("src/lyrics.ts");
  await settle();
  assert.equal(
    f.w.document.querySelector(".lyric-word").textContent,
    "Hello & goodbye",
  );
  f.w.document.querySelector(".lyric-line").click();
  assert.deepEqual(f.calls, [["seek", 1000]]);
});
test("lyrics fall through unavailable providers to Spotify", async (t) => {
  const f = setup(t),
    urls = [];
  f.w.fetch = async (url) => {
    urls.push(url);
    return { ok: false };
  };
  f.w.Spicetify.CosmosAsync.get = async () => ({
    lyrics: {
      syncType: "LINE_SYNCED",
      lines: [{ startTimeMs: "1200", words: "Spotify line" }],
    },
  });
  f.run("src/lyrics.ts");
  await settle();
  assert.equal(urls.length, 2);
  assert.equal(
    f.w.document.querySelector(".lyric-line").textContent,
    "Spotify line",
  );
});
test("out-of-order lyrics requests cannot replace the current track", async (t) => {
  const f = setup(t),
    requests = [];
  f.w.fetch = () => {
    const d = deferred();
    requests.push(d);
    return d.promise;
  };
  f.run("src/lyrics.ts");
  await settle();
  f.player.data.item = { ...f.player.data.item, uri: "spotify:track:b" };
  await f.emit("songchange");
  requests[1].resolve(ttml("Current"));
  await settle();
  requests[0].resolve(ttml("Old"));
  await settle();
  assert.equal(
    f.w.document.querySelector(".lyric-word").textContent,
    "Current",
  );
});
test("replaced slot keeps the new progress loop after an old request completes", async (t) => {
  const f = setup(t),
    requests = [];
  f.w.fetch = () => {
    const d = deferred();
    requests.push(d);
    return d.promise;
  };
  f.run("src/lyrics.ts");
  await settle();
  const old = f.w.document.querySelector("#lyrics-slot");
  old.remove();
  const fresh = f.w.document.createElement("div");
  fresh.id = "lyrics-slot";
  f.w.document.body.append(fresh);
  await f.frame();
  assert.equal(requests.length, 1, "replacement shares the in-flight track request");
  requests[0].resolve(ttml("Fresh"));
  await settle();
  await f.frame();
  assert.equal(fresh.querySelector(".lyric-word").textContent, "Fresh");
  assert.ok(fresh.querySelector(".lyric-line.active"));
  assert.equal(old.querySelector(".lyric-word"), null);
});

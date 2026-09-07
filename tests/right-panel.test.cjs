const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, settle } = require("./helpers/runtime.cjs");
const track = (id) => ({
  uri: "spotify:track:" + id,
  uid: id,
  metadata: { title: id, artist_name: "Artist" },
});
async function setup(t) {
  const f = fixture('<div class="Root__right-sidebar"></div>');
  t.after(() => f.dom.window.close());
  const state = {
    queue: { queued: [track("a")], nextUp: [track("b")] },
    devices: [
      { id: "local", name: "Computer", isActive: true, type: "computer" },
    ],
    history: [],
  };
  f.w.Spicetify.Platform.PlayerAPI = { getQueue: async () => state.queue };
  f.w.Spicetify.Platform.ConnectAPI = { getDevices: async () => state.devices };
  f.w.Spicetify.Platform.RecentsAPI = {
    getContents: async () => state.history,
  };
  f.run("src/right-panel.ts");
  await settle();
  return {
    ...f,
    state,
    refresh: async (delay) => {
      f.intervals.find((x) => x.delay === delay).fn();
      await settle();
    },
  };
}
test("devices render after sidebar removal even when device state is unchanged", async (t) => {
  const f = await setup(t);
  assert.equal(f.w.document.querySelectorAll(".crp-device-row").length, 1);
  f.w.document.querySelector("#custom-right-panel").remove();
  await f.frame();
  assert.equal(f.w.document.querySelectorAll(".crp-device-row").length, 1);
});
test("late sidebar mounting renders previously fetched devices", async (t) => {
  const f = fixture();
  t.after(() => f.dom.window.close());
  f.w.Spicetify.Platform.ConnectAPI = {
    getDevices: async () => [{ id: "x", name: "Phone", type: "smartphone" }],
  };
  f.run("src/right-panel.ts");
  await settle();
  f.w.document.body.innerHTML = '<div class="Root__right-sidebar"></div>';
  await f.frame();
  assert.equal(
    f.w.document.querySelector(".crp-device-row .crp-list-name").textContent,
    "Phone",
  );
});
test("device renames update without changing identity or active state", async (t) => {
  const f = await setup(t);
  f.state.devices[0].name = "Renamed";
  await f.refresh(5000);
  assert.equal(
    f.w.document.querySelector(".crp-device-row .crp-list-name").textContent,
    "Renamed",
  );
});
test("queue divider updates when provider split changes but ordering does not", async (t) => {
  const f = await setup(t);
  assert.ok(f.w.document.querySelector(".crp-queue-divider"));
  f.state.queue = { queued: [], nextUp: [track("a"), track("b")] };
  await f.refresh(2000);
  assert.equal(f.w.document.querySelector(".crp-queue-divider"), null);
});
test("recent pagination counts tracks, skips episodes, and preserves scroll position", async (t) => {
  const f = await setup(t);
  f.state.history = Array.from({ length: 90 }, (_, i) =>
    i % 3 === 0 ? { uri: "spotify:episode:" + i } : track(String(i)),
  );
  f.w.document.querySelector("#custom-right-panel").remove();
  await f.frame();
  assert.equal(
    f.w.document.querySelectorAll(".crp-recent-list .crp-list-row").length,
    30,
  );
  const pane = f.w.document.querySelector("[data-pane=recent]");
  pane.scrollTop = 100;
  pane.dispatchEvent(new f.w.Event("scroll"));
  await f.frame();
  assert.equal(
    f.w.document.querySelectorAll(".crp-recent-list .crp-list-row").length,
    60,
  );
  assert.equal(pane.scrollTop, 100);
});

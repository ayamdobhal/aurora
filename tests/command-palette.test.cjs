const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fixture, deferred, settle } = require("./helpers/runtime.cjs");
function setup(t) {
  const f = fixture();
  t.after(() => f.dom.window.close());
  const requests = [];
  f.w.Spicetify.GraphQL = {
    Definitions: { searchModalResults: {} },
    Request: (_, vars) => {
      const d = deferred();
      requests.push({ ...d, query: vars.searchTerm });
      return d.promise;
    },
  };
  f.run("src/command-palette.ts");
  f.key("k", { ctrlKey: true });
  const input = f.w.document.querySelector("#cmd-input");
  return {
    ...f,
    requests,
    input,
    type: async (query) => {
      input.value = query;
      input.dispatchEvent(new f.w.Event("input"));
      await f.timersRun();
    },
    text: () => f.w.document.querySelector("#cmd-results").textContent,
  };
}
function response(name, type = "Track") {
  return {
    data: {
      searchV2: {
        topResultsV2: {
          itemsV2: [
            {
              item: {
                __typename: type + "ResponseWrapper",
                data: {
                  uri: "spotify:" + type.toLowerCase() + ":" + name,
                  name,
                },
              },
            },
          ],
        },
      },
    },
  };
}
test("late search results cannot overwrite newer results, including a cache hit", async (t) => {
  const f = setup(t);
  await f.type("first");
  await f.type("second");
  f.requests[1].resolve(response("second"));
  await settle();
  f.requests[0].resolve(response("first"));
  await settle();
  assert.match(f.text(), /second/);
  assert.doesNotMatch(f.text(), /first/);
  await f.type("third");
  await f.type("first");
  f.requests[2].resolve(response("third"));
  await settle();
  assert.match(f.text(), /first/);
  assert.doesNotMatch(f.text(), /third/);
});
test("clearing input invalidates in-flight requests", async (t) => {
  const f = setup(t);
  await f.type("old");
  await f.type("");
  f.requests[0].resolve(response("old"));
  await settle();
  assert.equal(f.text(), "");
});
test("closing and reopening cancels pending debounce and in-flight results", async (t) => {
  const f = setup(t);
  await f.type("old");
  f.key("k", { ctrlKey: true });
  f.key("k", { ctrlKey: true });
  f.requests[0].resolve(response("old"));
  await settle();
  assert.equal(f.text(), "");
  f.input.value = "pending";
  f.input.dispatchEvent(new f.w.Event("input"));
  f.key("k", { ctrlKey: true });
  await f.timersRun();
  assert.equal(f.requests.length, 1);
});
test("Enter plays tracks and navigates albums", async (t) => {
  const f = setup(t);
  await f.type("song");
  f.requests[0].resolve(response("song"));
  await settle();
  f.input.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual(f.calls, [["play", "spotify:track:song"]]);
  f.key("k", { ctrlKey: true });
  await f.type("album");
  f.requests[1].resolve(response("album", "Album"));
  await settle();
  f.input.dispatchEvent(new f.w.KeyboardEvent("keydown", { key: "Enter" }));
  assert.deepEqual(f.calls[1], ["navigate", "/album/album"]);
});

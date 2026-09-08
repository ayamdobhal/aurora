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
test("Enter plays tracks and albums", async (t) => {
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
  await settle();
  assert.deepEqual(f.calls[1], ["play", "spotify:album:album"]);
});

function mixedResponse(...entries) {
 return {data:{searchV2:{topResultsV2:{itemsV2:entries.flatMap(([name,type])=>response(name,type).data.searchV2.topResultsV2.itemsV2)}}}};
}
test('hover and arrow navigation preview collections without playback; click activates the selected result',async(t)=>{
 const f=setup(t),previews=[];
 f.w.Spicetify.GraphQL.Definitions.queryAlbumTracks={album:true};
 const search=f.w.Spicetify.GraphQL.Request;
 f.w.Spicetify.GraphQL.Request=(def,vars)=>{if(!def.album)return search(def,vars);const d=deferred();previews.push({...d,uri:vars.uri});return d.promise};
 await f.type('mixed');f.requests[0].resolve(mixedResponse(['song','Track'],['album','Album'],['artist','Artist']));await settle();
 const rows=f.w.document.querySelectorAll('.cmd-result');rows[1].dispatchEvent(new f.w.Event('pointermove'));await f.timersRun();
 assert.equal(previews.length,1);assert.deepEqual(f.calls,[]);assert.equal(f.input.getAttribute('aria-activedescendant'),'cmd-option-1');
 previews[0].resolve({data:{albumUnion:{tracksV2:{totalCount:1,items:[{track:{uri:'spotify:track:inside',name:'Inside album',duration:{totalMilliseconds:123000}}}]}}}});await settle();
 assert.match(f.w.document.querySelector('.cmd-preview').textContent,/Inside album/);
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown'}));assert.match(f.w.document.querySelector('.cmd-preview h2').textContent,/artist/);assert.deepEqual(f.calls,[]);
 rows[0].click();await settle();assert.deepEqual(f.calls,[['play','spotify:track:song']]);
});
test('leaving a hovered row cancels its preview and keyboard navigation wins over pending hover',async(t)=>{
 const f=setup(t);await f.type('mixed');f.requests[0].resolve(mixedResponse(['one','Track'],['two','Track'],['three','Track']));await settle();
 const rows=f.w.document.querySelectorAll('.cmd-result');
 rows[2].dispatchEvent(new f.w.Event('pointermove'));rows[2].dispatchEvent(new f.w.Event('pointerleave'));await f.timersRun();assert.equal(f.input.getAttribute('aria-activedescendant'),'cmd-option-0');
 rows[2].dispatchEvent(new f.w.Event('pointermove'));f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown'}));await f.timersRun();assert.equal(f.input.getAttribute('aria-activedescendant'),'cmd-option-1');
});
test('late collection previews cannot replace a new selection or reopened search',async(t)=>{
 const f=setup(t),jobs=[];f.w.Spicetify.Platform.PlaylistAPI={getContents:()=>{const d=deferred();jobs.push(d);return d.promise}};
 await f.type('mixed');f.requests[0].resolve(mixedResponse(['list','Playlist'],['song','Track']));await settle();
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown'}));jobs[0].resolve({items:[{uri:'spotify:track:old',name:'Old playlist track'}]});await settle();assert.doesNotMatch(f.w.document.querySelector('.cmd-preview').textContent,/Old playlist track/);
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowUp'}));f.key('k',{ctrlKey:true});f.key('k',{ctrlKey:true});jobs[1].resolve({items:[{uri:'spotify:track:old',name:'Old playlist track'}]});await settle();assert.doesNotMatch(f.w.document.querySelector('.cmd-preview').textContent,/Old playlist track/);
});
test('filters keep selection valid and empty filtered results cannot play a hidden result',async(t)=>{
 const f=setup(t);await f.type('mixed');f.requests[0].resolve(mixedResponse(['song','Track'],['artist','Artist']));await settle();
 f.w.document.querySelector('[data-filter="album"]').click();assert.match(f.text(),/No albums/);assert.equal(f.input.hasAttribute('aria-activedescendant'),false);
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter'}));assert.deepEqual(f.calls,[]);
 f.w.document.querySelector('[data-filter="artist"]').click();assert.match(f.text(),/artist/);assert.doesNotMatch(f.text(),/song/);
 f.w.document.querySelector('.cmd-result').click();await settle();assert.deepEqual(f.calls,[['play','spotify:artist:artist']]);
});
test('activated searches are remembered locally and can be recalled and cleared',async(t)=>{
 const f=setup(t);await f.type('song');f.requests[0].resolve(response('song'));await settle();f.w.document.querySelector('.cmd-result').click();await settle();
 assert.deepEqual(JSON.parse(f.w.localStorage.getItem('aurora.searches')),['song']);f.key('k',{ctrlKey:true});
 f.w.document.querySelector('.cmd-recent').click();await f.timersRun();assert.match(f.text(),/song/);
 await f.type('');f.w.document.querySelector('.cmd-recents .cmd-clear').click();assert.equal(f.w.localStorage.getItem('aurora.searches'),null);assert.equal(f.w.document.activeElement,f.input);
});
test('unavailable preview offers retry, timeout is bounded, and opening remains available',async(t)=>{
 const f=setup(t);let n=0;f.w.Spicetify.Platform.PlaylistAPI={getContents:()=>{n++;return new Promise(()=>{})}};
 await f.type('list');f.requests[0].resolve(response('list','Playlist'));await settle();await f.timersRun();
 assert.match(f.w.document.querySelector('.cmd-preview').textContent,/Couldn’t load/);f.w.document.querySelector('.cmd-preview .cmd-clear').click();assert.equal(n,2);
 [...f.w.document.querySelectorAll('.cmd-preview-actions button')].find(b=>b.textContent==='Open playlist').click();assert.deepEqual(f.calls,[['navigate','/playlist/list']]);
});
test('preview content and artwork URLs cannot inject markup',async(t)=>{
 const f=setup(t);await f.type('unsafe');const r=response('<img onerror=bad>');r.data.searchV2.topResultsV2.itemsV2[0].item.data.albumOfTrack={coverArt:{sources:[{url:'https://example.test/" onerror="bad'}]}};f.requests[0].resolve(r);await settle();
 assert.equal(f.w.document.querySelector('[onerror]'),null);assert.match(f.text(),/<img onerror=bad>/);
});
test('queue action reports failures without closing search or starting playback',async(t)=>{
 const f=setup(t);let fail=true;f.w.Spicetify.Platform.PlayerAPI={addToQueue:async()=>{if(fail)throw Error('offline')}};
 await f.type('song');f.requests[0].resolve(response('song'));await settle();
 const b=[...f.w.document.querySelectorAll('.cmd-preview-actions button')].find(b=>b.textContent==='Add to queue');b.click();await settle();assert.match(f.w.document.querySelector('.cmd-feedback').textContent,/Couldn’t add/);assert.equal(b.disabled,false);
 fail=false;b.click();await settle();assert.match(f.w.document.querySelector('.cmd-feedback').textContent,/Added to queue/);assert.deepEqual(f.calls,[]);
});
test('click plays a playlist, while a failed play leaves the palette available',async(t)=>{
 const f=setup(t);await f.type('list');f.requests[0].resolve(response('list','Playlist'));await settle();
 f.player.playUri=async()=>{throw Error('offline')};f.w.document.querySelector('.cmd-result').click();await settle();assert.match(f.w.document.querySelector('.cmd-feedback').textContent,/Couldn’t start/);assert.equal(f.w.document.querySelector('#command-palette').classList.contains('hidden'),false);
 f.player.playUri=async uri=>f.calls.push(['play',uri]);f.w.document.querySelector('.cmd-result').click();await settle();assert.deepEqual(f.calls,[['play','spotify:playlist:list']]);
});
test('a changed Spotify search response reports an error instead of claiming no results',async(t)=>{
 const f=setup(t);await f.type('broken');f.requests[0].resolve({data:{searchV2:{}}});await settle();assert.match(f.text(),/Search failed/);assert.ok(f.w.document.querySelector('#cmd-results button'));
});

for (const type of ['Track','Album','Playlist','Artist']) {
 test(`Ctrl/Cmd+O opens ${type} without playing; Enter plays it`,async(t)=>{
  const f=setup(t);await f.type('result');f.requests[0].resolve(response('result',type));await settle();
  f.key('o',type === 'Track' ? {metaKey:true} : {ctrlKey:true});
  assert.deepEqual(f.calls,[['navigate','/'+type.toLowerCase()+'/result']]);
  f.key('k',{ctrlKey:true});await f.type('result');
  f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter'}));await settle();
  assert.deepEqual(f.calls[1],['play','spotify:'+type.toLowerCase()+':result']);
 });
}

test('Shift+Enter and Shift+click queue without playing, navigating or closing',async(t)=>{
 const f=setup(t),queued=[];f.w.Spicetify.Platform.PlayerAPI={addToQueue:async tracks=>queued.push(Array.from(tracks,t=>t.uri))};
 await f.type('song');f.requests[0].resolve(response('song'));await settle();
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true}));await settle();
 f.w.document.querySelector('.cmd-result').dispatchEvent(new f.w.MouseEvent('click',{shiftKey:true}));await settle();
 assert.deepEqual(queued,[['spotify:track:song'],['spotify:track:song']]);assert.deepEqual(f.calls,[]);assert.equal(f.w.document.querySelector('#command-palette').classList.contains('hidden'),false);
});
test('pending queue requests ignore repeated gestures and do not report success on a new selection',async(t)=>{
 const f=setup(t),job=deferred();let count=0;f.w.Spicetify.Platform.PlayerAPI={addToQueue:()=>{count++;return job.promise}};
 await f.type('songs');f.requests[0].resolve(mixedResponse(['one','Track'],['two','Track']));await settle();
 const event=()=>new f.w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true});f.input.dispatchEvent(event());f.input.dispatchEvent(event());await settle();assert.equal(count,1);
 f.input.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'ArrowDown'}));job.resolve();await settle();assert.equal(f.w.document.querySelector('.cmd-feedback').textContent,'');assert.deepEqual(f.calls,[]);
});

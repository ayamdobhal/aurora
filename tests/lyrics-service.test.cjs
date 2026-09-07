const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture,deferred,settle}=require('./helpers/runtime.cjs');const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/lyrics-service.ts'],bundle:true,write:false,format:'iife',globalName:'Service'}).outputFiles[0].text;
test('concurrent views share requests; instrumental and failure stay distinct',async()=>{
 const f=fixture();try{const p=f.w.eval(code+';Service;');let calls=0;f.w.fetch=async()=>{calls++;return {ok:true,json:async()=>({instrumental:true})}};
 const [a,b]=await Promise.all([p.requestLyrics(f.player.data.item,'lrclib'),p.requestLyrics(f.player.data.item,'lrclib')]);
 assert.equal(calls,1);assert.equal(a.lyrics.type,'instrumental');assert.equal(b.lyrics.type,'instrumental');
 p.invalidateLyrics(f.player.data.item.uri);f.w.fetch=async()=>{throw Error('offline')};
 assert.equal((await p.requestLyrics(f.player.data.item,'lrclib')).lyrics.type,'error');
 f.w.fetch=async()=>({ok:false,status:404});assert.equal((await p.requestLyrics(f.player.data.item,'lrclib')).lyrics.type,'none');
 }finally{f.dom.window.close()}
});
test('explicit retry cannot be overwritten in the shared cache by an older response',async()=>{
 const f=fixture();try{const p=f.w.eval(code+';Service;'),req=[];f.w.fetch=()=>{const d=deferred();req.push(d);return d.promise};
 const a=p.requestLyrics(f.player.data.item,'lrclib');p.invalidateLyrics(f.player.data.item.uri);const b=p.requestLyrics(f.player.data.item,'lrclib');
 req[1].resolve({ok:true,json:async()=>({plainLyrics:'new'})});await b;req[0].resolve({ok:true,json:async()=>({plainLyrics:'old'})});await a;await settle();
 assert.equal((await p.requestLyrics(f.player.data.item,'lrclib')).lyrics.text,'new');
 assert.equal(p.parseTtml('<bad').length,0);assert.equal(p.parseLrc('[bad]x\n[00:02.00]two\n[00:01.00]one')[0].text,'one');
 }finally{f.dom.window.close()}
});

test('slow response bodies time out and malformed word timing is normalized',async()=>{
 const f=fixture();try{
 const p=f.w.eval(code+';Service;');f.w.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});const result=p.requestLyrics(f.player.data.item,'lrclib');await settle();await f.timersRun();assert.equal((await result).lyrics.type,'error');
 const lines=p.parseTtml('<tt><p begin="1000ms"><span begin="bad">Bad</span><span begin="2s" end="1s">Good</span></p></tt>');assert.equal(lines[0].time,1);assert.equal(lines[0].words.length,1);assert.ok(lines[0].words[0].endTime>2);
 f.w.Spicetify.CosmosAsync.get=async()=>({lyrics:{syncType:'LINE_SYNCED',lines:[{startTimeMs:'bad',words:'bad'},{startTimeMs:'2000',words:'second'},{startTimeMs:'1000',words:'first'}]}});
 const spotify=await p.requestLyrics(f.player.data.item,'spotify');assert.equal(spotify.lyrics.lines[0].text,'first');assert.equal(spotify.lyrics.lines.length,2);
 }finally{f.dom.window.close()}
});

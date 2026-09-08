const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture}=require('./helpers/runtime.cjs');const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/search-preview.ts'],bundle:true,write:false,format:'iife',globalName:'Preview'}).outputFiles[0].text;
test('album and playlist contracts normalize artist, duration, availability and preview limits',async()=>{
 const f=fixture();try{
 const api=f.w.eval(code+';Preview;');let vars;
 f.w.Spicetify.GraphQL={Definitions:{queryAlbumTracks:{}},Request:async(_,v)=>{vars=v;return{data:{albumUnion:{tracksV2:{totalCount:30,items:[{track:{uri:'spotify:track:a',name:'A',artists:{items:[{profile:{name:'Artist'}}]},duration:{totalMilliseconds:123000},playability:{playable:false}}}]}}}}}};
 const a=await api.loadSearchPreview('album','spotify:album:a');assert.equal(a.tracks[0].artist,'Artist');assert.equal(a.tracks[0].duration,123000);assert.equal(a.tracks[0].playable,false);assert.equal(a.total,30);assert.equal(vars.limit,12);
 f.w.Spicetify.Platform.PlaylistAPI={getContents:async()=>({totalLength:50,items:[null,{uri:'spotify:episode:no'},...Array.from({length:20},(_,i)=>({uri:'spotify:track:'+i,name:'Track',artists:[{name:'Artist'}],duration:{milliseconds:1000},isPlayable:false}))]})};
 const p=await api.loadSearchPreview('playlist','spotify:playlist:a');assert.equal(p.tracks.length,12);assert.equal(p.total,50);assert.equal(p.tracks[0].artist,'Artist');assert.equal(p.tracks[0].playable,false);
 f.w.Spicetify.Platform.PlaylistAPI.getContents=async()=>({});await assert.rejects(api.loadSearchPreview('playlist','spotify:playlist:a'));
 }finally{f.dom.window.close()}
});
test('queue resolution fetches every collection page in order and excludes unplayable entries',async()=>{
 const f=fixture();try{
 const api=f.w.eval(code+';Preview;'),offsets=[];
 f.w.Spicetify.Platform.PlaylistAPI={getContents:async(_,options)=>{offsets.push(options.offset);return{totalLength:102,items:Array.from({length:options.offset===0?100:2},(_,i)=>({uri:'spotify:track:'+(options.offset+i),name:'Song',isPlayable:options.offset+i!==1}))}}};
 const tracks=await api.searchQueueTracks('playlist','spotify:playlist:a');assert.deepEqual(offsets,[0,100]);assert.equal(tracks.length,101);assert.equal(tracks[0].uri,'spotify:track:0');assert.equal(tracks[1].uri,'spotify:track:2');assert.equal(tracks.at(-1).uri,'spotify:track:101');
 f.w.Spicetify.Platform.PlaylistAPI.getContents=async(_,options)=>{if(options.offset)throw Error('offline');return{totalLength:102,items:[{uri:'spotify:track:a'}]}};
 await assert.rejects(api.searchQueueTracks('playlist','spotify:playlist:a'));
 }finally{f.dom.window.close()}
});

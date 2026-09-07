const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture,settle}=require('./helpers/runtime.cjs');const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/lyrics-view.ts'],bundle:true,write:false,format:'iife',globalName:'View'}).outputFiles[0].text;
test('manual reading suspends follow, return resumes, offsets seek consistently, disposal stops work',async()=>{
 const f=fixture('<div id="view"></div>');try{
 f.w.fetch=async()=>({ok:true,text:async()=>'<tt><p begin="1s">First</p><p begin="2s">Second</p></tt>'});
 const {mountLyricsView}=f.w.eval(code+';View;');let scrolls=0;f.w.HTMLElement.prototype.scrollIntoView=()=>scrolls++;
 let ms=1000;f.player.getProgress=()=>ms;const root=f.w.document.querySelector('#view');const view=mountLyricsView(root);await settle();assert.equal(scrolls,1);
 root.querySelector('.lyrics-content').dispatchEvent(new f.w.Event('wheel'));ms=2000;await f.emit('onprogress');assert.equal(scrolls,1);assert.equal(root.querySelector('.lyrics-follow').hidden,false);
 root.querySelector('.lyrics-follow').click();assert.equal(scrolls,2);
 root.querySelector('[data-offset="50"]').click();root.querySelectorAll('.lyric-line')[1].click();assert.deepEqual(f.calls.at(-1),['seek',1950]);
 assert.equal(f.frames.size,0,'paused lyrics schedule no continuous frames');view.dispose();assert.equal(f.w.__auroraLyricsViews.views.size,0);
 }finally{f.dom.window.close()}
});

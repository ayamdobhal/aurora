const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture,deferred,settle}=require('./helpers/runtime.cjs');
const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/artwork.ts'],bundle:true,write:false,format:'iife',globalName:'Art'}).outputFiles[0].text;
test('artwork waits for decode, avoids redundant swaps and ignores obsolete covers',async()=>{
 const f=fixture('<img id="cover" src="https://example.test/initial">');try{
 const jobs=[];f.w.Image=class{constructor(){this.job=deferred();jobs.push(this)}decode(){return this.job.promise}set src(v){this.url=v}};
 const a=f.w.eval(code+';Art;'),img=f.w.document.querySelector('img');
 a.syncArtwork(img,'https://example.test/a');a.syncArtwork(img,'https://example.test/a');assert.equal(jobs.length,1);assert.match(img.src,/initial/);
 a.syncArtwork(img,'https://example.test/b');jobs[1].job.resolve();await settle();assert.match(img.src,/\/b$/);
 jobs[0].job.resolve();await settle();assert.match(img.src,/\/b$/);
 let mutations=0;new f.w.MutationObserver(()=>mutations++).observe(img,{attributes:true});a.syncArtwork(img,'https://example.test/b');await settle();assert.equal(mutations,0);
 a.syncArtwork(img,'');assert.equal(img.hasAttribute('src'),false);
 }finally{f.dom.window.close()}
});
test('failed or detached artwork cannot repaint an obsolete player',async()=>{
 const f=fixture('<img>');try{
 let image;f.w.Image=class{constructor(){image=this}set src(v){}};const a=f.w.eval(code+';Art;'),img=f.w.document.querySelector('img');
 a.syncArtwork(img,'https://example.test/broken');image.onerror();await settle();assert.equal(img.hasAttribute('src'),false);
 a.syncArtwork(img,'https://example.test/next');img.remove();image.onload();await settle();assert.equal(img.hasAttribute('src'),false);
 }finally{f.dom.window.close()}
});

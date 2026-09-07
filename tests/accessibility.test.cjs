const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/runtime.cjs');
const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/accessibility.ts'],bundle:true,write:false,format:'iife',globalName:'Access'}).outputFiles[0].text;
test('modal traps forward and reverse Tab, Escape closes and restores its opener',()=>{
 const f=fixture('<button id="open">Open</button><div id="modal"><input><button hidden>Hidden</button><button id="last">Last</button></div>');try{
 const a=f.w.eval(code+';Access;'),d=f.w.document,opener=d.querySelector('#open'),root=d.querySelector('#modal');opener.focus();let release,closed=0;release=a.modalFocus(root,()=>{closed++;release()});
 const key=(k,shift=false)=>d.activeElement.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:k,shiftKey:shift,bubbles:true,cancelable:true}));
 assert.equal(d.activeElement.tagName,'INPUT');key('Tab',true);assert.equal(d.activeElement.id,'last');key('Tab');assert.equal(d.activeElement.tagName,'INPUT');key('Escape');assert.equal(closed,1);assert.equal(d.activeElement,opener);assert.equal(root.getAttribute('aria-modal'),'true');
 }finally{f.dom.window.close()}
});
test('sliders clamp keyboard input and tabs move selection with roving focus',()=>{
 const f=fixture('<div id="slider"></div><div class="mp-tab-bar"><button class="mp-tab" data-tab="lyrics">Lyrics</button><button class="mp-tab" data-tab="queue">Queue</button></div><div class="mp-tab-pane" data-pane="lyrics"></div><div class="mp-tab-pane" data-pane="queue"></div>');try{
 const a=f.w.eval(code+';Access;'),d=f.w.document,slider=d.querySelector('#slider');let value=95;a.wireSlider(slider,'Volume',()=>value,()=>100,n=>value=n,10);
 const key=(el,k)=>el.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));key(slider,'ArrowRight');assert.equal(value,100);key(slider,'Home');assert.equal(value,0);assert.equal(slider.getAttribute('aria-valuenow'),'0');
 d.querySelectorAll('.mp-tab').forEach(t=>t.onclick=()=>a.syncTabs(d.body,'mp',t.dataset.tab));a.syncTabs(d.body,'mp','lyrics');key(d.querySelector('.mp-tab'),'ArrowLeft');assert.equal(d.activeElement.dataset.tab,'queue');assert.equal(d.activeElement.getAttribute('aria-selected'),'true');assert.equal(d.querySelector('.mp-tab-bar').getAttribute('role'),'tablist');
 }finally{f.dom.window.close()}
});

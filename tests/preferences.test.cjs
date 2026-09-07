const {test}=require('node:test');const assert=require('node:assert/strict');const {fixture}=require('./helpers/runtime.cjs');const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/lib/preferences.ts'],bundle:true,write:false,format:'iife',globalName:'Prefs'}).outputFiles[0].text;
test('preferences validate corruption, bound offsets and share updates across bundles',()=>{
 const f=fixture();try{
 f.w.localStorage.setItem('aurora:preferences:v1','broken');const p=f.w.eval(code+';Prefs;');
 assert.equal(p.preferences().provider,'auto');p.savePreferences({sidebar:'friends',miniExpanded:false});
 for(let i=0;i<205;i++)p.setTrackOffset(i===204?99999:i,'spotify:track:'+i);
 assert.equal(Object.keys(p.preferences().offsets).length,200);assert.equal(p.trackOffset('spotify:track:204'),10000);assert.equal(p.trackOffset('spotify:track:0'),0);
 const other=f.w.eval(code+';Prefs;');assert.equal(other.preferences().sidebar,'friends');assert.equal(other.preferences().miniExpanded,false);
 delete f.w.__auroraPreferences;assert.equal(p.preferences().sidebar,'friends');
 p.savePreferences({provider:'invalid'});assert.equal(p.preferences().provider,'auto');
 }finally{f.dom.window.close();}
});

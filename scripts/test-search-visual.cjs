const {chromium}=require('playwright');
const {buildSync}=require('esbuild');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 try{
  for(const [width,height] of [[1200,850],[600,800],[390,680]]){
   const page=await browser.newPage({viewport:{width,height}});
   await page.route('https://example.test/',route=>route.fulfill({body:'<!doctype html><html></html>',contentType:'text/html'}));
   await page.goto('https://example.test/');
   await page.setContent('<!doctype html><button id="before">Spotify</button>');
   await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
   await page.evaluate(()=>{
    document.documentElement.style.setProperty('--aurora-accent-fill','#b28a57');document.documentElement.style.setProperty('--aurora-accent-text','#e3c394');document.documentElement.style.setProperty('--aurora-on-accent','#111111');
    const art='https://fixture.test/art.svg';
    const entries=[['Track','Stockholm Syndrome'],['Album','Absolution'],['Playlist','Late night listening'],['Artist','Muse']];
    window.actions=[];
    const tracks = Array.from({length:12},(_,i)=>({uri:'spotify:track:'+i,name:['Intro','Apocalypse Please','Time Is Running Out','Sing for Absolution','Stockholm Syndrome'][i%5],artists:{items:[{profile:{name:'Muse'}}]},duration:{totalMilliseconds:245000}}));
    const itemsV2 = entries.map(([type,name])=>({item:{__typename:type+'ResponseWrapper',data:{uri:'spotify:'+type.toLowerCase()+':fixture',name,profile:{name},artists:{items:[{profile:{name:'Muse'}}]},coverArt:{sources:[{url:art}]},albumOfTrack:{coverArt:{sources:[{url:art}]}},visuals:{avatarImage:{sources:[{url:art}]}},images:{items:[{sources:[{url:art}]}]}}}}));
    window.Spicetify = {
      Player:{playUri:async(uri)=>window.actions.push(uri)}, CosmosAsync:{},
      Platform:{
        History:{push:uri=>window.actions.push(uri)},
        PlaylistAPI:{getContents:async()=>({totalLength:40,items:tracks})},
        PlayerAPI:{addToQueue:async()=>{}}
      },
      GraphQL:{Definitions:{searchModalResults:{},queryAlbumTracks:{album:true}},Request:async(def)=>def.album
        ? {data:{albumUnion:{tracksV2:{totalCount:14,items:tracks.map(track=>({track}))}}}}
        : {data:{searchV2:{topResultsV2:{itemsV2}}}}
      }
    };
   });
   await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#9c876c"/><path d="M0 160L200 20V200H0" fill="#353b46"/><circle cx="65" cy="65" r="30" fill="#d6c3a0"/></svg>'}));
   await page.addScriptTag({content:buildSync({entryPoints:['src/command-palette.ts'],bundle:true,write:false,format:'iife'}).outputFiles[0].text});
   await page.locator('#before').focus();await page.keyboard.press('Control+k');await page.locator('#cmd-input').fill('muse');await page.locator('.cmd-result').nth(1).waitFor();
   await page.locator('.cmd-result').nth(1).hover();await page.locator('.cmd-preview-track').first().waitFor();
   assert.equal(await page.locator('.cmd-preview h2').textContent(),'Absolution');assert.deepEqual(await page.evaluate(()=>window.actions),[]);
   assert.ok(await page.locator('.cmd-modal').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth}));
   assert.ok(await page.locator('.cmd-footer').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.cmd-modal').getBoundingClientRect();return r.bottom<=p.bottom&&r.top>p.top}));
   const layout=await page.evaluate(()=>{const a=document.querySelector('.cmd-matches').getBoundingClientRect(),b=document.querySelector('.cmd-preview').getBoundingClientRect();return{side:b.left>=a.right-1,stack:b.top>=a.bottom-1}});assert.equal(width>680?layout.side:layout.stack,true);
   await page.locator('#cmd-input').focus();await page.keyboard.press('ArrowDown');await page.waitForFunction(()=>document.querySelector('.cmd-preview h2')?.textContent==='Late night listening');
   await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement.closest('.cmd-modal')!==null));
   await page.locator('[data-filter="album"]').click();assert.equal(await page.locator('.cmd-result').count(),1);
   await page.locator('.cmd-preview-track').first().waitFor();
   assert.equal(await page.locator('[data-filter="album"]').getAttribute('aria-pressed'),'true');
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-filter="album"]')).color==='rgb(227, 195, 148)');
   fs.mkdirSync('reports/search',{recursive:true});await page.screenshot({path:`reports/search/palette-${width}.png`});
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.cmd-modal').evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.keyboard.press('Escape');assert.equal(await page.locator('.cmd-modal').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'before');
   await page.close();
  }
  console.log('Passed search hover/keyboard previews, filters, focus restoration, reduced motion and responsive layout at three sizes.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

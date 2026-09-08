const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const {buildSync}=require('esbuild');
const vm=require('node:vm');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const code=buildSync({entryPoints:['src/lib/colors.ts'],bundle:true,write:false,format:'iife',globalName:'Colors'}).outputFiles[0].text;
const colors=vm.runInNewContext(code+';Colors;');
(async()=>{
 const browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
 try {
  const page=await browser.newPage();
  for(const sibling of [false,'scroll','plain'])for(const width of [440,900])for(const background of ['#ffffff','#9aebbc','#111111']) {
   await page.setViewportSize({width,height:650});
   await page.setContent(`<!doctype html><style>
    body{margin:0;background:#17191c;font-family:Arial;color:#f5f6f7}
    .fixture{position:relative;height:360px;background:${background}}
    .main-entityHeader-container{position:relative;height:360px}
    .main-entityHeader-contentWrapper{height:100%}
    .main-entityHeader-headerText{position:absolute;inset:36% 20px 20px;display:flex;flex-direction:column;justify-content:space-between}
    h1{margin:0;font-size:48px;line-height:1.05}p{margin:0;font-size:14px}
    .meta{color:#c4c8cf}.main-entityHeader-overlay{position:absolute;inset:0;background:linear-gradient(transparent,#0008)}
    #plain{height:80px}
   </style><div class="fixture"><div class="main-entityHeader-overlay"></div><div class="main-entityHeader-container main-entityHeader-withBackgroundImage"><div class="main-entityHeader-contentWrapper"><div class="main-entityHeader-headerText"><p id="pretitle">Public Playlist</p><h1>White artwork Radio</h1><p class="meta">Made for you · 50 songs</p><a href="#" class="meta">About recommendations</a></div></div></div></div><div id="plain" class="main-entityHeader-container"><div class="main-entityHeader-contentWrapper">An ordinary album header</div></div>`);
   await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
   if (sibling) await page.evaluate(({background,sibling})=>{
     const fixture=document.querySelector('.fixture');fixture.classList.add('Root__main-view');
     const wrap=document.createElement('div');if(sibling==='scroll')wrap.style.setProperty('--scroll','0');
     const image=document.createElement('div');image.style.cssText=`position:absolute;inset:0;background-image:linear-gradient(${background},${background});transform:scale(1.1)`;
     const color=document.createElement('div');color.style.cssText='--background-base:#fff;--background-elevated-base:#fff';
     wrap.append(image,color);fixture.prepend(wrap);
   },{background,sibling});
   const samples=await page.locator('.main-entityHeader-headerText > *').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:Math.floor(r.left+5),y:Math.floor(r.top+r.height/2),color:getComputedStyle(e).color.match(/[\d.]+/g).slice(0,3).map(Number)}}));
   // Sample the actual composited background beneath text without sampling glyph pixels.
   await page.locator('.main-entityHeader-headerText').evaluate(e=>e.style.visibility='hidden');
   const png=PNG.sync.read(await page.screenshot());
   for(const sample of samples){const i=(sample.y*png.width+sample.x)*4;const bg=[...png.data.slice(i,i+3)];assert.ok(colors.contrast(sample.color,bg)>=4.5,`header text contrast ${background} at ${width}px`)}
   if(sibling){const i=(368*png.width+20)*4;assert.ok(colors.contrast([245,246,247],[...png.data.slice(i,i+3)])>=4.5,'zoomed image below the header remains shaded without relying on scroll attributes')}
   const top=[...png.data.slice((5*png.width+5)*4,(5*png.width+5)*4+3)];
   if(background==='#ffffff' && !sibling)assert.ok(top.every(x=>x>240),'top of artwork stays visible');
   await page.locator('.main-entityHeader-headerText').evaluate(e=>e.style.visibility='');
   assert.equal(await page.locator('#plain').evaluate(e=>getComputedStyle(e,'::before').content),'none','ordinary headers do not receive a scrim');
   assert.equal(await page.locator(sibling ? '[style*="background-image"]' : '.main-entityHeader-withBackgroundImage').evaluate((e,sibling)=>getComputedStyle(e,sibling ? '::after' : '::before').pointerEvents,sibling),'none');
   assert.equal(await page.locator('a').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.left+5,r.top+5)===e}),true,'overlay does not block header links');
   fs.mkdirSync('reports/header',{recursive:true});if(background==='#ffffff')await page.screenshot({path:`reports/header/white-art-${width}.png`});
  }
  console.log('Passed image-header text contrast over white, bright and dark artwork at two widths, preserved ordinary headers and clickable links.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

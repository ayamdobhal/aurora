// Render sanitized control fixtures in Chromium; no Spotify account required.
const { chromium } = require('playwright');
const { buildSync } = require('esbuild');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const bundle = buildSync({entryPoints:['src/lib/colors.ts'], bundle:true, write:false,
  format:'iife', globalName:'Colors'}).outputFiles[0].text;
const colors = vm.runInNewContext(bundle + '; Colors;');
const rgb = (text) => text.match(/[\d.]+/g).slice(0,3).map(Number);

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),
  });
  try {
    const page = await browser.newPage({viewport:{width:1000,height:760}});
    await page.setContent(`<!doctype html><html><head><style>
      body {margin:0; background:white; padding:24px}
      .Root__main-view {padding:24px; width:500px}
      button {padding:0; border:0; background:transparent; font:inherit}
      button > span {display:block;padding:16px;border-radius:24px}
      svg {width:24px;height:24px}
      .e-10810-icon {color:var(--spice-button);fill:currentColor}
      .main-trackList-trackListHeader {position:sticky;top:0;padding:12px}
      [role=menu] {padding:16px;margin-top:20px}
      [role=menu] button {padding:12px}
      .category {background:rgb(210,25,155);padding:20px}
    </style></head><body>
      <main class="Root__main-view"><div class="main-view-container">
        <button id="play" data-encore-id="buttonPrimary"><span><svg class="e-10810-icon"><path d="M2 2L22 12L2 22Z"/></svg></span></button>
        <button class="crp-btn crp-primary" aria-label="Player play"><svg fill="currentColor"><path d="M2 2L22 12L2 22Z"/></svg></button><button class="mp-btn mp-primary" aria-label="Miniplayer play"><svg fill="currentColor"><path d="M2 2L22 12L2 22Z"/></svg></button><button role="checkbox" aria-checked="true"><span>Selected genre</span></button>
        <div class="main-trackList-trackListHeader">Title · Album</div>
        <div class="category" style="--background-base: #d2199b">Browse category</div>
        <div class="crp-device-active"><span class="crp-list-name">Connected device</span></div>
      </div></main>
      <div role="menu"><button role="menuitemradio" aria-checked="true">Selected sort</button></div>
      <div data-testid="toast">Saved</div><div data-testid="connect-device-picker">Devices</div>
    </body></html>`);
    await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
    let checks = 0;
    for (const fill of [[31,104,199],[190,30,50],[20,170,80],[0,0,0],[255,255,255],[128,128,128],[255,225,30]]) {
      const text = colors.readableAccent(fill), foreground = colors.onAccent(fill);
      await page.evaluate(({fill,text,foreground}) => {
        const root=document.documentElement.style;
        for (const [key,value] of Object.entries({'--aurora-accent-fill':fill,'--aurora-on-accent':foreground,
          '--aurora-accent-text':text,'--lyrics-accent':text,'--spice-button':fill}))
          root.setProperty(key,`rgb(${value.join(',')})`);
      }, {fill,text,foreground});
      for (const state of ['rest','hover','pressed','focus']) {
        await page.mouse.move(950,700);
        await page.locator('#play').blur();
        if (state==='hover'||state==='pressed') await page.locator('#play').hover();
        if (state==='pressed') await page.mouse.down();
        if (state==='focus') {
          await page.locator('#play').focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
        }
        const actual = await page.locator('#play').evaluate(e=>({
          fg:e.querySelector('path')?getComputedStyle(e.querySelector('path')).fill:getComputedStyle(e).color,
          bg:getComputedStyle(e.firstElementChild).backgroundColor,
          outline:getComputedStyle(e).outlineStyle,
        }));
        if (state==='pressed') await page.mouse.up();
        assert.ok(colors.contrast(rgb(actual.fg),rgb(actual.bg))>=4.5, `${fill} ${state}`);
        if (state==='focus') assert.equal(actual.outline,'solid');
        checks++;
      }
      for (const selector of ['.crp-primary','.mp-primary','[role=checkbox] > span']) {
        for (const hover of [false,true]) {
          await page.mouse.move(950,700);if(hover) await page.locator(selector).hover();
          const actual=await page.locator(selector).evaluate(e=>({bg:getComputedStyle(e).backgroundColor,fg:e.querySelector('path')?getComputedStyle(e.querySelector('path')).fill:getComputedStyle(e).color}));
          assert.deepEqual(rgb(actual.bg),fill,'player uses the same accent fill as Jam');
          assert.ok(colors.contrast(rgb(actual.fg),rgb(actual.bg))>=4.5,'player icon remains readable across palettes and hover');
        }
      }
      const menu = await page.locator('[role=menu]').evaluate(e=>({
        bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e.firstElementChild).color,
      }));
      assert.ok(colors.contrast(rgb(menu.fg),rgb(menu.bg))>=4.5);
    }
    assert.equal(await page.locator('.main-view-container').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('.main-trackList-trackListHeader').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(32, 35, 40)');
    assert.equal(await page.locator('.category').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(210, 25, 155)');
    assert.equal(await page.locator('[role=checkbox] > span').evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 0)');
    for (const selector of ['[data-testid=toast]','[data-testid=connect-device-picker]'])
      assert.ok(await page.locator(selector).isVisible(), selector);
    await page.locator('#play').evaluate(e=>e.disabled=true);
    assert.ok(await page.locator('#play').isDisabled());
    fs.mkdirSync('reports/phase-1',{recursive:true});
    await page.screenshot({path:'reports/phase-1/control-fixture.png'});
    await page.setContent(`<!doctype html><style>
      body{margin:0}.Root__top-container{display:grid;grid-template-columns:auto 1fr auto;gap:8px;height:700px}
      .Root__top-container > *{grid-row:3}.Root__nav-bar{position:relative;width:200px}
      .Root__right-sidebar{position:relative}
      .LayoutResizer__resize-bar{position:absolute;right:-8px;top:0;width:8px;height:100%}
    </style><div class="Root__top-container"><div class="Root__nav-bar"><nav>Library</nav><div class="LayoutResizer__resize-bar"></div></div><main class="Root__main-view">Content</main><div class="Root__right-sidebar"><div id="custom-right-panel"><div>Player</div><div class="crp-tabs"><div class="crp-tab-bar"><button class="crp-tab">Queue</button><button class="crp-tab">Recent</button><button class="crp-tab">Friends</button><button class="crp-tab">Devices</button></div></div></div></div></div>`);
    await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
    const resizeCode=buildSync({stdin:{contents:'import {setupPanelResizing} from "./src/lib/panel-resize"; setupPanelResizing();',resolveDir:process.cwd()},bundle:true,write:false,format:'iife'}).outputFiles[0].text;
    await page.addScriptTag({content:resizeCode});
    for (const selector of ['.LayoutResizer__resize-bar','.aurora-panel-resizer']) {
      assert.ok(await page.locator(selector).evaluate(e=>{
        const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+100)===e;
      }), `edge hit target ${selector}`);
      assert.equal(await page.locator(selector).getAttribute('title'),null);
    }
    const handle=page.getByRole('separator',{name:'Resize player panel'});
    const box=await handle.boundingBox();
    await page.mouse.move(box.x+4,box.y+100);await page.mouse.down();
    await page.mouse.move(box.x-46,box.y+100,{steps:5});await page.mouse.up();
    assert.equal(await handle.getAttribute('aria-valuenow'),'390');
    assert.equal(Math.round(await page.locator('.Root__right-sidebar').evaluate(e=>e.getBoundingClientRect().width)),390);
    await handle.focus();await handle.press('Home');
    assert.ok(await page.locator('.crp-tab-bar').evaluate(e=>e.scrollWidth<=e.clientWidth && [...e.querySelectorAll('.crp-tab')].every(x=>x.scrollWidth<=x.clientWidth)), 'tabs fit minimum width');
    const viewCode=buildSync({entryPoints:['src/lib/lyrics-view.ts'],bundle:true,write:false,format:'iife',globalName:'LyricsView'}).outputFiles[0].text;
    for (const [width,height] of [[360,560],[366,260],[282,334]]) {
      await page.setViewportSize({width,height});
      await page.setContent('<!doctype html><body class="mp-pip-body"><div id="mini-player" class="mini-player expanded"><div class="mp-compact"><div class="mp-art-wrap"><div class="mp-art"></div></div><div class="mp-compact-right">Player controls</div></div><div class="mp-panel"><div class="mp-tab-bar"><button class="mp-tab active">Lyrics</button><button class="mp-tab">Queue</button></div><div class="mp-tab-content"><div class="mp-tab-pane active" data-pane="lyrics"></div></div></div></div></body>');
      await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
      await page.evaluate(()=>{
        window.Spicetify={Player:{data:{item:{uri:'spotify:track:fixture',metadata:{}},isPaused:true},addEventListener(){},getProgress:()=>20000,getDuration:()=>120000}};
        window.fetch=async()=>({ok:true,text:async()=>'<tt>'+Array.from({length:50},(_,i)=>`<p begin="${i}s">Line ${i}</p>`).join('')+'</tt>'});
      });
      await page.addScriptTag({content:viewCode+';window.testView=LyricsView.mountLyricsView(document.querySelector(".mp-tab-pane"));'});
      await page.locator('.lyric-line.active').waitFor();
      await page.waitForTimeout(350);
      assert.ok(await page.evaluate(()=>{
        const root=document.querySelector('#mini-player'),pane=document.querySelector('.mp-tab-pane'),tools=document.querySelector('.lyrics-tools'),content=document.querySelector('.lyrics-content');
        return root.scrollTop===0 && pane.scrollHeight<=pane.clientHeight+1 && tools.getBoundingClientRect().top>0 && tools.scrollWidth<=tools.clientWidth && content.clientHeight>20;
      }), `miniplayer lyrics remain contained at ${width}×${height}`);
      await page.evaluate(()=>window.testView.dispose());
    }
    await page.setViewportSize({width:600,height:300});
    await page.setContent('<!doctype html><style>.mOhp6uUOOQY4YFdW{color:var(--background-base);padding:5px}.lyrics-tools{top:100px}</style><div role="gridcell"><div class="mOhp6uUOOQY4YFdW" style="background-color:rgb(128,215,239)"><span data-encore-id="text">8A</span></div></div><div class="lyrics-tools"><button>Retry</button></div>');
    await page.addStyleTag({content:fs.readFileSync('theme/user.css','utf8')});
    const badge=page.locator('.mOhp6uUOOQY4YFdW');
    for(const background of ['rgb(128, 215, 239)','rgb(5, 236, 203)','rgb(61, 237, 130)']) {
      await badge.evaluate((e,color)=>e.style.backgroundColor=color,background);
      const actual=await badge.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e.firstElementChild).color}));
      assert.equal(actual.bg,background);assert.ok(colors.contrast(rgb(actual.fg),rgb(actual.bg))>=4.5,'Mix key notation retains contrast and its native color');
    }
    await badge.evaluate(e=>e.className='future-spotify-badge');
    assert.equal(await page.locator('[role="gridcell"] span').evaluate(e=>getComputedStyle(e).color),'rgb(17, 17, 17)','structural fallback survives regenerated native class names');
    await page.mouse.move(590,290);await page.waitForFunction(() => getComputedStyle(document.querySelector('.lyrics-tools')).opacity === (document.querySelector('.lyrics-tools').matches(':hover, :focus-within') ? '1' : '0'));
    assert.equal(await page.locator('.lyrics-tools').evaluate(e=>getComputedStyle(e).opacity),'0');
    await page.locator('.lyrics-tools').hover();await page.waitForFunction(() => getComputedStyle(document.querySelector('.lyrics-tools')).opacity === '1');
    assert.equal(await page.locator('.lyrics-tools').evaluate(e=>getComputedStyle(e).opacity),'1');
    await page.locator('.lyrics-tools button').focus();await page.mouse.move(590,290);await page.waitForFunction(() => getComputedStyle(document.querySelector('.lyrics-tools')).opacity === (document.querySelector('.lyrics-tools').matches(':hover, :focus-within') ? '1' : '0'));
    assert.equal(await page.locator('.lyrics-tools').evaluate(e=>getComputedStyle(e).opacity),'1','keyboard focus keeps controls visible');
    await page.locator('.lyrics-tools button').blur();await page.waitForFunction(() => getComputedStyle(document.querySelector('.lyrics-tools')).opacity === (document.querySelector('.lyrics-tools').matches(':hover, :focus-within') ? '1' : '0'));
    assert.equal(await page.locator('.lyrics-tools').evaluate(e=>getComputedStyle(e).opacity),'0');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.lyrics-tools').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    console.log('Passed Mix key badge contrast and lyrics toolbar hover/focus auto-hide.');
    console.log('Passed miniplayer lyrics scroll containment and compact controls at three window sizes.');
    console.log(`Passed ${checks} palette/control state combinations, selected menus, surfaces, focus, chips and native feedback visibility.`);
    console.log('Passed invisible resize edge hit targets and rendered drag geometry.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});

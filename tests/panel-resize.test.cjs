const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const { fixture } = require('./helpers/runtime.cjs');
const code = buildSync({stdin:{contents:'import {setupPanelResizing} from "./src/lib/panel-resize"; setupPanelResizing();',resolveDir:process.cwd()},bundle:true,write:false,format:'iife'}).outputFiles[0].text;
const KEY = 'aurora:right-panel-width:v1';
function setup(saved) {
  const f = fixture('<div class="Root__nav-bar"></div><div class="Root__right-sidebar"></div>');
  f.w.innerWidth = 1200;
  f.w.document.querySelector('.Root__nav-bar').getBoundingClientRect = () => ({width:280});
  if (saved != null) f.w.localStorage.setItem(KEY,saved);
  f.w.eval(code);
  f.handle = () => f.w.document.querySelector('.aurora-panel-resizer');
  f.width = () => Number(f.handle().getAttribute('aria-valuenow'));
  f.press = key => f.handle().dispatchEvent(new f.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  f.pointer = (target,type,x) => {
    const e = new f.w.MouseEvent(type,{clientX:x,button:0,bubbles:true,cancelable:true});
    Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);
  };
  return f;
}
test('keyboard resize persists, clamps to available space and restores preferred width', () => {
  const f=setup('400');
  try {
    assert.equal(f.width(),400);
    f.press('ArrowLeft'); assert.equal(f.width(),410);
    assert.equal(f.w.localStorage.getItem(KEY),'410');
    f.w.innerWidth=900; f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(f.width(),268);
    assert.equal(f.w.localStorage.getItem(KEY),'410');
    f.w.innerWidth=1200; f.w.dispatchEvent(new f.w.Event('resize'));
    assert.equal(f.width(),410);
    f.press('Home'); assert.equal(f.width(),240);
    f.press('End'); assert.equal(f.width(),560);
  } finally {f.dom.window.close();}
});
test('drag commits on release and Escape cancels without leaking listeners', () => {
  const f=setup();
  try {
    f.pointer(f.handle(),'pointerdown',800);
    f.pointer(f.w.document,'pointermove',750);assert.equal(f.width(),390);
    f.press('Escape'); assert.equal(f.width(),340);
    f.pointer(f.w.document,'pointermove',600);assert.equal(f.width(),340);
    assert.equal(f.w.localStorage.getItem(KEY),null);
    f.pointer(f.handle(),'pointerdown',800);
    f.pointer(f.w.document,'pointerup',740);assert.equal(f.width(),400);
    assert.equal(f.w.localStorage.getItem(KEY),'400');
    assert.equal(f.w.document.body.classList.contains('aurora-resizing'),false);
  } finally {f.dom.window.close();}
});
test('invalid saved width falls back and replaced sidebars remount one handle', async () => {
  const f=setup('NaN');
  try {
    assert.equal(f.width(),340);
    f.w.document.querySelector('.Root__right-sidebar').outerHTML='<div class="Root__right-sidebar"></div>';
    await f.frame();await f.frame();
    assert.equal(f.w.document.querySelectorAll('.aurora-panel-resizer').length,1);
    f.press('ArrowRight');assert.equal(f.width(),330);
  } finally {f.dom.window.close();}
});
test('reopening uses committed width, reset restores default', () => {
  const f=setup('460');
  try {
    assert.equal(f.width(),460);
    f.handle().dispatchEvent(new f.w.MouseEvent('dblclick'));
    assert.equal(f.width(),340);
    assert.equal(f.w.localStorage.getItem(KEY),'340');
  } finally {f.dom.window.close();}
});

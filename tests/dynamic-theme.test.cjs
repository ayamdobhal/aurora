const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, settle } = require('./helpers/runtime.cjs');

test('missing artwork clears previous palette and rejects an older image result', async () => {
  const f=fixture();
  try {
    let image;
    f.w.Image = class {constructor(){image=this;} set src(value){this.url=value;}};
    f.w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray([20,60,200,255])})});
    f.player.data.item.metadata.image_url='https://example.test/old.png';
    f.run('src/dynamic-theme.ts');await f.timersRun();
    assert.equal(f.w.document.documentElement.style.getPropertyValue('--image_url'), '', 'do not expose undecoded art');
    f.player.data.item.metadata={};
    await f.emit('songchange');await f.timersRun();
    image.onload();await settle();
    const style=f.w.document.documentElement.style;
    assert.equal(style.getPropertyValue('--image_url'),'');
    assert.equal(style.getPropertyValue('--aurora-accent-text'),'#ffffff');
    assert.equal(style.getPropertyValue('--aurora-on-accent'),'#000000');
  } finally {f.dom.window.close();}
});

test('crossfade advances palette, cancels obsolete frames and respects reduced motion',async()=>{
 const f=fixture();try{
 let time=0,reduced=false;Object.defineProperty(f.w.performance,'now',{value:()=>time});f.w.matchMedia=()=>({matches:reduced});
 const images=[];f.w.Image=class{constructor(){images.push(this)}set src(v){this.url=v}};
 f.w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray([30,60,220,255])})});
 const style=f.w.document.documentElement.style;
 async function change(url){f.player.data.item.metadata.image_url=url;await f.emit('songchange');await f.timersRun();images.at(-1).onload();await settle();}
 f.player.data.item.metadata.image_url='https://example.test/a';f.run('src/dynamic-theme.ts');await f.timersRun();images[0].onload();await settle();assert.match(style.getPropertyValue('--image_url'),/\/a/);
 await change('https://example.test/b');assert.equal(f.frames.size,1);time=250;await f.frame();assert.equal(Number(style.getPropertyValue('--aurora-art-mix')),0.5);
 f.player.data.item.metadata.image_url='https://example.test/c';await f.emit('songchange');time=500;await f.frame();assert.doesNotMatch(style.getPropertyValue('--image_url'),/\/b/,'obsolete fade cannot commit');
 reduced=true;await f.timersRun();images.at(-1).onload();await settle();assert.match(style.getPropertyValue('--image_url'),/\/c/);assert.equal(f.frames.size,0);assert.equal(style.getPropertyValue('--aurora-next-image'),'');
 }finally{f.dom.window.close()}
});

test('broken decoded artwork resets to a neutral backdrop',async()=>{
 const f=fixture();try{
 f.w.Image=class{set src(v){} async decode(){throw Error('broken')}};
 f.w.document.documentElement.style.setProperty('--image_url','url(old)');f.player.data.item.metadata.image_url='https://example.test/broken';f.run('src/dynamic-theme.ts');await f.timersRun();
 assert.equal(f.w.document.documentElement.style.getPropertyValue('--image_url'),'');assert.equal(f.w.document.documentElement.style.getPropertyValue('--aurora-accent-text'),'#ffffff');
 }finally{f.dom.window.close()}
});

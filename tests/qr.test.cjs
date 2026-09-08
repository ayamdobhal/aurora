const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture}=require('./helpers/runtime.cjs');const {buildSync}=require('esbuild');const jsQR=require('jsqr');
const code=buildSync({entryPoints:['src/lib/qr.ts'],bundle:true,write:false,format:'iife',globalName:'QR'}).outputFiles[0].text;
test('locally generated invite QR decodes to the exact URL with a four-module quiet zone',()=>{
 const f=fixture();try{
 const qr=f.w.eval(code+';QR;'),url='https://spotify.link/exampleJamInvite',svg=qr.inviteQr(url),size=Number(svg.getAttribute('viewBox').split(' ')[2]),scale=6,width=size*scale;
 const pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(const m of svg.querySelector('path').getAttribute('d').matchAll(/M(\d+) (\d+)h1v1h-1z/g)){
   const x=Number(m[1]),y=Number(m[2]);assert.ok(x>=4&&y>=4&&x<size-4&&y<size-4);
   for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const i=((y*scale+dy)*width+x*scale+dx)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
 }
 assert.equal(jsQR(pixels,width,width).data,url);assert.equal(svg.getAttribute('aria-label'),'Scan to join this Jam');assert.throws(()=>qr.inviteQr('javascript:bad'));
 }finally{f.dom.window.close()}
});

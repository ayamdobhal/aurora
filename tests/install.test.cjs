const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
for(const scenario of ['success','apply-failure','invalid-archive']) test(`shell installer ${scenario}`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aurora-install-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const sub of ['bin','custom config/Themes/aurora','archive/theme','archive/extensions'])fs.mkdirSync(path.join(root,sub),{recursive:true});
 fs.writeFileSync(path.join(root,'custom config/config.ini'),'extensions = unrelated.js|old.js');
 fs.writeFileSync(path.join(root,'custom config/Themes/aurora/.aurora-extensions'),'old.js\n');
 fs.writeFileSync(path.join(root,'custom config/Themes/aurora/user.css'),'keep-me');
 for(const [file,data] of [['theme/user.css','body{}'],['theme/color.ini','[Base]'],['extensions/current.js','//built'],['BUILD.txt','fixture-sha']])fs.writeFileSync(path.join(root,'archive',file),data);
 if(scenario==='invalid-archive')fs.unlinkSync(path.join(root,'archive/BUILD.txt'));
 assert.equal(spawnSync('tar',['-czf',path.join(root,'fixture.tar.gz'),'-C',path.join(root,'archive'),'.']).status,0);
 fs.writeFileSync(path.join(root,'bin/curl'),'#!/bin/bash\ncp "$AURORA_FIXTURE/fixture.tar.gz" "$3"\n',{mode:0o755});
 fs.writeFileSync(path.join(root,'bin/spicetify'),'#!/bin/bash\nprintf "%s\\n" "$*" >> "$AURORA_FIXTURE/calls"\nif [ "$1" = -c ]; then printf "%s\\n" "$AURORA_FIXTURE/custom config/config.ini"; fi\nif [ "$1" = apply ] && [ "$FAIL_APPLY" = yes ]; then exit 7; fi\n',{mode:0o755});
 const result=spawnSync('bash',['install.sh'],{encoding:'utf8',env:{...process.env,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,AURORA_FIXTURE:root,FAIL_APPLY:scenario==='apply-failure'?'yes':'no'}});
 assert.equal(result.status===0,scenario==='success',result.stdout+result.stderr);
 const calls=fs.readFileSync(path.join(root,'calls'),'utf8');assert.doesNotMatch(calls,/unrelated.js-/);
 if(scenario==='success'){assert.match(calls,/config extensions old.js-/);assert.equal(fs.readFileSync(path.join(root,'custom config/Themes/aurora/.aurora-build'),'utf8'),'fixture-sha');}
 if(scenario==='invalid-archive')assert.equal(fs.readFileSync(path.join(root,'custom config/Themes/aurora/user.css'),'utf8'),'keep-me');
});

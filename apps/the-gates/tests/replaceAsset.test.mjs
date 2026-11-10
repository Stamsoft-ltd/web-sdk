import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('manual replacement helper dry-run leaves supplied PNG and rig untouched',()=>{
 const files=['static/assets/the-gates/art/symbols/eye.png','static/assets/the-gates/art/animations/SACRED_EYE.json'];
 const hashes=()=>files.map(p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex'));
 const before=hashes();
 const script=new URL('../tools/replace-asset.py',import.meta.url);
 const out=JSON.parse(execFileSync('python3',[script.pathname,'art/symbols/eye.png'],{encoding:'utf8'}));
 assert.equal(out.execute,false);assert.deepEqual(hashes(),before);
});
test('stable source layout exposes named originals, not dated export folders',()=>{
 for(const p of ['art/symbols/eye.png','art/symbols/envelope.png','ui/reel-frame.png','logo/badge.png','max-win/max-win.png','audio/music/normal.mp3','audio/sfx/spin-start.mp3','loading/frame-00.webp'])
  assert.ok(existsSync(new URL('../static/assets/the-gates/'+p,import.meta.url)),p);
 for(const p of ['figma-20261012','figma-20261013','logo-layers-20261016'])
  assert.ok(!existsSync(new URL('../static/assets/the-gates/'+p,import.meta.url)),p);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('cap replaces old heading and Legendary title with native MAX WIN composition only',()=>{
 const screen=read('src/components/WinScreen.svelte'), gpu=read('src/components/GpuWinArt.svelte');
 assert.doesNotMatch(screen,/<h2|celebration-label/);
 assert.match(screen,/\{capped\}/);
 assert.match(gpu,/if \(isCap\)[\s\S]*?\['banner', 'title', 'crown'\]/);
 for(const path of ['max-win/max-win.png','max-win/badge.png','stat-panels/tumble-gem.png']) assert.ok(gpu.includes(path));
 assert.match(gpu,/findBone\('crown'\)/);
 assert.match(gpu,/capTitle.alpha = entry.titleAlpha/);
 assert.match(gpu,/root.y = exit.y/);
});
test('cap owns fullscreen sizing, six explicit gems and crown aligned over A',()=>{
 const gpu=read('src/components/GpuWinArt.svelte'), screen=read('src/components/WinScreen.svelte');
 assert.match(gpu,/for \(const \[x, y, size\] of CAP_GEM_LAYOUT\)/);
 assert.match(gpu,/crown.y = 235 \+ entry.titleY/);
 assert.match(gpu,/crown.scaleX \*= 1.3/);
 assert.match(gpu,/findBone\('title'\)!\.y -= 25/);
 assert.match(gpu,/root.addChild\(capBadge, capTitle, award, capCrown\)/);
 assert.match(screen,/\.capped \.win-stage \{ width: 100%; height: 100%; \}/);
});

test('cap crown is a top-layer native sprite and max hold is 4.5 seconds',()=>{
 const gpu=read('src/components/GpuWinArt.svelte');
 assert.match(gpu,/capCrown.zIndex = 1000/);
 assert.match(gpu,/root.sortableChildren = true/);
 assert.match(gpu,/capCrown.alpha = entry.titleAlpha/);
 assert.match(read('src/game/presentation.ts'),/capAutoClose: 4500/);
});

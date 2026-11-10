import test from 'node:test';
import assert from 'node:assert/strict';
import {CAP_GEM_LAYOUT, GEM_START_MS, GEM_STAGGER_MS, GEM_FLIGHT_MS, winGemFrame, winGemBoardShake} from '../src/game/winGemMotion.ts';
import {WIN_ENTER_MS} from '../src/game/winMotion.ts';
import {readFileSync} from 'node:fs';
test('six side flights begin after main entrance, ordered and overlapping before first landing',()=>{
 assert.equal(CAP_GEM_LAYOUT.length,6);
 assert.ok(GEM_START_MS>WIN_ENTER_MS);
 assert.ok(5*GEM_STAGGER_MS<GEM_FLIGHT_MS);
 for(let i=0;i<6;i++){
  const start=GEM_START_MS+i*GEM_STAGGER_MS;
  assert.equal(winGemFrame(start-1,i,2000).visible,false);
  const initial=winGemFrame(start,i,2000);
  assert.equal(Math.sign(initial.x),i%2===0?-1:1);
  assert.equal(initial.landed,false);
  const end=winGemFrame(start+GEM_FLIGHT_MS,i,2000);
  assert.equal(end.x,0);assert.ok(Math.abs(end.y)<1e-8);
  assert.equal(end.rotation,0);assert.equal(end.landed,true);
 }
});
test('board impact bounded and settles; reduced motion has no travel or shake',()=>{
 for(let t=0;t<300;t++){
  const f=winGemBoardShake(t);
  assert.ok(Math.abs(f.x)<=2&&Math.abs(f.y)<=1.5);
 }
 assert.deepEqual(winGemBoardShake(220),{x:0,y:0,done:true});
 assert.deepEqual(winGemBoardShake(40,true),{x:0,y:0,done:true});
 for(let i=0;i<6;i++){
  const f=winGemFrame(0,i,2000,true);
  assert.equal(f.x,0);assert.equal(f.y,0);assert.equal(f.rotation,0);assert.equal(f.scale,1);
  assert.equal(f.visible,true);assert.equal(f.landed,true);
 }
});
test('GPU triggers one impact per gem, with glow, and moves board not HUD/background',()=>{
 const src=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8');
 const art=src('components/GpuWinArt.svelte'),board=src('game/gpuBoard.ts');
 assert.match(art,/f.landed&&!gem.landed/);
 assert.match(art,/!state.reduced&&!state.exitAt/);
 assert.match(art,/glow.circle/);
 assert.match(board,/root.x = baseX \+ impact.x/);
 assert.match(board,/return !impact.done/);
 assert.doesNotMatch(src('game/gpuScene.ts'),/boardImpactAt/);
});

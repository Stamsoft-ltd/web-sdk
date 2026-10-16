import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { portalRemovalTracks, PORTAL_SECONDS, SYMBOL_GONE_SECONDS } from '../tools/portal-removal-rig.mjs';
import {
 TextureAtlas, FakeTexture, AtlasAttachmentLoader, SkeletonJson,
 Skeleton, AnimationState, AnimationStateData, Physics,
} from '@esotericsoftware/spine-core';
const root=new URL('../static/assets/the-gates/figma-20261012/',import.meta.url);
const motion=new URL('motion/',root);
const json=name=>JSON.parse(readFileSync(new URL(name+'.json',motion),'utf8'));
const manifest=json('manifest');
function parsed(name,atlasName){
 const atlas=new TextureAtlas(readFileSync(new URL(atlasName+'.atlas',motion),'utf8'));
 for(const page of atlas.pages)page.setTexture(new FakeTexture({width:page.width,height:page.height}));
 return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json(name));
}
function pose(entry,animation,time=0){
 const data=parsed(entry.name,entry.atlas),skeleton=new Skeleton(data);
 const state=new AnimationState(new AnimationStateData(data));
 state.setAnimation(0,animation,false).trackTime=time;
 state.apply(skeleton);skeleton.updateWorldTransform(Physics.update);
 return {skeleton,state,data};
}
const signature=s=>s.bones.flatMap(b=>[b.a,b.b,b.c,b.d,b.worldX,b.worldY]);
const approximately=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<.00005,`${i}: ${v} != ${b[i]}`));};
test('new motion uses intact verified native art; no reference-only or invented Wild',()=>{
 assert.equal(manifest.symbols.length,11);assert.equal(manifest.wins.length,5);assert.equal(manifest.bonuses.length,3);
 assert.ok(!manifest.symbols.some(s=>s.name==='WILD'));
 const registered=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8')).assets;
 for(const src of manifest.sourceAssets){
  assert.equal(registered.find(a=>a.path===src.path)?.status,'ready');
  assert.equal(createHash('sha256').update(readFileSync(new URL(src.path,root))).digest('hex'),src.sha256);
 }
});
test('every standalone rig parses in official Spine 4.2 and stays finite',()=>{
 for(const entry of [...manifest.symbols,...manifest.wins,...manifest.bonuses,...manifest.gates]){
  const d=parsed(entry.name,entry.atlas);assert.equal(d.version,'4.2.74');
  for(const animation of d.animations){
   assert.ok(Number.isFinite(animation.duration)&&animation.duration>=0);
   for(const time of [0,animation.duration*.25,animation.duration*.5,animation.duration]){
    assert.ok(signature(pose(entry,animation.name,time).skeleton).every(Number.isFinite),`${entry.name}/${animation.name}`);
   }
  }
 }
});
test('landing visibly squashes at a fixed floor pivot then returns exactly to neutral',()=>{
 for(const entry of manifest.symbols){
  const setup=pose(entry,'setup').skeleton;
  const impact=pose(entry,'land',.024).skeleton;
  const a=setup.findBone('impact'),b=impact.findBone('impact');
  approximately([a.worldX,a.worldY],[b.worldX,b.worldY]);
  assert.ok(b.scaleX>1.27&&b.scaleY<.69,'deeper 1.28×/0.68× cartoon squash');
  const rebound=pose(entry,'land',.066).skeleton.findBone('impact');
  assert.ok(rebound.scaleX<.91&&rebound.scaleY>1.12);
  const art=setup.findSlot('body').getAttachment();
  const registered=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8')).assets;
  const src=registered.find(a=>a.path.endsWith('/'+art.region.page.name.split('/').pop()));
  const localY=entry.name==='KEY' ? -.5*art.height : (.5-(src.alphaBounds?.[3]??src.height)/src.height)*art.height;
  const foot=s=>{const body=s.findBone('body');return body.d*localY+body.worldY;};
  approximately([foot(setup)],[foot(impact)]);
  approximately([foot(setup)],[a.worldY]);
  approximately(signature(setup),signature(pose(entry,'land',.12).skeleton));
  assert.equal(parsed(entry.name,entry.atlas).findAnimation('land').duration,Math.fround(.12));
 }
});
test('all idle and paying loops close without popping; premiums have distinct poses',()=>{
 const premium=new Set();
 for(const entry of manifest.symbols){
  for(const anim of ['idle','paying']){
   const d=parsed(entry.name,entry.atlas).findAnimation(anim);
   approximately(signature(pose(entry,anim,0).skeleton),signature(pose(entry,anim,d.duration).skeleton));
   assert.notDeepEqual(signature(pose(entry,anim,d.duration*.25).skeleton),signature(pose(entry,anim,0).skeleton));
  }
  if(!entry.name.endsWith('_GEM'))premium.add(JSON.stringify(json(entry.name).animations.paying));
  assert.equal(pose(entry,'remove',parsed(entry.name,entry.atlas).findAnimation('remove').duration).skeleton.findSlot('body').color.a,0);
 }
 assert.equal(premium.size,6);
});
test('normal/fast/turbo land once and queue idle without altering the landing rig',()=>{
 const entry=manifest.symbols[0];
 for(const rate of [1,1.5,3]){
  const {state,skeleton}=pose(entry,'land');
  state.timeScale=rate;state.addAnimation(0,'idle',true,0);
  state.update(.12/rate+.00001);state.apply(skeleton);
  // Spine switches a queued track on the next update after crossing its delay.
  state.update(0);state.apply(skeleton);
  assert.equal(state.getCurrent(0).animation.name,'idle');
 }
});
test('win/bonus parts enter staggered, settle, idle seamlessly and fade away',()=>{
 for(const entry of [...manifest.wins,...manifest.bonuses]){
  const d=parsed(entry.name,entry.atlas);
  const start=pose(entry,'enter').skeleton,finish=pose(entry,'enter',d.findAnimation('enter').duration).skeleton;
  assert.ok(start.slots.every(s=>s.color.a===0));assert.ok(finish.slots.every(s=>s.color.a===1));
  approximately(signature(finish),signature(pose(entry,'setup').skeleton));
  approximately(signature(pose(entry,'idle').skeleton),signature(pose(entry,'idle',d.findAnimation('idle').duration).skeleton));
  assert.ok(pose(entry,'exit',d.findAnimation('exit').duration).skeleton.slots.every(s=>s.color.a===0));
 }
 const wild=parsed('win-wild','win-wild');
 assert.equal(wild.slots.length,6,'clean plaque plus independently animated symmetric horns');
 assert.equal(wild.findSlot('amount').attachmentName,null);
 assert.ok(wild.findSlot('horn-right'));
 assert.equal(wild.findBone('horn-right').scaleX,-1);
 for(const tier of ['sweet','epic','mythic','legendary'])assert.equal(parsed('win-'+tier,'win-'+tier).slots.length,6);
});
test('crowns register above requested letters, lift from text, then settle without sideways drift',()=>{
 const letters={sweet:'first E',wild:'D',epic:'P',mythic:'T',legendary:'N'};
 const assets=JSON.parse(readFileSync(new URL('asset-manifest.json',root),'utf8')).assets;
 for(const entry of manifest.wins){
  assert.equal(entry.crownAnchor.letter,letters[entry.tier]);
  const setup=pose(entry,'setup').skeleton,title=setup.findBone('title'),crown=setup.findBone('crown');
  assert.equal(crown.parent,title,'crown follows title, never viewport center');
  const titleArt=setup.findSlot('title').getAttachment(),crownArt=setup.findSlot('crown').getAttachment();
  const src=assets.find(a=>a.path===`wins/${entry.tier}-crown.png`),[left,,right,bottom]=src.alphaBounds;
  const visibleX=crown.x+((left+right)/2/src.width-.5)*crownArt.width;
  const visibleBottom=crown.y+(.5-bottom/src.height)*crownArt.height;
  approximately([visibleX,visibleBottom],[(entry.crownAnchor.u-.5)*titleArt.width,(.5-entry.crownAnchor.v)*titleArt.height+3]);
  const at=t=>pose(entry,'enter',t).skeleton.findBone('crown');
  assert.ok(at(.19).y<crown.y&&at(.44).y>crown.y);
  approximately([at(.19).x,at(.44).x,at(.9).x],[crown.x,crown.x,crown.x]);
  approximately([at(.9).y],[crown.y]);
  assert.equal(parsed(entry.name,entry.atlas).findAnimation('enter').duration,Math.fround(.9));
 }
});
test('portal rim stays below full-size symbol; slow suction, pinch and clear are ordered',()=>{
 assert.equal(manifest.removal.kind,'cartoon-mini-portal');assert.equal(manifest.particles,undefined);
 for(const entry of manifest.symbols){
  const data=parsed(entry.name,entry.atlas),duration=data.findAnimation('remove').duration;
  assert.equal(duration,Math.fround(PORTAL_SECONDS));
  const setup=pose(entry,'setup').skeleton,start=pose(entry,'remove').skeleton;
  assert.deepEqual(setup.drawOrder.map(s=>s.data.name),['portal-vortex','portal-rim','body']);
  assert.equal(setup.findSlot('portal-rim').color.a,0);assert.equal(start.findSlot('portal-vortex').color.a,0);
  const pop=pose(entry,'remove',.1).skeleton,suck=pose(entry,'remove',SYMBOL_GONE_SECONDS*.84).skeleton;
  assert.equal(pop.findBone('body').scaleX,1);assert.equal(pop.findBone('body').scaleY,1);
  assert.equal(start.findBone('body').scaleX,1);assert.equal(start.findBone('body').scaleY,1);
  assert.equal(start.findBone('body').worldX,setup.findBone('body').worldX);assert.equal(start.findBone('body').worldY,setup.findBone('body').worldY);
  assert.ok(pop.findBone('portal-root').scaleX>1&&pop.findSlot('portal-rim').color.a===1);
  assert.ok(suck.findBone('body').scaleX<.4&&suck.findBone('body').scaleX>.25);assert.equal(suck.findBone('body').scaleX,suck.findBone('body').scaleY);
  const middle=pose(entry,'remove',.5).skeleton.findBone('body');assert.ok(middle.scaleX>.7,'symbol remains large halfway through slow suction');
  assert.ok(Math.abs(suck.findBone('body').rotation)>10);
  assert.ok(suck.findBone('body').worldY<start.findBone('body').worldY);
  assert.equal(suck.findSlot('body').color.a,1,'shrink into portal, not a whole-symbol early fade');
  const gone=pose(entry,'remove',Math.fround(SYMBOL_GONE_SECONDS)).skeleton;
  assert.equal(gone.findSlot('body').color.a,0);assert.equal(gone.findSlot('portal-rim').color.a,1);
  const pinch=pose(entry,'remove',PORTAL_SECONDS*.97).skeleton;
  assert.ok(pinch.findBone('portal-root').scaleY<.08);
  assert.ok(pose(entry,'remove',duration).skeleton.slots.every(s=>s.color.a===0));
  for(const rate of [1,1.5,3]){
   const {state,skeleton}=pose(entry,'remove');state.timeScale=rate;state.update(PORTAL_SECONDS/rate+.00001);state.apply(skeleton);
   assert.ok(skeleton.slots.every(s=>s.color.a===0));
  }
  for(const animation of ['idle','land','paying'])assert.equal(pose(entry,animation,.05).skeleton.findSlot('portal-rim').color.a,0);
 }
 const source=new URL('../../portals-20261012/',motion),provenance=JSON.parse(readFileSync(new URL(manifest.removal.provenance,source),'utf8'));
 assert.equal(provenance.rimCenterAlpha,0,'real transparent portal hole');assert.deepEqual(provenance.alphaRange,[0,255]);
 assert.equal(createHash('sha256').update(readFileSync(new URL(provenance.path,source))).digest('hex'),manifest.removal.sha256);
});
test('portal eventId preserves replay motion; new cells/events change cosmetic spin only',()=>{
 assert.deepEqual(portalRemovalTracks('event-4:cell-7'),portalRemovalTracks('event-4:cell-7'));
 assert.notDeepEqual(portalRemovalTracks('event-4:cell-7'),portalRemovalTracks('event-4:cell-8'));
 for(const seed of ['a','b','c']){
  const tracks=portalRemovalTracks(seed);
  assert.equal(tracks.bones.body.scale.at(-1).time,SYMBOL_GONE_SECONDS);
  assert.equal(tracks.slots['portal-rim'].alpha.at(-1).time,PORTAL_SECONDS);
 }
});
test('gate and symbol-removal portals use each mode palette and verified transparent layered art',()=>{
 const source=new URL('../../portals-20261012/',motion),hashes=new Set();
 const expected={normal:['purple','hot pink','gold'],super:['royal blue','white','gold'],hidden:['ruby red','cream','gold']};
 for(const [tier,variant] of Object.entries(manifest.portalVariants)){
  assert.deepEqual(variant.palette,expected[tier]);
  const p=JSON.parse(readFileSync(new URL(variant.provenance,source),'utf8'));
  assert.equal(p.tier,tier);assert.equal(p.rimCenterAlpha,0);assert.deepEqual(p.alphaRange,[0,255]);
  const sha=createHash('sha256').update(readFileSync(new URL(variant.path,source))).digest('hex');
  assert.equal(sha,p.sha256);assert.equal(sha,variant.sha256);hashes.add(sha);
  const gate=manifest.gates.find(g=>g.tier===tier);
  assert.equal(gate.portal,variant.path);assert.equal(gate.portalSha256,sha);
  for(const layer of ['portal-rim','portal-vortex']){
   assert.ok(p.regions[layer][0]>=0&&p.regions[layer][1]>=0);
   assert.ok(p.regions[layer][0]+p.regions[layer][2]<=p.width);
   assert.ok(p.regions[layer][1]+p.regions[layer][3]<=p.height);
   assert.equal(pose(gate,'cycle',1.3).skeleton.findSlot(layer).getAttachment().region.page.name,`../../portals-20261012/${variant.path}`);
  }
  for(const symbol of manifest.symbols){
   const data=parsed(symbol.name,variant.symbolAtlas);assert.equal(data.findAnimation('land').duration,Math.fround(.12));
   assert.equal(data.defaultSkin.getAttachment(data.findSlot('portal-rim').index,'portal-rim').region.page.name,`../../portals-20261012/${variant.path}`);
  }
 }
 assert.equal(hashes.size,3,'never reuse one cyan portal across all gate modes');
 assert.equal(manifest.removal.defaultTier,'normal');assert.equal(manifest.removal.sha256,manifest.portalVariants.normal.sha256);
});

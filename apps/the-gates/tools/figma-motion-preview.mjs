// Asset-only workbench: no RGS requests, wagers, game state or Figma-layout code.
import { TextureAtlas, FakeTexture, AtlasAttachmentLoader, SkeletonJson } from '@esotericsoftware/spine-core';
import { SpinePose } from './spine-canvas.ts';
import { portalRemovalTracks } from './portal-removal-rig.mjs';
import { gateCycleTracks, gateClockStep } from './gate-cycle-rig.mjs';
const base = new URL('./',location.href);
const manifest = await (await fetch(new URL('manifest.json',base))).json();
const status = document.querySelector('#status');
const speed = document.querySelector('#speed');
const still = document.querySelector('#still');
const pause=document.querySelector('#pause'),inspectTime=document.querySelector('#inspect-time');
const rewardText=document.querySelector('#reward-text');
const symbolPalette=document.querySelector('#symbol-palette');
const expected=manifest.symbols.length+manifest.wins.length+manifest.bonuses.length+(manifest.gates?.length??0);
const actionButtons=[...document.querySelectorAll('[data-group][data-action]')];
for(const button of actionButtons)button.disabled=true;
symbolPalette.disabled=true;
const imageCache = new Map(), atlasCache = new Map(), actors = [];
let removalEvent=0,gateEvent=0;
const visible=new WeakMap();
const observer=new IntersectionObserver(entries=>{for(const entry of entries)visible.set(entry.target,entry.isIntersecting);});
let failures=0,frames=0,measuredAt=performance.now(),last=0,frameMs=0,drawn=0;
async function image(url){
 if(!imageCache.has(url))imageCache.set(url,(async()=>{const img=new Image();img.src=url;await img.decode();return img;})());
 return imageCache.get(url);
}
async function atlas(name){
 if(!atlasCache.has(name))atlasCache.set(name,(async()=>{
  const url=new URL(name+'.atlas',base),r=await fetch(url);if(!r.ok)throw new Error(`Atlas ${r.status}: ${name}`);
  const a=new TextureAtlas(await r.text());
  await Promise.all(a.pages.map(async p=>p.setTexture(new FakeTexture(await image(new URL(p.name,url).href)))));return a;
 })());
 return atlasCache.get(name);
}
async function actor(entry,container,width,height){
 const wrap=document.createElement('article');wrap.className='rig';wrap.dataset.rig=entry.name;
 const label=document.createElement('h3');label.textContent=entry.name.replaceAll('_',' ').replaceAll('-',' ');
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label',label.textContent+' animation');canvas.style.aspectRatio=width+'/'+height;
 wrap.append(label,canvas);container.append(wrap);observer.observe(canvas);
 const [a,res]=await Promise.all([atlas(entry.atlas),fetch(new URL(entry.name+'.json',base))]);
 if(!res.ok)throw new Error(`Rig ${res.status}: ${entry.name}`);
 const json=await res.json(),data=new SkeletonJson(new AtlasAttachmentLoader(a)).readSkeletonData(json);
 const pose=new SpinePose(data,'idle'),obj={entry,pose,json,atlas:a,canvas,wrap,mode:'idle',elapsed:0,repeat:false,dirty:true};
 actors.push(obj);wrap.dataset.loaded='true';return obj;
}
function run(a,animation,repeat=false){
 a.elapsed=0;a.mode=animation;a.repeat=repeat;a.dirty=true;a.wrap.dataset.animation=animation;
 if(still.checked){
  a.pose.state.clearTracks();a.pose.skeleton.setToSetupPose();
  a.pose.state.setAnimation(0,'setup',false);return;
 }
 const loop=animation==='idle'||animation==='paying';
 // Fresh seeded suction track; never mix an old paying pose into the portal.
 if(animation==='remove'){
  const json={...a.json,animations:{...a.json.animations,remove:portalRemovalTracks(`preview-event-${removalEvent}:${a.entry.name}`)}};
  a.pose=new SpinePose(new SkeletonJson(new AtlasAttachmentLoader(a.atlas)).readSkeletonData(json),'remove');
 }
 if(animation==='cycle'){
  const json={...a.json,animations:{...a.json.animations,cycle:gateCycleTracks(`preview-gate-${gateEvent}:${a.entry.name}`)}};
  a.pose=new SpinePose(new SkeletonJson(new AtlasAttachmentLoader(a.atlas)).readSkeletonData(json),'cycle');
  a.pose.state.clearTracks();a.pose.skeleton.setToSetupPose();
 }
 a.pose.state.setAnimation(0,animation,loop);
 if(animation==='land'||animation==='enter')a.pose.state.addAnimation(0,'idle',true,0);
}
function draw(now){
 requestAnimationFrame(draw);if(document.hidden){last=now;return;}
 if(now-last<1000/30)return;
 const dt=Math.min((now-last)/1000,.067);last=now;const start=performance.now();drawn=0;
 for(const a of actors){
  const {canvas}=a,ctx=canvas.getContext('2d');const dpr=Math.min(devicePixelRatio,2);
  const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;a.dirty=true;}
  a.elapsed+=pause.checked?0:dt;
  if(!still.checked&&!pause.checked&&a.repeat&&a.elapsed>(a.mode==='cycle'?3:1.15)&&['land','remove','cycle'].includes(a.mode)){
   if(a.mode==='remove')removalEvent++;if(a.mode==='cycle')gateEvent++;run(a,a.mode,true);
  }
  const advance=still.checked||pause.checked?0:a.mode==='cycle'?gateClockStep(a.pose.state.getCurrent(0)?.trackTime??0,dt,Number(speed.value)):dt*Number(speed.value);
  const pose=a.pose;pose.update(advance);
  if(!visible.get(canvas)||((still.checked||pause.checked)&&!a.dirty))continue;
  drawn++;a.dirty=false;
  ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  pose.draw(ctx,w/2,h/2,Math.min(w/pose.data.width,h/pose.data.height));
  if(a.entry.group==='gates')drawReward(a,ctx,w,h);
 }
 frames++;frameMs+=performance.now()-start;
 if(now-measuredAt>2000){
  status.textContent=`${actors.length}/${expected} rigs loaded · ${failures} errors · ${drawn} drawn surfaces · ${(frameMs/frames).toFixed(1)} ms draw/frame (desktop preview only)`;
  frames=0;frameMs=0;measuredAt=now;
 }
}
requestAnimationFrame(draw);
function drawReward(a,ctx,w,h){
 const {skeleton,data}=a.pose,bone=skeleton.findBone('reward'),slot=skeleton.findSlot('reward');
 if(slot.color.a<=0)return;
 const s=Math.min(w/data.width,h/data.height),text=rewardText.value.slice(0,32)||'8×';
 ctx.save();ctx.transform(s*bone.a,-s*bone.c,-s*bone.b,s*bone.d,w/2+s*bone.worldX,h/2-s*bone.worldY);
 ctx.globalAlpha=slot.color.a;ctx.font='88px GatesCartoon, system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
 const fit=Math.min(1,180/Math.max(1,ctx.measureText(text).width));ctx.scale(fit,fit);
 ctx.lineJoin='round';ctx.lineWidth=11;ctx.strokeStyle='#18052e';ctx.strokeText(text,0,0);
 ctx.fillStyle='#fff2b2';ctx.fillText(text,0,0);ctx.restore();
}
const symbols=document.querySelector('#symbols'),win=document.querySelector('#wins'),bonus=document.querySelector('#bonuses'),gates=document.querySelector('#gates');
await document.fonts.load('88px GatesCartoon');
for(const [entries,container,w,h] of [[manifest.symbols,symbols,240,240],[manifest.gates,gates,1000,620],[manifest.wins,win,1000,720],[manifest.bonuses,bonus,800,600]]){
 for(const entry of entries){try{await actor(entry,container,w,h);}catch(e){failures++;status.textContent=String(e);console.error(e);}}
}
status.textContent=`${actors.length}/${expected} rigs loaded · ${failures} errors`;
for(const button of actionButtons)button.disabled=false;
symbolPalette.disabled=false;
const group=name=>actors.filter(a=>manifest[name].some(e=>e.name===a.entry.name));
document.querySelectorAll('[data-group][data-action]').forEach(button=>button.addEventListener('click',()=>{
 if(button.dataset.action==='remove')removalEvent++;
 if(button.dataset.action==='cycle')gateEvent++;
 for(const a of group(button.dataset.group))run(a,button.dataset.action,button.dataset.repeat==='true'||['land','remove'].includes(button.dataset.action));
 if(pause.checked)inspect();
}));
still.addEventListener('change',()=>{for(const a of actors)run(a,still.checked?'setup':'idle');});
function inspect(){
 if(still.checked)return;
 pause.checked=true;
 for(const a of actors){
  for(const [pose,animation] of [[a.pose,a.mode]]){
   if(!pose)continue;pose.state.clearTracks();pose.skeleton.setToSetupPose();
   pose.state.setAnimation(0,animation,false).trackTime=Number(inspectTime.value)/1000;pose.update(0);
  }
  a.dirty=true;
 }
 document.querySelector('#inspect-value').textContent=inspectTime.value+' ms';
}
inspectTime.addEventListener('input',inspect);
pause.addEventListener('change',()=>{if(pause.checked)inspect();});
rewardText.addEventListener('input',()=>{for(const a of group('gates'))a.dirty=true;});
symbolPalette.addEventListener('change',async()=>{
 symbolPalette.disabled=true;
 const buttons=actionButtons.filter(b=>b.dataset.group==='symbols');for(const b of buttons)b.disabled=true;
 try{
  const next=await atlas(manifest.portalVariants[symbolPalette.value].symbolAtlas);
  for(const a of group('symbols')){
   a.atlas=next;
   a.pose=new SpinePose(new SkeletonJson(new AtlasAttachmentLoader(next)).readSkeletonData(a.json),'idle');
   run(a,'idle');
  }
 }catch(error){failures++;status.textContent=String(error);console.error(error);}
 finally{symbolPalette.disabled=false;for(const b of buttons)b.disabled=false;}
});
// Animation clocks remain continuous when speeds change; no restarting airborne poses.
window.addEventListener('pagehide',()=>{observer.disconnect();for(const a of actors)a.pose.state.clearTracks();},{once:true});

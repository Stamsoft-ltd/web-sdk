/** Standalone authored animation assets. Not a Figma layout implementation.
 * Source PNGs are referenced intact: no image edits, recoloring or vector tracing.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { portalRemovalTracks, PORTAL_SECONDS, SYMBOL_GONE_SECONDS } from './portal-removal-rig.mjs';
import { gateCycleTracks, GATE_CYCLE, GATE_SPARK_COUNT } from './gate-cycle-rig.mjs';
import { WIN_COMPOSITION as WIN, WIN_TIER_COMPOSITION } from '../src/game/winLayout.ts';
const root = fileURLToPath(new URL('../static/assets/the-gates/figma-20261012/', import.meta.url));
const out = path.join(root, 'motion');
mkdirSync(out, { recursive: true });
const inventory = JSON.parse(readFileSync(path.join(root, 'asset-manifest.json'), 'utf8'));
const assets = new Map(inventory.assets.map((a) => [a.path, a]));
const used = new Map();
const write = (name, value) => writeFileSync(path.join(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
function source(file) {
 const a = assets.get(file);
 if (!a || a.status !== 'ready') throw new Error(`Not usable animation art: ${file}`);
 const sha = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
 if (sha !== a.sha256) throw new Error(`Source hash changed: ${file}`);
 used.set(file, { path: file, sha256: sha, nodeId: a.nodeId ?? null });
 return a;
}
function atlas(entries) {
 return entries.map(([region, file]) => {
  const a = source(file);
  const crop = file === 'symbols/key-original.png' ? [12,13,113,95] : [0,0,a.width,a.height];
  return `../${file}\nsize: ${a.width},${a.height}\nfilter: Linear,Linear\npma: false\n${region}\n  bounds: ${crop.join(',')}\n\n`;
 }).join('');
}
function rig(width, height) {
 return { skeleton: { spine: '4.2.74', x: -width/2, y: -height/2, width, height }, bones: [{ name: 'root' }], slots: [], skins: [{ name: 'default', attachments: {} }], animations: {} };
}
function bone(r, name, parent = 'root', x = 0, y = 0) { r.bones.push({ name, parent, x, y }); }
function part(r, name, file, width, x = 0, y = 0, parent = 'root') {
 const original = source(file); const a = file === 'symbols/key-original.png' ? {...original,width:113,height:95} : original; bone(r, name, parent, x, y);
 r.slots.push({ name, bone: name, attachment: name });
 r.skins[0].attachments[name] = { [name]: { path: name, width, height: width*a.height/a.width } };
}
const scale = (frames) => frames.map(([time, x, y = x]) => ({ time, x, y }));
const translate = (frames) => frames.map(([time, x, y]) => ({ time, x, y }));
const rotate = (frames) => frames.map(([time, value]) => ({ time, value }));
const alpha = (frames) => frames.map(([time, value]) => ({ time, value }));
const sway = (duration, angle) => rotate([[0,0],[duration*.25,angle],[duration*.5,0],[duration*.75,-angle],[duration,0]]);
const breathe = (duration, amount) => scale([[0,1],[duration*.5,amount],[duration,1]]);
const symbols = {
 GUARDIAN_MASK: 'pharaoh', SUN_MEDALLION: 'coin', SACRED_EYE: 'eye',
 RUNE_CHALICE: 'letter', CRYSTAL_ORB: 'orb', RED_GEM: 'red-gem',
 BLUE_GEM: 'blue-gem', GREEN_GEM: 'green-gem', PURPLE_GEM: 'purple-gem',
 AMBER_GEM: 'gold-gem', KEY: 'key-original',
};
const symbolEntries = [];
const portalRoot=path.join(root,'../portals-20261012');
const portalVariants=Object.fromEntries(['normal','super','hidden'].map(tier=>{
 const a=JSON.parse(readFileSync(path.join(portalRoot,`${tier}-provenance.json`),'utf8'));
 if(a.tier!==tier||a.rimCenterAlpha!==0||createHash('sha256').update(readFileSync(path.join(portalRoot,a.path))).digest('hex')!==a.sha256)throw new Error(`Invalid portal variant: ${tier}`);
 return [tier,a];
}));
const portalSource=portalVariants.normal;
function portalAtlasFor(a){return `../../portals-20261012/${a.path}\nsize: ${a.width},${a.height}\nfilter: Linear,Linear\npma: false\n`+Object.entries(a.regions).map(([name,box])=>`${name}\n  bounds: ${box.join(',')}\n`).join('')+'\n';}
for (const [name, file] of Object.entries(symbols)) {
 const png = `symbols/${file}.png`, original = source(png), a = name === 'KEY' ? {...original,width:113,height:95,alphaBounds:[0,0,113,95]} : original, r = rig(240,240);
 const fit=144/Math.max(a.width,a.height);
 const floorY=(a.height/2-(a.alphaBounds?.[3]??a.height))*fit;
 bone(r, 'impact', 'root', 0, floorY);
 const width = a.width*fit;
 part(r, 'body', png, width, 0, -floorY, 'impact');
 symbolEntries.push([`${name}-art`, png]);
 r.skins[0].attachments.body.body.path = `${name}-art`;
 // Spine scale keys multiply setup scale: keep setup at 1; hidden slots hide portal.
 bone(r,'portal-root','root',0,-14);
 for(const [layer,width] of [['portal-vortex',88],['portal-rim',128]]){
  bone(r,layer,'portal-root');
  const [, ,w,h]=portalSource.regions[layer];
  r.slots.push({name:layer,bone:layer,attachment:layer,color:'ffffff00'});
  r.skins[0].attachments[layer]={[layer]:{path:layer,width,height:width*h/w}};
 }
 // Both portal layers stay behind the symbol throughout suction.
 r.slots.sort((a,b)=>['portal-vortex','portal-rim','body'].indexOf(a.name)-['portal-vortex','portal-rim','body'].indexOf(b.name));
 r.animations.setup = { bones: { impact: { scale: scale([[0,1]]) } } };
 r.animations.idle = { bones: { body: { translate: translate([[0,0,0],[2.4,0,.6],[4.8,0,0]]) } } };
 // Bottom-anchored contact squash; final pose exactly restores neutral scale.
 r.animations.land = { bones: { impact: {
  scale: scale([[0,.94,1.09],[.024,1.28,.68],[.038,1.28,.68],[.066,.9,1.13],[.094,1.05,.95],[.12,1,1]]),
 } }, events: [{time:0,name:'contact'},{time:.12,name:'settled'}] };
 r.events = { contact: {}, settled: {} };
 let paying;
 if (name.endsWith('_GEM')) {
  paying = { rotate:sway(.76,5), scale:scale([[0,1],[.18,1.07,.97],[.38,1.025,1.04],[.56,.98,1.02],[.76,1]]) };
 } else if (name === 'GUARDIAN_MASK') {
  paying = { rotate:rotate([[0,0],[.18,-5],[.42,3],[.72,0],[1.1,0]]), scale:breathe(1.1,1.045) };
 } else if (name === 'SUN_MEDALLION') {
  paying = { rotate:sway(1.05,12), scale:scale([[0,1],[.26,.86,1.055],[.52,1.05,1.02],[.78,.92,1.04],[1.05,1]]) };
 } else if (name === 'SACRED_EYE') {
  paying = { rotate:sway(.94,2.5), scale:scale([[0,1],[.2,1.035,.93],[.4,1.025,1.05],[.7,1.04,1],[.94,1]]) };
 } else if (name === 'RUNE_CHALICE') {
  paying = { rotate:sway(.9,7), translate:translate([[0,0,0],[.16,0,8],[.36,0,0],[.54,0,4],[.9,0,0]]) };
 } else if (name === 'CRYSTAL_ORB') {
  paying = { rotate:rotate([[0,0],[.18,-8],[.48,18],[.78,-5],[1.12,0]]), scale:breathe(1.12,1.065) };
 } else {
  paying = { rotate:rotate([[0,0],[.16,-12],[.38,15],[.6,-4],[.82,0]]), translate:translate([[0,0,0],[.38,0,5],[.82,0,0]]) };
 }
 r.animations.paying = { bones: { body: paying } };
 r.animations.remove = portalRemovalTracks(`authored:${name}`);
 write(`${name}.json`,r);
}
const portalAtlas=portalAtlasFor(portalSource);
write('symbols.atlas',atlas(symbolEntries)+portalAtlas);
for(const [tier,a] of Object.entries(portalVariants))write(`symbols-${tier}.atlas`,atlas(symbolEntries)+portalAtlasFor(a));
const winManifest = [];
const sideFor = { sweet:[1,2], wild:[2,1], epic:[2,1], mythic:[1,2], legendary:[1,2] };
// Letter contact points in the unmodified title bitmap, not viewport coordinates.
const crownLetters = {
 sweet:{letter:'first E',u:.535,v:.09}, wild:{letter:'D',u:.746,v:.127},
 epic:{letter:'P',u:.449,v:.093}, mythic:{letter:'T',u:.49,v:.173},
 legendary:{letter:'N',u:.507,v:.107},
};
for (const tier of ['sweet','wild','epic','mythic','legendary']) {
 const r = rig(1000,720), entries = [];
 const layout=WIN_TIER_COMPOSITION[tier];
 bone(r, 'celebration');
 r.bones.find(b=>b.name==='celebration').scaleX=layout.scale;
 r.bones.find(b=>b.name==='celebration').scaleY=layout.scale;
 const add = (name,file,w,x,y) => { part(r,name,file,w,x,y,'celebration'); entries.push([name,file]); };
 add('banner',`wins/${tier}-banner.png`,700,0,WIN.bannerY);
 add('horn-left',`wins/${tier}-horn-${sideFor[tier][0]}.png`,layout.hornWidth,-layout.hornX,layout.hornY);
 r.bones.find(b=>b.name==='horn-left').rotation=-WIN.hornAngle;
 // Clean Wild plaque supports separate mirrored trumpets.
 add('horn-right',`wins/${tier}-horn-${tier==='wild'?sideFor[tier][0]:sideFor[tier][1]}.png`,layout.hornWidth,layout.hornX,layout.hornY);r.bones.find(b=>b.name==='horn-right').rotation=WIN.hornAngle; if(tier==='wild')r.bones.find(b=>b.name==='horn-right').scaleX=-1;
 const titleWidth=layout.titleWidth,title=source(`wins/${tier}-title.png`);
 add('title',`wins/${tier}-title.png`,titleWidth,0,WIN.titleY);
 bone(r,'amount','celebration',0,WIN.amountY);r.slots.push({name:'amount',bone:'amount'});
 const crown=source(`wins/${tier}-crown.png`),[left,,right,bottom]=crown.alphaBounds;
 const crownWidth=125,crownHeight=crownWidth*crown.height/crown.width;
 const letter=crownLetters[tier];
 const letterX=(letter.u-.5)*titleWidth,letterY=(.5-letter.v)*titleWidth*title.height/title.width;
 // Register visible crown bottom/center (PNG transparent padding varies per tier).
 const crownX=letterX-((left+right)/2/crown.width-.5)*crownWidth;
 const crownY=letterY-(.5-bottom/crown.height)*crownHeight+3;
 part(r,'crown',`wins/${tier}-crown.png`,crownWidth,crownX,crownY,'title');
 entries.push(['crown',`wins/${tier}-crown.png`]);
 const enter = { bones: {}, slots: {} }, idle = { bones: {} }, exit = { bones: {}, slots: {} };
 enter.bones.celebration = { scale:scale([[0,.72],[.15,.92],[.32,1.045],[.5,.985],[.68,1]]) };
 for (const [n,delay] of [['banner',0],['horn-left',.06],['horn-right',.12],['title',.12],['crown',.19],['amount',.24]]) {
  if(!r.bones.some(b=>b.name===n))continue;
  enter.bones[n] = { translate:translate([[0,0,-55],[delay,0,-55],[delay+.22,0,11],[delay+.38,0,-3],[delay+.5,0,0]]) };
  enter.slots[n] = { alpha:alpha([[0,0],[delay,0],[delay+.12,1]]) };
  exit.bones[n] = { translate:translate([[0,0,0],[.2,0,25]]) };
  exit.slots[n] = { alpha:alpha([[0,1],[.2,0]]) };
 }
 // Crown begins touching the letter, lifts clear, drops with a short rebound.
 enter.bones.crown={translate:translate([[0,0,-30],[.19,0,-30],[.44,0,42],[.66,0,-5],[.78,0,3],[.9,0,0]]),rotate:rotate([[0,0],[.19,0],[.44,-7],[.66,3],[.9,0]])};
 idle.bones.title={scale:breathe(2.8,1.018)};
 idle.bones.crown={translate:translate([[0,0,0],[1.4,0,5],[2.8,0,0]]),rotate:sway(2.8,2)};
 idle.bones['horn-left']={rotate:sway(2.8,-5)};
 idle.bones['horn-right']={rotate:sway(2.8,5)};
 r.animations={enter,idle,exit,setup:{bones:{celebration:{scale:scale([[0,1]])}}}};
 write(`win-${tier}.json`,r);write(`win-${tier}.atlas`,atlas(entries));
 winManifest.push({name:`win-${tier}`,atlas:`win-${tier}`,tier,crownAnchor:letter,independentSlots:r.slots.map(s=>s.name),notes:[]});
}
const bonuses=[];
for(const tier of ['normal','super','hidden']) {
 const r=rig(800,600);
 part(r,'title',`bonus/${tier}-title.png`,610,0,115);
 part(r,'award','panels/bonus-counter-blank.png',260,0,-145);
 r.animations={setup:{},enter:{bones:{title:{scale:scale([[0,.6],[.16,.88],[.34,1.06],[.52,.98],[.74,1]]),translate:translate([[0,0,45],[.34,0,-8],[.74,0,0]])},award:{scale:scale([[0,.75],[.3,.75],[.54,1.05],[.75,1]]),translate:translate([[0,0,-35],[.3,0,-35],[.58,0,6],[.75,0,0]])}},slots:{title:{alpha:alpha([[0,0],[.13,1]])},award:{alpha:alpha([[0,0],[.3,0],[.46,1]])}}},idle:{bones:{title:{scale:breathe(3.2,1.012)},award:{scale:breathe(3.2,1.005)}}},exit:{slots:{title:{alpha:alpha([[0,1],[.22,0]])},award:{alpha:alpha([[0,1],[.22,0]])}}}};
 write(`bonus-${tier}.json`,r);write(`bonus-${tier}.atlas`,atlas([['title',`bonus/${tier}-title.png`],['award','panels/bonus-counter-blank.png']]));bonuses.push({name:`bonus-${tier}`,atlas:`bonus-${tier}`});
}
const gates=[];
const sparkRoot=path.join(root,'../sparks-20261012'),sparkSource=JSON.parse(readFileSync(path.join(sparkRoot,'provenance.json'),'utf8'));
if(createHash('sha256').update(readFileSync(path.join(sparkRoot,sparkSource.path))).digest('hex')!==sparkSource.sha256)throw new Error('Cartoon spark hash changed');
const sparkAtlas=`../../sparks-20261012/${sparkSource.path}\nsize: ${sparkSource.width},${sparkSource.height}\nfilter: Linear,Linear\npma: false\nimpact-spark\n  bounds: 0,0,${sparkSource.width},${sparkSource.height}\n\n`;
for(const tier of ['normal','super','hidden']){
 const modePortal=portalVariants[tier];
 const file=`gates/${tier}-leaf-original.png`,r=rig(1000,620);
 bone(r,'stage');bone(r,'portal-root','stage');
 for(const [layer,width] of [['portal-vortex',218],['portal-rim',340]]){
  const [,,w,h]=modePortal.regions[layer];bone(r,layer,'portal-root');
  r.slots.push({name:layer,bone:layer,attachment:layer,color:'ffffff00'});
  r.skins[0].attachments[layer]={[layer]:{path:layer,width,height:width*h/w}};
 }
 // Dynamic reward, not baked or invented outcome art. Preview adapter draws localized text.
 bone(r,'reward','stage');r.slots.push({name:'reward',bone:'reward',color:'ffffff00'});
 part(r,'door-left',file,256,-128,0,'stage');
 part(r,'door-right',file,256,128,0,'stage');r.bones.find(b=>b.name==='door-right').scaleX=-1;
 for(const name of ['door-left','door-right'])r.skins[0].attachments[name][name].path='gate-leaf';
 const sparkPart=(name,width,x=0,y=0,rotation=0)=>{
  bone(r,name,'stage',x,y);r.bones.at(-1).rotation=rotation;
  r.slots.push({name,bone:name,attachment:name,color:'ffffff00'});
  r.skins[0].attachments[name]={[name]:{path:'impact-spark',width,height:width*sparkSource.height/sparkSource.width}};
 };
 sparkPart('impact-flash',100);
 // Setup positions fixed on seam; eventId only varies launch/small rotation.
 // Tracks use translated setup offsets in the factory so every runtime event has new scatter.
 for(let i=0;i<GATE_SPARK_COUNT;i++)sparkPart(`impact-spark-${i}`,36);
 r.events={gateImpact:{},gateOpened:{},rewardShown:{},rewardRemoved:{},gateFinished:{}};
 r.animations={setup:{},idle:{},cycle:gateCycleTracks(`authored-gate:${tier}`)};
 write(`gate-${tier}.json`,r);write(`gate-${tier}.atlas`,atlas([['gate-leaf',file]])+portalAtlasFor(modePortal)+sparkAtlas);
 gates.push({name:`gate-${tier}`,atlas:`gate-${tier}`,tier,group:'gates',leaf:file,portal:modePortal.path,portalSha256:modePortal.sha256,palette:modePortal.palette,mirroredRight:true,reward:'Dynamic authoritative reward only; workbench text is explicitly a demo'});
}
write('manifest.json',{
 version:1,spine:'4.2.74',status:'Standalone motion authoring; NOT integrated with game or final Figma layout',
 symbols:Object.keys(symbols).map(name=>({name,atlas:'symbols',singleBitmap:true})),wins:winManifest,bonuses,gates,
 gateCycle:{...GATE_CYCLE,rewardHoldMs:750,impactShake:'stage bone only; runtime camera wiring pending',sequence:'slide in → crash + little shake → slide open + reward spins/grows out → upright readable reward → reward removed → portal closes',source:'intact native leaf used twice; right side mirrored, never clipped reference-only leaves'},
 gateSparks:{count:GATE_SPARK_COUNT,centralFlash:true,source:sparkSource.path,sha256:sparkSource.sha256,emission:'eventId-seeded launch from seam at collision only; all gone before reopening'},
 landing:{scaleX:1.28,scaleY:.68,reboundX:.9,reboundY:1.13,pivot:'visible alpha floor',durationMs:120},
 portalVariants:Object.fromEntries(Object.entries(portalVariants).map(([tier,a])=>[tier,{path:a.path,sha256:a.sha256,palette:a.palette,provenance:`${tier}-provenance.json`,symbolAtlas:`symbols-${tier}`}])),
 removal:{kind:'cartoon-mini-portal',layers:['portal-vortex','portal-rim','body'],defaultTier:'normal',provenance:'normal-provenance.json',source:portalSource.path,sha256:portalSource.sha256,seed:'eventId + symbol/cell identity; cosmetic only'},
 animations:{symbols:['setup','idle','land','paying','remove'],presentations:['setup','enter','idle','exit'],gates:['setup','idle','cycle']},
 timings:{landMs:120,fastScale:1.5,turboScale:3,removeMs:PORTAL_SECONDS*1000,symbolGoneMs:SYMBOL_GONE_SECONDS*1000,winEnterMs:900,bonusEnterMs:750},
 sourceAssets:[...used.values()],pending:['Native symbol PNGs flattened: landing/pay poses deform intact bitmap, not independently rigged facets/faces','Bonus end/MAX WIN artwork and final screen geometry still pending'],
 integration:{landing:'reveal movement completion → land once → idle; do not restart on speed/skip change',paying:'cascadeWin positions only; never infer wins visually',removal:'tumbleRemove → portal opens behind full-size source → slow continuous shrink/twist inward → tiny source disappears → portal shrinks uniformly closed in 60ms; canonical 1000ms, runtime Normal 820ms / Fast 500ms / Turbo 180ms; seed eventId + cell/symbol; no shards',presentation:'enter once → idle → exit on existing dismissal; amounts/counts remain localized dynamic UI',reducedMotion:'clear tracks + setToSetupPose + setup animation; no looping or squash'},
});
console.log(`Authored ${Object.keys(symbols).length} symbols + ${winManifest.length} wins + ${bonuses.length} bonus intros + ${gates.length} gate cycles; source PNGs untouched.`);

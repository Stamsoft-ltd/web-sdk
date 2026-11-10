import test from 'node:test';import assert from 'node:assert/strict';
import {symbolMotion,DURATION_MS,keyPayingFrame} from './motion.mjs';
test('bounded deterministic paying gestures at every speed',()=>{
 for(const speed of [1,1.8,3])for(let t=0;t<=DURATION_MS;t+=5){
  const a=symbolMotion(t),b=symbolMotion(t/speed,{speed});
  for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<1e-9,key);
  for(const key of ['p','active','flap','seal','blink','sweep'])assert.ok(a[key]>=0&&a[key]<=1,key);
  assert.ok(Math.abs(a.glance)<=1);assert.ok(a.orbAngle<=0&&a.orbAngle>=-Math.PI*6);
 }
});
test('rest endpoints, reduced motion and held final frame',()=>{
 for(const t of [0,DURATION_MS,DURATION_MS*3])for(const key of ['active','flap','seal','blink','glance'])assert.equal(symbolMotion(t)[key],0,key);
 for(let t=0;t<=DURATION_MS;t+=17){const m=symbolMotion(t,{reduced:true});for(const key of ['active','flap','seal','blink','glance','rayAngle','orbAngle'])assert.equal(m[key],0,key);assert.equal(m.petal,-1)}
});
test('seal lifts before flap opens; settle before end',()=>{
 assert.ok(symbolMotion(180).seal>0);assert.equal(symbolMotion(180).flap,0);
 assert.ok(symbolMotion(800).flap>.9);assert.equal(symbolMotion(1750).flap,0);
});

test('orb reverses and sun rays make a full turn',()=>{
 assert.ok(symbolMotion(900).orbAngle<-Math.PI*2);
 assert.equal(symbolMotion(DURATION_MS*.82).orbAngle,-Math.PI*6);
 assert.equal(symbolMotion(DURATION_MS).orbAngle,-Math.PI*6);
 assert.ok(symbolMotion(1200).rayAngle>Math.PI);
 assert.equal(symbolMotion(DURATION_MS).rayAngle,Math.PI*2);
 assert.equal('wink' in symbolMotion(600),false);
});

test('key uses the original game paying keys and timings',async()=>{
 const {readFile}=await import('node:fs/promises');
 const rig=JSON.parse(await readFile(new URL('../../static/assets/the-gates/art/animations/KEY.json',import.meta.url),'utf8'));
 for(const k of rig.animations.paying.bones.body.rotate)assert.equal(keyPayingFrame(rig,k.time*1000).degrees,k.value);
 assert.deepEqual(keyPayingFrame(rig,380),{degrees:15,y:5});
 assert.deepEqual(keyPayingFrame(rig,190,{speed:2}),{degrees:15,y:5});
 assert.deepEqual(keyPayingFrame(rig,190,{reduced:true}),{degrees:0,y:0});
 assert.deepEqual(keyPayingFrame(rig,1800),{degrees:0,y:0});
});

test('all eight supplied preview assets match original-file provenance',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(await readFile(new URL('./assets/provenance.json',import.meta.url),'utf8'));
 assert.equal(manifest.assets.length,8);
 const root=new URL('../../',import.meta.url);
 for(const a of manifest.assets){
  const data=await readFile(new URL(a.file.replace(/^apps\/the-gates\//,''),root));
  assert.equal(createHash('sha256').update(data).digest('hex'),a.sha256,a.file);
  assert.equal(a.modified,false);
  assert.equal(data.subarray(1,4).toString(),'PNG');
 }
});

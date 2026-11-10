import test from 'node:test';
import assert from 'node:assert/strict';
import {eyeLookFrame,EYE_LOOK_MS,irisProjection} from './motion.mjs';
test('wide glances, center endpoints and speed equivalence',()=>{
 assert.deepEqual(eyeLookFrame(0),{x:0,y:0});
 assert.deepEqual(eyeLookFrame(EYE_LOOK_MS),{x:0,y:0});
 assert.equal(eyeLookFrame(EYE_LOOK_MS*.3).x,-44);
 assert.equal(eyeLookFrame(EYE_LOOK_MS*.6).x,44);
 for(let t=0;t<=EYE_LOOK_MS;t+=5){
  const f=eyeLookFrame(t);assert.ok(Math.abs(f.x)<=44&&Math.abs(f.y)<=13);
  const fast=eyeLookFrame(t/3,{speed:3});
  assert.ok(Math.abs(fast.x-f.x)<1e-10&&Math.abs(fast.y-f.y)<1e-10);
  assert.deepEqual(eyeLookFrame(t,{reduced:true}),{x:0,y:0});
 }
});

test('iris turns with the volume, symmetric perspective and neutral rest',()=>{
 assert.deepEqual(irisProjection({x:0,y:0}),{width:131,height:131});
 assert.deepEqual(irisProjection({x:-44,y:0}),irisProjection({x:44,y:0}));
 assert.ok(irisProjection({x:44,y:0}).width<115);
 assert.ok(irisProjection({x:0,y:-13}).height<131);
});

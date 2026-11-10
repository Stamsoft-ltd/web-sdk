import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code=readFileSync(new URL('../src/game/playback.svelte.ts',import.meta.url),'utf8');
const helper=code.slice(code.indexOf('\tlet capShown = false;'),code.indexOf('\tlet scatterCelebrated = false;'))
 .replace('amount: number','amount');
const begin=code.indexOf("\t\t\t\tcase 'freeSpinEnd':");
const max=code.indexOf("\t\t\t\tcase 'maxWin':",begin);
const end=code.indexOf('\n\t\t\t}',max);
const cases=code.slice(begin,end);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const run=new AsyncFunction('events','runtime','loadRig','signal','MOTION_ROOT','playGameSound','present','TIMING','exitWin','stopGameSounds','transition',
 helper+'\nfor(const e of events){switch(e.type){'+cases+'}}');
async function play(events, fail=false){
 const log=[], runtime={game:{total:2500000}};
 await run(events,runtime,async()=>{}, {aborted:false},'rigs/',()=>{},async()=>{
  log.push(runtime.overlay.kind);
  assert.equal(runtime.overlay.amount,2500000);
  if(fail)throw new Error('Cancelled');
 },{capAutoClose:4500},async()=>{},()=>{},async()=>log.push('gates'));
 return {log,runtime};
}
test('actual presentation branches show cap before summary then gates, exactly once',async()=>{
 const events=[{type:'freeSpinEnd',tier:'normal',amount:2499800,index:100},{type:'maxWin',amount:2500000,index:101}];
 const before=structuredClone(events);
 const {log,runtime}=await play(events);
 assert.deepEqual(log,['cap','summary','gates']);
 assert.deepEqual(events,before); // presentation never rewrites source book events
 assert.equal(runtime.overlay,null);
});
test('base cap and resume starting at cap still show max tally',async()=>{
 assert.deepEqual((await play([{type:'maxWin',amount:2500000,index:101}])).log,['cap']);
});
test('cancelled max tally never advances to summary',async()=>{
 await assert.rejects(play([{type:'freeSpinEnd',tier:'super',index:100},{type:'maxWin',amount:2500000,index:101}],true),/Cancelled/);
});

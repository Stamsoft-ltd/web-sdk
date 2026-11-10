import test from 'node:test';
import assert from 'node:assert/strict';
import { gateCounterResetDelay, GATE_OPEN_DURATION_MS } from '../src/game/gatePlayback.ts';
import { panelCounters, consumedGateMeter } from '../src/game/panelPresentation.ts';
import { initialState, reduceEvent } from '../src/game/reducer.ts';
test('meter reset aligns with closed-door impact at every speed', () => {
 for (const factor of [1, 1.65, 2.7]) {
  assert.equal(gateCounterResetDelay(false, factor), 360 / factor);
  assert.ok(gateCounterResetDelay(false, factor) < GATE_OPEN_DURATION_MS / factor);
 }
 assert.equal(gateCounterResetDelay(true, 1), 0);
});
test('closed-door reset affects only presentation, never multiplier/book progress', () => {
 const game = { ...initialState(), progress: 3, multiplier: 17, multiplierActive: true };
 assert.equal(panelCounters(game, false, false).progress, 3);
 assert.deepEqual(panelCounters(game, false, true), { progress: 0, multiplier: 17, multiplierActive: true });
 assert.equal(game.progress, 3);
 const next = reduceEvent(game, { index: 1, type: 'gateProgress', progress: 1 });
 assert.equal(panelCounters(next, false, false).progress, 1);
});
test('resume restores consumed gems, not premature reset before the next Gate', () => {
 const events = [{ type: 'spinStart' }, { type: 'gateProgress' }, { type: 'gateOpen' }, { type: 'gateReward' }, { type: 'reveal' }];
 assert.equal(consumedGateMeter(events, 2), false);
 assert.equal(consumedGateMeter(events, 3), true);
 assert.equal(consumedGateMeter(events, 5), true);
 events.push({ type: 'gateProgress' });
 assert.equal(consumedGateMeter(events, 6), false);
 events.push({ type: 'spinStart' });
 assert.equal(consumedGateMeter(events, 7), false);
});

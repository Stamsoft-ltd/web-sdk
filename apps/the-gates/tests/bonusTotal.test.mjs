import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, reduceEvent } from '../src/game/reducer.ts';
import { panelBonusWin } from '../src/game/panelPresentation.ts';
const event = (s, type, values) => reduceEvent(s, { type, index: s.cursor, ...values });
test('bonus starts with entry win, updates live, and matches full-round summary', () => {
	let s = event(initialState(), 'setTotalWin', { amount: 250 });
	s = event(s, 'freeSpinTrigger', { tier: 'super', totalFs: 15 });
	assert.equal(panelBonusWin(s, 0, 250), 250);
	s = event(s, 'updateFreeSpin', { amount: 1, total: 15, remaining: 14, tier: 'super' });
	assert.equal(panelBonusWin(s, 250, 120), 370);
	s = event(s, 'setTotalWin', { amount: 370 });
	assert.equal(panelBonusWin(s, 250, 120), 370);
	s = event(s, 'updateFreeSpin', { amount: 2, total: 15, remaining: 13, tier: 'super' });
	assert.equal(panelBonusWin(s, 370, 80), 450);
	s = event(s, 'setTotalWin', { amount: 450 });
	s = event(s, 'freeSpinEnd', { amount: 200, tier: 'super' });
	assert.equal(panelBonusWin(s, 370, 80), 450);
	assert.equal(s.total, 450); // wallet/round total unchanged
});
test('summary uses capped authoritative amount, never a projected uncapped win', () => {
	assert.equal(panelBonusWin({ total: 2500000, freeSpin: 15, lastType: 'freeSpinEnd' }, 2400000, 500000), 2500000);
});
test('Wild background shares raised cell order while amount layer remains above it', () => {
	const board = readFileSync(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	assert.match(board, /tile.root.zIndex = name === 'KEY' \|\| name === 'WILD' \? 10 : 0/);
	assert.match(board, /root.addChild\(background, field, mask, frame, keyLayer, payouts\)/);
});

test('summary reads cumulative authoritative total, not bonus-only freeSpinEnd amount', () => {
	const playback = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	assert.match(playback, /kind: 'summary', tier: e.tier, amount: runtime.game.total/);
});

test('cap settlement clears stale gate so summary owns rendering and Continue', () => {
	let s = event(initialState(), 'gateOpen', { gate: 1, rewardCount: 1 });
	assert.equal(s.gateOpen, true);
	s = event(s, 'spinWin', { amount: 2500000, rawAmount: 15000, multiplier: 200, capped: true });
	assert.equal(s.gateOpen, false);
	assert.equal(s.reward, null);
});

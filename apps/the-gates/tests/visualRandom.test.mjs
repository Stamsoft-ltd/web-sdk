import assert from 'node:assert/strict';
import { test } from 'node:test';
import { visualRandom, winCoinSize } from '../src/game/visualRandom.ts';
import { initialState, reduceEvent, restorePrefix } from '../src/game/reducer.ts';
test('presentation RNG is stable per cosmetic seed and stays bounded', () => {
	const samples = (seed) => {
		const rand = visualRandom(seed);
		return Array.from({ length: 100 }, () => rand());
	};
	const a = samples('round-1:event-23');
	assert.deepEqual(a, samples('round-1:event-23'));
	assert.notDeepEqual(a, samples('round-2:event-23'));
	assert.ok(a.every((v) => v >= 0 && v < 1));
	assert.equal(new Set(a).size, 100);
});
test('gate eventId preserved; index fallback and prefix replay deterministic', () => {
	const e = { type: 'gateOpen', index: 17, eventId: 'gate-uuid', gate: 1, rewardCount: 1 };
	assert.equal(reduceEvent(initialState(), e).gateEventId, 'gate-uuid');
	assert.equal(reduceEvent(initialState(), { ...e, eventId: undefined }).gateEventId, '17');
	assert.equal(restorePrefix([e], 1).gateEventId, 'gate-uuid');
});
test('coins triple original desktop size, mobile retains larger but bounded coins', () => {
	for (let tier = 0; tier < 5; tier++)
		for (const r of [0, 0.5, 1]) {
			assert.equal(winCoinSize(tier, r, 1366), 3 * (18 + r * 18 + tier * 2));
			assert.ok(winCoinSize(tier, r, 320) >= 35 && winCoinSize(tier, r, 320) <= 86);
		}
});

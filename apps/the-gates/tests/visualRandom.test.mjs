import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gateDustParticles, winCoinSize } from '../src/game/visualRandom.ts';
import { initialState, reduceEvent, restorePrefix } from '../src/game/reducer.ts';
test('dust repeats for replay, changes for each round/event, and spans space/time', () => {
	const a = gateDustParticles('round-1:event-23');
	assert.deepEqual(a, gateDustParticles('round-1:event-23'));
	assert.notDeepEqual(a, gateDustParticles('round-1:event-24'));
	assert.notDeepEqual(a, gateDustParticles('round-2:event-23'));
	assert.equal(a.length, 32);
	for (const field of ['x', 'y', 'drift', 'delay', 'duration', 'size', 'rotation'])
		assert.ok(new Set(a.map((p) => p[field])).size > 20, field);
	assert.ok(a.some((p) => p.drift < 0) && a.some((p) => p.drift > 0));
	assert.ok(Math.max(...a.map((p) => p.delay)) - Math.min(...a.map((p) => p.delay)) > 500);
	assert.ok(a[0].x < 4 && a[31].x > 96);
	for (const p of a) {
		assert.ok(p.delay >= 0 && p.delay <= 780);
		assert.ok(p.y < 0);
		assert.ok(p.duration >= 1050 && p.duration <= 2150);
	}
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

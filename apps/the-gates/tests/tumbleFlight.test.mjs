import test from 'node:test';
import assert from 'node:assert/strict';
import {
	tumbleFlightPoint,
	tumbleDestination,
	TUMBLE_FLIGHT_MS,
	TUMBLE_ARRIVAL_MS,
} from '../src/game/tumbleFlight.ts';
test('wisp targets only new 1/2/3 increments, not resets or repeated reactive updates', () => {
	assert.equal(tumbleDestination(0, 1), 1);
	assert.equal(tumbleDestination(1, 2), 2);
	assert.equal(tumbleDestination(2, 3), 3);
	for (const [a, b] of [
		[3, 0],
		[2, 2],
		[3, 4],
		[0, -1],
		[0, 1.5],
	])
		assert.equal(tumbleDestination(a, b), null);
});
test('flight starts at winning symbols and lands exactly at the selected number', () => {
	const from = { x: 450, y: 250 },
		to = { x: 100, y: 180 };
	assert.deepEqual(tumbleFlightPoint(from, to, 0), from);
	assert.deepEqual(tumbleFlightPoint(from, to, -1), from);
	const end = tumbleFlightPoint(from, to, 1);
	assert.equal(end.x, to.x);
	assert.ok(Math.abs(end.y - to.y) < 1e-9);
	assert.ok(tumbleFlightPoint(from, to, 0.5).y < (from.y + to.y) / 2);
	for (let i = 0; i <= 100; i++) {
		const p = tumbleFlightPoint(from, to, i / 100);
		assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
	}
	assert.equal(TUMBLE_FLIGHT_MS + TUMBLE_ARRIVAL_MS, 600);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	AUTOPLAY_COUNTS,
	autoplayCountAt,
	validAutoplayCount,
} from '../src/game/autoplayCounts.ts';
test('autoplay detents preserve small counts then step by 100 to 1000', () => {
	assert.deepEqual(
		AUTOPLAY_COUNTS.filter((x) => x >= 100),
		[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
	);
	assert.equal(new Set(AUTOPLAY_COUNTS).size, AUTOPLAY_COUNTS.length);
	assert.equal(autoplayCountAt(-3), 10);
	assert.equal(autoplayCountAt(900), 1000);
	for (const x of AUTOPLAY_COUNTS) assert.ok(validAutoplayCount(x));
	for (const x of [0, NaN, Infinity, 101, 150, 1100]) assert.equal(validAutoplayCount(x), false);
});
test('autoplay has no optional stop threshold controls', () => {
	const ui = readFileSync(
		new URL('../src/components/AutoplayControls.svelte', import.meta.url),
		'utf8',
	);
	assert.doesNotMatch(ui, /lossLimit|winLimit|STOP LIMITS|autoplay-limits/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedSpeed, nextSpeed, speedFactor, showsWinPanel } from '../src/game/uiPolicy.ts';
test('normal -> fast -> turbo -> normal matches exclusive studio speed flags', () => {
	let s = 'normal';
	for (const expected of ['fast', 'turbo', 'normal']) {
		s = nextSpeed(s, {});
		assert.equal(s, expected);
	}
	assert.equal(selectedSpeed({ isTurbo: true, isSuperTurbo: false }, {}), 'fast');
	assert.equal(selectedSpeed({ isTurbo: false, isSuperTurbo: true }, {}), 'turbo');
	assert.deepEqual(['normal', 'fast', 'turbo'].map(speedFactor), [1, 2, 3]);
});
test('jurisdiction restrictions cannot be bypassed by speed flags', () => {
	assert.equal(nextSpeed('fast', { disabledSuperTurbo: true }), 'normal');
	assert.equal(nextSpeed('normal', { disabledTurbo: true }), 'normal');
	assert.equal(
		selectedSpeed({ isTurbo: false, isSuperTurbo: true }, { disabledSuperTurbo: true }),
		'normal',
	);
	assert.equal(
		selectedSpeed({ isTurbo: true, isSuperTurbo: true }, { disabledTurbo: true }),
		'normal',
	);
});
test('win panel starts at 20x, including fractional boundary', () => {
	for (const n of [0, 25, 375, 750, 1000, 1999]) assert.equal(showsWinPanel(n), false);
	for (const n of [2000, 5000, 2500000]) assert.equal(showsWinPanel(n), true);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	WIN_TIERS,
	showsAnyWin,
	showsInlineWin,
	winTier,
	winTiming,
} from '../src/game/winPresentation.ts';
test('exact win boundaries in hundredths of base bet', () => {
	for (const n of [0, 999]) {
		assert.equal(showsAnyWin(n), false);
		assert.equal(showsInlineWin(n), false);
	}
	for (const n of [1000, 1001, 1999]) {
		assert.equal(showsAnyWin(n), true);
		assert.equal(showsInlineWin(n), true);
		assert.equal(winTier(n), null);
	}
	for (const [i, tier] of WIN_TIERS.entries()) {
		assert.equal(showsInlineWin(tier.minimum), false);
		assert.equal(winTier(tier.minimum)?.key, tier.key);
		assert.equal(winTier(tier.minimum - 1)?.key ?? null, WIN_TIERS[i - 1]?.key ?? null);
	}
	assert.equal(winTier(2500000)?.title, 'LEGENDARY WIN');
});
test('Veggie count/hold timings scale safely; all automatically finish counting before close', () => {
	for (const amount of [1000, ...WIN_TIERS.map((tier) => tier.minimum)]) {
		for (const factor of [1, 2, 3, 6]) {
			const timing = winTiming(amount, factor);
			assert.ok(timing.countMs < timing.holdMs);
			assert.ok(timing.countMs >= 600);
		}
	}
	assert.equal(winTiming(2000).countMs, 2500);
	assert.equal(winTiming(50000).holdMs, 8500);
	assert.equal(winTiming(1000).holdMs, 1100);
});

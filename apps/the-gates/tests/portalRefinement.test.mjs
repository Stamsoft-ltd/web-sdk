import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	portalRemovalTracks,
	PORTAL_SECONDS,
	SYMBOL_GONE_SECONDS,
	SYMBOL_FULL_SIZE_SECONDS,
} from '../src/game/portalAnimation.ts';
import { MOTION, cellMotion } from '../src/game/motion.ts';
import { BUY_CARD, BUY_MENU_PADDING } from '../src/game/buyLayout.ts';

test('suction holds full scale first, then shrinks smoothly through fifteen authored poses', () => {
	const tracks = portalRemovalTracks('event-1:cell-2');
	const keys = tracks.bones.body.scale;
	assert.equal(keys.length, 15);
	assert.equal(keys[0].x, 1);
	assert.deepEqual(keys[1], { time: SYMBOL_FULL_SIZE_SECONDS, x: 1, y: 1 });
	for (let i = 2; i < keys.length; i++) {
		assert.ok(keys[i].time > keys[i - 1].time);
		assert.ok(keys[i].x < keys[i - 1].x);
		assert.ok(keys[i].y < keys[i - 1].y);
		assert.equal(keys[i].x, keys[i].y, 'uniform shrink, no initial squash');
	}
	assert.equal(keys.at(-1).time, SYMBOL_GONE_SECONDS);
	assert.equal(SYMBOL_GONE_SECONDS, 0.86);
	assert.equal(PORTAL_SECONDS, 1);
	assert.equal(tracks.slots.body.alpha.at(-3).value, 1);
	assert.ok(tracks.slots.body.alpha.at(-3).time > SYMBOL_GONE_SECONDS * 0.9);
});
test('all speeds show the full slower removal; skipping still compresses only the remaining tail', () => {
	assert.deepEqual(
		[MOTION.normal.remove, MOTION.fast.remove, MOTION.turbo.remove],
		[820, 500, 180],
	);
	for (const speed of ['normal', 'fast', 'turbo']) {
		const original = cellMotion({ speed, kind: 'remove', cut: null, tail: 130 }, 2, 2, 0);
		assert.equal(original.duration, MOTION[speed].remove);
		const skipped = cellMotion({ speed, kind: 'remove', cut: 30, tail: 65 }, 2, 2, 0);
		assert.ok(skipped.delay + skipped.duration <= 95);
	}
});
test('buy pill clears both native frame and cost capsule; multiplier has its own blue highlight', () => {
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	const source = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.equal(BUY_MENU_PADDING, 24);
	assert.match(css, /\.cartoon-modal\.fit-wide \.mode-art\s*\{\s*margin-top: 61px;/);
	assert.match(css, /\.cartoon-modal\.fit-wide \.mode-action\s*\{\s*bottom: 48px;/);
	assert.match(css, /\.cost-tier\s*\{[\s\S]*?background: linear-gradient\(#129ae9, #0275d1\)/);
	assert.match(source, /class="cost-tier"/);
	const actionBottom = BUY_CARD.height - 48;
	const actionTop = actionBottom - (20 + 10 * 2 + 3 * 2);
	const costBottom = 38 + 61 + 57 + 4 + 32;
	assert.ok(264 - actionBottom >= 16, 'clear native inner bottom frame');
	assert.ok(actionTop - costBottom >= 8, 'clear capsule above');
});

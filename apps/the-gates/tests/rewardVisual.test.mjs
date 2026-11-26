import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { multiplierRewardText, rewardVisual, rewardMotion } from '../src/game/rewardVisual.ts';

test('equal-value add and multiply rewards have unambiguous operation-first labels', () => {
	for (const value of [2, 5, 1000]) {
		assert.equal(multiplierRewardText({ kind: 'addMultiplier', value }), `+${value}×`);
		assert.equal(multiplierRewardText({ kind: 'multiplyMultiplier', value }), `×${value}`);
	}
});
test('operation palettes, badge silhouettes and flight motion differ without relying on colour alone', () => {
	const add = rewardVisual({ kind: 'addMultiplier', value: 5 }),
		multiply = rewardVisual({ kind: 'multiplyMultiplier', value: 5 });
	assert.equal(add.badge, 'rounded');
	assert.equal(multiply.badge, 'diamond');
	assert.notEqual(add.fill, multiply.fill);
	assert.notEqual(add.accent, multiply.accent);
	assert.notDeepEqual(
		rewardMotion('addMultiplier', 350, 0.5),
		rewardMotion('multiplyMultiplier', 350, 0.5),
	);
	for (const kind of ['addMultiplier', 'multiplyMultiplier']) {
		assert.deepEqual(rewardMotion(kind, 350, 0.5, true), {
			scale: 1,
			y: 0,
			rotation: 0,
			flightRotation: 0,
		});
		for (const age of [0, 100, 350, 800, 1800, 3000]) {
			const m = rewardMotion(kind, age, 0.5);
			assert.ok(Object.values(m).every(Number.isFinite));
			assert.ok(m.scale >= 0.8 && m.scale <= 1.2);
		}
	}
});
test('presentation helpers never change authoritative reward data and ignore non-multiplier awards', () => {
	const reward = { kind: 'multiplyMultiplier', value: 5 };
	const before = JSON.stringify(reward);
	rewardVisual(reward);
	multiplierRewardText(reward);
	rewardMotion(reward.kind, 300, 0.4);
	assert.equal(JSON.stringify(reward), before);
	assert.equal(multiplierRewardText({ kind: 'extraSpin', spinsAdded: 3 }), null);
	assert.equal(rewardVisual({ kind: 'stickyWild', positions: [] }).badge, null);
});
test('portal, flight and accessible label use the same operation presentation', () => {
	const source = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
	assert.match(source('components/Game.svelte'), /multiplierRewardText\(r\)/);
	for (const file of ['components/TempleGate.svelte', 'game/gpuRewardFlight.ts']) {
		const code = source(file);
		assert.match(code, /rewardVisual\(/);
		assert.match(code, /rewardMotion\(/);
		assert.match(code, /drawRewardBadge\(/);
	}
});

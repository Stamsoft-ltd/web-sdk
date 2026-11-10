import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { logoWordScale, LOGO_IDLE_MS } from '../src/game/logoIdle.ts';
test('THE pulses first, then GATES, around independent centers in a seamless 2.5-second loop without a shared rest', () => {
	assert.equal(LOGO_IDLE_MS, 2500);
	for (const word of ['the', 'gates']) {
		assert.equal(logoWordScale(0, word), 1);
		assert.equal(logoWordScale(LOGO_IDLE_MS, word), 1);
		for (let age = 0; age < LOGO_IDLE_MS; age += 17)
			assert.ok(logoWordScale(age, word) >= 1 && logoWordScale(age, word) <= 1.08);
	}
	assert.equal(logoWordScale(1000, 'the'), 1.08);
	assert.ok(logoWordScale(1000, 'gates') > 1);
	assert.equal(logoWordScale(2200, 'the'), 1);
	assert.equal(logoWordScale(1500, 'gates'), 1.08);
	assert.ok(logoWordScale(1600, 'the') > 1);
	assert.ok(logoWordScale(1600, 'gates') > 1);
	assert.equal(logoWordScale(2500, 'gates'), 1);
	for (let age = 1; age < LOGO_IDLE_MS; age++)
		assert.ok(logoWordScale(age, 'the') > 1 || logoWordScale(age, 'gates') > 1);
});
test('reduced motion is static; presentation uses shared clock and stops on overlays', () => {
	for (const age of [100, 1000, 2500, 6000]) assert.equal(logoWordScale(age, 'the', true), 1);
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.match(game, /idle=\{entered && !entryLeavingAt && !gpu.presenting\}/);
	const scene = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.match(scene, /setIdle\(enabled: boolean, reduced: boolean\)/);
	assert.match(scene, /return entering \|\| moving/);
	assert.doesNotMatch(scene, /logoIdleBox/);
	assert.match(scene, /fitLogoArt\(badge, mainLogoBox\)/);
});

test('logo uses separate native badge and wordmarks with stronger text pulse', async () => {
	const { LOGO_LAYERS } = await import('../src/game/logoArt.ts');
	assert.equal(LOGO_LAYERS.length, 3);
	const scene = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.equal((scene.match(/createLogoArt\(engine\)/g) || []).length, 2);
	assert.match(scene, /pulseLogoText\(badge/);
	assert.match(scene, /pulseLogoText\(\s*logo/);
});

test('landing and main logo share a continuous pulse clock through the handoff', () => {
	const scene = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.match(scene, /engine.logoPulseStartedAt = introStartedAt/);
	assert.match(scene, /now - \(engine.logoPulseStartedAt \?\? idleStartedAt\)/);
	assert.match(scene, /now - \(engine.logoPulseStartedAt \?\? now\)/);
	assert.doesNotMatch(scene, /leaving \? state.leavingAt! : now\) - introStartedAt/);
});

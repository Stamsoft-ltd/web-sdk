import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TIMING, waitForDismissal } from '../src/game/presentation.ts';
const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('bonus presentation requires acknowledgement, darkens only, with no button or duplicate copy', () => {
	const bonus = source('components/BonusScreen.svelte'),
		win = source('components/WinScreen.svelte');
	assert.match(bonus, /<GpuBonusArt/);
	assert.doesNotMatch(bonus, /<button|GATE HINT|<p>|backdrop-filter|<dialog|showModal/);
	for (const screen of [bonus, win]) {
		assert.match(screen, /data-pixi-shade="true"/);
		assert.match(screen, /data-pixi-overlay/);
		assert.match(screen, /installModalFocus/);
		assert.doesNotMatch(screen, /backdrop-filter|showModal/);
	}
	const playback = source('game/playback.svelte.ts');
	assert.match(playback, /await present\(\s*signal,\s*undefined,\s*TIMING.overlayGuard/);
	assert.match(playback, /case 'freeSpinEnd':[\s\S]*?await present\(signal\);/);
	assert.match(playback, /Decode before starting the guarded bonus intro/);
	assert.match(playback, /loadRig\(`bonus-\$\{artTier\(e.tier\)\}/);
	assert.match(playback, /if \(!autoplaySettings.continueOnBonus\) stateBet.autoSpinsCounter = 0/);
	assert.ok(TIMING.bonusIntro + TIMING.bonusGuard >= 2500);
	assert.ok(TIMING.bonusIntroReduced >= 1000);
});

test('bonus acknowledgement has no auto-close; abort still cleans the pending listener', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const controller = new AbortController();
	let dismiss,
		done = false;
	const wait = waitForDismissal(controller.signal, (callback) => (dismiss = callback)).then(
		() => (done = true),
	);
	t.mock.timers.tick(60_000);
	await Promise.resolve();
	assert.equal(done, false);
	dismiss();
	await wait;
	assert.equal(done, true);
	assert.equal(dismiss, null);
	const second = new AbortController();
	const aborted = waitForDismissal(second.signal, (callback) => (dismiss = callback));
	second.abort();
	await aborted;
	assert.equal(dismiss, null);
});

test('bonus spins and summary count use native award bone in Pixi, never DOM text anchoring', () => {
	const gpu = source('components/GpuBonusArt.svelte');
	assert.match(gpu, /new Text\(/);
	assert.match(gpu, /findBone\('award'\)/);
	assert.match(gpu, /award\.setFromMatrix/);
	assert.match(gpu, /celebrationCount/);
	assert.match(gpu, /observer.disconnect\(\)/);
	assert.match(gpu, /remove\(\)/);
	assert.doesNotMatch(gpu, /new Application|new Tween|style\.transform|requestAnimationFrame/);
});

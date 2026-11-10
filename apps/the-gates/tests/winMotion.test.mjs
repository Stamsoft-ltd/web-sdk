import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	winEntranceFrame,
	winExitFrame,
	winTrumpetTilt,
	WIN_ENTER_MS,
	WIN_EXIT_MS,
	WIN_REDUCED_EXIT_MS,
} from '../src/game/winMotion.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('banner rises, title drops and trumpets converge without changing their final composition', () => {
	for (const [w, h] of [
		[1200, 784],
		[390, 844],
		[844, 390],
		[2560, 720],
	]) {
		const start = winEntranceFrame(0, w + 900, h + 600);
		assert.ok(start.bannerY < -h);
		assert.ok(start.titleY > 0 && start.titleY <= 90);
		assert.ok(start.leftX < -w && start.rightX > w);
		let previous = start;
		for (let time = 1; time <= WIN_ENTER_MS; time++) {
			const f = winEntranceFrame(time, w + 900, h + 600);
			assert.ok(f.bannerY >= previous.bannerY);
			assert.ok(f.titleY <= previous.titleY);
			assert.ok(f.leftX >= previous.leftX && f.rightX <= previous.rightX);
			previous = f;
		}
		const end = winEntranceFrame(WIN_ENTER_MS, w + 900, h + 600);
		for (const key of ['bannerY', 'titleY', 'leftX', 'rightX'])
			assert.ok(Math.abs(end[key]) < 1e-8);
		assert.equal(end.titleAlpha, 1);
	}
});
test('exit takes whole composition above screen; reduced mode fades without travel', () => {
	assert.equal(winExitFrame(0, 1600).y, 0);
	assert.deepEqual(winExitFrame(WIN_EXIT_MS, 1600), { y: -1600, alpha: 1, done: true });
	assert.ok(winExitFrame(WIN_EXIT_MS / 2, 1600).y < 0);
	assert.equal(winEntranceFrame(200, 1000, 1000, true).bannerY, 0);
	assert.equal(winEntranceFrame(200, 1000, 1000, true).leftX, 0);
	assert.deepEqual(winExitFrame(WIN_REDUCED_EXIT_MS, 1600, true), { y: 0, alpha: 0, done: true });
	const gpu = src('components/GpuWinArt.svelte');
	assert.match(gpu, /findBone\('amount'\)!\.y \+= entry.bannerY/);
	assert.match(gpu, /root.y = exit.y/);
	assert.match(gpu, /elapsed < 140 \|\| \(state.exitAt > 0 && !exit.done\)/);
	assert.match(gpu, /runtime.winExitAt;\s*gpu.engine\?\.invalidate/);
	assert.match(gpu, /updateWorldTransform\(Physics.update\)/);
	const playback = src('game/playback.svelte.ts');
	assert.match(playback, /await present\(signal, timing.holdMs\);\s*await exitWin\(signal\)/);
	assert.match(playback, /await present\(signal, TIMING.capAutoClose\);\s*await exitWin\(signal\)/);
	assert.match(playback, /runtime.overlay = null;\s*runtime.winExitAt = 0/);
});

test('coins stay in screen-space gravity while banners exit faster and trumpets dip', () => {
	assert.equal(WIN_EXIT_MS, 360);
	assert.equal(WIN_ENTER_MS, 950);
	assert.equal(winTrumpetTilt(0), 0);
	assert.equal(winTrumpetTilt(500), 9);
	assert.ok(Math.abs(winTrumpetTilt(950)) < 1e-8);
	assert.equal(winTrumpetTilt(360, true), 8);
	assert.equal(winTrumpetTilt(500, false, true), 0);
	const coins = src('components/WinCoins.svelte');
	assert.doesNotMatch(coins, /root.y =|winExitFrame/);
	assert.match(coins, /p.vy \+= gravity \* dt/);
	assert.match(coins, /if \(!runtime.winExitAt\) emission \+= dt/);
});

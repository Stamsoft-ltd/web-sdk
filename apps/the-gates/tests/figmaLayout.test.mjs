import test from 'node:test';
import assert from 'node:assert/strict';
import { fitFigmaLayout, BOARD_WINDOW } from '../src/game/figmaLayout.ts';

test('desktop adds caption clearance and keeps the authored width', () => {
	const l = fitFigmaLayout(1200, 840);
	assert.equal(l.width, 1200);
	assert.equal(l.height, 680);
	assert.equal(l.scale, 1);
	assert.equal(l.portrait, false);
	assert.equal(l.compact, false);
});
test('portrait adaptation contains the complete board and control stage', () => {
	const l = fitFigmaLayout(390, 844, true);
	assert.equal(l.portrait, true);
	assert.equal(l.width, 360);
	assert.equal(l.height, 628);
	assert.ok(l.width * l.scale <= 390);
	assert.ok(l.height * l.scale <= 830 + 1e-9);
	assert.ok(44 * l.scale >= 44, 'portrait bet controls remain 44px+');
});
test('compact landscape keeps tappable controls instead of tiny desktop buttons', () => {
	const l = fitFigmaLayout(844, 390, true);
	assert.equal(l.compact, true);
	assert.equal(l.width, 800);
	assert.equal(l.height, 360);
	assert.ok(48 * l.scale >= 44);
	assert.ok(l.height * l.scale <= 376);
});
test('empty or short viewport never gets a negative fit', () => {
	for (const [w, h] of [
		[0, 0],
		[1, 1],
		[300, 20],
	])
		assert.ok(fitFigmaLayout(w, h).scale >= 0);
});

test('portrait intro has independent clearance after shortening the game stage', () => {
	for (const [w, h] of [[320, 568]]) {
		const l = fitFigmaLayout(w, h, true);
		assert.ok(740 * l.introScale <= h - 14 + 1e-9);
		assert.ok(360 * l.introScale <= w + 1e-9);
	}
});

test('native frame opening has no added left padding and ends before bottom frame', () => {
	assert.equal(BOARD_WINDOW.left * 1494, 91);
	assert.equal(BOARD_WINDOW.top * 1052, 103);
	assert.equal((BOARD_WINDOW.left + BOARD_WINDOW.width) * 1494, 1403);
	assert.ok(Math.abs((BOARD_WINDOW.top + BOARD_WINDOW.height) * 1052 - 933) < 1e-9);
});

test('short desktop windows never switch to mobile landscape', () => {
	for (const [w, h] of [
		[844, 390],
		[667, 375],
		[1200, 500],
	]) {
		const fit = fitFigmaLayout(w, h, false);
		assert.equal(fit.width, 1200);
		assert.equal(fit.portrait, false);
		assert.equal(fit.compact, false);
		assert.ok(fit.width * fit.scale <= w + 1e-9);
		assert.ok(fit.height * fit.scale <= h - 14 + 1e-9);
	}
});

test('portrait layout stays orientation-based regardless of device signal', () => {
	for (const mobile of [false, true]) {
		const fit = fitFigmaLayout(390, 844, mobile);
		assert.equal(fit.portrait, true);
		assert.equal(fit.width, 360);
		assert.equal(fit.compact, false);
	}
});

test('modal chrome is responsive and short viewport rules copy shrinks', async () => {
	const { readFileSync } = await import('node:fs');
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	assert.match(css, /--close-size: clamp\(26px/);
	const rules = readFileSync(new URL('../src/components/Rules.svelte', import.meta.url), 'utf8');
	assert.match(rules, /grid-auto-rows: minmax\(0, 1fr\)/);
	assert.match(rules, /clamp\(10px, 3.2vh, 13px\)/);
});

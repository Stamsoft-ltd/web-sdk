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

test('autoplay refresh uses bounded detents and retains existing toggle policy', () => {
	const ui = readFileSync(
		new URL('../src/components/AutoplayControls.svelte', import.meta.url),
		'utf8',
	);
	assert.match(ui, /autoplay-count-stepper/);
	assert.match(ui, /count = autoplayCountAt\(Math.max\(0, countIndex\) \+ direction\)/);
	assert.match(ui, /disabled=\{countIndex <= 0\}/);
	assert.match(ui, /disabled=\{countIndex >= AUTOPLAY_COUNTS.length - 1\}/);
	assert.doesNotMatch(ui, /type="range"/);
	assert.match(ui, /bind:checked=\{autoplaySettings.continueOnBonus\}/);
	assert.match(ui, /stateConfig.jurisdiction.disabledAutoplay/);
	assert.match(ui, /aria-live="polite"/);
});

test('portrait autoplay uses sliced rectangular art, leaving other orientations unchanged', () => {
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	assert.match(
		css,
		/@media \(max-width: 600px\) and \(orientation: portrait\)\s*\{\s*\.modal-overlay \.autoplay-sheet \.modal-frame\s*\{\s*background: none;[\s\S]*?border-image: url\('\.\/assets\/the-gates\/ui\/confirmation-frame\.png'\) 130 120 110 120 fill/,
	);
});

test('autoplay overlay insets match its width budget and constrain the centered grid track', () => {
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	assert.match(
		css,
		/\.modal-overlay:has\(> \.autoplay-sheet\)\s*\{\s*padding: 12px;\s*grid-template-columns: minmax\(0, 1fr\);\s*grid-template-rows: minmax\(0, 1fr\);\s*place-items: center;/,
	);
	assert.match(
		css,
		/\.modal-overlay > \.cartoon-modal\.autoplay-sheet\s*\{\s*justify-self: center;\s*margin-inline: auto;\s*max-width: 100%;/,
	);
});

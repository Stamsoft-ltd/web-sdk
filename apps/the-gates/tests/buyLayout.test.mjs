import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUY_CARD, BUY_MENU_PADDING, fitBuyMenu } from '../src/game/buyLayout.ts';

const sizes = [
	[1920, 1080],
	[1200, 800],
	[1024, 768],
	[844, 390],
	[667, 375],
	[390, 844],
	[390, 650],
	[320, 568],
	[440, 956],
];
test('original card dimensions never change at any breakpoint', () => {
	assert.deepEqual(BUY_CARD, { width: 355, height: 295 });
	for (const [w, h] of sizes)
		for (const active of [false, true]) {
			const fit = fitBuyMenu(w, h, active);
			assert.equal(fit.width, fit.columns * BUY_CARD.width + BUY_MENU_PADDING * 2);
			assert.equal(fit.rows, Math.ceil(5 / fit.columns));
			assert.equal(
				fit.height,
				fit.rows * BUY_CARD.height + 44 + 140 + BUY_MENU_PADDING * 2 + (active ? 60 : 0),
			);
		}
});
test('all five cards fit without a scroll track; choose largest uniform scale', () => {
	for (const [w, h] of sizes)
		for (const active of [false, true]) {
			const fit = fitBuyMenu(w, h, active);
			assert.ok(fit.scale > 0 && fit.scale <= 1);
			assert.ok(fit.width * fit.scale <= w - 24 + 1e-9, `${w}x${h} width`);
			assert.ok(fit.height * fit.scale <= h - 24 + 1e-9, `${w}x${h} height`);
			for (let columns = 1; columns <= 5; columns++) {
				const width = columns * 355 + BUY_MENU_PADDING * 2,
					height =
						Math.ceil(5 / columns) * 295 + 44 + 140 + BUY_MENU_PADDING * 2 + (active ? 60 : 0);
				assert.ok(fit.scale + 1e-9 >= Math.min(1, (w - 24) / width, (h - 24) / height));
			}
		}
	assert.equal(fitBuyMenu(1920, 1080).columns, 5);
	assert.equal(fitBuyMenu(1200, 800).columns, 3);
	assert.ok(fitBuyMenu(844, 390).columns >= 3);
});
test('restored menu renders original captions and cards, not pages or new rectangular actions', () => {
	const source = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	const menu = source.slice(
		source.indexOf("{:else if modal === 'features'}"),
		source.indexOf("{:else if modal === 'rules'}"),
	);
	assert.match(menu, /fitted=\{buyFit\}/);
	assert.match(menu, /\['CHANCE', 'FEATURE', 'BONUS', 'SUPER', 'MYSTERY'\]/);
	assert.match(menu, /class="mode-card"/);
	assert.match(menu, /class="mode-action"/);
	assert.doesNotMatch(menu, /ButtonLabel|BuyMenu|pagination|buy-action/);
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	assert.match(
		css,
		/\.cartoon-modal\.fit-wide \.mode-card\s*\{\s*flex: 0 0 355px;\s*width: 355px;\s*height: 295px;/,
	);
});
test('HUD bonus caption remains plain visible text, not a collapsing fitted child', () => {
	const source = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	const button = source.slice(
		source.indexOf('class="feature-button"'),
		source.indexOf('class="hud-metrics"'),
	);
	assert.match(button, /t\('BONUS BUTTON'\)/);
	assert.match(button, /<span\s*>/);
	assert.doesNotMatch(button, /ButtonLabel/);
});

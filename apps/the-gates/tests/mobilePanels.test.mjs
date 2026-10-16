import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PORTRAIT_LAYOUT as p, statPanelLayout } from '../src/game/panelLayout.ts';
import { fitFigmaLayout } from '../src/game/figmaLayout.ts';
const src = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
const bottom = (b) => b.y + b.height;
const right = (b) => b.x + b.width;
test('portrait uses two equal pairs around the board with centered, evenly spaced cards', () => {
	const cards = statPanelLayout(360, p.boardTop + p.boardHeight, true);
	for (const card of [cards.tumbles, cards.multiplier, cards.freeSpins, cards.totalWin]) {
		assert.equal(card.width, 165);
		assert.equal(card.height, 48);
		assert.ok(card.x >= 0 && right(card) <= p.width);
	}
	assert.equal(cards.freeSpins.x, cards.tumbles.x);
	assert.equal(cards.totalWin.x, cards.multiplier.x);
	assert.equal(cards.freeSpins.y, cards.totalWin.y);
	assert.equal(cards.tumbles.y, cards.multiplier.y);
	assert.equal(cards.tumbles.x, p.width - right(cards.multiplier));
	assert.equal(cards.multiplier.x - right(cards.tumbles), 14);
	assert.ok(
		bottom(cards.freeSpins) + 8 < p.boardTop,
		'bonus cards clear the board and its overlapping Keys',
	);
	assert.equal(cards.tumbles.y - (p.boardTop + p.boardHeight), p.boardCardGap);
	assert.equal(p.hudTop - bottom(cards.tumbles), p.controlGap);
	assert.equal(p.metricsTop - (p.hudTop + p.hudHeight), p.controlGap);
	assert.ok(p.metricsTop + p.metricsHeight <= p.height);
	// Stats and board never jump when the feature state changes.
	assert.deepEqual(statPanelLayout(360, p.boardTop + p.boardHeight, false), cards);
});
test('portrait fit includes the enlarged header and controls at supported viewport sizes', () => {
	for (const [width, height] of [
		[320, 568],
		[390, 844],
		[430, 932],
		[768, 1024],
	]) {
		const fit = fitFigmaLayout(width, height, true);
		assert.equal(fit.height, p.height);
		assert.ok(fit.scale * p.width <= width + 1e-8);
		assert.ok(fit.scale * (p.metricsTop + p.metricsHeight) <= height - 14 + 1e-8);
	}
	const css = src('figma.css'),
		game = src('components/Game.svelte');
	assert.match(
		css,
		/\.figma-layout.portrait \.board-area\s*\{[^}]*top: var\(--portrait-board-top\)/,
	);
	assert.match(
		css,
		/\.figma-layout.portrait \.hud-button-rail\s*\{[^}]*top: var\(--portrait-hud-top\)/,
	);
	assert.match(
		css,
		/\.figma-layout.portrait \.hud-metrics > div\s*\{[^}]*top: var\(--portrait-metrics-top\)/,
	);
	assert.match(game, /--portrait-hud-top:\$\{PORTRAIT_LAYOUT.hudTop\}px/);
	assert.match(game, /--portrait-metrics-top:\$\{PORTRAIT_LAYOUT.metricsTop\}px/);
	assert.match(css, /left: 112px;\s*top: 12px;/);
	assert.match(css, /left: 141px;\s*top: 0;/);
});
test('landscape bonus rail fits four framed cards above the bet selector without overlap', () => {
	const layout = statPanelLayout(800, 352, true);
	const cards = [layout.tumbles, layout.multiplier, layout.freeSpins, layout.totalWin];
	cards.forEach((card, i) => {
		assert.equal(card.x, 10);
		assert.equal(card.width, 130);
		assert.equal(card.height, 40);
		if (i) assert.ok(card.y - bottom(cards[i - 1]) >= 6);
	});
	assert.ok(bottom(layout.totalWin) + 7 <= 269, 'reserve gap before bet adjustment controls');
	assert.ok(layout.tumbles.y < 99 && layout.multiplier.y < 155);
	const base = statPanelLayout(800, 352, false);
	assert.ok(base.tumbles.y < 99 && base.multiplier.y < 185);
	assert.ok(bottom(base.multiplier) < 269);
	const panels = src('game/gpuPanels.ts');
	assert.match(panels, /titleSize = portrait \? 11 : compact \? \(short \? 10 : 11\) : 20/);
	assert.match(panels, /portrait \? 17 : compact \? \(short \? 16 : 21\) : 30/);
});
test('all four stat cards use ornate frames only on desktop; no Remaining label at any size', () => {
	const panels = src('game/gpuPanels.ts');
	assert.doesNotMatch(panels, /fsRemaining|showRemaining|translate\('REMAINING'\)/);
	for (const [frame, box] of [
		['tumbleFrame', 'tb'],
		['multiplierFrame', 'mb'],
		['fsFrame', 'sb'],
		['bonusTotalFrame', 'wb'],
	])
		assert.ok(panels.includes(`panel(${frame}, ${box}.width, ${box}.height)`));
	const frame = panels.slice(panels.indexOf('const panel ='), panels.indexOf('let state:'));
	assert.match(frame, /state\?\.width === 360 \|\| state\?\.width === 800/);
	assert.match(frame, /frame.visible = !mobile/);
	assert.match(frame, /fill: mobileGold/);
	assert.match(panels, /new NineSliceSprite/);
	assert.match(panels, /stat-art-20261016\/stat-frame.png/);
	assert.match(panels, /stat-art-20261016\/tumble-gem.png/);
	assert.doesNotMatch(panels, /String\(i \+ 1\)/);
	assert.doesNotMatch(src('components/ScenePanels.svelte'), /REMAINING/);
	const desktop = statPanelLayout(1200, 583, true);
	assert.deepEqual(desktop.freeSpins, { x: 1000, y: 170, width: 175, height: 115 });
	assert.deepEqual(desktop.totalWin, { x: 1000, y: 292, width: 175, height: 115 });
});

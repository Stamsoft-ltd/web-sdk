import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { panelCounters } from '../src/game/panelPresentation.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('bonus exit resets only displayed counters under closed gates; preserves awarded data', () => {
	const game = { progress: 3, multiplier: 288, multiplierActive: true, total: 410955 };
	assert.deepEqual(panelCounters(game, false), {
		progress: 3,
		multiplier: 288,
		multiplierActive: true,
	});
	assert.deepEqual(panelCounters(game, true), {
		progress: 0,
		multiplier: 1,
		multiplierActive: false,
	});
	assert.equal(game.total, 410955);
	assert.equal(game.multiplier, 288);
	const playback = src('game/playback.svelte.ts');
	const transition = playback.slice(
		playback.indexOf('const transition = async'),
		playback.indexOf('let scatterCelebrated'),
	);
	assert.ok(
		transition.indexOf('await delay(closedAt / factor, signal)') <
			transition.indexOf('runtime.baseCountersReset = true'),
	);
	assert.match(transition, /if \(kind === 'exit'\) runtime.baseCountersReset = true/);
	assert.match(
		playback,
		/runtime.busy = true;\s*runtime.spinTurbo = false;\s*runtime.baseCountersReset = false/,
	);
	assert.match(src('components/Game.svelte'), /progress: shownCounters.progress/);
});
test('control images cannot drag; pointer focus is unringed but keyboard focus stays visible', () => {
	const css = src('figma.css'),
		game = src('components/Game.svelte');
	assert.match(css, /-webkit-user-drag: none/);
	assert.match(css, /-webkit-tap-highlight-color: transparent/);
	assert.match(css, /:focus:not\(:focus-visible\)[\s\S]*?outline: none/);
	assert.match(css, /:focus-visible[\s\S]*?outline: 2px solid #ffd224/);
	assert.doesNotMatch(css, /outline: 2px solid var\(--cyan\)/);
	for (const img of game.match(/<img\b[^>]*>/gs) || []) assert.match(img, /draggable="false"/);
});

test('summary shade clears at closed-gate scene switch, not after reopening', () => {
	const bonus = src('components/BonusScreen.svelte');
	assert.match(bonus, /data-pixi-shade=\{!\(summary && runtime.baseCountersReset\)\}/);
	assert.match(src('components/GpuBonusArt.svelte'), /runtime.baseCountersReset;\s*gpu.engine\?\.invalidate\(\)/);
	const playback = src('game/playback.svelte.ts');
	const transition = playback.slice(playback.indexOf('const transition = async'), playback.indexOf('let scatterCelebrated'));
	assert.ok(transition.indexOf('runtime.baseCountersReset = true') < transition.indexOf('bonusTransitionDuration(kind, reduced) - closedAt'));
});

test('GPU frame refreshes existing overlay shade without remount or resize', () => {
	const renderer = src('game/gpuRenderer.ts');
	const tick = renderer.slice(renderer.indexOf('private tick = (now: number) => {'), renderer.indexOf('\n\tdestroy()'));
	// Execute the actual renderer frame body with minimal rendering surfaces.
	const body = tick.slice(tick.indexOf('{') + 1, tick.lastIndexOf('};'));
	const frame = new Function('now', 'dev', 'document', body);
	const overlay = { dataset: { pixiShade: 'true' } };
	const rendered = [];
	const engine = {
		dead: false, previous: 0, jobs: [], renders: 0,
		overlay, shade: { visible: false },
		app: { render() {} },
		overlayApp: { canvas: { style: {} }, render() { rendered.push(engine.shade.visible); } },
	};
	frame.call(engine, 100, false, { hidden: false });
	assert.equal(engine.shade.visible, true);
	// Same overlay and same GPU jobs: only the DOM attribute changes at gate close.
	overlay.dataset.pixiShade = 'false';
	frame.call(engine, 116, false, { hidden: false });
	assert.equal(engine.shade.visible, false);
	frame.call(engine, 132, false, { hidden: false });
	assert.deepEqual(rendered, [true, false, false]);
	assert.equal(engine.overlay, overlay);
});

test('cluster amounts render above overflow symbols while retaining board clipping', () => {
	const board = src('game/gpuBoard.ts');
	assert.match(board, /root.addChild\(background, field, mask, frame, keyLayer, payouts\)/);
	assert.doesNotMatch(board, /field.addChild\(payouts\)/);
	assert.match(board, /payouts.mask = mask/);
	assert.match(board, /parent = overFrame \? keyLayer : tile.root/);
});

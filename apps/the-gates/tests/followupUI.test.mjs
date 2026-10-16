import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tumbleFlightTiming } from '../src/game/tumbleFlight.ts';
import { tumbleLabelAnchors, liveSpinWin } from '../src/game/tumbleLabels.ts';
import { fitFigmaLayout } from '../src/game/figmaLayout.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('wisp timing shrinks by speed and mobile landscape does not depend on small height', () => {
	assert.ok(tumbleFlightTiming('turbo').flight < tumbleFlightTiming('fast').flight);
	assert.ok(tumbleFlightTiming('fast').flight < tumbleFlightTiming('normal').flight);
	assert.equal(fitFigmaLayout(1200, 700, true).width, 800);
	assert.equal(fitFigmaLayout(1200, 700, false).width, 1200);
	assert.equal(fitFigmaLayout(390, 844, true).width, 360);
});
test('per-type labels choose closest winning symbol to center without changing win data', () => {
	const wins = [
		{
			symbol: 'RED_GEM',
			rawAmount: 80,
			size: 8,
			positions: [
				{ reel: 0, row: 0 },
				{ reel: 2, row: 2 },
				{ reel: 5, row: 4 },
			],
		},
	];
	const before = JSON.stringify(wins);
	assert.deepEqual(tumbleLabelAnchors(wins)[0].position, { reel: 2, row: 2 });
	assert.equal(JSON.stringify(wins), before);
	assert.equal(liveSpinWin(100, 5, true, 0, 'winning'), 500);
	assert.equal(liveSpinWin(100, 5, false, 0, 'winning'), 100);
	assert.equal(liveSpinWin(100, 5, true, 550, 'settling'), 550);
});
test('skip existing round settles wallet without reload; presentation has no continue button', () => {
	const game = src('components/Game.svelte'),
		skip = game.slice(
			game.indexOf('async function skipUnfinished'),
			game.indexOf('function startReplay'),
		);
	assert.match(skip, /finishUnfinishedRound/);
	assert.match(skip, /stateBet.balanceAmount/);
	assert.match(skip, /pending = false/);
	assert.doesNotMatch(skip, /reload\(/);
	assert.doesNotMatch(src('components/WinScreen.svelte'), /t\('CONTINUE'\)|<button/);
	assert.match(src('game/gpuRenderer.ts'), /zIndex: '40'/);
	assert.doesNotMatch(src('components/GpuSurface.svelte'), /z-index: 40/);
	assert.match(game, /onkeyup=/);
	assert.match(game, /onblur=\{releaseSpace\}/);
	assert.match(game, /buy-bet-adjuster/);
});

test('each symbol type gets one summed label and original authoritative arrays remain untouched', () => {
	const positions = [{ reel: 0, row: 0 }],
		wins = [
			{ symbol: 'RED_GEM', rawAmount: 40, size: 8, positions },
			{ symbol: 'RED_GEM', rawAmount: 80, size: 10, positions: [{ reel: 3, row: 2 }] },
		];
	const result = tumbleLabelAnchors(wins);
	assert.equal(result.length, 1);
	assert.equal(result[0].rawAmount, 120);
	assert.deepEqual(result[0].position, { reel: 3, row: 2 });
	assert.equal(positions.length, 1);
});

test('total win matches free-spin frame; payouts appear near portal removal end with larger type', () => {
	const panels = src('game/gpuPanels.ts'),
		board = src('game/gpuBoard.ts');
	assert.match(panels, /wb = geometry.totalWin/);
	assert.match(panels, /panel\(bonusTotalFrame, wb.width, wb.height\)/);
	assert.match(board, /state.phase === 'removing'/);
	assert.match(board, /duration \* 0.78/);
	assert.match(board, /fontSize: 32/);
	assert.match(src('game/gpuRenderer.ts'), /this.overlayApp.stage.addChild\(this.shade\)/);
	assert.match(src('game/gpuRenderer.ts'), /private initialized = false/);
});

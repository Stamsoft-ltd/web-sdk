import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(appRoot, '..', '..');
const appSource = (path: string) => readFileSync(resolve(appRoot, path), 'utf8');
const sharedSource = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');

describe('Theme Park manual reel stop order', () => {
	it('stops only moving reels and sorts them left to right', () => {
		const enhancedBoard = sharedSource('packages/utils-slots/src/createEnhanceBoard.ts');
		const spinningReel = sharedSource('packages/utils-slots/src/createReelForSpinning.svelte.ts');
		expect(enhancedBoard).toContain('reel.isActive()');
		expect(spinningReel).toContain('const isActive = () => spinActive');
		expect(spinningReel).toContain('spinActive = true');
		expect(spinningReel).toContain('spinActive = false');
		expect(enhancedBoard).toContain('.sort((left, right) => left.reelIndex - right.reelIndex)');
		expect(enhancedBoard).toContain('setTimeout(stopAtIndex, delayMs * index)');
		expect(enhancedBoard).toContain('if (!isMoving(reel)) return');
	});

	it('uses ordered stopping for direct, buffered, and pre-anticipation skips', () => {
		const board = appSource('src/components/Board.svelte');
		const events = appSource('src/game/bookEventHandlerMap.ts');
		const anticipation = appSource('src/components/Anticipation.svelte');
		const boardSpin = sharedSource('packages/utils-slots/src/createEnhanceBoardSpin.ts');
		const spinningReel = sharedSource('packages/utils-slots/src/createReelForSpinning.svelte.ts');
		expect(board.match(/stopSequentially/g)?.length).toBeGreaterThanOrEqual(2);
		expect(events).toContain('stateGameDerived.enhancedBoard.stopSequentially({ delayMs })');
		expect(events).toContain('onWaitingForReady: () =>');
		expect(events).toContain('onPrepared: () =>');
		expect(board).toContain('reel.finishPreSpin()');
		expect(spinningReel).toContain('const finishPreSpin = () =>');
		expect(boardSpin).toContain('onWaitingForReady?.()');
		expect(boardSpin.indexOf('onPrepared?.()')).toBeGreaterThan(boardSpin.indexOf('board.reduce('));
		const stopHandler = anticipation.slice(
			anticipation.indexOf('stopButtonClick:'),
			anticipation.indexOf('$effect(() =>', anticipation.indexOf('stopButtonClick:')),
		);
		expect(stopHandler).not.toContain('props.reel.forceStop()');
	});

	it('does not play a second full reel strip after a Theme Park super-turbo pre-spin', () => {
		const stateGame = appSource('src/game/stateGame.svelte.ts');
		const spinningReel = sharedSource('packages/utils-slots/src/createReelForSpinning.svelte.ts');
		const reelTypes = sharedSource('packages/utils-slots/src/types.ts');
		expect(stateGame).toContain('skipSuperTurboSlideWhenPreSpinning: true');
		expect(reelTypes).toContain('skipSuperTurboSlideWhenPreSpinning?: boolean');
		expect(spinningReel).toContain(
			'const skipSlide = isSpinning && reelOptions.skipSuperTurboSlideWhenPreSpinning',
		);
		expect(spinningReel).toContain('if (!skipSlide) await slideDown()');
	});
});

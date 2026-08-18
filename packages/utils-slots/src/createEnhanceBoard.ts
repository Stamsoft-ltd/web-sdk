import { createEnhanceBoardPreSpin } from './createEnhanceBoardPreSpin';
import { createEnhanceBoardSpin } from './createEnhanceBoardSpin';
import type { Reel, GetRawSymbolFromReel } from './types';

export function createEnhanceBoard() {
	function enhanceBoard<TReel extends Reel<any, any>>({ board }: { board: TReel[] }) {
		type TRawSymbol = GetRawSymbolFromReel<TReel>;

		const { preSpin } = createEnhanceBoardPreSpin({ board });
		const { spin } = createEnhanceBoardSpin({ board });
		let orderedStopRun = 0;
		const isMoving = (reel: TReel) => reel.isActive();
		const stopOne = (reel: TReel, force: boolean) => {
			if (!isMoving(reel)) return;
			const forceStoppable = reel as TReel & { forceStop?: () => void };
			if (force && forceStoppable.forceStop) forceStoppable.forceStop();
			else reel.stop();
		};
		const settle = (rawBoard?: TRawSymbol[][]) => {
			orderedStopRun += 1;
			board.forEach((reel, reelIndex) => {
				const rawSymbols = rawBoard?.[reelIndex] || [];
				reel.setSymbolsWithRawSymbols(rawSymbols);
			});
		};
		// Do not interrupt reels that already landed. Interrupting a completed reel arms its pending
		// interrupt for the NEXT spin, which made later force-stops appear to pick random columns.
		const stop = () => {
			orderedStopRun += 1;
			board.filter(isMoving).forEach((reel) => reel.stop());
		};
		// Only spinning reels expose forceStop; cascading reels fall back to their plain stop.
		const forceStop = () => {
			orderedStopRun += 1;
			board.filter(isMoving).forEach((reel) => stopOne(reel, true));
		};
		const stopSequentially = ({ force = false, delayMs = 60 } = {}) => {
			const run = ++orderedStopRun;
			const movingReels = board
				.filter(isMoving)
				.sort((left, right) => left.reelIndex - right.reelIndex);
			movingReels.forEach((reel, index) => {
				const stopAtIndex = () => {
					if (run !== orderedStopRun) return;
					stopOne(reel, force);
				};
				if (index === 0 || delayMs <= 0) stopAtIndex();
				else setTimeout(stopAtIndex, delayMs * index);
			});
		};
		const readyToSpinEffect = () => {
			board.forEach((reel) => reel.readyToSpinEffect());
		};

		return {
			board,
			preSpin,
			spin,
			settle,
			stop,
			forceStop,
			stopSequentially,
			readyToSpinEffect,
		};
	}

	return { enhanceBoard };
}

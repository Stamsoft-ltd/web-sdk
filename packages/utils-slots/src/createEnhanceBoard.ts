import { createEnhanceBoardPreSpin } from './createEnhanceBoardPreSpin';
import { createEnhanceBoardSpin } from './createEnhanceBoardSpin';
import type { Reel, GetRawSymbolFromReel } from './types';

export function createEnhanceBoard() {
	function enhanceBoard<TReel extends Reel<any, any>>({ board }: { board: TReel[] }) {
		type TRawSymbol = GetRawSymbolFromReel<TReel>;

		const { preSpin } = createEnhanceBoardPreSpin({ board });
		const { spin } = createEnhanceBoardSpin({ board });
		const settle = (rawBoard?: TRawSymbol[][]) =>
			board.forEach((reel, reelIndex) => {
				const rawSymbols = rawBoard?.[reelIndex] || [];
				reel.setSymbolsWithRawSymbols(rawSymbols);
			});
		const stop = () => board.forEach((reel) => reel.stop());
		// Only spinning reels expose forceStop; cascading reels fall back to their plain stop.
		const forceStop = () =>
			board.forEach((reel) => {
				const forceStoppable = reel as { forceStop?: () => void };
				if (forceStoppable.forceStop) forceStoppable.forceStop();
				else reel.stop();
			});
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
			readyToSpinEffect,
		};
	}

	return { enhanceBoard };
}

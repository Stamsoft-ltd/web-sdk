import config from './config';
import type { ClusterSeriesSnapshot } from './types';

const MAX_BOOK_WIN = config.betModes.BASE.max_win * 100;

export const getSuperSeriesPreviewAmount = (series: ClusterSeriesSnapshot[]) =>
	Math.min(
		MAX_BOOK_WIN,
		series.reduce((total, entry) => {
			const symbol = config.symbols[entry.symbol];
			const baseMultiplier = Number(symbol?.paytable?.[String(entry.lockedPositions.length)] ?? 0);
			return total + Math.round(baseMultiplier * 100) * Math.max(1, Number(entry.multiplier) || 1);
		}, 0),
	);

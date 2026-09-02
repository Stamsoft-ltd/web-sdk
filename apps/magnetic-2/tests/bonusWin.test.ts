import { describe, expect, it } from 'vitest';

import { capBookWinAmount, getSeriesPreviewAmount, MAX_BOOK_WIN } from '../src/game/bonusWin';
import type { ClusterSeriesSnapshot } from '../src/game/types';

const series = (
	symbol: ClusterSeriesSnapshot['symbol'],
	size: number,
	multiplier: number,
): ClusterSeriesSnapshot => ({
	id: `${symbol}-${size}-${multiplier}`,
	symbol,
	kind: 'super',
	anchorPositions: [{ reel: 0, row: 0 }],
	lockedPositions: Array.from({ length: size }, (_, index) => ({
		reel: index % 7,
		row: Math.floor(index / 7),
	})),
	multiplier,
	persistent: true,
});

describe('Mega Chain running total', () => {
	it('prices the current persistent series in book units', () => {
		expect(getSeriesPreviewAmount([series('H4', 5, 2)])).toBe(40);
		expect(getSeriesPreviewAmount([series('H1', 10, 3)])).toBe(4_500);
	});

	it('sums series and caps the preview at max win', () => {
		expect(getSeriesPreviewAmount([series('H4', 5, 2), series('L2', 10, 3)])).toBe(1_240);
		expect(getSeriesPreviewAmount([series('H1', 49, 100)])).toBe(MAX_BOOK_WIN);
	});

	it('caps a settled bonus total plus the live respin preview', () => {
		expect(capBookWinAmount(MAX_BOOK_WIN - 10 + 50)).toBe(MAX_BOOK_WIN);
	});
});

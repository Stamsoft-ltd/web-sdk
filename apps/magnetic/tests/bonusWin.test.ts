import { describe, expect, it } from 'vitest';

import { getSuperSeriesPreviewAmount } from '../src/game/bonusWin';
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
		expect(getSuperSeriesPreviewAmount([series('H4', 5, 2)])).toBe(40);
		expect(getSuperSeriesPreviewAmount([series('H1', 10, 3)])).toBe(4_500);
	});

	it('sums series and caps the preview at max win', () => {
		expect(getSuperSeriesPreviewAmount([series('H4', 5, 2), series('L2', 10, 3)])).toBe(1_240);
		expect(getSuperSeriesPreviewAmount([series('H1', 49, 100)])).toBe(2_000_000);
	});
});

import { describe, expect, it } from 'vitest';

import { resolveMagnetActivationPositions } from '../src/game/magnetActivation';
import type { RawSymbol } from '../src/game/types';

const board = (): RawSymbol[][] =>
	Array.from({ length: 7 }, () =>
		Array.from({ length: 7 }, () => ({ name: 'L1' }) as RawSymbol),
	);

describe('resolveMagnetActivationPositions', () => {
	it('uses the post-polarity magnet cell instead of stale event coordinates', () => {
		const settled = board();
		settled[6][2] = { name: 'WILD', wild: true, magnet: true };

		expect(
			resolveMagnetActivationPositions({
				eventPositions: [{ reel: 3, row: 2 }],
				board: settled,
			}),
		).toEqual([{ reel: 6, row: 2 }]);
	});

	it('keeps event coordinates when no settled magnet is available', () => {
		expect(
			resolveMagnetActivationPositions({
				eventPositions: [{ reel: 3, row: 2 }],
				board: board(),
			}),
		).toEqual([{ reel: 3, row: 2 }]);
	});
});

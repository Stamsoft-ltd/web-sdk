import { describe, expect, it } from 'vitest';

import { resolveMagnetActivationPositions } from '../src/game/magnetActivation';
import type { RawSymbol } from '../src/game/types';

const board = (): RawSymbol[][] =>
	Array.from({ length: 7 }, () =>
		Array.from({ length: 7 }, () => ({ name: 'L1' }) as RawSymbol),
	);

const magnet = (): RawSymbol => ({ name: 'WILD', wild: true, magnet: true }) as RawSymbol;

describe('resolveMagnetActivationPositions', () => {
	it('uses the post-polarity magnet cell instead of stale event coordinates', () => {
		const settled = board();
		settled[6][2] = magnet();

		expect(
			resolveMagnetActivationPositions({
				eventPositions: [{ reel: 3, row: 2 }],
				board: settled,
			}),
		).toEqual([{ reel: 6, row: 2 }]);
	});

	it('keeps the event cells when the settled board agrees with them', () => {
		const settled = board();
		settled[1][4] = magnet();
		settled[5][0] = magnet();

		expect(
			resolveMagnetActivationPositions({
				eventPositions: [{ reel: 5, row: 0 }],
				board: settled,
			}),
		).toEqual([{ reel: 5, row: 0 }]);
	});

	it('drops only the event cells the settled board does not back', () => {
		const settled = board();
		settled[2][2] = magnet();

		expect(
			resolveMagnetActivationPositions({
				eventPositions: [
					{ reel: 2, row: 2 },
					{ reel: 4, row: 6 },
				],
				board: settled,
			}),
		).toEqual([{ reel: 2, row: 2 }]);
	});

	it('activates nothing when the settled board holds no magnet', () => {
		expect(
			resolveMagnetActivationPositions({
				eventPositions: [{ reel: 3, row: 2 }],
				board: board(),
			}),
		).toEqual([]);
	});

	it('reads a magnet carried only by its visual name', () => {
		const settled = board();
		settled[0][3] = { name: 'MAGNET' } as RawSymbol;

		expect(
			resolveMagnetActivationPositions({
				eventPositions: [],
				board: settled,
			}),
		).toEqual([{ reel: 0, row: 3 }]);
	});
});

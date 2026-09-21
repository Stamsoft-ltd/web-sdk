import { describe, expect, it } from 'vitest';

import {
	collectDeviceNamesAcrossMoves,
	planPolarityDeviceDemotions,
	type PolarityMove,
} from '../src/game/polarityDevices';
import type { ClusterSeriesSnapshot, RawSymbol } from '../src/game/types';

const board = (fill: RawSymbol['name'] = 'H3'): RawSymbol[][] =>
	Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => ({ name: fill }) as RawSymbol));

const at = (reel: number, row: number) => ({ reel, row });

const series = (positions: Array<[number, number]>): ClusterSeriesSnapshot[] => [
	{
		id: 'magnet-1',
		symbol: 'L1',
		kind: 'magnet',
		anchorPositions: [],
		lockedPositions: positions.map(([reel, row]) => at(reel, row)),
		multiplier: 1,
		persistent: false,
	} as ClusterSeriesSnapshot,
];

describe('polarity device carry', () => {
	it('demotes cluster cells math named WILD when their source was a plain pay symbol', () => {
		// The 2026-09-21 recording: a locked L1 cluster slams UP. Reel 2's column moves; reel 1
		// stays put. Math's polarity board names one moved cell and one unmoved cell WILD.
		const before = board();
		before[1][3] = { name: 'L1' } as RawSymbol; // stays
		before[2][5] = { name: 'L1' } as RawSymbol; // moves to (2,4)
		before[2][6] = { name: 'L1' } as RawSymbol; // moves to (2,5)
		const moves: PolarityMove[] = [
			{ from: at(2, 5), to: at(2, 4), kind: 'cluster' },
			{ from: at(2, 6), to: at(2, 5), kind: 'cluster' },
			{ from: at(2, 0), to: at(2, 6), kind: 'filler' },
		];
		const carried = collectDeviceNamesAcrossMoves({ board: before, moves });

		const after = board();
		after[1][3] = { name: 'WILD', wild: true } as RawSymbol;
		after[2][4] = { name: 'WILD', wild: true, magnet: true } as RawSymbol;
		after[2][5] = { name: 'L1' } as RawSymbol;
		after[2][6] = { name: 'H2' } as RawSymbol;

		expect(
			planPolarityDeviceDemotions({
				board: after,
				carried,
				series: series([
					[1, 3],
					[2, 4],
					[2, 5],
				]),
			}),
		).toEqual([
			{ position: at(1, 3), from: 'WILD', to: 'L1' },
			{ position: at(2, 4), from: 'WILD', to: 'L1' },
		]);
	});

	it('keeps a genuine wild that the slam moved', () => {
		const before = board();
		before[4][6] = { name: 'WILD', wild: true } as RawSymbol;
		const moves: PolarityMove[] = [{ from: at(4, 6), to: at(4, 2), kind: 'cluster' }];
		const carried = collectDeviceNamesAcrossMoves({ board: before, moves });

		const after = board();
		after[4][2] = { name: 'WILD', wild: true } as RawSymbol;

		expect(
			planPolarityDeviceDemotions({ board: after, carried, series: series([[4, 2]]) }),
		).toEqual([]);
	});

	it('reads a destination from the cell that moved in, not the one it displaced', () => {
		const before = board();
		before[0][0] = { name: 'L1' } as RawSymbol; // moves out to (0,3)
		before[0][3] = { name: 'WILD', wild: true } as RawSymbol; // moves out to (0,6)
		before[0][6] = { name: 'MAGNET', magnet: true } as RawSymbol; // displaced by the WILD
		const moves: PolarityMove[] = [
			{ from: at(0, 0), to: at(0, 3), kind: 'cluster' },
			{ from: at(0, 3), to: at(0, 6), kind: 'cluster' },
		];
		const carried = collectDeviceNamesAcrossMoves({ board: before, moves });

		// (0,3) now holds the L1 that moved in: naming it WILD is an invention.
		// (0,6) now holds the WILD that moved in: math naming it WILD is right.
		const after = board();
		after[0][3] = { name: 'WILD', wild: true } as RawSymbol;
		after[0][6] = { name: 'WILD', wild: true } as RawSymbol;

		expect(
			planPolarityDeviceDemotions({
				board: after,
				carried,
				series: series([
					[0, 3],
					[0, 6],
				]),
			}),
		).toEqual([{ position: at(0, 3), from: 'WILD', to: 'L1' }]);
	});

	it('lets a filler destination take whatever math named it', () => {
		const before = board();
		const moves: PolarityMove[] = [{ from: at(3, 0), to: at(3, 6), kind: 'filler' }];
		const carried = collectDeviceNamesAcrossMoves({ board: before, moves });

		const after = board();
		after[3][6] = { name: 'WILD', wild: true } as RawSymbol;

		expect(planPolarityDeviceDemotions({ board: after, carried, series: [] })).toEqual([]);
	});

	it('restores an unlocked loose symbol to the name it carried in', () => {
		const before = board();
		before[5][5] = { name: 'H4' } as RawSymbol;
		const moves: PolarityMove[] = [{ from: at(5, 5), to: at(5, 1), kind: 'symbol' }];
		const carried = collectDeviceNamesAcrossMoves({ board: before, moves });

		const after = board();
		after[5][1] = { name: 'MAGNET', magnet: true } as RawSymbol;

		expect(planPolarityDeviceDemotions({ board: after, carried, series: [] })).toEqual([
			{ position: at(5, 1), from: 'MAGNET', to: 'H4' },
		]);
	});
});

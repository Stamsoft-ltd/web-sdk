import type { RawSymbol, SymbolName } from '../../game/types';
import type { BookEvent } from '../../game/typesBookEvent';

export type StoryBook = {
	id: number;
	payoutMultiplier: number;
	events: BookEvent[];
	criteria: string;
	baseGameWins: number;
	freeGameWins: number;
};

// Board cells per the contract shapes
export const cell = (name: SymbolName): RawSymbol => {
	if (name === 'W') return { name, wild: true };
	if (name === 'DC') return { name, duck: true };
	if (name === 'S_DUCK' || name === 'S_ROLLER' || name === 'S_COASTER') return { name, scatter: true };
	return { name };
};

export const wild = (multiplier?: number, persistent?: boolean): RawSymbol => ({
	name: 'W',
	wild: true,
	...(multiplier !== undefined ? { multiplier } : {}),
	...(persistent ? { persistent: true } : {}),
});

type CellSpec = SymbolName | RawSymbol;
const toCell = (spec: CellSpec): RawSymbol => (typeof spec === 'string' ? cell(spec) : spec);

// Builds a contract reveal board: 7 rows per reel — 1 padding row on top,
// 5 visible rows (indices 1..5), 1 padding row on the bottom.
export const makeBoard = (visibleReels: CellSpec[][]): RawSymbol[][] =>
	visibleReels.map((visible, reelIndex) => {
		if (visible.length !== 5) throw new Error(`reel ${reelIndex} must have 5 visible rows`);
		const padTop: SymbolName = reelIndex % 2 === 0 ? 'L4' : 'L5';
		const padBottom: SymbolName = reelIndex % 2 === 0 ? 'L2' : 'L3';
		return [cell(padTop), ...visible.map(toCell), cell(padBottom)];
	});

// Replace visible cells at persistent wild tile positions (Mega Coaster reveals
// carry the tiles baked into every freegame board).
export const bakeTiles = (
	board: RawSymbol[][],
	tiles: { reel: number; row: number; multiplier: number }[],
): RawSymbol[][] =>
	board.map((reel, reelIndex) =>
		reel.map((rawSymbol, paddedRow) => {
			const tile = tiles.find((entry) => entry.reel === reelIndex && entry.row === paddedRow - 1);
			if (!tile) return rawSymbol;
			return { name: 'W', wild: true, multiplier: tile.multiplier, persistent: true };
		}),
	);

export const PADDING_POSITIONS = [3, 7, 11, 15, 19];
export const NO_ANTICIPATION = [0, 0, 0, 0, 0];

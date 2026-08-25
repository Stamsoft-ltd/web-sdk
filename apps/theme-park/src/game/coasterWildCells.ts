import {
	BOARD_DIMENSIONS,
	BOARD_SIDE_CONTENT_INSET,
	CELL_W,
	CELL_H,
	COASTER_WILD_GRID_INSET,
} from './constants';

export type CoasterCellKey = string;

export const coasterCellKey = (reel: number, row: number): CoasterCellKey => `${reel},${row}`;

export const toCoasterCellKeys = (cells: { reel: number; row: number }[]): Set<CoasterCellKey> =>
	new Set(cells.map(({ reel, row }) => coasterCellKey(reel, row)));

export type CoasterWildRect = { x: number; y: number; width: number; height: number };

/**
 * The opaque cover of one persistent Mega Coaster Wild, in board units.
 *
 * A free edge stays inset so the cover never paints over the one grid authored into <BoardFrame>
 * and never spills through the board's side rail. An edge SHARED with another Wild takes no inset
 * at all: two inset covers left a 2 x COASTER_WILD_GRID_INSET slot open between them, and the reel
 * kept scrolling in plain sight through that slot. Neighbours that meet on the cell boundary close
 * it, and the grid line still reads there because the cover is itself a cut of the grid art.
 */
export const getCoasterWildRect = (
	reel: number,
	row: number,
	occupied: ReadonlySet<CoasterCellKey>,
): CoasterWildRect => {
	const shares = (reelStep: number, rowStep: number) =>
		occupied.has(coasterCellKey(reel + reelStep, row + rowStep));
	const edgeOrGridInset = (isBoardEdge: boolean, sharesEdge: boolean) =>
		isBoardEdge ? BOARD_SIDE_CONTENT_INSET : sharesEdge ? 0 : COASTER_WILD_GRID_INSET;

	const left = edgeOrGridInset(reel === 0, shares(-1, 0));
	const right = edgeOrGridInset(reel === BOARD_DIMENSIONS.x - 1, shares(1, 0));
	const top = shares(0, -1) ? 0 : COASTER_WILD_GRID_INSET;
	const bottom = shares(0, 1) ? 0 : COASTER_WILD_GRID_INSET;

	return {
		x: CELL_W * reel + left,
		y: CELL_H * row + top,
		width: CELL_W - left - right,
		height: CELL_H - top - bottom,
	};
};

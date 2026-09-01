import { BOARD_DIMENSIONS, BOARD_SIDE_CONTENT_INSET, CELL_W, CELL_H } from './constants';

export type CoasterCellKey = string;

export const coasterCellKey = (reel: number, row: number): CoasterCellKey => `${reel},${row}`;

export const toCoasterCellKeys = (cells: { reel: number; row: number }[]): Set<CoasterCellKey> =>
	new Set(cells.map(({ reel, row }) => coasterCellKey(reel, row)));

export type CoasterWildRect = { x: number; y: number; width: number; height: number };

/**
 * The opaque cover of one persistent Mega Coaster Wild, in board units.
 *
 * IT COVERS THE WHOLE CELL. Every inset here is a leak: the reels keep scrolling under a persistent
 * Wild for the rest of the feature, so any board unit the cover gives back at an edge is a strip of
 * moving symbols showing along the top and bottom of the sign (reported 2026-08-28, and the same
 * complaint earlier about the slot between two neighbouring Wilds).
 *
 * A free edge used to keep `COASTER_WILD_GRID_INSET` back from the boundary so the cover would not
 * paint over the one grid line authored into <BoardFrame>. That was worth doing when the cover was a
 * flat near-black rectangle. It is not any more: <CoasterWildBackground> cuts the cover out of the
 * board's OWN grid art at the same scale, so the pixels it paints over a grid line are that grid
 * line. There is nothing left to protect and no reason to hold back.
 *
 * The one inset that survives is at the board's outer rail, where the cover would spill past the
 * gameplay rect and under the frame rather than over another cell — the same
 * `BOARD_SIDE_CONTENT_INSET` <Board> already holds its reels to.
 */
export const getCoasterWildRect = (
	reel: number,
	row: number,
	// Which other cells carry a Wild no longer changes the answer — a shared edge and a free interior
	// edge both close flush now. Kept in the signature because every caller already threads it and
	// the cover and its clip mask must go on calling the same function.
	_occupied: ReadonlySet<CoasterCellKey>,
): CoasterWildRect => {
	const railInset = (isBoardEdge: boolean) => (isBoardEdge ? BOARD_SIDE_CONTENT_INSET : 0);

	const left = railInset(reel === 0);
	const right = railInset(reel === BOARD_DIMENSIONS.x - 1);
	const top = railInset(row === 0);
	const bottom = railInset(row === BOARD_DIMENSIONS.y - 1);

	return {
		x: CELL_W * reel + left,
		y: CELL_H * row + top,
		width: CELL_W - left - right,
		height: CELL_H - top - bottom,
	};
};

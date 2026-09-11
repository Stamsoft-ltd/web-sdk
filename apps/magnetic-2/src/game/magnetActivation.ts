import type { Position, RawSymbol } from './types';

const posKey = ({ reel, row }: Position) => `${reel}:${row}`;

/**
 * Which cells a magnetActivated event may light up as Magnets.
 *
 * The event carries the coordinates math chose, but when a Polarity Shifter fires in the same
 * step, books generated before the math fix report the cells as they were BEFORE the slam. The
 * presentation writes name/wild/magnet at whatever it is handed (markMagnetPositions), so a stale
 * coordinate promoted whichever ordinary symbol had shifted into that cell into a second magnet.
 *
 * The settled board is the authority: math owns it and the slam has already been applied to it.
 * Prefer the event's own cells where they agree with it, fall back to the magnets the board
 * actually has, and light up nothing at all when it has none - an activation that matches no
 * settled Magnet is a book we cannot trust, and inventing a magnet is worse than skipping a pulse.
 */
export const resolveMagnetActivationPositions = ({
	eventPositions,
	board,
}: {
	eventPositions: Position[];
	board: RawSymbol[][];
}): Position[] => {
	const settledPositions = board.flatMap((column, reel) =>
		column.flatMap((cell, row) =>
			cell.magnet || cell.name === 'MAGNET' ? [{ reel, row }] : [],
		),
	);
	if (!settledPositions.length) return [];

	const settledKeys = new Set(settledPositions.map(posKey));
	const agreed = eventPositions.filter((position) => settledKeys.has(posKey(position)));
	return agreed.length ? agreed : settledPositions;
};

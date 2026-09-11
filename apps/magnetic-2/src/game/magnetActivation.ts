import type { Position, RawSymbol } from './types';

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
	return settledPositions.length ? settledPositions : eventPositions;
};

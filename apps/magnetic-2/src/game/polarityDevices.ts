import type { ClusterSeriesSnapshot, Position, RawSymbol, SymbolName } from './types';

const posKey = ({ reel, row }: Position) => `${reel}:${row}`;

/** A wild/magnet DEVICE is named WILD or MAGNET — the same rule stateGame's updateCellRaw uses. */
export const isWildDeviceName = (name: SymbolName) => name === 'WILD' || name === 'MAGNET';

export type PolarityMove = { from: Position; to: Position; kind: 'cluster' | 'symbol' | 'filler' };

export type CarriedDevice = { name: SymbolName; isDevice: boolean };

/**
 * Which cells were wild/magnet DEVICES before a Polarity shift, keyed by where the shift puts them.
 *
 * THE BUG THIS FIXES (recording 2026-09-21, Stake build, bonus respin chain): a locked cluster of
 * plain magnets took a Polarity slam and came out of it with five of its cells drawn as WILD. Every
 * other raw-board entry point keeps the presentation's own name for a locked cell — the reveal drop
 * skips locked cells outright (`if (cell.locked) continue`) — but the slam is settled from the
 * event's board verbatim, locked cells included, and math's polarity board names cells `WILD` that
 * the board had been showing as the cluster's pay symbol for four respins. The name-based rules
 * (updateCellRaw / shouldKeepWildInCluster) do exactly what they say with a literal `WILD`, so
 * this is the one path where math's naming of a cluster cell reaches the screen.
 *
 * Polarity does not spawn symbols — it MOVES existing cells (`cluster` and `symbol` moves) and
 * back-fills with `filler` — so a destination can only hold a device if its source was one. A
 * source is a device by NAME, the same rule as everywhere else. `filler` destinations have no
 * source on the board and take math's name as they always did.
 *
 * Read BEFORE the board mutates, like the multiplier carry beside it in stateGame; applied after
 * the settle by planPolarityDeviceDemotions.
 */
export const collectDeviceNamesAcrossMoves = ({
	board,
	moves,
}: {
	board: RawSymbol[][];
	moves: PolarityMove[];
}) => {
	const destinationByFromKey = new Map(
		moves.filter((move) => move.kind !== 'filler').map((move) => [posKey(move.from), move.to]),
	);
	const fillerKeys = new Set(
		moves.filter((move) => move.kind === 'filler').map((move) => posKey(move.to)),
	);
	const carried = new Map<string, CarriedDevice>();
	board.forEach((column, reel) => {
		column.forEach((cell, row) => {
			const position = { reel, row };
			// A cell that does not move keeps its own position as the destination.
			const moved = destinationByFromKey.has(posKey(position));
			const destination = destinationByFromKey.get(posKey(position)) ?? position;
			const key = posKey(destination);
			if (fillerKeys.has(key)) return;
			// A moved cell overrides the stay-put reading of whatever cell it lands on.
			if (!moved && carried.has(key)) return;
			carried.set(key, { name: cell.name, isDevice: isWildDeviceName(cell.name) });
		});
	});
	return carried;
};

export type PolarityDeviceDemotion = { position: Position; from: SymbolName; to: SymbolName };

/**
 * Every settled cell math named a device whose source on the board was not one, with the name it
 * goes back to: its cluster's pay symbol when the cell is locked (exactly what setSeriesSnapshots
 * stamps on a non-wild cluster cell), otherwise the name it carried in.
 */
export const planPolarityDeviceDemotions = ({
	board,
	carried,
	series,
}: {
	board: RawSymbol[][];
	carried: Map<string, CarriedDevice>;
	series: ClusterSeriesSnapshot[];
}): PolarityDeviceDemotion[] => {
	const seriesSymbolByKey = new Map(
		series.flatMap((entry) =>
			entry.lockedPositions.map((position) => [posKey(position), entry.symbol] as const),
		),
	);
	return board.flatMap((column, reel) =>
		column.flatMap((cell, row) => {
			if (!isWildDeviceName(cell.name)) return [];
			const key = posKey({ reel, row });
			const source = carried.get(key);
			// No source on the board (filler, or nothing carried) — math's name stands.
			if (!source || source.isDevice) return [];
			return [
				{ position: { reel, row }, from: cell.name, to: seriesSymbolByKey.get(key) ?? source.name },
			];
		}),
	);
};

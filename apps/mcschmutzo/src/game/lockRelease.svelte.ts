import { stateGame } from './stateGame.svelte';
import type { RawSymbol } from './types';
import { SYMBOL_SIZE } from './constants';

// Letting go of the locked (Lock & Re-Spin) cells when the next spin starts, instead of snapping them
// off: the light box fades and shrinks away while the held symbol rides down with its reel (on a board-
// coloured cover that hides the reel's own symbol in that slot), clipped to the board, and fades out.
// The ride reads the reel's motion off the reel symbol that sat under the cell (`ref`): the reel keeps
// that object's index while the strip is re-padded above it, so right after the pre-spin starts it reads
// one whole strip (`span`) up and then slides back down — its offset + span is the strip's true slide.
// (The reel's own symbol objects can't carry it: settle() swaps them for fresh ones the strip doesn't
// keep, so which object is on screen once the spin starts isn't knowable from here.)

type Name = RawSymbol['name'];
type ReelSymbolRef = { rawSymbol: RawSymbol; symbolY: () => number };
export type ReleasedCell = { reel: number; gridRow: number; name: Name | ''; ref?: ReelSymbolRef; restY: number; span: number; delay: number };

/** The box lets go in place for this long before the reels start (actor waits it out). */
export const RELEASE_HOLD_MS = 450;
/** …then the held symbol rides its reel away and fades out. */
export const RELEASE_RIDE_MS = 520;
export const RELEASE_MS = RELEASE_HOLD_MS + RELEASE_RIDE_MS;

export const lockRelease = $state({
	/** What each locked cell shows right now (LockedCells keeps this current): `${reel}:${gridRow}` → name. */
	held: {} as Record<string, Name>,
	cells: [] as ReleasedCell[],
	at: 0,
});

let pruneTimer: ReturnType<typeof setTimeout> | undefined;

/** Clear the locks with the release animation (no-op when nothing is locked). Returns whether there
 *  was anything to release, so the caller can hold the reels for RELEASE_HOLD_MS. */
export const releaseLocks = () => {
	const any = stateGame.lockedPositions.length > 0;
	if (any) {
		lockRelease.cells = stateGame.lockedPositions.map(({ reel, row }) => {
			const gridRow = row - 1;
			const strip = stateGame.board[reel]?.reelState.symbols;
			const ref: ReelSymbolRef | undefined = strip?.[row];
			const name = lockRelease.held[`${reel}:${gridRow}`] ?? ref?.rawSymbol?.name ?? '';
			// each box lets go as ITS reel starts (the reels start one after another)
			const delay = reel * (stateGame.board[reel]?.reelState.spinOptions().reelSpinDelay ?? 0);
			return { reel, gridRow, name, ref, restY: ref?.symbolY() ?? 0, span: (strip?.length ?? 0) * SYMBOL_SIZE, delay };
		});
		lockRelease.at = performance.now();
		clearTimeout(pruneTimer);
		pruneTimer = setTimeout(() => (lockRelease.cells = []), RELEASE_MS + Math.max(0, ...lockRelease.cells.map((c) => c.delay)) + 50);
	}
	stateGame.lockedPositions = [];
	stateGame.lockSymbol = undefined;
	return any;
};

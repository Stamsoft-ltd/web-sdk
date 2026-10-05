// The free-games soup pot next to the chef (special bg) IS the multiplier display: its base shows the
// win multiplier. Whenever soups (M) raise the multiplier, the steps are queued here and flushed right
// away (bookEventHandlerMap) while the soups are still on the board — before any win of that spin is
// shown: each soup shoots its "+N" into the pot and, as its blob sinks, the pot's number climbs by that
// soup's steps along the Win Multiplier ladder (so two soups = two visible increases).
//
// SpecialMascot draws the pot and publishes where it is (`rect`, canvas px); PotShots draws the
// flying blobs over the board; the book-event flow queues shots and awaits `flush()`.

export type PotShot = {
	/** Board cell the soup sat in (`row` 1-based, as in book-event positions), if known. */
	reel?: number;
	row?: number;
	steps: number;
	/** The multiplier the pot shows once this shot has sunk (set by flushPot). */
	after?: number;
};

/** The Win Multiplier ladder (info page): each step moves one rung up. */
export const MULT_LADDER = [
	1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 120, 150, 200, 250, 300, 350, 400, 500,
	600, 800, 1000,
];
const climb = (mult: number, steps: number) => {
	let i = MULT_LADDER.findLastIndex((m) => m <= mult);
	if (i < 0) i = 0;
	return MULT_LADDER[Math.min(MULT_LADDER.length - 1, i + steps)];
};

// Soups that already shot during the current reveal (a later step event in the same spin must not
// shoot the same soup again). Cleared by beginPotReveal at every reveal.
const shotCells = new Set<string>();
export const beginPotReveal = () => shotCells.clear();

export const potState = $state({
	/** The multiplier shown on the pot's base. */
	mult: 1,
	/** Set by SpecialMascot while the pot is on screen (desktop free games), canvas px. */
	rect: null as null | { x: number; y: number; w: number; h: number },
	/** Shots waiting for the end of the round. */
	pending: [] as PotShot[],
	/** The volley currently flying (PotShots animates it and calls `done`). */
	volley: null as null | { shots: PotShot[]; target: number; done: () => void },
	/**
	 * Board cells handed over to their shot, potCellKey → 0..1: the cell's board symbol and (if
	 * locked) its yellow box + held symbol fade out by this much while PotShots shows the soup there.
	 */
	hidden: {} as Record<string, number>,
});

/** `reel:row` (row 1-based, as in book-event positions); '' for a shot without a known cell. */
export const potCellKey = (p: { reel?: number; row?: number }) =>
	p.reel !== undefined && p.row !== undefined ? `${p.reel}:${p.row}` : '';

/** Start of a bonus: the pot shows the starting multiplier, nothing queued. */
export const resetPot = (mult: number) => {
	potState.mult = mult;
	potState.pending = [];
	potState.volley = null;
	potState.hidden = {};
	shotCells.clear();
};

/** A soup raised the multiplier by `steps` (split across the soups that landed, if known). */
export const queuePotShots = (steps: number, positions: { reel: number; row: number }[] = []) => {
	if (steps <= 0) return;
	const fresh = positions.filter((p) => !shotCells.has(potCellKey(p)));
	if (positions.length && !fresh.length) {
		if (import.meta.env.DEV) console.warn('[pot] step event for soups that already shot this spin', { steps, positions });
		return;
	}
	if (!fresh.length) {
		potState.pending.push({ steps });
		return;
	}
	const each = Math.floor(steps / fresh.length);
	let rest = steps - each * fresh.length;
	for (const p of fresh) {
		const s = each + (rest > 0 ? 1 : 0);
		if (rest > 0) rest--;
		if (s > 0) {
			shotCells.add(potCellKey(p));
			potState.pending.push({ reel: p.reel, row: p.row, steps: s });
		}
	}
};

/**
 * End of a round: fire the queued shots into the pot and resolve once they've sunk and the pot shows
 * `target`. Without a visible pot (mobile layouts) the number just updates.
 */
export const flushPot = async (target: number) => {
	const shots = potState.pending;
	potState.pending = [];
	if (!shots.length) {
		potState.mult = target;
		return;
	}
	// A shot must visibly raise the pot: steps that don't change the value (e.g. already at the top
	// rung, or the same increase reported twice) fly no blob.
	if (target <= potState.mult) {
		if (import.meta.env.DEV) console.warn('[pot] soups added steps but the multiplier did not rise', { shots, from: potState.mult, target });
		potState.mult = target;
		return;
	}
	// each shot climbs the ladder by its own steps (never past the book's value); the last lands on it
	let cum = 0;
	shots.forEach((s, i) => {
		cum += s.steps;
		s.after = i === shots.length - 1 ? target : Math.min(target, climb(potState.mult, cum));
	});
	if (!potState.rect) {
		potState.mult = target;
		return;
	}
	await new Promise<void>((resolve) => {
		potState.volley = { shots, target, done: resolve };
	});
	potState.volley = null;
	potState.hidden = {};
	potState.mult = target;
};

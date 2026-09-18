/* Liveness for symbols at rest on the board — the splash crop's beat, played very gently.

   Every board symbol is authored with its eyes open and a glint, except the scatter king, whose
   symbol art (`onion.webp`, the same drawing as `scatter.webp`) has them shut — so he squinted
   for ever in a cell while the splash's king blinked. This gives each resting cell its own slow,
   randomly phased clock: the king rests on `scatter_open` and drops to the authored shut frame
   for a blink; a vegetable occasionally blinks or glances — its eyes slid one art pixel left or
   right — using the frames scripts/build-splash-eyes.py already cuts from these very sprites
   (splash/<name>-look-l|look-r|blink.webp), so every frame is the board art itself.

   A Svelte action on the board `<img>` (`use:symbolLiveness={cell.name}`) rather than a component,
   so the prototype's scoped `.symbol` styles still land on the same element; it only ever writes
   `src`. Gentle by construction: long per-cell rests, a board-wide cap of two cells moving at
   once and a minimum gap between starts, nothing while the board is not idle or the cell is
   dropping / winning, off under prefers-reduced-motion. Timers only — no per-frame work. */

const PIXEL_ROOT = './assets/veggie-salad/pixel';
const SCATTER_OPEN = `${PIXEL_ROOT}/scatter_open.webp`;
const SCATTER_SHUT = `${PIXEL_ROOT}/scatter.webp`;

type Beat = 'blink' | 'look-l' | 'look-r';

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/* The king keeps the splash's own rhythm; the crowd is much sparser. */
const KING = { first: [1200, 3600], rest: [2400, 5600] } as const;
const VEG = { first: [1500, 9000], rest: [6000, 14000] } as const;
const BLINK_MS: [number, number] = [130, 170];
const GLANCE_MS: [number, number] = [400, 800];
const DOUBLE_GAP_MS = 150;
const DOUBLE_CHANCE = 0.3;
const GLANCE_CHANCE = 0.55;
/* Board-wide: never more than this many cells mid-beat, and starts at least this far apart. */
const MAX_CONCURRENT = 2;
const MIN_START_GAP_MS = 350;
const RETRY_MS: [number, number] = [400, 1200];
const BUSY_CELL_CLASSES = ['cluster-hit', 'scatter-hit', 'falling'];

let active = 0;
let lastStart = 0;
const preloaded = new Set<string>();

const reducedMotion = () =>
	typeof window !== 'undefined' &&
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const preload = (src: string) => {
	if (preloaded.has(src) || typeof Image === 'undefined') return;
	preloaded.add(src);
	new Image().src = src;
};

/** The frame set for one symbol image, or null for art that has no eye frames. */
const framesFor = (img: HTMLImageElement, name: string) => {
	if (name === 'SCATTER') {
		return { rest: SCATTER_OPEN, beats: { blink: SCATTER_SHUT } as Partial<Record<Beat, string>>, clock: KING };
	}
	// splash/<file>-look-l.webp is cut from pixel/<file>.webp, so key the variants off the file
	// the board actually loaded (the cauliflower/radish files are historically swapped; the
	// variants follow the files, not the names, so they stay pixel-true).
	const file = (img.getAttribute('src') || '').split('/').pop()?.replace(/\.webp$/, '');
	if (!file) return null;
	const variant = (beat: Beat) => `${PIXEL_ROOT}/splash/${file}-${beat}.webp`;
	return {
		rest: img.getAttribute('src') || '',
		beats: { blink: variant('blink'), 'look-l': variant('look-l'), 'look-r': variant('look-r') },
		clock: VEG,
	};
};

/** Idle board, cell not dropping or celebrating, tab visible. */
const atRest = (img: HTMLImageElement) => {
	if (typeof document === 'undefined' || document.hidden) return false;
	const board = img.closest('.board');
	if (board && !board.classList.contains('phase-idle')) return false;
	const cell = img.closest('.cell');
	if (!cell) return true;
	// `falling` is a fall DISTANCE flag: the reveal handler leaves it set on every landed cell
	// until the next spin, so it only means "dropping" while the board is not idle — which the
	// check above has already ruled out. Reading it here too froze the whole board after its
	// first spin ("after a spin the veggies stop being alive", user 2026-09-16).
	return !BUSY_CELL_CLASSES.some((name) => name !== 'falling' && cell.classList.contains(name));
};

/**
 * `use:symbolLiveness={cell.name}` on the board symbol `<img>`. The board re-keys its cells on
 * every reveal, so each symbol gets a fresh clock and phase when it lands and the cleanup runs
 * when it leaves; a cell whose symbol changes is therefore never left mid-beat.
 */
export const symbolLiveness = (img: HTMLImageElement, name: string) => {
	const frames = framesFor(img, name);
	if (!frames) return;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	let holding = false;
	const at = (ms: number, fn: () => void) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			if (!disposed) fn();
		}, ms);
	};
	const release = () => {
		if (!holding) return;
		holding = false;
		active -= 1;
	};
	const show = (src: string) => {
		img.src = src;
	};

	const rest = () => at(rand(frames.clock.rest[0], frames.clock.rest[1]), beat);
	const finish = () => {
		show(frames.rest);
		release();
		rest();
	};
	const blink = (again: number) => {
		show(frames.beats.blink as string);
		at(rand(...BLINK_MS), () => {
			show(frames.rest);
			if (again > 0) at(DOUBLE_GAP_MS, () => blink(again - 1));
			else finish();
		});
	};
	const glance = () => {
		show(frames.beats[Math.random() < 0.5 ? 'look-l' : 'look-r'] as string);
		at(rand(...GLANCE_MS), finish);
	};
	const beat = () => {
		const now = Date.now();
		if (!atRest(img) || active >= MAX_CONCURRENT || now - lastStart < MIN_START_GAP_MS) {
			return at(rand(...RETRY_MS), beat);
		}
		holding = true;
		active += 1;
		lastStart = now;
		const canGlance = frames.beats['look-l'] && frames.beats['look-r'];
		if (canGlance && Math.random() < GLANCE_CHANCE) glance();
		else blink(Math.random() < DOUBLE_CHANCE ? 1 : 0);
	};

	Object.values(frames.beats).forEach((src) => src && preload(src));
	if (frames.rest !== img.getAttribute('src')) {
		preload(frames.rest);
		show(frames.rest);
	}
	if (!reducedMotion()) at(rand(frames.clock.first[0], frames.clock.first[1]), beat);

	return {
		destroy() {
			disposed = true;
			clearTimeout(timer);
			release();
		},
	};
};

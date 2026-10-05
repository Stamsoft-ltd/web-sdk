import type { RawSymbol, SymbolState } from './types';

export const SYMBOL_WIDTH = 131;
export const SYMBOL_SIZE = 120;
export const REEL_PADDING = 0.5;

const symbols = (names: RawSymbol['name'][]): RawSymbol[] => names.map((name) => ({ name }));

// Seven symbols per reel: one top pad, five visible rows, one bottom pad.
export const INITIAL_BOARD: RawSymbol[][] = [
	symbols(['L2', 'L1', 'L4', 'H2', 'L1', 'H5', 'L3']),
	symbols(['H1', 'L5', 'L2', 'H3', 'L4', 'L1', 'H4']),
	symbols(['L3', 'L5', 'S', 'H4', 'L4', 'H2', 'L1']),
	symbols(['H4', 'H3', 'L4', 'L5', 'L1', 'W', 'L2']),
	symbols(['H3', 'L3', 'L5', 'H1', 'H1', 'L4', 'H2']),
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };
export const BOARD_SIZES = {
	width: SYMBOL_WIDTH * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 1678 / 937;
export const PORTRAIT_BACKGROUND_RATIO = 937 / 1678;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;
const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = {
	width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO,
	height: LANDSCAPE_HEIGHT,
};
export const PORTRAIT_MAIN_SIZES = {
	width: PORTRAIT_HEIGHT * PORTRAIT_RATIO,
	height: PORTRAIT_HEIGHT,
};
export const HIGH_SYMBOLS = ['H1', 'H2', 'H3', 'H4', 'H5'];
export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.22,
	reelPaddingMultiplierNormal: 1.2,
	reelPaddingMultiplierAnticipated: 10,
	reelSpinDelay: 100,
};
// Normal play is paced for suspense (design ask: "too fast"): reels spin a little slower, run longer
// before stopping, stop one after another with a clear gap, and settle with a softer bounce.
// Turbo (SPIN_OPTIONS_FAST) keeps the original quick timings.
export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPaddingMultiplierNormal: 2.0,
	// Smooth start: a small wind-up, then a steady acceleration from rest that ends at EXACTLY
	// reelSpinSpeed and never exceeds it. f = t² − 0.25·t(1−t)² has f'(1) = 2, so with the leg's
	// average speed at half the spin speed its final speed is exactly reelSpinSpeed — no lurch.
	reelPreSpinSpeed: 1.4,
	reelPreSpinEasing: (t: number) => t * t - 0.25 * t * (1 - t) * (1 - t),
	reelSpinSpeed: 2.8,
	// Anticipated (yellow-frame) reels run faster than the rest, each ramping up the same smooth way
	// once the result arrives, then stop from that speed.
	reelAnticipationSpeedMulti: 1.6,
	reelAnticipationRampMs: 900,
	// Hard stop: the reel keeps its full speed right up to the landing (p = 1 → linear, no slow-down
	// before the stop), overshoots a touch and snaps back — the symbols' squash fires at that impact.
	reelStopEasingPower: 1,
	reelSpinDelay: 190,
	reelBounceBackSpeed: 0.3,
	reelBounceSizeMulti: 0.14,
};
export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelSpinSpeedBeforeBounce: 4.5,
	reelPreSpinSpeed: 6,
	reelSpinSpeed: 7,
	reelBounceSizeMulti: 0.05,
};
export const MOTION_BLUR_VELOCITY = 31;

export const zIndexes = {
	background: { backdrop: -3, normal: -2, feature: -1 },
};

// Global bump so every symbol reads a bit larger in its cell (relative per-symbol scales, tuned so
// they all look the same size, are preserved — this just multiplies them all).
const SYMBOL_SCALE = 1.08;
const spriteStates = (assetKey: string, scale = 0.92) => {
	const s = scale * SYMBOL_SCALE;
	const sprite = {
		type: 'sprite' as const,
		assetKey,
		sizeRatios: { width: s, height: s },
	};
	return {
		static: sprite,
		spin: sprite,
		land: sprite,
		win: sprite,
		postWinStatic: sprite,
		explosion: sprite,
	};
};

export const SYMBOL_INFO_MAP = {
	H1: spriteStates('mcH1', 0.96),
	H2: spriteStates('mcH2', 0.94), // Smutz cup
	// Sausage art fills its frame more than the other highs — scale it down so it reads the same size.
	H3: spriteStates('mcH3', 0.8),
	H4: spriteStates('mcH4'),
	// Onion rings read a touch large vs the other highs — scale down slightly.
	H5: spriteStates('mcH5', 0.84),
	L1: spriteStates('mcL1', 0.88),
	L2: spriteStates('mcL2', 0.88),
	L3: spriteStates('mcL3', 0.88),
	L4: spriteStates('mcL4', 0.88),
	L5: spriteStates('mcL5', 0.88),
	W: spriteStates('mcW', 1),
	S: spriteStates('mcS', 1),
	M: spriteStates('mcM'), // soup pot — the multiplier symbol
} as const;

// How long a newly locked cell takes to arrive (LockedCells' drop → impact → settle). The free-games
// flow waits this long after new locks so the next re-spin never starts over the animation.
export const LOCK_SLAM_MS = 1150;

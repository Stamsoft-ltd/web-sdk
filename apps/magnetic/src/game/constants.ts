import type { RawSymbol, SymbolState, SymbolName } from './types';

// Cells are WIDER than tall so the 7×7 grid matches the blue board-pad's ~1.21 aspect and the
// magnetic symbol art (328×264 ≈ 1.24) reads bigger. Positions/magnet math all derive from these.
export const SYMBOL_W = 114;
export const SYMBOL_H = 94;
export const SYMBOL_SIZE = SYMBOL_H;
export const BOARD_GRID_OFFSET_Y = 0;
export const BOARD_DIMENSIONS = { x: 7, y: 7 };
export const BOARD_SIZES = {
	width: SYMBOL_W * BOARD_DIMENSIONS.x,
	height: SYMBOL_H * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 1920 / 1080;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
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

export const PAY_SYMBOLS: SymbolName[] = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4'];
export const PREMIUM_SYMBOLS: SymbolName[] = ['H1', 'H2', 'H3', 'H4'];
export const LOW_SYMBOLS: SymbolName[] = ['L1', 'L2', 'L3', 'L4'];

const baseRows: RawSymbol[][] = [
	['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3'],
	['L4', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2'],
	['L3', 'L4', 'H1', 'H2', 'H3', 'H4', 'L1'],
	['L2', 'L3', 'L4', 'H1', 'H2', 'H3', 'H4'],
	['L1', 'L2', 'L3', 'L4', 'H1', 'H2', 'H3'],
	['H4', 'L1', 'L2', 'L3', 'L4', 'WILD', 'H1'],
	['H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'L4'],
].map((row) =>
	row.map((name) => ({
		name: name as SymbolName,
		wild: name === 'WILD',
		magnet: false,
		scatter: name === 'SCATTER',
	})),
);

export const INITIAL_BOARD = baseRows.map((row) => [...row]);
export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

export const SYMBOL_SIZE_RATIOS = {
	premium: { width: 0.92, height: 0.92 },
	low: { width: 0.92, height: 0.92 },
	special: { width: 0.98, height: 0.98 },
	multiplierWild: { width: 0.98, height: 0.98 },
} as const;

// createReelForSpinning needs (BOARD_DIMENSIONS.y + 2) symbols per reel:
// one hidden above the mask and one hidden below.
export const SPIN_REEL_LENGTH = BOARD_DIMENSIONS.y + 2; // 9

const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.15,
	reelSpinSpeedBeforeBounce: 4,
	reelPaddingMultiplierNormal: 1.2,
	reelPaddingMultiplierAnticipated: 3,
	reelSpinDelay: 145,
};

// Normal mode only (turbo/super-turbo use FAST/TURBO below). Speeds are 10% lower than the
// previous tuning (1.5 / 2.3 divided by 1.1), so the reels scroll 10% slower.
export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 1.36,
	reelSpinSpeed: 2.09,
	reelBounceSizeMulti: 0.3,
};

export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 3,
	reelSpinSpeed: 4,
	reelBounceSizeMulti: 0.15,
};

export const SPIN_OPTIONS_TURBO = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 6,
	reelSpinSpeed: 7,
	reelBounceSizeMulti: 0.1,
	reelSpinDelay: 60,
};

// Normal-speed timings run ~69% slower than the original tuning (x1.3 applied twice) — the
// game felt too rushed at normal speed. Turbo (BOARD_MOTION_FAST) is unchanged.
export const BOARD_MOTION_DEFAULT = {
	spin: {
		dropRows: 12,
		fadeOutMs: 0,
		clearGapMs: 0,
		durationMs: 439,
		scaleFrom: 0.98,
		reelDelayMs: 122,
		rowDelayMs: 0,
		bounceMs: 163,
		overshootRows: 0.26,
		lockPulseMs: 0,
	},
	respin: {
		dropRows: 4.8,
		fadeOutMs: 203,
		clearGapMs: 118,
		durationMs: 642,
		scaleFrom: 0.9,
		reelDelayMs: 30,
		rowDelayMs: 30,
		bounceMs: 270,
		overshootRows: 0.18,
		lockPulseMs: 304,
	},
	pulse: {
		magnetMs: 507,
		freshMs: 575,
		winMs: 946,
	},
} as const;

export const BOARD_MOTION_FAST = {
	spin: {
		dropRows: 7,
		fadeOutMs: 0,
		clearGapMs: 0,
		durationMs: 140,
		scaleFrom: 0.96,
		reelDelayMs: 18,
		rowDelayMs: 0,
		bounceMs: 56,
		overshootRows: 0.2,
		lockPulseMs: 0,
	},
	respin: {
		dropRows: 2.2,
		fadeOutMs: 40,
		clearGapMs: 18,
		durationMs: 150,
		scaleFrom: 0.96,
		reelDelayMs: 8,
		rowDelayMs: 6,
		bounceMs: 60,
		overshootRows: 0.12,
		lockPulseMs: 72,
	},
	pulse: {
		magnetMs: 90,
		freshMs: 120,
		winMs: 140,
	},
} as const;

export const SCATTER_LAND_SOUND_MAP = {
	1: 'mag_sct_001',
	2: 'mag_sct_002',
	3: 'mag_sct_002',
	4: 'mag_sct_002',
	5: 'mag_sct_002',
} as const;

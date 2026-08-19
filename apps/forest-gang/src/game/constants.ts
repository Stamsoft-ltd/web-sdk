import _ from 'lodash';

import type { RawSymbol, SymbolState } from './types';

// Symbol cells sized so the 5×4 grid fills the wooden frame's inner panel
export const SYMBOL_W = 121;   // cell width
export const SYMBOL_H = 103;   // cell height
export const SYMBOL_SIZE = SYMBOL_H; // kept as alias for height-based calculations
export const BOARD_GRID_OFFSET_Y = 0;
export const REEL_PADDING = 0.53;

const _BASE_SYMBOLS: RawSymbol[] = [
	{ name: 'A' }, { name: 'A' },
	{ name: 'K' }, { name: 'K' },
	{ name: 'Q' }, { name: 'Q' },
	{ name: 'J' }, { name: 'J' }, { name: 'J' },
	{ name: 'T' }, { name: 'T' }, { name: 'T' }, { name: 'T' },
];

const _makeRandomReel = (includeScatter: boolean): RawSymbol[] => {
	const pool = [..._BASE_SYMBOLS];
	const reel: RawSymbol[] = [];
	for (let i = 0; i < 6; i++) {
		const idx = Math.floor(Math.random() * pool.length);
		reel.push({ ...pool[idx] });
	}
	if (includeScatter) {
		reel[Math.floor(Math.random() * 6)] = { name: 'SCATTER', scatter: true };
	}
	return reel;
};

export const INITIAL_BOARD: RawSymbol[][] = [
	_makeRandomReel(false),
	_makeRandomReel(false),
	_makeRandomReel(false),
	_makeRandomReel(false),
	_makeRandomReel(false),
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };
export const BOARD_SIZES = {
	width: SYMBOL_W * BOARD_DIMENSIONS.x,   // 121 × 5 = 605
	height: SYMBOL_H * BOARD_DIMENSIONS.y,  // 103 × 4 = 412
};

export const BACKGROUND_RATIO = 2039 / 1000;
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

export const HIGH_SYMBOLS = ['FOX', 'WOLF', 'BEAR', 'RABBIT', 'SQUIRREL'];
export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

const HIGH_SYMBOL_SIZE = 0.9;
const LOW_SYMBOL_SIZE = 0.9;
const SPECIAL_SYMBOL_SIZE = 1;

const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.15,
	// The stop leg is DERIVED from the spin speed, not tuned beside it. createReelForSpinning turns
	// this exponent p into easing `1 − (1 − t)^p` and duration `p × distance / reelSpinSpeed`, so the
	// leg starts at exactly the speed the reel was already travelling — on all four paths that reach
	// it (2.3 default, 3.0 anticipated, 4 autospin-turbo, 7 turbo), not just one. The old pairing
	// (reelSpinSpeedBeforeBounce 2.8 + cubicOut, f'(0) = 3) entered the "deceleration" at 8.4 px/ms
	// against 2.3 coming in: a 130 px first frame against a 38 px cruise, wider than a 103 px cell.
	//
	// p = 2 is constant deceleration. p is the ONLY knob and it moves duration and curve together —
	// raising it brakes harder at the junction and trails off longer, over a proportionally longer
	// leg; p = 1 is the short end (linear, continuous, no deceleration). Do not add a speed here.
	// Budget at p = 2, board slideDown (reel 0 -> reel 4): 589->932 ms and 1856->2199 ms. A continuous
	// stop cannot be as short as the old one, which was only short because it accelerated.
	// Re-measure with apps/forest-gang/scripts/verify-reel-stop.mjs after changing p.
	reelStopEasingPower: 2,
	reelPaddingMultiplierNormal: 1.2,
	reelPaddingMultiplierAnticipated: 10,
	reelSpinDelay: 145,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 1.5,
	reelSpinSpeed: 2.3,
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

export const SPIN_OPTIONS_ANTICIPATED = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 2.6,
	reelSpinSpeed: 3.0,
	reelBounceSizeMulti: 0.2,
	reelPaddingMultiplierAnticipated: 16,
};

// Bought-bonus trigger spins: the player already knows the bonus is coming, so the scatter
// anticipation runs at HALF the padding — identical motion, half the wall-clock time.
export const SPIN_OPTIONS_ANTICIPATED_BOUGHT = {
	...SPIN_OPTIONS_ANTICIPATED,
	reelPaddingMultiplierAnticipated: 8,
};

export const MOTION_BLUR_VELOCITY = 31;

// Opacity of the baked spin smear at a given reel velocity (signed board-px per 60 Hz tick, as
// measured in Board.svelte). MOTION_BLUR_VELOCITY is the FULL-blur point and sits below the base
// cruise (reelSpinSpeed 2.3 px/ms = ~38 px/tick), so the body of every spin draws the pure baked
// art; the smear only dissolves once the reel is slower than that, over the band down to
// BLUR_FADE_FLOOR. Replaces a bare `velocity > MOTION_BLUR_VELOCITY` branch swap, which changed
// sharpness AND per-symbol geometry in a single frame at each end of the spin (worst on the eased
// stop, where the reel is nearly readable when it flipped) and could chatter frame-to-frame while
// velocity sat on the threshold. Smoothstep, so the band's own ends don't pop either.
const BLUR_FADE_FLOOR = MOTION_BLUR_VELOCITY * 0.35;
export const blurAlpha = (velocity: number) => {
	const t = (Math.abs(velocity) - BLUR_FADE_FLOOR) / (MOTION_BLUR_VELOCITY - BLUR_FADE_FLOOR);
	return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
};

export const zIndexes = {
	background: {
		backdrop: -3,
		normal: -2,
		feature: -1,
	},
};

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_land_1',
	2: 'sfx_scatter_land_2',
	3: 'sfx_scatter_land_3',
	4: 'sfx_scatter_land_4',
	5: 'sfx_scatter_land_5',
} as const;

export const winPositionToExpandedReels = (positions: { reel: number; row: number }[]) =>
	_.uniq(positions.map((position) => position.reel));

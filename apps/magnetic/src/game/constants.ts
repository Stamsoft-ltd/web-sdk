import type { RawSymbol, SymbolState, SymbolName } from './types';

export const SYMBOL_W = 94;
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
export const LANDSCAPE_MAIN_SIZES = { width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO, height: LANDSCAPE_HEIGHT };
export const PORTRAIT_MAIN_SIZES = { width: PORTRAIT_HEIGHT * PORTRAIT_RATIO, height: PORTRAIT_HEIGHT };

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
	['H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'MAGNET'],
].map((row) =>
	row.map((name) => ({
		name: name as SymbolName,
		wild: name === 'WILD',
		magnet: name === 'MAGNET',
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

export const BOARD_MOTION_DEFAULT = {
	spin: {
		dropRows: 9,
		fadeOutMs: 0,
		durationMs: 360,
		scaleFrom: 0.94,
		reelDelayMs: 58,
		rowDelayMs: 12,
		bounceMs: 120,
	},
	respin: {
		dropRows: 3.8,
		fadeOutMs: 110,
		durationMs: 340,
		scaleFrom: 0.9,
		reelDelayMs: 42,
		rowDelayMs: 12,
		bounceMs: 130,
	},
	pulse: {
		magnetMs: 300,
		freshMs: 340,
		winMs: 560,
	},
} as const;

export const BOARD_MOTION_FAST = {
	spin: {
		dropRows: 7,
		fadeOutMs: 0,
		durationMs: 160,
		scaleFrom: 0.96,
		reelDelayMs: 18,
		rowDelayMs: 3,
		bounceMs: 70,
	},
	respin: {
		dropRows: 2.2,
		fadeOutMs: 24,
		durationMs: 110,
		scaleFrom: 0.96,
		reelDelayMs: 10,
		rowDelayMs: 2,
		bounceMs: 48,
	},
	pulse: {
		magnetMs: 90,
		freshMs: 120,
		winMs: 140,
	},
} as const;

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_stop_1',
	2: 'sfx_scatter_stop_2',
	3: 'sfx_scatter_stop_3',
	4: 'sfx_scatter_stop_4',
	5: 'sfx_scatter_stop_5',
} as const;

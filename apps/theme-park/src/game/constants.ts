import _ from 'lodash';
import type { SymbolName, RawSymbol, SymbolState } from './types';

// Theme Park board: 5 reels x 5 rows
export const BOARD_DIMENSIONS = { x: 5, y: 5 };

// Match Forest Gang's reel pitch. Keeping the same 121x103 cell geometry makes
// Theme Park's reels, symbols, masks and feature overlays scale as one system;
// the fifth row is handled by the responsive board fit rather than square cells.
export const SYMBOL_W = 121;
export const SYMBOL_H = 103;
export const SYMBOL_SIZE = SYMBOL_H;

export const BOARD_SIZES = {
	width: SYMBOL_W * BOARD_DIMENSIONS.x,
	height: SYMBOL_H * BOARD_DIMENSIONS.y,
};

export const BOARD_GRID_OFFSET_Y = 0;

// SYMBOL_INFO_MAP — defines how each symbol is rendered
// type 'sprite' = static PNG (no animation)
// type 'spine' = Spine animation
// type 'spineIntroLoop' = Spine with intro→loop transition
export type SymbolInfo =
	| {
			type: 'sprite';
			assetKey: string;
			sizeRatios: { width: number; height: number };
			animationName?: never;
	  }
	| {
			type: 'spine';
			assetKey: string;
			animationName: string;
			sizeRatios: { width: number; height: number };
	  }
	| {
			type: 'spineIntroLoop';
			assetKey: string;
			introAnimation: string;
			loopAnimation: string;
			sizeRatios: { width: number; height: number };
	  };

const sprite = (assetKey: string): SymbolInfo => ({
	type: 'sprite',
	assetKey,
	sizeRatios: { width: 1, height: 1 },
});

const states = (base: string, win: string): Record<SymbolState, SymbolInfo> => ({
	spin: sprite(base),
	land: sprite(base),
	static: sprite(base),
	win: sprite(win),
});

export const SYMBOL_INFO_MAP: Record<SymbolName, Record<SymbolState, SymbolInfo>> = {
	H1: states('tp_h1.png', 'tp_h1.png'), // Coaster Car
	H2: states('tp_h2.png', 'tp_h2.png'), // Rubber Duck
	H3: states('tp_h3.png', 'tp_h3.png'), // Balloon Bundle
	H4: states('tp_h4.png', 'tp_h4.png'), // Popcorn
	H5: states('tp_h5.png', 'tp_h5.png'), // Ferris Wheel
	L1: states('tp_l1.png', 'tp_l1.png'), // A
	L2: states('tp_l2.png', 'tp_l2.png'), // K
	L3: states('tp_l3.png', 'tp_l3.png'), // Q
	L4: states('tp_l4.png', 'tp_l4.png'), // J
	L5: states('tp_l5.png', 'tp_l5.png'), // 10
	W: states('tp_wild.png', 'tp_wild.png'),
	DC: states('tp_duck_collect.png', 'tp_duck_collect.png'),
	S_DUCK: states('tp_scatter_duck.png', 'tp_scatter_duck.png'),
	S_ROLLER: states('tp_scatter_roller.png', 'tp_scatter_roller.png'),
	S_COASTER: states('tp_scatter_coaster.png', 'tp_scatter_coaster.png'),
};

export const SCATTER_SYMBOLS: SymbolName[] = ['S_DUCK', 'S_ROLLER', 'S_COASTER'];

export const PAYING_SYMBOLS: SymbolName[] = [
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'L1',
	'L2',
	'L3',
	'L4',
	'L5',
];

export const HIGH_SYMBOLS: SymbolName[] = PAYING_SYMBOLS;

export const INITIAL_SYMBOL_STATE = 'static' as const;

export const INITIAL_BOARD: RawSymbol[][] = _.range(BOARD_DIMENSIONS.x).map(() =>
	_.range(BOARD_DIMENSIONS.y + 4).map(() => {
		const all: SymbolName[] = PAYING_SYMBOLS;
		return { name: all[Math.floor(Math.random() * all.length)] };
	}),
);

// Scatter land sounds — indexed by how many scatters have landed (1-5)
export const SCATTER_LAND_SOUND_MAP: Record<1 | 2 | 3 | 4 | 5, string> = {
	1: 'sfx_scatter_stop_1',
	2: 'sfx_scatter_stop_2',
	3: 'sfx_scatter_stop_3',
	4: 'sfx_scatter_stop_4',
	5: 'sfx_scatter_stop_5',
};

// Spin timing options — SpinningReelSpinOptions shape.
const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.15,
	reelSpinSpeedBeforeBounce: 4,
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

export const MOTION_BLUR_VELOCITY = SYMBOL_H * 0.7;

export const zIndexes = {
	board: 0,
	overlay: 10,
	win: 20,
	freeSpin: 30,
	hud: 40,
};

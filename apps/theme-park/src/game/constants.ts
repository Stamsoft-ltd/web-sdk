import _ from 'lodash';
import type { SymbolName, RawSymbol, SymbolState } from './types';

// Theme Park board: 5 reels x 5 rows
export const BOARD_DIMENSIONS = { x: 5, y: 5 };

// Drawn size of a symbol. Inherited from Forest Gang's reel pitch, and left alone: the symbol
// exports are 448x360 frames, so 121x103 is the shape every piece of art in this game is authored
// against.
export const SYMBOL_W = 121;
export const SYMBOL_H = 103;
export const SYMBOL_SIZE = SYMBOL_H;

// One shared contract for the landed Roller trigger and the moving track car. The authored frame
// includes generous transparent margins, so 1.55 cells tall keeps the visible car readable without
// spilling across a full neighbouring reel.
export const ROLLER_CAR_H = SYMBOL_H * 1.55;
export const ROLLER_CAR_W = ROLLER_CAR_H * (256 / 334);

// Reel pitch — how far apart the cell CENTRES sit, which is a separate thing from how big a symbol
// is drawn. Figma 6612-4311 puts the grid at 691x457 inside a 701x467 board (nodes 6612:4553 and
// 6612:4357), i.e. a 1.512:1 cell, far wider than the 1.175:1 the old shared-with-art pitch gave.
// The old pitch was squeezing the frame art by 28% vertically and packing the reels into a tall
// narrow box. Widening the pitch alone spreads the reels to the design's proportions and leaves
// every symbol, badge and overlay drawn as before. <BoardFrame> sizes the pad art off this same
// grid, so the lines painted into it land on these cell boundaries.
export const CELL_W = SYMBOL_H * (691 / 457);
export const CELL_H = SYMBOL_H;

export const BOARD_SIZES = {
	width: CELL_W * BOARD_DIMENSIONS.x,
	height: CELL_H * BOARD_DIMENSIONS.y,
};

// Keep reel content behind the authored side rails. The wider reserve matches the cell-cut masks
// used by Mega Wilds, so opaque Coaster Wild cells cannot paint across the bulbs at either edge.
// Edge reel centres move by half the reserve, keeping their visible areas centred.
export const BOARD_SIDE_CONTENT_INSET = 18;
// Opaque Mega Coaster Wild cells need more clearance than transparent reel symbols. This exposes
// the one grid authored into BoardFrame instead of drawing a second grid above the feature.
export const COASTER_WILD_GRID_INSET = 2.5;
export const getBoardCellCenterX = (reelIndex: number) =>
	CELL_W * (reelIndex + 0.5) +
	(reelIndex === 0
		? BOARD_SIDE_CONTENT_INSET * 0.5
		: reelIndex === BOARD_DIMENSIONS.x - 1
			? -BOARD_SIDE_CONTENT_INSET * 0.5
			: 0);

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
	H1: states('tpH1', 'tpH1Win'), // Coaster Car
	H2: states('tpH2', 'tpH2Win'), // Rubber Duck
	H3: states('tpH3', 'tpH3Win'), // Balloon Bundle
	H4: states('tpH4', 'tpH4Win'), // Popcorn
	H5: states('tpH5', 'tpH5Win'), // Ferris Wheel
	L1: states('tpL1', 'tpL1Win'), // A
	L2: states('tpL2', 'tpL2Win'), // K
	L3: states('tpL3', 'tpL3Win'), // Q
	L4: states('tpL4', 'tpL4Win'), // J
	L5: states('tpL5', 'tpL5Win'), // 10
	W: states('tpWildDesktop', 'tpWildDesktop'),
	DC: states('tpDuckScatterDesktop', 'tpDuckScatterDesktop'),
	S_DUCK: states('tpDuckScatterDesktop', 'tpDuckScatterDesktop'),
	S_ROLLER: states('tpRollerScatterDesktop', 'tpRollerScatterDesktop'),
	S_COASTER: states('tpCoasterScatterDesktop', 'tpCoasterScatterDesktop'),
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
	// Reel contract: one padding symbol above + below the five visible rows.
	// Keeping nine symbols here while every reveal supplies seven changes the
	// reel's fixed length after the first settle and makes the next spin snap.
	_.range(BOARD_DIMENSIONS.y + 2).map(() => {
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

// The dim behind the congratulations panels (Figma 6094:4339). The design's scrim is a full-frame
// black rectangle over the scene AND the HUD; measured against the bar plate rendered on its own it
// leaves 30% of it, so 0.7 black.
export const POPUP_SCRIM_ALPHA = 0.7;

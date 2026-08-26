import _ from 'lodash';
import type { SymbolName, RawSymbol, SymbolState } from './types';

// Theme Park board: 5 reels x 5 rows
export const BOARD_DIMENSIONS = { x: 5, y: 5 };

// The frame every piece of symbol art in this game is authored in.
export const SYMBOL_FRAME = { width: 448, height: 360 };

// Symbol art keeps its authored size. Grid row pitch is separate and 5% taller for breathing room.
export const SYMBOL_H = 103;
// Drawn size of a symbol, derived from the frame so the art is never distorted.
//
// This used to be a flat 121, inherited from Forest Gang's reel pitch. 121x103 is 1.175:1 against
// the frame's 1.244:1, so every symbol was being squeezed 5.6% horizontally — invisible on the
// photoreal renders the game shipped with, and immediately obvious the moment a flat cartoon with a
// circle in it (the ferris wheel, the balloons) went on the board. Width is the side that gives,
// because SYMBOL_H drives CELL_H and therefore the whole board's height, while CELL_W is derived
// from SYMBOL_H too and at 155.7 has room to spare for the 128.2 this comes out at.
export const SYMBOL_W = SYMBOL_H * (SYMBOL_FRAME.width / SYMBOL_FRAME.height);
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
export const CELL_H = SYMBOL_H * 1.05;

export const BOARD_SIZES = {
	width: CELL_W * BOARD_DIMENSIONS.x,
	height: CELL_H * BOARD_DIMENSIONS.y,
};

// One shared board-interior curve. Base art and full-reel feature masks must agree or dark square
// corners/feature pixels can protrude beyond the rounded authored rail.
export const BOARD_CORNER_RADIUS = CELL_H * 0.22;

// Borderless board: every reel owns the same exact grid-line-to-grid-line width. Edge content only
// leaves the same narrow divider clearance as internal cells; edge reel centres never shift.
export const BOARD_SIDE_CONTENT_INSET = 1.4;
// Opaque Mega Coaster Wild cells need more clearance than transparent reel symbols. This exposes
// the one grid authored into BoardFrame instead of drawing a second grid above the feature.
export const COASTER_WILD_GRID_INSET = 2.5;
// The screen-wide dim <CoasterSetupPresenter> lays over the whole game while the carts stamp their
// Wilds. It is shared because the Wild cells are drawn ABOVE it: each one covers the reel with a cut
// of the board's own grid art, and that cut has to be dimmed by the same amount as the board around
// it or every stamped cell reads as a lit hole in the dimmed screen.
//
// 0.15, down from 0.72 and then 0.3 (design ask, 2026-08-26). The design render of this feature does
// not dim the game AT ALL — the park behind the rails is as bright there as on any other spin — and
// at 0.72 the board, the backdrop and the symbols still on the reels had all gone to near-black.
// It is not dropped to zero because it is still what settles the reels behind the carts and the
// Wilds they stamp, but at 0.15 the marquee bulbs on the letter symbols read as lit, which is the
// thing the heavier values were taking away.
//
// NOTE for the next time this screen looks too dark: most of what is left is NOT this. The Mega
// Coaster bonus swaps in its own NIGHT backdrop (`coasterBackground` in <Background>) and that art
// is dark on purpose — this scrim only covers what sits on top of it.
export const COASTER_SETUP_SCRIM = { color: 0x11021b, alpha: 0.15 };
export const getBoardCellCenterX = (reelIndex: number) => CELL_W * (reelIndex + 0.5);

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

// Every symbol passes the same asset for both states on purpose: a win is <SymbolBulbs> lighting
// the bulbs already in the art, or the board's win pulse, never a second piece of art.
export const SYMBOL_INFO_MAP: Record<SymbolName, Record<SymbolState, SymbolInfo>> = {
	H1: states('tpH1', 'tpH1'), // Coaster Car
	H2: states('tpH2', 'tpH2'), // Rubber Duck
	H3: states('tpH3', 'tpH3'), // Balloon Bundle
	H4: states('tpH4', 'tpH4'), // Popcorn
	H5: states('tpH5', 'tpH5'), // Ferris Wheel
	L1: states('tpL1', 'tpL1'), // A
	L2: states('tpL2', 'tpL2'), // K
	L3: states('tpL3', 'tpL3'), // Q
	L4: states('tpL4', 'tpL4'), // J
	L5: states('tpL5', 'tpL5'), // 10
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

// A manual stop lands columns in visual reading order. Fast/turbo still keep a small separation so
// the result never looks like five unrelated reels snapping in a scheduler-dependent order.
export const REEL_SKIP_GAP_MS = { normal: 70, fast: 35, turbo: 18 } as const;

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

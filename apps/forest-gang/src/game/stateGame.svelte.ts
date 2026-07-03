import _ from 'lodash';
import type { Tween } from 'svelte/motion';

import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForSpinning } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, RawSymbol, SymbolState, Position, SymbolName } from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import {
	SYMBOL_SIZE,
	BOARD_SIZES,
	BOARD_GRID_OFFSET_Y,
	INITIAL_BOARD,
	BOARD_DIMENSIONS,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	SPIN_OPTIONS_TURBO,
	SPIN_OPTIONS_ANTICIPATED,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (rawSymbol.name === 'SCATTER') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}

	if (rawSymbol.name === 'WILD') {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_landing' });
	}
};

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForSpinning({
		reelIndex,
		symbolHeight: SYMBOL_SIZE,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelStopping: () => {
			eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_reel_stop_1',
				forcePlay: !(stateBet.isTurbo || stateBet.isSuperTurbo),
			});
		},
		onSymbolLand,
	});

	reel.reelState.spinOptions = () => {
		if ((stateBet.isTurbo || stateBet.isSuperTurbo) && !stateGame.bonusMode)
			return SPIN_OPTIONS_TURBO;

		if (reel.reelState.spinType === 'fast') {
			return stateGame.bonusMode ? SPIN_OPTIONS_DEFAULT : SPIN_OPTIONS_FAST;
		}

		if (reel.reelState.spinType === 'anticipated') {
			return stateGame.bonusMode ? SPIN_OPTIONS_DEFAULT : SPIN_OPTIONS_ANTICIPATED;
		}

		return SPIN_OPTIONS_DEFAULT;
	};

	return reel;
});

export type Reel = (typeof board)[number];
export type ReelSymbol = Reel['reelState']['symbols'][number];

export type MultiplierSymbol = {
	initX: number;
	initY: number;
	symbolX: Tween<number>;
	symbolY: Tween<number>;
	rawSymbol: RawSymbol;
	symbolState: SymbolState;
	oncomplete: () => void;
};

export const stateGame = $state({
	board,
	gameType: 'basegame' as GameType,
	multiplierBoard: [] as (MultiplierSymbol | undefined)[][],
	scatterCounter: 0,
	selectedBonusSymbol: null as SymbolName | null,
	bonusMode: null as 'freegame' | 'superspin' | 'feature' | null,
	globalMultiplier: 1,
	expandedSymbol: null as null | { symbol: SymbolName; reels: number[]; positions: Position[] },
	expandedSymbolWon: false,
	paylineWins: [] as Array<{ lineIndex: number; path: Array<{ reel: number; row: number }> }>,
	tempMultiplier: null as number | null,
	endRoundOnly: false,
	pendingStop: false,
	awaitingFirstReveal: false,
	stopAutoOnBonus: false,     // autoplay stops when a bonus triggers
	hasAnticipationPending: false,  // true when current spin has unskipped anticipation reels
	anticipationSkipped: false,     // set when stop is pressed during anticipation so any newly-mounted anticipation overlay self-skips
	resumeModalOpen: false,     // the "Unfinished Round" resume dialog is on screen
});

const getBoardViewportPadding = () => {
	const layoutType = stateLayoutDerived.layoutType();

	if (layoutType === 'portrait') return { top: 8, right: 2, bottom: 146, left: 2 };
	if (layoutType === 'landscape') return { top: 4, right: 16, bottom: 22, left: 8 };
	if (layoutType === 'tablet') return { top: 10, right: 20, bottom: 86, left: 20 };
	return { top: 108, right: 220, bottom: 172, left: 208 };
};

const getBoardViewportMetrics = () => {
	const mainLayout = stateLayoutDerived.mainLayout();
	const canvasSizes = stateLayoutDerived.canvasSizes();
	const padding = getBoardViewportPadding();
	const availableCanvasWidth = Math.max(
		BOARD_SIZES.width * mainLayout.scale,
		canvasSizes.width - padding.left - padding.right,
	);
	const availableCanvasHeight = Math.max(
		BOARD_SIZES.height * mainLayout.scale,
		canvasSizes.height - padding.top - padding.bottom,
	);

	return { mainLayout, canvasSizes, padding, availableCanvasWidth, availableCanvasHeight };
};

const getBoardScale = () => {
	const { mainLayout, availableCanvasHeight, availableCanvasWidth } = getBoardViewportMetrics();
	return Math.max(
		1,
		Math.min(
			availableCanvasHeight / (BOARD_SIZES.height * (mainLayout.scale || 1)),
			availableCanvasWidth / (BOARD_SIZES.width * (mainLayout.scale || 1)),
		),
	);
};

const getBoardOffset = () => {
	const { mainLayout, canvasSizes, padding, availableCanvasHeight, availableCanvasWidth } =
		getBoardViewportMetrics();
	const layoutType = stateLayoutDerived.layoutType();
	const extraLeftShiftPx = layoutType === 'desktop' ? 75 : layoutType === 'landscape' ? 55 : 0;
	const centeredCanvasX = padding.left + availableCanvasWidth * 0.5 - canvasSizes.width * 0.5;
	const centeredCanvasY = padding.top + availableCanvasHeight * 0.5 - canvasSizes.height * 0.5;
	// extraLeftShiftPx (75) and shiftRightPx cancel → board sits centred in the
	// padded area. Lower shiftRightPx to nudge the whole board left.
	// Portrait has no left-shift to cancel, so it must not shift right either.
	const shiftRightPx = layoutType === 'portrait' ? 0 : 90;
	const shiftDownPx = layoutType === 'portrait' ? 0 : 10;

	return {
		x: (centeredCanvasX - extraLeftShiftPx + shiftRightPx) / (mainLayout.scale || 1),
		y: (centeredCanvasY + shiftDownPx) / (mainLayout.scale || 1),
	};
};

// Mirror BoardFrame.svelte constants — keep in sync if BoardFrame changes
// slot_pad.png is 3220×2364 — these MUST match BoardFrame.svelte exactly so the
// grid is centred inside the drawn frame's inner brown panel.
const _FRAME_MARGIN = 1.04;
const _FRAME_INNER_W_FRAC = 0.762;
const _FRAME_ASPECT_H_W = 2364 / 3220;
const _FRAME_ANCHOR_Y = 0.515; // = slot_pad window centre y (grid centred vertically)
const _FRAME_EXTRA_SCALE = 1.30 / 1.27;
const PORTRAIT_FRAME_FILL = 1.0; // portrait: mobile frame fills the full canvas width
const PORTRAIT_TOP_OFFSET = 236; // portrait: push frame down from the top (main-layout units)
// Mobile board frame (board_frame_mobile.png) — full width, top/bottom borders only.
// Fractions of the drawn frame the reel grid occupies. Mirrored in BoardFrame.svelte.
const MOBILE_FRAME_INNER_W = 0.965;
const MOBILE_FRAME_INNER_H = 0.78;

// Mobile-landscape reserves a bottom control strip + side rails (Figma 2682-3639) and
// centres the reel grid in the remaining play area. Desktop/portrait are unaffected.
const LS_PANEL_TOP = 88;   // where the inner wood panel (reel area) begins — near the top
const LS_BOTTOM_BAR = 66;  // gap below the frame for the bet pad
const LS_LEFT_RAIL = 150;
const LS_RIGHT_RAIL = 120;
// reel_frame.png cropped to opaque bounds (2121×1638). The rope hangs from the top ~25% of the
// image; the inner wood panel (where the reels sit) is measured below it.
const LS_FRAME_ASPECT = 2121 / 1638;
const LS_FRAME_INNER_W = 0.78;
const LS_FRAME_INNER_H = 0.70;
const LS_FRAME_INNER_CX = 0.5;
const LS_FRAME_INNER_CY = 0.59;
const LS_PANEL_FILL = 0.98;  // reel pitch fills ~98% of the inner panel (both axes)
const LS_SYMBOL_FILL = 0.86; // symbol size vs its cell (smaller → even gaps, as in the design)
const LS_FRAME_WIDTH = 0.9;  // slight narrowing of the frame/background (forest margin on sides)

const boardLayout = () => {
	const layoutType = stateLayoutDerived.layoutType();

	// Mobile landscape: frame-driven. Fit the whole rope-hung reel frame (rope + poles
	// included) inside the play area, then place the reel grid inside its inner wood region.
	if (layoutType === 'landscape') {
		const main = stateLayoutDerived.mainLayout();
		const availW = main.width - LS_LEFT_RAIL - LS_RIGHT_RAIL;
		// Pin the inner PANEL: its top sits at LS_PANEL_TOP (near the screen top) and the frame
		// bottom sits just above the bet pad. The rope extends off-screen above (that's fine — it
		// keeps the wood panel high, as in the design). Solve frameH from these two constraints.
		const frameBottom = main.height - LS_BOTTOM_BAR;
		const panelTopFrac = LS_FRAME_INNER_CY - LS_FRAME_INNER_H * 0.5;
		const frameH = (frameBottom - LS_PANEL_TOP) / (1 - panelTopFrac);
		const frameW = frameH * LS_FRAME_ASPECT * LS_FRAME_WIDTH;
		const frameCx = LS_LEFT_RAIL + availW * 0.5;
		const frameCy = frameBottom - frameH * 0.5;
		// Inner wood panel (where the reels sit).
		const innerW = frameW * LS_FRAME_INNER_W;
		const innerH = frameH * LS_FRAME_INNER_H;
		// Reel PITCH fills the panel on each axis; symbol SIZE is the smaller of the two, scaled
		// down a touch so cells have even gaps (as in the design). Board.svelte compensates each
		// sprite's width/height so symbols keep their proportions despite the non-uniform pitch.
		const boardScaleX = (innerW / BOARD_SIZES.width) * LS_PANEL_FILL;
		const boardScaleY = (innerH / BOARD_SIZES.height) * LS_PANEL_FILL;
		const boardScale = Math.min(boardScaleX, boardScaleY) * LS_SYMBOL_FILL;
		return {
			x: frameCx + (LS_FRAME_INNER_CX - 0.5) * frameW,
			y: frameCy + (LS_FRAME_INNER_CY - 0.5) * frameH - BOARD_GRID_OFFSET_Y,
			frameTopY: 0,
			frameCx,
			frameCy,
			frameW,
			frameH,
			boardScale,
			boardScaleX,
			boardScaleY,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	// Portrait: the mobile frame is a full-width wood panel (no side poles). Size the grid
	// to fill MOBILE_FRAME_INNER_W of the frame and the frame to ~fill the canvas width.
	if (layoutType === 'portrait') {
		const { availableCanvasWidth, mainLayout } = getBoardViewportMetrics();
		const availWidthMain = availableCanvasWidth / (mainLayout.scale || 1);
		const boardScale =
			(availWidthMain * PORTRAIT_FRAME_FILL * MOBILE_FRAME_INNER_W) / BOARD_SIZES.width;
		const mFrameH = (BOARD_SIZES.height * boardScale) / MOBILE_FRAME_INNER_H;
		return {
			x: stateLayoutDerived.mainLayout().width * 0.5 + getBoardOffset().x,
			y: PORTRAIT_TOP_OFFSET + mFrameH * 0.5,
			frameTopY: PORTRAIT_TOP_OFFSET,
			frameCx: 0,
			frameCy: 0,
			frameW: 0,
			frameH: 0,
			boardScale,
			boardScaleX: boardScale,
			boardScaleY: boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	const boardScale = getBoardScale() * 0.81 * 1.27;
	// Spread the columns a touch wider than the symbol size so the outer reels sit closer to the
	// frame edges (less L/R padding, matching Figma). Board.svelte compensates symbol width so the
	// symbols themselves stay undistorted — only the reel pitch widens.
	const H_SPREAD = 1.06;
	// Tighten the vertical reel pitch so the rows sit closer together (less dead space between
	// rows). Symbols keep their size — only the row-to-row spacing shrinks.
	const V_TIGHTEN = 0.93;
	// Frame top is pinned to canvas y=0; inner panel centre is at ANCHOR_Y × frameH
	const frameW =
		(BOARD_SIZES.width * boardScale * _FRAME_MARGIN * _FRAME_EXTRA_SCALE) / _FRAME_INNER_W_FRAC;
	const frameH = frameW * _FRAME_ASPECT_H_W;
	return {
		x: stateLayoutDerived.mainLayout().width * 0.5 + getBoardOffset().x,
		y: frameH * _FRAME_ANCHOR_Y,
		frameTopY: 0,
		frameCx: 0,
		frameCy: 0,
		frameW,
		frameH,
		boardScale,
		boardScaleX: boardScale * H_SPREAD,
		boardScaleY: boardScale * V_TIGHTEN,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const boardRaw = () =>
	board.map((reel) => reel.reelState.symbols.map((reelSymbol) => reelSymbol.rawSymbol));

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const resetBonusState = () => {
	stateGame.selectedBonusSymbol = null;
	stateGame.bonusMode = null;
	stateGame.globalMultiplier = 1;
	stateGame.expandedSymbol = null;
	stateGame.expandedSymbolWon = false;
	stateGame.tempMultiplier = null;
	stateGame.paylineWins = [];
};

const { enhanceBoard } = createEnhanceBoard();
const enhancedBoard = enhanceBoard({ board: stateGame.board });

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({
	winLevelMap,
});

export const stateGameDerived = {
	onSymbolLand,
	boardLayout,
	boardRaw,
	scatterLandIndex,
	enhancedBoard,
	getWinLevelDataByWinLevelAlias,
	resetBonusState,
};

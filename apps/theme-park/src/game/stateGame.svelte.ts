import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForSpinning } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type {
	GameType,
	RawSymbol,
	Position,
	SymbolName,
	BonusType,
	DuckKind,
	DuckPrize,
	RollerReel,
} from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import {
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	BOARD_DIMENSIONS,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	SPIN_OPTIONS_TURBO,
	SPIN_OPTIONS_ANTICIPATED,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
	SCATTER_SYMBOLS,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (SCATTER_SYMBOLS.includes(rawSymbol.name)) {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
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
		if (reel.reelState.spinType === 'fast')
			return stateGame.bonusMode ? SPIN_OPTIONS_DEFAULT : SPIN_OPTIONS_FAST;
		if (reel.reelState.spinType === 'anticipated')
			return stateGame.bonusMode ? SPIN_OPTIONS_DEFAULT : SPIN_OPTIONS_ANTICIPATED;
		return SPIN_OPTIONS_DEFAULT;
	};

	return reel;
});

export type Reel = (typeof board)[number];
export type ReelSymbol = Reel['reelState']['symbols'][number];

export type DuckRevealed = { position: Position; kind: DuckKind; value: number };
export type DuckPickRevealed = {
	pickIndex: number;
	kind: DuckKind;
	value: number;
	runningTotal: number;
};
export type CoasterTile = { reel: number; row: number; multiplier: number };

export const stateGame = $state({
	board,
	gameType: 'basegame' as GameType,
	scatterCounter: 0,
	selectedBonusSymbol: null as SymbolName | null,
	bonusMode: null as 'freegame' | null,
	// Which scatter feature is running ('roller' | 'coaster'), null outside bonuses
	bonusType: null as BonusType | null,
	expandedSymbol: null as null | { symbol: SymbolName; reels: number[]; positions: Position[] },
	expandedSymbolWon: false,
	paylineWins: [] as Array<{ lineIndex: number; path: Array<{ reel: number; row: number }> }>,
	// Duck Collect (base-game DC symbols) presentation state
	duckCollect: null as null | { positions: Position[]; revealed: DuckRevealed[] },
	duckRunningTotal: 0, // cents — shared by duck collect and duck pond
	// Duck Your Luck pond bonus state
	duckPicks: null as null | {
		totalPicks: number;
		pool: DuckPrize[];
		picks: DuckPickRevealed[];
		finalAmount: number | null;
	},
	// Roller Wilds: full-wild reels for THIS spin only
	activeRollerReels: [] as RollerReel[],
	// Mega Coaster: persistent wild tiles (Position → multiplier), persists across the bonus
	coasterTiles: [] as CoasterTile[],
	endRoundOnly: false,
	pendingStop: false,
	awaitingFirstReveal: false,
	hasAnticipationPending: false,
	anticipationSkipped: false,
	stopAutoOnBonus: false,
	resumeModalOpen: false,
	buyModalOpen: false,
	freeSpinPopupShowing: false,
	// Current spin's win for the HUD. Bonus cumulative win stays in winBookEventAmount.
	// At bonus/round end this becomes the final total until the next reveal clears it.
	roundWin: 0,
	// freeSpinEnd already presented the dedicated bonus-total board. The following
	// final setWin is settlement data, not another per-spin win presentation.
	bonusSummaryShown: false,
});

const getBoardViewportPadding = () => {
	const layoutType = stateLayoutDerived.layoutType();
	if (layoutType === 'portrait') return { top: 8, right: 6, bottom: 146, left: 6 };
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
	return {
		x: (centeredCanvasX - extraLeftShiftPx + 90) / (mainLayout.scale || 1),
		y: (centeredCanvasY + 10) / (mainLayout.scale || 1),
	};
};

const _FRAME_MARGIN = 1.04;
const _FRAME_INNER_W_FRAC = 0.64;
const _FRAME_ASPECT_H_W = 2528 / 3616;
const _FRAME_ANCHOR_Y = 0.45;
const _FRAME_EXTRA_SCALE = 1.35 / 1.15;
const PORTRAIT_FRAME_FILL = 1;
const PORTRAIT_TOP_OFFSET = 236;
const MOBILE_FRAME_INNER_W = 0.95;
const MOBILE_FRAME_INNER_H = 0.95;

// Same mobile-landscape play-area reservation used by Forest Gang. Theme Park
// uses a different temporary frame, but the reel grid follows the same fit and
// centering rules so board-space features remain aligned at every viewport.
const LS_PANEL_TOP = 88;
const LS_BOTTOM_BAR = 66;
const LS_LEFT_RAIL = 150;
const LS_RIGHT_RAIL = 120;
const LS_PANEL_FILL = 0.98;

const boardLayout = () => {
	const layoutType = stateLayoutDerived.layoutType();

	if (layoutType === 'landscape') {
		const main = stateLayoutDerived.mainLayout();
		const availableWidth = main.width - LS_LEFT_RAIL - LS_RIGHT_RAIL;
		const availableHeight = main.height - LS_PANEL_TOP - LS_BOTTOM_BAR;
		const boardScale =
			Math.min(availableWidth / BOARD_SIZES.width, availableHeight / BOARD_SIZES.height) *
			LS_PANEL_FILL;

		return {
			x: LS_LEFT_RAIL + availableWidth * 0.5,
			y: LS_PANEL_TOP + availableHeight * 0.5,
			frameTopY: LS_PANEL_TOP,
			frameCx: LS_LEFT_RAIL + availableWidth * 0.5,
			frameCy: LS_PANEL_TOP + availableHeight * 0.5,
			frameW: (BOARD_SIZES.width * boardScale) / MOBILE_FRAME_INNER_W,
			frameH: (BOARD_SIZES.height * boardScale) / MOBILE_FRAME_INNER_H,
			boardScale,
			boardScaleX: boardScale,
			boardScaleY: boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	if (layoutType === 'portrait') {
		const { availableCanvasWidth, mainLayout } = getBoardViewportMetrics();
		const availableWidth = availableCanvasWidth / (mainLayout.scale || 1);
		const boardScale =
			(availableWidth * PORTRAIT_FRAME_FILL * MOBILE_FRAME_INNER_W) / BOARD_SIZES.width;
		const frameHeight = (BOARD_SIZES.height * boardScale) / MOBILE_FRAME_INNER_H;

		return {
			// Centre the board on screen — same as frameCx. (getBoardOffset() carries a desktop-only
			// +90px left-rail nudge that would otherwise push the portrait board off the right edge.)
			x: mainLayout.width * 0.5,
			y: PORTRAIT_TOP_OFFSET + frameHeight * 0.5,
			frameTopY: PORTRAIT_TOP_OFFSET,
			frameCx: mainLayout.width * 0.5,
			frameCy: PORTRAIT_TOP_OFFSET + frameHeight * 0.5,
			frameW: (BOARD_SIZES.width * boardScale) / MOBILE_FRAME_INNER_W,
			frameH: frameHeight,
			boardScale,
			boardScaleX: boardScale,
			boardScaleY: boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	// Forest Gang desktop/tablet scale. Since both games now share the same reel
	// pitch, viewport fitting produces the same visible board height automatically.
	const boardScale = getBoardScale() * 0.81 * 1.27;
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
		boardScaleX: boardScale,
		boardScaleY: boardScale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const boardRaw = () => board.map((reel) => reel.reelState.symbols.map((s) => s.rawSymbol));

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const resetBonusState = () => {
	stateGame.selectedBonusSymbol = null;
	stateGame.bonusMode = null;
	stateGame.bonusType = null;
	stateGame.expandedSymbol = null;
	stateGame.expandedSymbolWon = false;
	stateGame.paylineWins = [];
	stateGame.duckCollect = null;
	stateGame.duckRunningTotal = 0;
	stateGame.duckPicks = null;
	stateGame.activeRollerReels = [];
	stateGame.coasterTiles = [];
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

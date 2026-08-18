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
	CELL_H,
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
import { FRAME_OVER_GRID_X } from './boardArt';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (SCATTER_SYMBOLS.includes(rawSymbol.name)) {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}
};

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForSpinning({
		reelIndex,
		symbolHeight: CELL_H,
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
	// DC ducks currently turning and ducks that have settled on their rear pose. Arrays let
	// fast/turbo playback and a user skip turn the complete landed set in one synchronized batch.
	duckRevealPositions: [] as Position[],
	duckTurnedPositions: [] as Position[],
	duckRevealBatch: false,
	duckRunningTotal: 0, // cents — shared by duck collect and duck pond
	// Duck Your Luck pond bonus state
	duckPicks: null as null | {
		totalPicks: number;
		pool: DuckPrize[];
		picks: DuckPickRevealed[];
		finalAmount: number | null;
	},
	// Roller Wilds result metadata for THIS spin only. The overlay owns the full-reel art through
	// paylines; the authored reveal symbols stay unchanged beneath it and roll on the next spin.
	activeRollerReels: [] as RollerReel[],
	// Roller Wilds animation: cells (`${reel},${row}`) the descending car has already cleared, so
	// <Board> hides the original symbols while the overlay owns the transformed reel presentation.
	rollerClearedCells: [] as string[],
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
	/**
	 * A "press anywhere to continue" prompt is up. The caption itself is HTML rather than pixi: the
	 * design puts it across the HUD bar, and the HUD is a DOM layer above the canvas, so nothing
	 * drawn in the scene can reach it. <PressToContinue> owns the input; this only says whether to
	 * paint the words.
	 */
	pressToContinueShowing: false,
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

// The 5x5 grid in Figma 6612-4311 (node 6612:4553): 691x457 at (255, 86) inside the 1200x670 frame.
// Everything the desktop board does is expressed as one of these four fractions.
const DESIGN_GRID = {
	width: 691 / 1200,
	height: 457 / 670,
	centreX: (255 + 691 / 2) / 1200,
	centreY: (86 + 457 / 2) / 670,
};

// The Forest Gang frame constants that used to drive the desktop board (_FRAME_MARGIN,
// _FRAME_INNER_W_FRAC, _FRAME_ASPECT_H_W, _FRAME_ANCHOR_Y, _FRAME_EXTRA_SCALE) are gone with it —
// they described that game's frame art, not this one's, and nothing else read them.
const PORTRAIT_FRAME_FILL = 1;
const PORTRAIT_TOP_OFFSET = 236;
/**
 * Share of the room left between the board and the control bar that is given back above the board.
 *
 * The offset above is a fixed design number, so on anything taller than the design the whole surplus
 * collects underneath as a long empty apron of ground while the board rides up under the logo. This
 * hands part of that surplus back, which settles the board towards the middle of the play area
 * without ever lifting it above the design's own position on a short screen.
 */
const PORTRAIT_SETTLE = 0.2;
const MOBILE_FRAME_INNER_W = 0.95;
const MOBILE_FRAME_INNER_H = 0.95;

// Mobile-landscape play-area reservation, inherited from Forest Gang. This is also the layout the
// site's small popout windows land in — anything whose short side is 480 or less — so it is judged
// against those and not only against a phone on its side.
//
// The fit is height-limited here (the play area is 1.78 wide, the grid 1.44), which means these two
// vertical numbers and the fill are the only things that set the board's size. The bar reservation
// was 66 and the fill 0.9, which together left a strip of empty ground under the board while the
// HUD's own controls sit out at the corners; the values below spend most of that on the board.
const LS_PANEL_TOP = 88;
const LS_BOTTOM_BAR = 52;
// The two rails are deliberately lopsided. Because the fit is height-limited, neither of them changes
// the board's SIZE — between them they only decide where it sits horizontally, and the right side has
// two things to hold (the action dock AND the BUY BONUS button beside it) against the left's one
// column of pills. With the rails equal the button was left a 48px slot on an 856-wide popout, i.e.
// smaller than its own label; the extra ~100 units here move the board off it.
const LS_LEFT_RAIL = 150;
const LS_RIGHT_RAIL = 218;
const LS_PANEL_FILL = 0.93;

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
		const { mainLayout, canvasSizes, padding } = getBoardViewportMetrics();
		// Full-bleed board on mobile portrait: the frame spans the ENTIRE screen width. Use the raw
		// canvas width (not availableCanvasWidth, which reserves 6px side padding) so frameW resolves
		// to exactly the canvas width; the reels stay inset by MOBILE_FRAME_INNER_W within it.
		const availableWidth = canvasSizes.width / (mainLayout.scale || 1);
		// The visible frame is the grid blown up by FRAME_OVER_GRID_X (the decorative border baked into
		// the board art). Scale so THAT equals the full canvas width — the reels sit inside it — else
		// the ~3% border leaves a sky margin and the board reads as not-quite full width.
		const boardScale =
			(availableWidth * PORTRAIT_FRAME_FILL) / (BOARD_SIZES.width * FRAME_OVER_GRID_X);
		const frameHeight = (BOARD_SIZES.height * boardScale) / MOBILE_FRAME_INNER_H;

		// Whatever room is left between the board's bottom and the control bar, and the share of it
		// handed back above the board — see PORTRAIT_SETTLE. MainContainer draws main-space around the
		// canvas centre, so this is that mapping inverted: canvas y -> main y.
		const scale = mainLayout.scale || 1;
		const toMainY = (canvasY: number) =>
			mainLayout.height * 0.5 + (canvasY - canvasSizes.height * 0.5) / scale;
		const barTop = toMainY(canvasSizes.height - padding.bottom);
		const slack = Math.max(0, barTop - (PORTRAIT_TOP_OFFSET + frameHeight));
		const topY = PORTRAIT_TOP_OFFSET + slack * PORTRAIT_SETTLE;

		return {
			// Centre the portrait board on screen; desktop applies its own design-space placement below.
			x: mainLayout.width * 0.5,
			y: topY + frameHeight * 0.5,
			frameTopY: topY,
			frameCx: mainLayout.width * 0.5,
			frameCy: topY + frameHeight * 0.5,
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

	// Desktop is now placed straight off the design instead of the inherited Forest Gang chain.
	// `y: frameH * _FRAME_ANCHOR_Y` derived the board's position from that game's frame art, which
	// only landed correctly while the grid carried its 1.175:1 cell — with this design's 1.512:1 cell
	// it dropped the board ~90px and clipped the bottom row behind the bar.
	const { mainLayout, canvasSizes } = getBoardViewportMetrics();
	const scale = mainLayout.scale || 1;

	// Fit to whichever design edge runs out first so the proportions survive canvases that are not
	// the design's 1.79. The two agree exactly at 1200x670, which is where the numbers come from.
	const boardScale = Math.min(
		(canvasSizes.width * DESIGN_GRID.width) / (BOARD_SIZES.width * scale),
		(canvasSizes.height * DESIGN_GRID.height) / (BOARD_SIZES.height * scale),
	);

	// mainLayout space -> canvas is `canvasCentre + (p - mainSize/2) * scale` (see MainContainer), so
	// this is the inverse: put the grid's centre on the design's fraction of the canvas.
	const toMainX = (fraction: number) =>
		mainLayout.width * 0.5 + (canvasSizes.width * (fraction - 0.5)) / scale;
	const toMainY = (fraction: number) =>
		mainLayout.height * 0.5 + (canvasSizes.height * (fraction - 0.5)) / scale;

	return {
		x: toMainX(DESIGN_GRID.centreX),
		y: toMainY(DESIGN_GRID.centreY),
		frameTopY: 0,
		frameCx: 0,
		frameCy: 0,
		frameW: BOARD_SIZES.width * boardScale,
		frameH: BOARD_SIZES.height * boardScale,
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
	// Paylines are per-spin presentation, not bonus metadata. They persist through finalWin/outro and
	// are cleared by the next reveal immediately before reel motion begins.
	stateGame.duckCollect = null;
	stateGame.duckRunningTotal = 0;
	stateGame.duckPicks = null;
	stateGame.activeRollerReels = [];
	stateGame.rollerClearedCells = [];
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

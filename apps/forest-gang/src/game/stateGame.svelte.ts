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
	SPIN_OPTIONS_ANTICIPATED_BOUGHT,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (rawSymbol.name === 'SCATTER') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}

	if (rawSymbol.name === 'WILD') {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land' });
	}
};

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForSpinning({
		reelIndex,
		symbolHeight: SYMBOL_SIZE,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelStopping: () => {
			const turbo = stateBet.isTurbo || stateBet.isSuperTurbo;
			// In turbo/super-turbo the reels stop almost simultaneously, so per-reel stops overlap and
			// — with a play state lingering from the previous fast spin — end up inaudible. Play ONE
			// guaranteed reel-stop when the last reel lands instead (forcePlay ignores the lingering state).
			if (turbo) {
				if (reelIndex === BOARD_DIMENSIONS.x - 1)
					eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });
			} else {
				eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });
			}
		},
		onSymbolLand,
	});

	reel.reelState.spinOptions = () => {
		// Autospin has two speed toggles: fast (isTurbo) < turbo (isSuperTurbo).
		// Outside autospin keep the existing behavior untouched.
		const isAutoSpinning = stateBet.autoSpinsCounter !== 0;
		if (isAutoSpinning && stateBet.isSuperTurbo && !stateGame.bonusMode)
			return SPIN_OPTIONS_TURBO;
		if (isAutoSpinning && stateBet.isTurbo && !stateGame.bonusMode)
			return SPIN_OPTIONS_FAST;

		if ((stateBet.isTurbo || stateBet.isSuperTurbo) && !stateGame.bonusMode)
			return SPIN_OPTIONS_TURBO;

		if (reel.reelState.spinType === 'fast') {
			return stateGame.bonusMode ? SPIN_OPTIONS_DEFAULT : SPIN_OPTIONS_FAST;
		}

		if (reel.reelState.spinType === 'anticipated') {
			if (stateGame.bonusMode) return SPIN_OPTIONS_DEFAULT;
			// Bought rounds (Deal It / All In): the outcome is known, so run the anticipation at
			// half length — activeBetModeKey stays BONUS/SUPER for the whole bought round.
			const isBoughtRound = ['BONUS', 'SUPER'].includes(String(stateBet.activeBetModeKey));
			return isBoughtRound ? SPIN_OPTIONS_ANTICIPATED_BOUGHT : SPIN_OPTIONS_ANTICIPATED;
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
	scatterCounter: 0,
	selectedBonusSymbol: null as SymbolName | null,
	bonusMode: null as 'freegame' | 'superspin' | 'feature' | null,
	// What the BACKGROUND should show. Mirrors bonusMode, but is only ever assigned at the points
	// where the transition veil covers the screen (see bookEventHandlerMap's freeSpinTrigger).
	// bonusMode itself is also set by `bonusSymbolSelected`, which runs with the deer presenter on
	// screen and nothing covering it — driving the background from that flipped the forest art
	// mid-animation, in full view.
	bonusBackgroundMode: null as 'freegame' | 'superspin' | 'feature' | null,
	globalMultiplier: 1,
	expandedSymbol: null as null | { symbol: SymbolName; reels: number[]; positions: Position[] },
	expandedSymbolWon: false,
	// True once the expanded column's reveal animation has finished. From that point the overlay
	// stops drawing and Board renders the expanded symbol on those reels as normal win symbols.
	expandedSettled: false,
	// Rows the expanded-column overlay currently paints over, per reel, as [firstRow, endRow).
	// Published by ExpandedSymbolOverlay as its reveal grows; Board hides exactly these cells so the
	// reel's own symbols stay visible in the rows the reveal has not reached yet.
	expandedCoverage: {} as Record<number, [number, number]>,
	paylineWins: [] as Array<{ lineIndex: number; path: Array<{ reel: number; row: number }> }>,
	paylineSnap: false,
	tempMultiplier: null as number | null,
	endRoundOnly: false,
	pendingStop: false,
	awaitingFirstReveal: false,
	stopAutoOnBonus: false,     // autoplay stops when a bonus triggers
	hasAnticipationPending: false,  // true when current spin has unskipped anticipation reels
	resumeModalOpen: false,     // the "Unfinished Round" resume dialog is on screen
	buyModalOpen: false,        // the Buy Bonus dialog is on screen (board animations freeze behind it)
	freeSpinPopupShowing: false, // a free-spin congrats screen (intro OR outro) is up — HUD buttons
	                            // are made non-interactive so the popup reads as a fullscreen modal
	                            // (taps pass through the HUD to the press-anywhere handler)
	// Per-round win (book-event units) for the HUD WIN readout: this spin's win — NOT the cumulative
	// bonus total (that's EARNED / winBookEventAmount). Cleared each spin, set to the grand total at
	// bonus end. Distinct from winBookEventAmount so WIN shows per-round during a bonus.
	roundWin: 0,
});

const getBoardViewportPadding = () => {
	const layoutType = stateLayoutDerived.layoutType();

	if (layoutType === 'portrait') return { top: 8, right: 2, bottom: 146, left: 2 };
	if (layoutType === 'landscape') return { top: 4, right: 16, bottom: 22, left: 8 };
	if (layoutType === 'tablet') return { top: 10, right: 20, bottom: 86, left: 20 };
	// Desktop: trim the bottom on short laptop canvases (e.g. 1024×576) so the board grows to fill the
	// gap above the HUD; normal desktops keep 172. The bonus rail is re-anchored to the right edge in
	// `bonusRailAdjust` so the enlarged board doesn't push it off-screen.
	const shortCanvas = stateLayoutDerived.canvasSizes().height < 640;
	return { top: 76, right: 220, bottom: shortCanvas ? 118 : 150, left: 208 };
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
	// Desktop shifts zeroed: the legacy ±px pair biased the frame off true centre.
	const extraLeftShiftPx = layoutType === 'landscape' ? 55 : 0;
	const centeredCanvasX = padding.left + availableCanvasWidth * 0.5 - canvasSizes.width * 0.5;
	const centeredCanvasY = padding.top + availableCanvasHeight * 0.5 - canvasSizes.height * 0.5;
	// extraLeftShiftPx (75) and shiftRightPx cancel → board sits centred in the
	// padded area. Lower shiftRightPx to nudge the whole board left.
	// Portrait has no left-shift to cancel, so it must not shift right either.
	const shiftRightPx = layoutType === 'landscape' ? 90 : 0;
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
const _FRAME_ANCHOR_Y = 0.502; // grid centre y as a fraction of frameH (tuned so the top gap to the
// top log equals the bottom gap to the bottom log — the drawn frame's V_SQUASH raised the bottom log,
// so the grid needed to move up to stay centred between the two logs)
const _FRAME_EXTRA_SCALE = 1.30 / 1.27;
// Portrait: the frame's share of the available canvas width (the reel grid then takes
// MOBILE_FRAME_INNER_W of the frame). At the old 1.048 the frame bled off-screen and the grid
// itself came out to 1.048 x 0.965 = 101.1% of the available width — the outer columns' symbols
// were clipped at the screen edges (worse for animals, whose border frame draws wider than the
// cell). 0.99 leaves ~4pt of forest visible either side of the frame (design ask) and puts the
// grid at 95.5% of the width, so every symbol sits fully on screen.
const PORTRAIT_FRAME_FILL = 0.99;
const PORTRAIT_TOP_OFFSET = 236; // portrait: push frame down from the top (main-layout units)
// Mobile board frame (board_frame_mobile.png) — full width, top/bottom borders only.
// Fractions of the drawn frame the reel grid occupies. Mirrored in BoardFrame.svelte.
const MOBILE_FRAME_INNER_W = 0.965;
const MOBILE_FRAME_INNER_H = 0.78;

// reel_frame.png cropped to opaque bounds (2121×1638). The rope hangs from the top ~25% of the
// image; the inner wood panel (where the reels sit) is measured below it.
const LS_FRAME_ASPECT = 2121 / 1638;
const LS_FRAME_INNER_W = 0.83; // wider inner panel → bigger cells
const LS_FRAME_INNER_H = 0.75; // taller inner panel → bigger cells
const LS_FRAME_INNER_CX = 0.5;
const LS_FRAME_INNER_CY = 0.6; // grid vertical centre in the frame (even top/bottom gap)
const LS_PANEL_FILL = 0.98;  // reel pitch fills ~98% of the inner panel (both axes)
const LS_SYMBOL_FILL = 1.12; // symbol size vs its cell (bigger → fills the cell, tighter gaps)
const LS_FRAME_WIDTH = 0.9;  // slight narrowing of the frame/background (forest margin on sides)
// Mobile landscape fits the frame between the HUD's Press Play rail pieces, in its --lu units
// (HudHtml.svelte `.ls-stats` / `.ls-side` — keep in step): BALANCE/WIN boxes 14 from the left,
// 120 wide; stepper column's left edge 92.5 + 46 from the right.
const LS_STATS_LEFT_LU = 14;
const LS_STATS_W_LU = 120;
const LS_SIDE_FROM_RIGHT_LU = 92.5 + 46;
const LS_HUD_GAP_LU = 8;
const LS_TOP_LU = 10; // clearance above the visible frame
const LS_FOOT_LU = 40; // the rail / stats foot line, up from the bottom
// The drawn wood box inside the frame rect (fractions), measured at 740x420.
const LS_FRAME_VIS_X0 = 0.066;
const LS_FRAME_VIS_X1 = 0.94;
const LS_FRAME_VIS_Y0 = 0.238;
const LS_FRAME_VIS_Y1 = 0.947;

// Clearance between the desktop board frame and the top of the HUD's Press Play bar, device px.
const DESKTOP_BAR_GAP_PX = 6;

const boardLayout = () => {
	const layoutType = stateLayoutDerived.layoutType();

	// Mobile landscape: frame-driven. Fit the whole rope-hung reel frame (rope + poles
	// included) inside the play area, then place the reel grid inside its inner wood region.
	if (layoutType === 'landscape') {
		const main = stateLayoutDerived.mainLayout();
		// As big as the screen allows without touching the HUD (2026-11-26 ask): the VISIBLE wood box
		// (LS_FRAME_VIS_*, measured off the drawn frame — the rect above it is empty) fills the gap
		// between the BALANCE/WIN boxes and the bet-stepper column, and between the screen top and
		// the rail's foot line. The HUD (HudHtml's Press Play landscape rail) is laid out in
		// --lu = min(vw/800, vh/360) px, so the gap is worked out in canvas px, then mapped to main.
		const canvas = stateLayoutDerived.canvasSizes();
		const ms = main.scale || 1;
		const lu = Math.min(canvas.width / 800, canvas.height / 360);
		const gap = LS_HUD_GAP_LU * lu;
		const left = (LS_STATS_LEFT_LU + LS_STATS_W_LU) * lu + gap;
		const right = canvas.width - LS_SIDE_FROM_RIGHT_LU * lu - gap;
		const top = LS_TOP_LU * lu;
		const bottom = canvas.height - LS_FOOT_LU * lu;
		const aspect = LS_FRAME_ASPECT * LS_FRAME_WIDTH;
		const visW = LS_FRAME_VIS_X1 - LS_FRAME_VIS_X0;
		const visH = LS_FRAME_VIS_Y1 - LS_FRAME_VIS_Y0;
		const frameHpx = Math.max(1, Math.min((right - left) / (visW * aspect), (bottom - top) / visH));
		const frameWpx = frameHpx * aspect;
		const frameLeftPx = (left + right) * 0.5 - ((LS_FRAME_VIS_X0 + LS_FRAME_VIS_X1) * 0.5) * frameWpx;
		const frameTopPx = (top + bottom) * 0.5 - ((LS_FRAME_VIS_Y0 + LS_FRAME_VIS_Y1) * 0.5) * frameHpx;
		const frameW = frameWpx / ms;
		const frameH = frameHpx / ms;
		const frameCx = main.width * 0.5 + (frameLeftPx + frameWpx * 0.5 - canvas.width * 0.5) / ms;
		const frameCy = main.height * 0.5 + (frameTopPx + frameHpx * 0.5 - canvas.height * 0.5) / ms;
		// Inner wood panel (where the reels sit).
		const innerW = frameW * LS_FRAME_INNER_W;
		const innerH = frameH * LS_FRAME_INNER_H;
		// UNIFORM reel pitch: both axes use the tighter of the two fill scales so the columns aren't
		// spread out across a wide panel (which left big horizontal gaps). Gaps are then even on both
		// axes and controlled purely by LS_SYMBOL_FILL. The board centres in the panel.
		const pitchX = (innerW / BOARD_SIZES.width) * LS_PANEL_FILL;
		const pitchY = (innerH / BOARD_SIZES.height) * LS_PANEL_FILL;
		const pitch = Math.min(pitchX, pitchY);
		const boardScaleX = pitch;
		const boardScaleY = pitch;
		const boardScale = pitch * LS_SYMBOL_FILL;
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

	// Redesign: the board reads much larger — roughly from the BUY BONUS button to the spin
	// button (see Figma 3449-1334). Wider reel pitch (H_SPREAD, symbols stay undistorted) plus a
	// bigger overall scale; the frame is sized/centred from the new-frame interior fractions
	// (kept in sync with BoardFrame.svelte). The ×1.1 is the "whole board 10% bigger" ask —
	// BoardFrame derives its size from these scale values, so grid + frame grow together.
	let boardScale = getBoardScale() * 1.05;
	const H_SPREAD = 1.12;
	const V_TIGHTEN = 0.95;
	// Panel fractions measured from board_frame_desktop.webp (mirrors BoardFrame.svelte):
	// y 0.040..0.947 — the old 0.03..0.95 box sat high, leaving extra space at the bottom rail.
	const NEW_INNER_W = 0.961 - 0.034;
	const NEW_INNER_H = 0.947 - 0.04;
	const NEW_INNER_CY = (0.947 + 0.04) / 2;
	// Margins 1.004 / 1.004 mirror BoardFrame.svelte — outer columns/rows sit ~1px from the rails.
	const DESKTOP_TOP_GAP = 54;
	// Keep the frame clear of the HUD's Press Play bar (2026-11-26). The bar is Blob Split's, laid
	// out in --bs = min(vw/1280, vh/760) px and standing 8px + 122·bs tall from the bottom (HudHtml),
	// so it grows with the window while this board is sized from fixed px padding — on big screens
	// the frame's bottom log ran under the bar. Shrink the board just enough to end above it.
	{
		const main = stateLayoutDerived.mainLayout();
		const canvas = stateLayoutDerived.canvasSizes();
		const ms = main.scale || 1;
		const bs = Math.min(canvas.width / 1280, canvas.height / 760);
		const barTopMain =
			main.height * 0.5 + (canvas.height * 0.5 - (8 + 122 * bs) - DESKTOP_BAR_GAP_PX) / ms;
		const frameH0 = (BOARD_SIZES.height * boardScale * V_TIGHTEN * 1.004) / NEW_INNER_H;
		const maxFrameH = barTopMain - DESKTOP_TOP_GAP;
		if (maxFrameH > 0 && frameH0 > maxFrameH) boardScale *= maxFrameH / frameH0;
	}
	const frameW = (BOARD_SIZES.width * boardScale * H_SPREAD * 1.004) / NEW_INNER_W;
	const frameH = (BOARD_SIZES.height * boardScale * V_TIGHTEN * 1.004) / NEW_INNER_H;
	return {
		x: stateLayoutDerived.mainLayout().width * 0.5 + getBoardOffset().x,
		y: DESKTOP_TOP_GAP + frameH * NEW_INNER_CY,
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
	stateGame.bonusBackgroundMode = null;
	stateGame.globalMultiplier = 1;
	stateGame.expandedSymbol = null;
	stateGame.expandedSymbolWon = false;
	stateGame.expandedSettled = false;
	stateGame.expandedCoverage = {};
	stateGame.tempMultiplier = null;
	// paylineWins is deliberately NOT cleared here. This resets BONUS presentation, and finalWin
	// calls it at the end of every round — which wiped the payline vines a moment after they were
	// drawn, while the player was still looking at the winning line. The vines belong to the WIN
	// presentation and are meant to stay until the result is replaced: the two places that legitimately
	// end them (the next spin's `reveal`, and `freeSpinEnd`) clear them explicitly already.
};

// Desktop bonus side-rail (bonus symbol / multiplier / earned / global-multiplier / FS counter):
// fit each panel into the strip between the board's right grid edge and the canvas right edge —
// shrunk when the strip is narrow (laptop canvases used to push the rail off the right edge) and
// horizontally centred in the strip. The components anchor their panel CENTRE at
// (boardW + 40 + railAdj.x) inside BoardContainer, so railAdj.x re-targets that anchor to the
// strip centre. Non-desktop layouts keep the identity transform (they have their own branches).
const bonusRailAdjust = (panelW: number) => {
	if (stateLayoutDerived.layoutType() !== 'desktop') return { scale: 1, x: 0 };
	const cs = stateLayoutDerived.canvasSizes();
	const main = stateLayoutDerived.mainLayout();
	const bl = boardLayout();
	const mScale = main.scale || 1;
	const scl = bl.boardScale || 1;
	// The reel grid renders inside MainContainer (design units → canvas via the centred,
	// mScale'd container), while the panels' BoardContainer is mounted at the pixi ROOT and
	// positions in raw canvas px. The two spaces differ, so map each side with its own transform.
	const gridRightCanvas =
		cs.width / 2 +
		(bl.x + (bl.width - bl.pivot.x) * (bl.boardScaleX ?? scl) - main.width / 2) * mScale;
	const stripW = Math.max(cs.width - gridRightCanvas, 0);
	// Panel canvas width = panelW * componentScale * scl (BoardContainer's scale — no mScale).
	// Fit the strip (0.86 fill keeps a margin) AND never exceed the desktop FS-counter card
	// width (SYMBOL_SIZE*2*0.72 design px — FreeSpinCounter.svelte SIZE) so the whole rail
	// reads as one matched set; floored at 0.5 so panels never vanish.
	const fsCardCanvasW = SYMBOL_SIZE * 2.0 * 0.72 * mScale;
	const fitScale = Math.min((stripW * 0.86) / Math.max(panelW * scl, 1), fsCardCanvasW / Math.max(panelW * scl, 1));
	const scale = Math.min(1, Math.max(fitScale, 0.5));
	// The strip centre, expressed as a BoardContainer-local x (raw canvas px space).
	const stripCenterCanvasX = gridRightCanvas + stripW / 2;
	const targetLocalX = bl.pivot.x + (stripCenterCanvasX - bl.x) / scl;
	return { scale, x: targetLocalX - (bl.width + 40) };
};

// Mobile-landscape bonus rail: a full-height column on the LEFT (symbol → multiplier → FS counter →
// earned) stacked under the FOREST GANG logo, matching the Figma design. The panels render inside a
// MainContainer in landscape, so these coordinates are in main-layout units. Tune the Y fractions and
// column centre here.
const landscapeRail = () => {
	const main = stateLayoutDerived.mainLayout();
	// FS counter card width (SYMBOL_SIZE*2.0*0.96) — every rail panel scales its own frame to this so
	// the symbol / multiplier / FS / earned boxes all render the same width.
	const refWidth = SYMBOL_SIZE * 2.0 * 0.96;
	// Column centred in the strip between the screen's left edge and the board frame's left
	// edge (grid left + the desktop frame's ~8% side-rail overhang).
	const bl = boardLayout();
	const gridW = bl.width * (bl.boardScaleX ?? bl.boardScale);
	const boardLeft = bl.x - (gridW / 2) * 1.08;
	const x = boardLeft / 2;
	const H = main.height;
	return {
		x,
		refWidth,
		symbolY: H * 0.22,
		multiplierY: H * 0.39,
		fsY: H * 0.56,
		earnedY: H * 0.73,
	};
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
	bonusRailAdjust,
	landscapeRail,
};

import { backOut, cubicIn, cubicOut, quadIn } from 'svelte/easing';

import { stateBet } from 'state-shared';
import { createReelForSpinning } from 'utils-slots';
import { waitForTimeout } from 'utils-shared/wait';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type {
	BoardCell,
	ClusterSeriesSnapshot,
	GameType,
	PaySymbolName,
	Position,
	RawSymbol,
	SymbolState,
} from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import {
	BOARD_DIMENSIONS,
	BOARD_SIZES,
	INITIAL_BOARD,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	SPIN_OPTIONS_TURBO,
	SYMBOL_H,
	SYMBOL_W,
} from './constants';
import { eventEmitter } from './eventEmitter';

// ── helpers ──────────────────────────────────────────────────────────────────

const posKey = ({ reel, row }: Position) => `${reel}:${row}`;
const getTargetY = (row: number) => SYMBOL_H * (row + 0.5);

// ── motion presets ────────────────────────────────────────────────────────────

const MOTION_NORMAL = {
	respin: {
		dimDurationMs: 110,
		clearGapMs: 50,
		spinCount: 5,
		spinFrameMs: 270,
		durationMs: 250,
		bounceMs: 80,
		groupDelayMs: 200, // ms between each stop-group of 1–5 cells
		lockPulseMs: 130,
	},
};

const MOTION_FAST = {
	respin: {
		dimDurationMs: 40,
		clearGapMs: 18,
		spinCount: 3,
		spinFrameMs: 80,
		durationMs: 80,
		bounceMs: 45,
		groupDelayMs: 45,
		lockPulseMs: 55,
	},
};

const getMotion = () =>
	stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations
		? MOTION_FAST
		: MOTION_NORMAL;

const SKIP_REEL_DELAY_MS = 70;
const SKIP_MIN_SPIN_MS_NORMAL = 220;
const SKIP_MIN_SPIN_MS_FAST = 140;
const SKIP_MIN_SPIN_MS_TURBO = 60;
let skipCascadeStartedAt = 0;
let reelSpinStartedAt: number[] = [];
const skipStopScheduledReels = new Set<number>();

const getSkipMinSpinMs = () => {
	if (stateBet.isSuperTurbo) return SKIP_MIN_SPIN_MS_TURBO;
	if (stateBet.isTurbo) return SKIP_MIN_SPIN_MS_FAST;
	return SKIP_MIN_SPIN_MS_NORMAL;
};

// Paid/free-spin reveal: a loose gravity RAIN, not rigid column strips (retimed against a
// reference capture of the target behaviour — 60fps frame strips, scratchpad/refvid). Every
// symbol falls on its own clock: bottom rows first so each column piles up from the floor
// (~rowStaggerMs cadence per column), a small random jitter per symbol so nothing lands in
// lockstep, and an ACCELERATING fall (quadIn) instead of the old constant-speed slam. The
// per-cell squash + bounce on landing stays — the reference has the same settle.
const DROP_START_ROWS = BOARD_DIMENSIONS.y + 3;
const DROP_THUMP_MS = 45;
const DROP_BOUNCE_UP_MS = 35;
const DROP_BOUNCE_SETTLE_MS = 40;
const DROP_BOUNCE_HEIGHT = SYMBOL_H * 0.08;
const DROP_EXIT_ROWS = BOARD_DIMENSIONS.y + 1;

const DROP_MOTION_NORMAL = {
	startRows: DROP_START_ROWS,
	durationMs: 240,
	reelDelayMs: 12,
	rowStaggerMs: 62,
	jitterMs: 70,
} as const;

const DROP_MOTION_FAST = {
	startRows: DROP_START_ROWS,
	durationMs: 90,
	reelDelayMs: 8,
	rowStaggerMs: 14,
	jitterMs: 24,
} as const;

type ActiveDrop = {
	skipped: boolean;
	cancelled: boolean;
	skipPromise: Promise<void>;
	resolveSkip: () => void;
};

let activeDropToken = 0;
let dropInProgress = false;
let activeDrop: ActiveDrop | null = null;
let boardExitPromise: Promise<void> | null = null;

const cancelActiveDrop = () => {
	if (!activeDrop) return;
	activeDrop.cancelled = true;
	activeDrop.resolveSkip();
	activeDrop = null;
	dropInProgress = false;
};

// ── cell helpers ──────────────────────────────────────────────────────────────

import { Tween } from 'svelte/motion';

const initBoardCell = (raw: RawSymbol, reel: number, row: number): BoardCell => ({
	...raw,
	key: `${reel}:${row}`,
	position: { reel, row },
	symbolState: INITIAL_SYMBOL_STATE,
	displayX: new Tween(0),
	displayY: new Tween(getTargetY(row)),
	displayAlpha: new Tween(1),
	displayScale: new Tween(1),
	locked: false,
	highlighted: false,
	anchor: false,
	target: false,
	persistent: false,
	fresh: false,
	pulling: false,
});

const updateCellRaw = (cell: BoardCell, raw: RawSymbol) => {
	cell.name = raw.name;
	cell.multiplier = raw.multiplier;
	cell.scatter = raw.scatter;
	cell.magnet = raw.magnet || raw.name === 'MAGNET';
	cell.wild = raw.wild && !cell.magnet;
};

const shouldKeepWildInCluster = (cell: RawSymbol) =>
	cell.wild || cell.magnet || cell.name === 'WILD' || cell.name === 'MAGNET';

// `highlighted` OUTRANKS `locked`. It used to be the other way round, which made a stacked cell
// unable to ever show its win animation: animateWinningPositions sets symbolState = 'win' directly,
// but the next applySeriesDecorations — and there is one on essentially every clusterSeriesUpdate —
// recomputed it straight back to 'locked'. In a bonus the wild and its whole chain ARE the locked
// cluster, so that is exactly the run of symbols that stayed frozen on its static tile while every
// unlocked winning symbol animated. Board.svelte already has the branch to draw the win
// presentation for a locked cell (<SymbolWinFx> inside the lockedCells loop); it was simply
// unreachable.
const applyCellVisualState = (cell: BoardCell) => {
	cell.symbolState = cell.highlighted
		? 'win'
		: cell.locked
			? 'locked'
			: cell.magnet
				? 'magnet'
				: 'static';
};

// ── series decorations ────────────────────────────────────────────────────────

const applySeriesDecorations = ({
	board,
	series,
	magnetTargetSymbol,
	freshKeys = new Set<string>(),
}: {
	board: BoardCell[][];
	series: ClusterSeriesSnapshot[];
	magnetTargetSymbol: PaySymbolName | null;
	freshKeys?: Set<string>;
}) => {
	const locked = new Set(series.flatMap((e) => e.lockedPositions.map(posKey)));
	const anchors = new Set(series.flatMap((e) => e.anchorPositions.map(posKey)));
	const persistent = new Set(
		series.filter((e) => e.persistent).flatMap((e) => e.lockedPositions.map(posKey)),
	);

	for (const reel of board) {
		for (const cell of reel) {
			const key = posKey(cell.position);
			cell.locked = locked.has(key);
			cell.anchor = anchors.has(key);
			cell.persistent = persistent.has(key);
			cell.fresh = freshKeys.has(key);
			cell.target = magnetTargetSymbol != null && cell.name === magnetTargetSymbol;
			applyCellVisualState(cell);
		}
	}
};

// ── layout helpers ────────────────────────────────────────────────────────────

const getBoardViewportPadding = () => {
	const layoutType = stateLayoutDerived.layoutType();
	if (layoutType === 'portrait') return { top: 10, right: 10, bottom: 170, left: 10 };
	if (layoutType === 'landscape') return { top: 10, right: 20, bottom: 34, left: 12 };
	if (layoutType === 'tablet') return { top: 24, right: 28, bottom: 100, left: 28 };
	return { top: 110, right: 230, bottom: 245, left: 210 };
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
		0.53,
		Math.min(
			availableCanvasHeight / (BOARD_SIZES.height * (mainLayout.scale || 1)),
			availableCanvasWidth / (BOARD_SIZES.width * (mainLayout.scale || 1)),
		),
	);
};

// Portrait: the board fills most of the width and sits below the logo + ALL WINS/capsule/FREE SPINS
// top bar; the HTML HUD occupies the space below it.
const PORTRAIT_FRAME_FILL = 0.94;
const PORTRAIT_TOP_OFFSET = 372;
const LANDSCAPE_FRAME_FILL = 0.82;
// On small landscape screens the HTML HUD sits at its min pixel sizes (proportionally larger), so the
// board fills LESS of the frame there to keep the gutters (balance/bet left, capsule/nav right) clear.
// Lerp the fill from FILL_MIN at short-side ≤ 250px up to FILL at short-side ≥ 430px.
// Raised 0.76 -> 0.84 so the grid reads bigger at popout-S sizes. This is the t=0 end of the lerp,
// so it moves ONLY the small landscape screens; popout L sits at t=1 on LANDSCAPE_FRAME_FILL and is
// untouched.
const LANDSCAPE_FRAME_FILL_MIN = 0.84;
const LANDSCAPE_FILL_SHORT_MIN = 240;
const LANDSCAPE_FILL_SHORT_MAX = 410;
// 0 at the smallest landscape screens → 1 at normal-size ones; drives both the board fill and the
// capsule column bias so small screens get a smaller board and a capsule pulled toward it (nav room).
const landscapeSizeT = () => {
	const c = stateLayoutDerived.canvasSizes();
	const shortSidePx = Math.min(c.width, c.height);
	return Math.max(
		0,
		Math.min(
			1,
			(shortSidePx - LANDSCAPE_FILL_SHORT_MIN) /
				(LANDSCAPE_FILL_SHORT_MAX - LANDSCAPE_FILL_SHORT_MIN),
		),
	);
};
const landscapeFrameFill = () =>
	LANDSCAPE_FRAME_FILL_MIN + landscapeSizeT() * (LANDSCAPE_FRAME_FILL - LANDSCAPE_FRAME_FILL_MIN);

// Single source of truth for the game logo's drawn size, in virtual units. GameLogoFrame draws it;
// LandscapeCapsule and RespinPanel anchor the left-gutter box column (TOTAL WIN / FREE SPINS /
// RESPIN) just beneath it. All three used to hardcode their own copy of this formula, which desynced
// the instant the logo gained a per-screen scale — the column stayed pinned to a phantom taller logo
// and sat too low. LOGO_SMALL_SCALE shrinks the mark on popout-S sizes only (t=0); popout L is t=1
// and keeps the original full size.
const LOGO_ART_ASPECT = 1400 / 1098;
const LOGO_WIDTH_FRACTION = 0.3;
const LOGO_SMALL_SCALE = 0.72;
const landscapeLogoWidth = () =>
	stateLayoutDerived.mainLayout().width *
	LOGO_WIDTH_FRACTION *
	(LOGO_SMALL_SCALE + landscapeSizeT() * (1 - LOGO_SMALL_SCALE));
const landscapeLogoHeight = () => landscapeLogoWidth() / LOGO_ART_ASPECT;
// How far below the screen top the left-gutter box column starts, as a fraction of the logo height.
// Lerped so popout S pulls the column (and the RESPIN box at its foot) UP toward the logo, where
// there is far less vertical room, while popout L keeps the 0.6 it was tuned at.
const LANDSCAPE_STACK_TOP_MIN = 0.42;
const LANDSCAPE_STACK_TOP_MAX = 0.6;
const landscapeStackTopY = () => {
	const main = stateLayoutDerived.mainLayout();
	const canvasTopY =
		main.height * 0.5 - stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1));
	const factor =
		LANDSCAPE_STACK_TOP_MIN +
		landscapeSizeT() * (LANDSCAPE_STACK_TOP_MAX - LANDSCAPE_STACK_TOP_MIN);
	return canvasTopY + landscapeLogoHeight() * factor;
};
// Shrink the landscape grid so the right-hand furniture (capsule tube, BUY BONUS, nav column, spin
// button) has clearance instead of overlapping the board — see boardLayout() below. 0.912 = the
// first 5% trim plus a further 4% (0.95 x 0.96) once the first pass still read as too tight.
const LANDSCAPE_BOARD_TRIM = 0.912;
// Landscape vertical capsule column (shared by the pixi capsule and the HTML buy-bonus button so
// they always align across device aspect ratios). Bias = fraction from the board's right edge toward
// the visible right edge — snug to the nav on normal screens, pulled toward the board on small ones so
// the (now bigger) capsule keeps clearance from the nav.
// MAX (popout L, t=1) lowered from 0.33 -> 0.27: the capsule column and the BUY BONUS badge that
// tracks it sat too far right there, crowding the nav. MIN (popout S, t=0) went the other way,
// 0.24 -> 0.26, to push the column slightly RIGHT on small screens as requested.
const LANDSCAPE_CAPSULE_BIAS_MIN = 0.26;
const LANDSCAPE_CAPSULE_BIAS_MAX = 0.27;
const landscapeCapsuleBias = () =>
	LANDSCAPE_CAPSULE_BIAS_MIN +
	landscapeSizeT() * (LANDSCAPE_CAPSULE_BIAS_MAX - LANDSCAPE_CAPSULE_BIAS_MIN);
// The landscape capsule is the portrait glass tube (magnetic_tube.webp, 1002×668) rotated to vertical.
// The art has ~29% transparent margins top/bottom (→ left/right after the 90° rotation): the opaque
// tube is only ~42.5% of the sprite's width and ~94% of its height, so the *visible* tube is a slim
// vertical cylinder. RATIO scales the whole sprite (bigger = bigger visible tube); STRETCH keeps the
// native aspect (1.0 = undistorted — higher just makes the visible tube thinner, which reads as small).
const LANDSCAPE_CAPSULE_TUBE_RATIO = 1.5;
const LANDSCAPE_CAPSULE_TUBE_ASPECT = 668 / 1002;
const LANDSCAPE_CAPSULE_TUBE_STRETCH = 1.0;
// Opaque tube extents within the sprite (measured), used to place things against the VISIBLE tube
// rather than the padded sprite box.
const LANDSCAPE_CAPSULE_VISIBLE_W = 0.425; // opaque width as a fraction of the sprite width (tubeW)
const LANDSCAPE_CAPSULE_VISIBLE_H = 0.94; // opaque height as a fraction of the sprite height (tubeH)

const boardLayout = () => {
	const mainLayout = stateLayoutDerived.mainLayout();
	const layoutType = stateLayoutDerived.layoutType();

	if (layoutType === 'portrait') {
		const boardScale = (mainLayout.width * PORTRAIT_FRAME_FILL) / BOARD_SIZES.width;
		return {
			x: mainLayout.width * 0.5,
			y: PORTRAIT_TOP_OFFSET + (BOARD_SIZES.height * boardScale) / 2,
			boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	if (layoutType === 'landscape') {
		// Mobile landscape: board fills most of the height and sits slightly LEFT of centre, leaving a
		// wider right gutter for the vertical capsule + buy bonus + nav bar (left gutter holds the
		// logo / ALL WINS / FREE SPINS / balance / bet).
		// LANDSCAPE_BOARD_TRIM: at popout-L sizes the grid grew until the nav column, the spin button
		// and the BUY BONUS badge sat ON TOP of the board's right edge and the capsule tube. Those are
		// positioned independently of the board, so the grid has to give the room back. Applied as a
		// factor on top of the fill lerp so the existing small-screen ramp is preserved.
		const boardScale =
			((mainLayout.height * landscapeFrameFill()) / BOARD_SIZES.height) * LANDSCAPE_BOARD_TRIM;
		return {
			x: mainLayout.width * 0.475,
			y: mainLayout.height * 0.5,
			boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	// Very slightly smaller (was 0.92 → 0.9) so its bottom-right corner clears the nav on short screens
	// like 1024×576; shrinking (rather than moving down) also eases the top, which is already tight there.
	const boardScale = getBoardScale() * 0.88;
	// Centre the grid in the padded region (top padding sits below the logo, bottom padding above the
	// HUD) instead of top-anchoring it, then ease it slightly DOWN — the full bottom reserve pulled it
	// too close to the top on short laptops (e.g. 1024×576).
	const pad = getBoardViewportPadding();
	const mainScale = mainLayout.scale || 1;
	const boardY = mainLayout.height * 0.5 + (pad.top - pad.bottom + 25) / (2 * mainScale);
	return {
		// MainContainer is anchored 0.5 at canvasSizes().width * 0.5, so local x = width * 0.5 IS the
		// viewport centre. This used to add getBoardOffset().x, which centred the board in the padded
		// region instead — and since desktop padding is asymmetric (210 left / 230 right) plus a
		// hand-tuned +30, the grid sat 20px right of centre.
		x: mainLayout.width * 0.5,
		y: boardY,
		boardScale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

// Landscape vertical-capsule column geometry, in virtual (main) coordinates. Single source of truth
// shared by the pixi LandscapeCapsule and the HTML buy-bonus button (which converts it to device px)
// so the capsule and the buy badge beneath it stay aligned at every device aspect ratio.
const LANDSCAPE_CAPSULE_TOP_GAP = 0.01;

const landscapeCapsuleLayout = () => {
	const board = boardLayout();
	const main = stateLayoutDerived.mainLayout();
	const scale = board.boardScale;
	const gridHalfW = board.width * 0.5 * scale;
	const gridHalfH = board.height * 0.5 * scale;
	// Right edge of the visible viewport, expressed in virtual units.
	const canvasRightX =
		main.width * 0.5 + stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1));
	const boardRightX = board.x + gridHalfW;
	const colX = boardRightX + (canvasRightX - boardRightX) * landscapeCapsuleBias();
	// 10% larger than the board-derived base size, anchored near the SCREEN TOP (not centred on
	// the board) so the capsule column starts almost at the top edge.
	const baseH = gridHalfH * LANDSCAPE_CAPSULE_TUBE_RATIO * 1.1;
	const tubeW = baseH * LANDSCAPE_CAPSULE_TUBE_ASPECT;
	const tubeH = baseH * LANDSCAPE_CAPSULE_TUBE_STRETCH;
	// Visible (opaque) tube extents — the sprite box is padded, so size the symbol against these and
	// place the buy-bonus just below the visible tube bottom (not the padded sprite bottom).
	const visibleW = tubeW * LANDSCAPE_CAPSULE_VISIBLE_W;
	const visibleH = tubeH * LANDSCAPE_CAPSULE_VISIBLE_H;
	const canvasTopY =
		main.height * 0.5 - stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1));
	// Anchor the VISIBLE glass top — not the padded sprite box, which carries ~3% dead space above
	// the art and pushed the whole column down by that much on top of the gap. LANDSCAPE_CAPSULE_TOP_GAP
	// is now literally the clearance between the screen top and the tube's first visible pixel, so it
	// means what it says. (0.07 sprite-anchored originally, which read as floating.) This is the single
	// knob for the capsule's height; the buy-bonus badge and WIN pill track its visible bottom and follow.
	let tubeY = canvasTopY + main.height * LANDSCAPE_CAPSULE_TOP_GAP + visibleH * 0.5;
	const symSize = visibleW * 0.66;
	let visibleBottom = tubeY + visibleH * 0.5;
	// On very short landscape screens (e.g. 400×225) the board — and this board-derived tube — shrinks,
	// so the top-anchored capsule + buy-bonus float near the top with dead space below. There, slide the
	// whole group down so it sits near the bottom. Taller landscape screens keep the top anchor (the
	// tube already fills the gutter), so this doesn't disturb them.
	// NOTE: short landscape screens (popout S, ~400x225) used to slide this whole group DOWN toward the
	// bottom, on the reasoning that the board-derived tube shrinks there and would otherwise float with
	// dead space beneath it. That shift is gone by request — the capsule (and the buy-bonus badge and
	// WIN pill that track its visible bottom) now keeps the same top anchor at every landscape size.
	return {
		colX,
		tubeY,
		tubeW,
		tubeH,
		visibleW,
		visibleH,
		visibleBottom,
		symSize,
		gridHalfW,
		gridHalfH,
	};
};

// ── sound helpers ─────────────────────────────────────────────────────────────

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const boardRaw = () =>
	stateGame.board.map((reel) =>
		reel.map(
			({
				key,
				position,
				symbolState,
				displayX,
				displayY,
				displayAlpha,
				displayScale,
				locked,
				highlighted,
				anchor,
				target,
				persistent,
				fresh,
				...raw
			}) => raw as RawSymbol,
		),
	);

const playLandSound = (raw: RawSymbol) => {
	if (raw.name === 'SCATTER') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}
	// The wild itself landing, distinct from the pull it goes on to trigger (sfx_magnet_pull) and
	// from each subsequent addition to the chain (sfx_chain_grow). `magnet` covers pay symbols the
	// board has turned magnetic; `name` covers a literal WILD/MAGNET drop.
	if (raw.magnet || raw.name === 'WILD' || raw.name === 'MAGNET') {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land' });
	}
	if (raw.multiplier && raw.multiplier > 1) {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_hit' });
	}
};

// ── pulse helpers ─────────────────────────────────────────────────────────────

const pulseScale = async (cell: BoardCell, peak: number, durationMs: number) => {
	await cell.displayScale.set(peak, { duration: 0 });
	await cell.displayScale.set(1, { duration: durationMs, easing: backOut });
};

const pulseFreshPositions = async (freshKeys: Set<string>) => {
	if (!freshKeys.size) return;
	const pulseMs = getMotion().respin.lockPulseMs;
	await Promise.all(
		stateGame.board.flatMap((reel) =>
			reel.flatMap((cell) =>
				freshKeys.has(posKey(cell.position)) ? [pulseScale(cell, 1.12, pulseMs)] : [],
			),
		),
	);
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			if (freshKeys.has(posKey(cell.position))) cell.fresh = false;
		}
	}
};

// Scatters get a multi-beat heartbeat when they show — three decaying pops instead of the
// single landing bounce.
const pulseScatters = async () => {
	const cells = stateGame.board.flat().filter((c) => c.name === 'SCATTER' && !c.locked);
	if (!cells.length) return;
	const fast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const beats = fast ? 1 : 3;
	const peaks = [1.28, 1.2, 1.13];
	for (let b = 0; b < beats; b++) {
		await Promise.all(cells.map((c) => pulseScale(c, peaks[b] ?? 1.12, fast ? 120 : 300)));
		if (b < beats - 1) await waitForTimeout(fast ? 40 : 130);
	}
};

const restoreBoardAlpha = () => {
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			cell.displayAlpha.set(1, { duration: 0 });
		}
	}
};

const markMagnetPositions = (positions: Position[]) => {
	let marked = false;
	for (const position of positions) {
		const cell = stateGame.board[position.reel]?.[position.row];
		if (!cell) continue;
		cell.name = 'WILD';
		cell.scatter = false;
		cell.wild = true;
		cell.magnet = true;
		cell.symbolState = 'magnet';
		cell.displayAlpha.set(1, { duration: 0 });
		marked = true;
	}
	// The magnet ANCHOR turning into a visible wild is the other way a wild reaches the board, and
	// in a bonus it is by far the common one: playLandSound only runs from the drop path, and cells
	// already in the persistent cluster are skipped there (`if (cell.locked) continue`), so a
	// magnet-created wild used to arrive in silence. This is the moment the brief describes —
	// "a wild landed in the board and items start stacking around it" — so it layers with
	// sfx_magnet_pull (the pull itself) rather than replacing it. Not forced: if a wild also
	// dropped moments ago the cue is still ringing, and one hit for the moment is enough.
	if (marked) eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_wild_land' });
};

const pulseMagnetActivation = async (positions: Position[]) => {
	stateGame.magnetPulseKeys = positions.map(posKey);
	markMagnetPositions(positions);
	const isFast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const dimMs = isFast ? 100 : 280;
	const pulseMs = isFast ? 120 : 650;

	// Super regular spins must not flash/dim the whole non-locked board after landing.
	// The carry cluster is persistent; just pop the magnet cells.
	if (stateGame.bonusMode === 'superspin') {
		await Promise.all(
			positions.map(async (position) => {
				const cell = stateGame.board[position.reel]?.[position.row];
				if (!cell) return;
				cell.displayScale.set(1.18, { duration: 0 });
				await cell.displayScale.set(1, { duration: pulseMs, easing: backOut });
			}),
		);
		restoreBoardAlpha();
		stateGame.magnetPulseKeys = [];
		return;
	}

	const targetSymbol = stateGame.magnetTargetSymbol;
	const magnetKeys = new Set(positions.map(posKey));
	const targetCells = targetSymbol
		? stateGame.board.flat().filter((cell) => cell.name === targetSymbol && !cell.locked)
		: [];
	const targetKeys = new Set(targetCells.map((c) => posKey(c.position)));

	const magnetCenterReel =
		positions.reduce((s, p) => s + p.reel, 0) / Math.max(1, positions.length);
	const magnetCenterRow = positions.reduce((s, p) => s + p.row, 0) / Math.max(1, positions.length);

	// Phase 1: hide all non-target cells; magnet cell pulses; target cells stay bright
	await Promise.all([
		...stateGame.board.flat().map((cell) => {
			const key = posKey(cell.position);
			if (targetKeys.has(key) || magnetKeys.has(key) || cell.locked) return;
			return cell.displayAlpha.set(0.08, { duration: dimMs });
		}),
		...positions.map(async (position) => {
			const cell = stateGame.board[position.reel]?.[position.row];
			if (!cell) return;
			cell.displayScale.set(1.25, { duration: 0 });
			await cell.displayScale.set(1, { duration: pulseMs, easing: backOut });
		}),
	]);

	// Do not leave the board dimmed. Cluster locking/flight runs from the next
	// clusterSeriesUpdate event, and sub-threshold magnets may not emit that event at all.
	restoreBoardAlpha();
	stateGame.magnetPulseKeys = [];
};

// Fly each pulled target-symbol cell to its exact final cluster position.
// Called from clusterSeriesUpdate (after magnetActivated) where lockedPositions are known.
const animateClusterFormation = async ({
	series,
	magnetTargetSymbol,
	activatedPositions = [],
}: {
	series: ClusterSeriesSnapshot[];
	magnetTargetSymbol: PaySymbolName | null;
	activatedPositions?: Position[];
}) => {
	// Initial magnet pulls all selected symbols. Later plain respins land in-place, but a
	// secondary magnet should still run a pull pass for newly added locked positions.
	if (!magnetTargetSymbol || !series.length) {
		restoreBoardAlpha();
		stateGame.forceFastAnimations = false;
		return;
	}

	const previousLockedKeys = getCurrentLockedKeys();
	const isInitialPull = stateGame.activeSeries.length === 0;
	const isSecondaryMagnetPull = activatedPositions.length > 0;
	if (!isInitialPull && !isSecondaryMagnetPull) {
		restoreBoardAlpha();
		stateGame.forceFastAnimations = false;
		return;
	}

	const isFast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const flyMs = isFast ? 220 : 820;
	const landMs = isFast ? 100 : 300;

	const lockedPositions = isInitialPull
		? series.flatMap((entry) => entry.lockedPositions)
		: series
				.flatMap((entry) => entry.lockedPositions)
				.filter((position) => !previousLockedKeys.has(posKey(position)));

	const activatedKeys = new Set(activatedPositions.map(posKey));
	const magnetCells = stateGame.board
		.flat()
		.filter((cell) => cell.magnet || activatedKeys.has(posKey(cell.position)));
	const magnetPosKeys = new Set(magnetCells.map((cell) => posKey(cell.position)));

	// Destination positions (non-magnet cluster spots — magnet transforms in-place).
	const nonMagnetDests = lockedPositions.filter((p) => !magnetPosKeys.has(posKey(p)));

	const magnetCenter =
		magnetCells.length > 0
			? {
					reel: magnetCells.reduce((s, c) => s + c.position.reel, 0) / magnetCells.length,
					row: magnetCells.reduce((s, c) => s + c.position.row, 0) / magnetCells.length,
				}
			: { reel: Math.floor(BOARD_DIMENSIONS.x / 2), row: Math.floor(BOARD_DIMENSIONS.y / 2) };

	const distToMagnet = (reel: number, row: number) =>
		Math.abs(reel - magnetCenter.reel) + Math.abs(row - magnetCenter.row);

	// Source cells: unlocked, non-magnet cells that currently hold the target symbol.
	const sourceCells = stateGame.board
		.flat()
		.filter((cell) => cell.name === magnetTargetSymbol && !cell.locked && !cell.magnet);

	// Pair exact in-place destinations first.  Never fly a target out of a cell that is
	// already part of the final cluster — that caused a one-frame empty locked square when
	// another source later landed on the same BoardCell and the old source hide won the race.
	const destByKey = new Map(nonMagnetDests.map((dest) => [posKey(dest), dest]));
	const usedSourceKeys = new Set<string>();
	const usedDestKeys = new Set<string>();
	const sameCellPairs = sourceCells.flatMap((source) => {
		const key = posKey(source.position);
		const dest = destByKey.get(key);
		if (!dest) return [];
		usedSourceKeys.add(key);
		usedDestKeys.add(key);
		return [{ source, dest }];
	});

	// Pair remaining sources to remaining destinations by proximity to magnet.
	const sortedSources = sourceCells
		.filter((source) => !usedSourceKeys.has(posKey(source.position)))
		.sort(
			(a, b) =>
				distToMagnet(a.position.reel, a.position.row) -
				distToMagnet(b.position.reel, b.position.row),
		);
	const sortedDests = nonMagnetDests
		.filter((dest) => !usedDestKeys.has(posKey(dest)))
		.sort((a, b) => distToMagnet(a.reel, a.row) - distToMagnet(b.reel, b.row));
	const movePairs = Array.from(
		{ length: Math.min(sortedSources.length, sortedDests.length) },
		(_, i) => ({
			source: sortedSources[i],
			dest: sortedDests[i],
		}),
	);
	const pairs = [...sameCellPairs, ...movePairs];
	const lockedDestKeys = new Set(nonMagnetDests.map(posKey));

	// Fade each destination cell's CURRENT occupant as the pull begins, so the flying symbols
	// don't overlap it mid-flight — the cell pops back in as the new cluster symbol on landing.
	for (const { source, dest } of pairs) {
		if (source.position.reel === dest.reel && source.position.row === dest.row) continue;
		const destCell = stateGame.board[dest.reel]?.[dest.row];
		if (destCell && !destCell.magnet) {
			void destCell.displayAlpha.set(0, { duration: Math.min(250, flyMs * 0.35) });
		}
	}

	await Promise.all(
		pairs.map(({ source, dest }) => {
			return (async () => {
				// Cell is already at its grid position (visible, from Phase 1 of pulseMagnetActivation).
				const sameCell = source.position.reel === dest.reel && source.position.row === dest.row;
				if (sameCell) {
					// Target symbol already at its cluster position — keep it visible, just pulse.
					source.name = magnetTargetSymbol;
					source.multiplier = undefined;
					source.scatter = false;
					source.wild = false;
					source.magnet = false;
					source.displayAlpha.set(1, { duration: 0 });
					source.displayScale.set(1.18, { duration: 0 });
					void source.displayScale.set(1, { duration: landMs, easing: backOut });
					return;
				}

				// displayX is an offset from the cell's natural grid X center.
				// displayY is an absolute Y coordinate (initialized to getTargetY(row)).
				const destX = (dest.reel - source.position.reel) * SYMBOL_W;
				const destY = getTargetY(dest.row);

				source.pulling = true; // pulled symbol renders above normal board symbols during flight
				source.displayAlpha.set(1, { duration: 0 });
				source.displayScale.set(1.05, { duration: 0 });

				try {
					await Promise.all([
						source.displayX.set(destX, { duration: flyMs, easing: cubicOut }),
						source.displayY.set(destY, { duration: flyMs, easing: cubicOut }),
						source.displayScale.set(0.88, { duration: flyMs }),
					]);
				} finally {
					source.pulling = false;
				}

				// Destination cell lands with a pop; source cell hides at grid position.
				const destCell = stateGame.board[dest.reel]?.[dest.row];
				if (destCell) {
					if (shouldKeepWildInCluster(destCell)) {
						destCell.name = 'WILD';
						destCell.scatter = false;
						destCell.wild = true;
						destCell.magnet = false;
					} else {
						destCell.name = magnetTargetSymbol;
						destCell.multiplier = undefined;
						destCell.scatter = false;
						destCell.wild = false;
						destCell.magnet = false;
					}
					destCell.symbolState = 'static';
					destCell.displayAlpha.set(1, { duration: 0 });
					destCell.displayScale.set(1.14, { duration: 0 });
					void destCell.displayScale.set(1, { duration: landMs, easing: backOut });
				}

				// Hide source at its original grid position only when that original cell is not
				// a final locked destination.  If it is, keep it visible until lock decoration lands.
				const sourceKey = posKey(source.position);
				if (lockedDestKeys.has(sourceKey)) {
					source.displayAlpha.set(1, { duration: 0 });
				} else {
					void source.displayAlpha.set(0, { duration: 60 });
				}
				source.displayX.set(0, { duration: 0 });
				source.displayY.set(getTargetY(source.position.row), { duration: 0 });
				source.displayScale.set(1, { duration: 0 });
			})();
		}),
	);

	// Magnet trigger is a WILD symbol (optionally multiplier wild); keep the anchor visible as WILD.
	for (const magnetCell of magnetCells) {
		magnetCell.name = 'WILD';
		magnetCell.scatter = false;
		magnetCell.wild = true;
		magnetCell.magnet = false;
		magnetCell.symbolState = 'locked';
		magnetCell.displayAlpha.set(1, { duration: 0 });
		magnetCell.displayScale.set(1.2, { duration: 0 });
		void magnetCell.displayScale.set(1, { duration: landMs, easing: backOut });
	}
	stateGame.forceFastAnimations = false;
};

const getCurrentLockedKeys = () =>
	new Set(stateGame.activeSeries.flatMap((e) => e.lockedPositions.map(posKey)));

// When an active cluster is cleared for the next paid/free spin, remove lock-only wild/magnet
// visuals from cluster cells before the reel strip snapshots them as previous symbols.
const normalizeSeriesCellsToPaySymbols = (series: ClusterSeriesSnapshot[]) => {
	const anchorKeys = new Set(series.flatMap((entry) => entry.anchorPositions.map(posKey)));
	for (const entry of series) {
		for (const position of entry.lockedPositions) {
			const cell = stateGame.board[position.reel]?.[position.row];
			if (!cell) continue;
			if (anchorKeys.has(posKey(position)) && shouldKeepWildInCluster(cell)) {
				cell.name = 'WILD';
				cell.scatter = false;
				cell.wild = true;
				cell.magnet = false;
				cell.displayAlpha.set(1, { duration: 0 });
				continue;
			}
			cell.name = entry.symbol;
			cell.multiplier = undefined;
			cell.scatter = false;
			cell.magnet = false;
			cell.wild = false;
			cell.displayAlpha.set(1, { duration: 0 });
		}
	}
};

const syncSpinBoardFromSettledBoard = () => {
	const rawBoard = boardRaw();
	for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
		stateGame.spinBoard[ri].setSymbolsWithRawSymbols(makeSpinSymbols(rawBoard[ri]));
	}
};

const stopReelAfterSkipWindow = async (reel: SpinBoardReel, reelIndex: number) => {
	if (skipStopScheduledReels.has(reelIndex)) return;
	skipStopScheduledReels.add(reelIndex);

	const spinStartedAt = reelSpinStartedAt[reelIndex] ?? performance.now();
	const cascadeStopAt = skipCascadeStartedAt + SKIP_REEL_DELAY_MS * reelIndex;
	const minSpinStopAt = spinStartedAt + getSkipMinSpinMs();
	const stopAt = Math.max(cascadeStopAt, minSpinStopAt);
	const remainingMs = Math.max(0, stopAt - performance.now());
	if (remainingMs > 0) await waitForTimeout(remainingMs);
	if (stateGame.boardMode === 'spin' && reel.reelState.motion !== 'stopped') reel.stop();
};

// ── spin board (createReelForSpinning) ────────────────────────────────────────

// Each spin reel needs BOARD_DIMENSIONS.y + 2 symbols: 1 hidden above + 7 visible + 1 hidden below.
const makeSpinSymbols = (baseReel: RawSymbol[]): RawSymbol[] => [
	{ ...baseReel[0] },
	...baseReel.map((s) => ({ ...s })),
	{ ...baseReel[baseReel.length - 1] },
];

const createSpinBoardReel = (reelIndex: number) => {
	const reel = createReelForSpinning<RawSymbol, SymbolState>({
		reelIndex,
		symbolHeight: SYMBOL_H,
		initialSymbols: makeSpinSymbols(INITIAL_BOARD[reelIndex]),
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelStopping: () => {
			eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_reel_stop',
				forcePlay: !stateBet.isTurbo && !stateBet.isSuperTurbo,
			});
		},
		onSymbolLand: ({ rawSymbol }) => playLandSound(rawSymbol),
	});

	reel.reelState.spinOptions = () => {
		if (stateBet.isSuperTurbo || stateGame.forceFastAnimations) return SPIN_OPTIONS_TURBO;
		if (stateBet.isTurbo) return SPIN_OPTIONS_FAST;
		return SPIN_OPTIONS_DEFAULT;
	};

	return reel;
};

const spinBoard = Array.from({ length: BOARD_DIMENSIONS.x }, (_, ri) => createSpinBoardReel(ri));

export type SpinBoardReel = (typeof spinBoard)[number];

// ── state ─────────────────────────────────────────────────────────────────────

export const stateGame = $state({
	board: INITIAL_BOARD.map((reel, ri) => reel.map((raw, rowi) => initBoardCell(raw, ri, rowi))),
	spinBoard,
	boardMode: 'settle' as 'spin' | 'settle',
	gameType: 'basegame' as GameType,
	bonusMode: null as 'freegame' | 'superspin' | 'feature' | null,
	globalMultiplier: 1,
	seriesTotalMultiplier: 1,
	magnetTargetSymbol: null as PaySymbolName | null,
	activeSeries: [] as ClusterSeriesSnapshot[],
	persistentSeries: null as ClusterSeriesSnapshot | null,
	boardSpinning: false,
	scatterCounter: 0,
	pendingStop: false,
	awaitingFirstReveal: false,
	stopAutoOnBonus: false,
	selectedBonusSymbol: null as PaySymbolName | null,
	tempMultiplier: null as number | null,
	magnetPulseKeys: [] as string[],
	nextRevealMode: 'spin' as 'spin' | 'respin',
	// True while the current bonus reveal is a cluster-growth respin (a free spin awarded to the
	// player) — drives the RESPIN indicator panel. Cleared on normal reveals / spin start / reset.
	respinIndicator: false,
	forceFastAnimations: false,
	// Set true when the player chooses "End" on the unfinished-round dialog: the end flows through the
	// xstate machine (RESUME_BET) but onPlayGame skips the animation so endGame just ends the round +
	// credits balance. Ending the round outside the machine leaves it active on the RGS.
	endRoundOnly: false,
});

// ── instant board settle ──────────────────────────────────────────────────────

const settleBoardInstant = ({
	rawBoard,
	series = stateGame.activeSeries,
	magnetTargetSymbol = stateGame.magnetTargetSymbol,
}: {
	rawBoard: RawSymbol[][];
	series?: ClusterSeriesSnapshot[];
	magnetTargetSymbol?: PaySymbolName | null;
}) => {
	activeDropToken += 1;
	cancelActiveDrop();
	for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
		for (let rowi = 0; rowi < BOARD_DIMENSIONS.y; rowi++) {
			const cell = stateGame.board[ri][rowi];
			updateCellRaw(cell, rawBoard[ri][rowi]);
			cell.displayX.set(0, { duration: 0 });
			cell.displayY.set(getTargetY(rowi), { duration: 0 });
			cell.displayAlpha.set(1, { duration: 0 });
			cell.displayScale.set(1, { duration: 0 });
			cell.highlighted = false;
			cell.locked = false;
			cell.anchor = false;
			cell.target = false;
			cell.persistent = false;
			cell.fresh = false;
			cell.pulling = false;
			applyCellVisualState(cell);
		}
		stateGame.spinBoard[ri].setSymbolsWithRawSymbols(makeSpinSymbols(rawBoard[ri]));
	}
	applySeriesDecorations({ board: stateGame.board, series, magnetTargetSymbol });
	stateGame.boardSpinning = false;
	stateGame.boardMode = 'settle';
};

// Trap-door exit: old unlocked symbols clear below the grid before the next result enters.
// Locked cluster cells stay in place during respins; a fresh spin unlocks them before this runs.
const animateBoardExit = async () => {
	const fast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const motion = fast ? DROP_MOTION_FAST : DROP_MOTION_NORMAL;
	const exitingCells = stateGame.board.flat().filter((cell) => !cell.locked);
	await Promise.all(
		exitingCells.map(async (cell) => {
			// Loose free-fall out the bottom: small per-symbol jitter instead of a rigid
			// left-to-right sweep, and gravity acceleration. Lower cells clear the frame
			// first on their own — every cell travels the same rows, so the bottom row
			// crosses the edge earliest.
			const delayMs =
				cell.position.reel * motion.reelDelayMs + Math.random() * motion.jitterMs * 0.6;
			if (delayMs > 0) await waitForTimeout(delayMs);
			await cell.displayY.set(getTargetY(cell.position.row) + DROP_EXIT_ROWS * SYMBOL_H, {
				duration: motion.durationMs,
				easing: quadIn,
			});
		}),
	);
};

// ── near-simultaneous board-drop reveal ───────────────────────────────────────

const animateSpinReels = async ({ rawBoard }: { rawBoard: RawSymbol[][] }) => {
	cancelActiveDrop();
	const token = ++activeDropToken;
	let resolveSkip = () => {};
	const skipPromise = new Promise<void>((resolve) => {
		resolveSkip = resolve;
	});
	const drop: ActiveDrop = {
		skipped: false,
		cancelled: false,
		skipPromise,
		resolveSkip,
	};
	activeDrop = drop;
	dropInProgress = true;
	stateGame.boardMode = 'settle';
	const fast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const motion = fast ? DROP_MOTION_FAST : DROP_MOTION_NORMAL;
	const fallingCells: Array<{ cell: BoardCell; raw: RawSymbol; delayMs: number }> = [];

	// Swap to the result above the mask. Persistent super cells remain fixed while
	// every unlocked result cell enters from the same shallow overhead plane.
	for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
		for (let rowi = 0; rowi < BOARD_DIMENSIONS.y; rowi++) {
			const cell = stateGame.board[ri][rowi];
			if (cell.locked) continue;
			const raw = rawBoard[ri][rowi];
			updateCellRaw(cell, raw);
			cell.displayY.set(getTargetY(rowi) - motion.startRows * SYMBOL_H, { duration: 0 });
			cell.displayAlpha.set(1, { duration: 0 });
			cell.displayScale.set(1, { duration: 0 });
			cell.displayX.set(0, { duration: 0 });
			cell.highlighted = false;
			cell.fresh = false;
			cell.pulling = false;
			cell.symbolState = 'static';
			fallingCells.push({
				cell,
				raw,
				// Bottom rows first: each column piles up from the floor. A falling cell's path
				// never goes below its own target row, so a later (higher) symbol cannot pass
				// through an already-landed one. The random jitter breaks the grid lockstep —
				// the rain look of the reference.
				delayMs:
					ri * motion.reelDelayMs +
					(BOARD_DIMENSIONS.y - 1 - rowi) * motion.rowStaggerMs +
					Math.random() * motion.jitterMs,
			});
		}
	}

	await Promise.all(
		fallingCells.map(async ({ cell, raw, delayMs }) => {
			if (delayMs > 0) {
				await Promise.race([waitForTimeout(delayMs), drop.skipPromise]);
			}
			if (drop.cancelled || token !== activeDropToken) return;
			if (drop.skipped) {
				cell.symbolState = 'land';
				return;
			}
			const tweenPromise = cell.displayY.set(getTargetY(cell.position.row), {
				duration: motion.durationMs,
				// Gravity: slow off the ledge, fast into the floor. The scale squash below
				// still supplies the impact.
				easing: quadIn,
			});
			// Tween.set({ duration: 0 }) aborts the active Svelte tween without resolving its
			// promise. Race it against the skip signal so repeated stop presses cannot strand
			// playBook/xstate forever.
			await Promise.race([tweenPromise, drop.skipPromise]);
			if (drop.cancelled || token !== activeDropToken) return;
			cell.symbolState = 'land';
			if (!drop.skipped) {
				playLandSound(raw);
				cell.displayScale.set(0.9, { duration: 0 });
				await Promise.race([
					Promise.all([
						cell.displayScale.set(1, { duration: DROP_THUMP_MS, easing: cubicOut }),
						cell.displayY.set(getTargetY(cell.position.row) - DROP_BOUNCE_HEIGHT, {
							duration: DROP_BOUNCE_UP_MS,
							easing: cubicOut,
						}),
					]),
					drop.skipPromise,
				]);
				if (drop.cancelled || drop.skipped || token !== activeDropToken) return;
				await Promise.race([
					cell.displayY.set(getTargetY(cell.position.row), {
						duration: DROP_BOUNCE_SETTLE_MS,
						easing: cubicIn,
					}),
					drop.skipPromise,
				]);
			}
		}),
	);

	if (drop.cancelled || token !== activeDropToken) return;
	if (!drop.skipped) {
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_reel_stop',
			forcePlay: !stateBet.isTurbo && !stateBet.isSuperTurbo,
		});
	}
	for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
		stateGame.spinBoard[ri].setSymbolsWithRawSymbols(makeSpinSymbols(rawBoard[ri]));
	}
	if (activeDrop === drop) activeDrop = null;
	dropInProgress = false;
	stateGame.forceFastAnimations = false;
	skipCascadeStartedAt = 0;
	reelSpinStartedAt = [];
	skipStopScheduledReels.clear();
};

// ── combined reveal animation ─────────────────────────────────────────────────

const animateReveal = async ({
	rawBoard,
	gameType,
}: {
	rawBoard: RawSymbol[][];
	gameType: GameType;
}) => {
	stateGame.gameType = gameType;
	stateGame.boardSpinning = true;

	const isRespin = stateGame.nextRevealMode === 'respin';
	const exitPromise = boardExitPromise ?? animateBoardExit();
	await exitPromise;
	if (boardExitPromise === exitPromise) boardExitPromise = null;

	if (!isRespin) {
		await animateSpinReels({ rawBoard });
		stateGame.boardSpinning = false;
		stateGame.nextRevealMode = 'respin';
		return;
	}

	await animateSpinReels({ rawBoard });

	stateGame.boardSpinning = false;
	stateGame.nextRevealMode = 'respin';
};

// ── public API ────────────────────────────────────────────────────────────────

const resetBoardVisuals = () => {
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			cell.highlighted = false;
			cell.fresh = false;
			cell.pulling = false;
			applyCellVisualState(cell);
			cell.displayX.set(0, { duration: 0 });
			cell.displayScale.set(1, { duration: 0 });
			cell.displayAlpha.set(1, { duration: 0 });
		}
	}
	stateGame.magnetPulseKeys = [];
};

const setBoardFromRaw = ({
	rawBoard,
	series = stateGame.activeSeries,
	magnetTargetSymbol = stateGame.magnetTargetSymbol,
}: {
	rawBoard: RawSymbol[][];
	series?: ClusterSeriesSnapshot[];
	magnetTargetSymbol?: PaySymbolName | null;
}) => settleBoardInstant({ rawBoard, series, magnetTargetSymbol });

const setSeriesSnapshots = ({
	series: seriesInput,
	magnetTargetSymbol,
	totalMultiplier,
}: {
	series: ClusterSeriesSnapshot[] | null;
	magnetTargetSymbol: PaySymbolName | null;
	totalMultiplier: number;
}) => {
	// The math emits superSeriesCarry/clusterSeriesUpdate with series: null when a super
	// spin has no cluster to carry — treat it as "no active series", not a crash.
	const series = seriesInput ?? [];
	const prevLocked = getCurrentLockedKeys();
	const nextLocked = new Set(series.flatMap((e) => e.lockedPositions.map(posKey)));
	const freshKeys = new Set([...nextLocked].filter((key) => !prevLocked.has(key)));

	stateGame.activeSeries = series;
	stateGame.seriesTotalMultiplier = totalMultiplier;
	stateGame.globalMultiplier = totalMultiplier;
	stateGame.magnetTargetSymbol = magnetTargetSymbol;
	stateGame.selectedBonusSymbol = magnetTargetSymbol;
	stateGame.persistentSeries = series.find((e) => e.persistent) ?? null;

	// Stamp the cluster symbol onto locked non-wild cells.  Required when the math physically
	// relocates symbols near the magnet — those grid cells may still show their original symbol
	// until the next reveal event overwrites them.  Wilds that land into a cluster stay wild.
	for (const entry of series) {
		for (const position of entry.lockedPositions) {
			const cell = stateGame.board[position.reel]?.[position.row];
			if (!cell) continue;
			if (shouldKeepWildInCluster(cell)) {
				cell.name = 'WILD';
				cell.scatter = false;
				cell.wild = true;
				cell.magnet = false;
			} else {
				cell.name = entry.symbol as PaySymbolName;
				cell.multiplier = undefined;
				cell.scatter = false;
				cell.wild = false;
				cell.magnet = false;
			}
			applyCellVisualState(cell);
			cell.displayAlpha.set(1, { duration: 0 });
		}
	}

	applySeriesDecorations({ board: stateGame.board, series, magnetTargetSymbol, freshKeys });

	void pulseFreshPositions(freshKeys);
};

const animateWinningPositions = async (positions: Position[]) => {
	const keys = new Set(positions.map(posKey));
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			if (!keys.has(posKey(cell.position))) continue;
			cell.highlighted = true;
			cell.symbolState = 'win';
			// Punchier pop than the old 1.12 — <SymbolWinFx>'s burst choreography carries it, and
			// the settle below still brings it home with the backOut overshoot.
			cell.displayScale.set(1.22, { duration: 0 });
		}
	}
	await waitForTimeout(stateBet.isTurbo || stateBet.isSuperTurbo ? 120 : 871);
	const scaleMs = stateBet.isTurbo || stateBet.isSuperTurbo ? 60 : 364;
	// Scale back down but KEEP the win state (highlight box + looping win flipbook) — it stays
	// live for the whole win presentation and is cleared via clearWinCellStates() when the
	// round moves on.
	await Promise.all(
		stateGame.board.flatMap((reel) =>
			reel.flatMap((cell) => {
				if (!keys.has(posKey(cell.position))) return [];
				return [cell.displayScale.set(1, { duration: scaleMs, easing: backOut })];
			}),
		),
	);
};

// Revert all win-state cells to their normal visual state (locked/static/magnet).
const clearWinCellStates = () => {
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			if (cell.highlighted || cell.symbolState === 'win') {
				cell.highlighted = false;
				applyCellVisualState(cell);
			}
		}
	}
};

const applyReveal = async ({
	rawBoard,
	gameType,
}: {
	rawBoard: RawSymbol[][];
	gameType: GameType;
}) => {
	await animateReveal({ rawBoard, gameType });
	void pulseScatters();
	applySeriesDecorations({
		board: stateGame.board,
		series: stateGame.activeSeries,
		magnetTargetSymbol: stateGame.magnetTargetSymbol,
	});
};

const beginSpin = () => {
	// Start-of-spin cue. It lives here rather than in the actor's onNewGameStart so it follows the
	// PRESENTATION: the super-turbo-autoplay and space-hold fast paths return before beginSpin and
	// draw no spin at all, so they get no spin sound either. forcePlay matches sfx_reel_stop — a
	// crisp retrigger at normal speed, but during turbo an already-playing cue is left to ring out
	// instead of stacking on every rapid spin.
	eventEmitter.broadcast({
		type: 'soundOnce',
		name: 'sfx_spin_start',
		forcePlay: !stateBet.isTurbo && !stateBet.isSuperTurbo,
	});
	resetBonusState();
	// Magnetic uses the whole-board drop presenter. Never expose the legacy
	// rolling reel layer, including after HMR/resume left stale view state.
	stateGame.boardMode = 'settle';
	stateGame.boardSpinning = true;
	stateGame.nextRevealMode = 'spin';
	stateGame.respinIndicator = false;
	stateGame.forceFastAnimations = false;
	resetBoardVisuals();
	boardExitPromise = animateBoardExit();
};

const markNextRevealAsSpin = () => {
	stateGame.nextRevealMode = 'spin';
};

const speedUpMotion = () => {
	if (dropInProgress && activeDrop) {
		if (activeDrop.skipped) return;
		stateGame.forceFastAnimations = true;
		activeDrop.skipped = true;
		activeDrop.resolveSkip();
		for (const reel of stateGame.board) {
			for (const cell of reel) {
				if (cell.locked) continue;
				cell.displayY.set(getTargetY(cell.position.row), { duration: 0 });
				cell.displayScale.set(1, { duration: 0 });
				cell.symbolState = 'land';
			}
		}
		return;
	}
	if (stateGame.boardMode !== 'spin') return;
	stateGame.forceFastAnimations = true;
	if (!skipCascadeStartedAt) skipCascadeStartedAt = performance.now();
	for (const [reelIndex, reel] of stateGame.spinBoard.entries()) {
		if (reel.reelState.motion !== 'stopped') void stopReelAfterSkipWindow(reel, reelIndex);
	}
};

const activateMagnetPulse = async (positions: Position[]) => {
	await pulseMagnetActivation(positions);
};

const clearSeriesState = () => {
	if (stateGame.activeSeries.length) {
		normalizeSeriesCellsToPaySymbols(stateGame.activeSeries);
		syncSpinBoardFromSettledBoard();
	}
	stateGame.activeSeries = [];
	stateGame.persistentSeries = null;
	stateGame.magnetTargetSymbol = null;
	stateGame.selectedBonusSymbol = null;
	stateGame.seriesTotalMultiplier = 1;
	stateGame.globalMultiplier = 1;
	stateGame.magnetPulseKeys = [];
	applySeriesDecorations({ board: stateGame.board, series: [], magnetTargetSymbol: null });
	restoreBoardAlpha();
};

const resetBonusState = () => {
	if (stateGame.activeSeries.length) {
		normalizeSeriesCellsToPaySymbols(stateGame.activeSeries);
		syncSpinBoardFromSettledBoard();
	}
	stateGame.bonusMode = null;
	stateGame.globalMultiplier = 1;
	stateGame.seriesTotalMultiplier = 1;
	stateGame.magnetTargetSymbol = null;
	stateGame.activeSeries = [];
	stateGame.persistentSeries = null;
	stateGame.selectedBonusSymbol = null;
	stateGame.tempMultiplier = null;
	stateGame.magnetPulseKeys = [];
	stateGame.nextRevealMode = 'spin';
	stateGame.respinIndicator = false;
	applySeriesDecorations({ board: stateGame.board, series: [], magnetTargetSymbol: null });
	restoreBoardAlpha();
};

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({
	winLevelMap,
});

export const stateGameDerived = {
	boardLayout,
	landscapeCapsuleLayout,
	// Exposed so components can scope a tweak to ONE end of the landscape range: 0 at popout-S sizes,
	// 1 at popout-L. GameLogoFrame uses it to shrink the logo on small screens only.
	landscapeSizeT,
	landscapeLogoWidth,
	landscapeLogoHeight,
	landscapeStackTopY,
	boardRaw,
	scatterLandIndex,
	resetBoardVisuals,
	setBoardFromRaw,
	setSeriesSnapshots,
	animateClusterFormation,
	animateWinningPositions,
	clearWinCellStates,
	applyReveal,
	beginSpin,
	markNextRevealAsSpin,
	speedUpMotion,
	activateMagnetPulse,
	clearSeriesState,
	resetBonusState,
	getWinLevelDataByWinLevelAlias,
};

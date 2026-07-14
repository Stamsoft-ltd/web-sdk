import { backOut, cubicOut } from 'svelte/easing';

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
		durationMs: 220,
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

const applyCellVisualState = (cell: BoardCell) => {
	cell.symbolState = cell.locked
		? 'locked'
		: cell.highlighted
			? 'win'
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
	return { top: 110, right: 230, bottom: 170, left: 210 };
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
		0.74,
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
	const extraLeftShiftPx = layoutType === 'desktop' ? 50 : layoutType === 'landscape' ? 30 : 0;
	const centeredCanvasX = padding.left + availableCanvasWidth * 0.5 - canvasSizes.width * 0.5;
	const centeredCanvasY = padding.top + availableCanvasHeight * 0.5 - canvasSizes.height * 0.5;
	return {
		x: (centeredCanvasX - extraLeftShiftPx + 80) / (mainLayout.scale || 1),
		y: (centeredCanvasY + 18) / (mainLayout.scale || 1),
	};
};

// Portrait: the board fills most of the width and sits below the logo + ALL WINS/capsule/FREE SPINS
// top bar; the HTML HUD occupies the space below it.
const PORTRAIT_FRAME_FILL = 0.94;
const PORTRAIT_TOP_OFFSET = 372;
const LANDSCAPE_FRAME_FILL = 0.72;
// On small landscape screens the HTML HUD sits at its min pixel sizes (proportionally larger), so the
// board fills LESS of the frame there to keep the gutters (balance/bet left, capsule/nav right) clear.
// Lerp the fill from FILL_MIN at short-side ≤ 250px up to FILL at short-side ≥ 430px.
const LANDSCAPE_FRAME_FILL_MIN = 0.64;
const LANDSCAPE_FILL_SHORT_MIN = 240;
const LANDSCAPE_FILL_SHORT_MAX = 410;
// 0 at the smallest landscape screens → 1 at normal-size ones; drives both the board fill and the
// capsule column bias so small screens get a smaller board and a capsule pulled toward it (nav room).
const landscapeSizeT = () => {
	const c = stateLayoutDerived.canvasSizes();
	const shortSidePx = Math.min(c.width, c.height);
	return Math.max(
		0,
		Math.min(1, (shortSidePx - LANDSCAPE_FILL_SHORT_MIN) / (LANDSCAPE_FILL_SHORT_MAX - LANDSCAPE_FILL_SHORT_MIN)),
	);
};
const landscapeFrameFill = () =>
	LANDSCAPE_FRAME_FILL_MIN + landscapeSizeT() * (LANDSCAPE_FRAME_FILL - LANDSCAPE_FRAME_FILL_MIN);
// Landscape vertical capsule column (shared by the pixi capsule and the HTML buy-bonus button so
// they always align across device aspect ratios). Bias = fraction from the board's right edge toward
// the visible right edge — snug to the nav on normal screens, pulled toward the board on small ones so
// the (now bigger) capsule keeps clearance from the nav.
const LANDSCAPE_CAPSULE_BIAS_MIN = 0.24;
const LANDSCAPE_CAPSULE_BIAS_MAX = 0.33;
const landscapeCapsuleBias = () =>
	LANDSCAPE_CAPSULE_BIAS_MIN + landscapeSizeT() * (LANDSCAPE_CAPSULE_BIAS_MAX - LANDSCAPE_CAPSULE_BIAS_MIN);
// The landscape capsule is the portrait glass tube (magnetic_tube.png, 1002×668) rotated to vertical.
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
		const boardScale = (mainLayout.height * landscapeFrameFill()) / BOARD_SIZES.height;
		return {
			x: mainLayout.width * 0.475,
			y: mainLayout.height * 0.5,
			boardScale,
			anchor: { x: 0.5, y: 0.5 },
			pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
			...BOARD_SIZES,
		};
	}

	const boardScale = getBoardScale() * 0.92;
	// Grid centre Y = a small margin below the top of the game area + half the grid height, so the
	// board sits near the top (just under the logo) instead of the old wooden-frame-derived Y that
	// sank/clipped it once the cells were widened.
	const TOP_MARGIN = mainLayout.height * 0.03;
	return {
		x: mainLayout.width * 0.5 + getBoardOffset().x,
		y: TOP_MARGIN + (BOARD_SIZES.height * boardScale) / 2,
		boardScale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

// Landscape vertical-capsule column geometry, in virtual (main) coordinates. Single source of truth
// shared by the pixi LandscapeCapsule and the HTML buy-bonus button (which converts it to device px)
// so the capsule and the buy badge beneath it stay aligned at every device aspect ratio.
const landscapeCapsuleLayout = () => {
	const board = boardLayout();
	const main = stateLayoutDerived.mainLayout();
	const scale = board.boardScale;
	const gridHalfW = (board.width * 0.5) * scale;
	const gridHalfH = (board.height * 0.5) * scale;
	// Right edge of the visible viewport, expressed in virtual units.
	const canvasRightX = main.width * 0.5 + stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1));
	const boardRightX = board.x + gridHalfW;
	const colX = boardRightX + (canvasRightX - boardRightX) * landscapeCapsuleBias();
	const baseH = gridHalfH * LANDSCAPE_CAPSULE_TUBE_RATIO;
	const tubeW = baseH * LANDSCAPE_CAPSULE_TUBE_ASPECT;
	const tubeH = baseH * LANDSCAPE_CAPSULE_TUBE_STRETCH;
	const tubeY = board.y;
	// Visible (opaque) tube extents — the sprite box is padded, so size the symbol against these and
	// place the buy-bonus just below the visible tube bottom (not the padded sprite bottom).
	const visibleW = tubeW * LANDSCAPE_CAPSULE_VISIBLE_W;
	const visibleH = tubeH * LANDSCAPE_CAPSULE_VISIBLE_H;
	const symSize = visibleW * 0.66;
	const visibleBottom = tubeY + visibleH * 0.5;
	return { colX, tubeY, tubeW, tubeH, visibleW, visibleH, visibleBottom, symSize, gridHalfW, gridHalfH };
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
	if (raw.multiplier && raw.multiplier > 1) {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_landing' });
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
	for (const position of positions) {
		const cell = stateGame.board[position.reel]?.[position.row];
		if (!cell) continue;
		cell.name = 'WILD';
		cell.scatter = false;
		cell.wild = true;
		cell.magnet = true;
		cell.symbolState = 'magnet';
		cell.displayAlpha.set(1, { duration: 0 });
	}
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
	const flyMs = isFast ? 220 : 1092;
	const landMs = isFast ? 100 : 403;

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

				source.displayAlpha.set(1, { duration: 0 });
				source.displayScale.set(1.05, { duration: 0 });

				await Promise.all([
					source.displayX.set(destX, { duration: flyMs, easing: cubicOut }),
					source.displayY.set(destY, { duration: flyMs, easing: cubicOut }),
					source.displayScale.set(0.88, { duration: flyMs }),
				]);

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
				name: 'sfx_reel_stop_1',
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
			applyCellVisualState(cell);
		}
		stateGame.spinBoard[ri].setSymbolsWithRawSymbols(makeSpinSymbols(rawBoard[ri]));
	}
	applySeriesDecorations({ board: stateGame.board, series, magnetTargetSymbol });
	stateGame.boardSpinning = false;
	stateGame.boardMode = 'settle';
};

// ── spin animation (createReelForSpinning) ────────────────────────────────────

const animateSpinReels = async ({ rawBoard }: { rawBoard: RawSymbol[][] }) => {
	stateGame.boardMode = 'spin';
	reelSpinStartedAt = [];
	skipStopScheduledReels.clear();

	const isFastMode = stateBet.isTurbo || stateBet.isSuperTurbo;
	const isSuperTurbo = stateBet.isSuperTurbo;
	const waitForReelDelay = async (durationMs: number, reelIndex: number) => {
		const stepMs = 20;
		for (let elapsed = 0; elapsed < durationMs; elapsed += stepMs) {
			if (stateGame.forceFastAnimations) {
				const targetTime = skipCascadeStartedAt + SKIP_REEL_DELAY_MS * reelIndex;
				const remainingMs = Math.max(0, targetTime - performance.now());
				if (remainingMs > 0) await waitForTimeout(remainingMs);
				return;
			}
			await waitForTimeout(Math.min(stepMs, durationMs - elapsed));
		}
	};

	// Prepare all reels — accumulate paddingSize across reels (forest-gang pattern)
	stateGame.spinBoard.reduce((prevPaddingSize, reel, ri) => {
		const symbols = makeSpinSymbols(rawBoard[ri]);
		const paddingReel = makeSpinSymbols(INITIAL_BOARD[ri]);
		const spinType = isFastMode ? 'fast' : 'normal';
		const paddingSize = reel.prepareToSpin({
			noStop: false,
			spinType,
			symbols,
			paddingReel,
			paddingPosition: 0,
			previousPaddingSize: prevPaddingSize,
			onSpinFinishing: () => reel.onReelStopping(),
		});
		return paddingSize;
	}, 0);

	// Spin each reel with cascading delay (reels land left-to-right)
	const opts = stateGame.spinBoard[0].reelState.spinOptions();
	await Promise.all(
		stateGame.spinBoard.map(async (reel, ri) => {
			if (!isSuperTurbo && ri > 0) await waitForReelDelay(opts.reelSpinDelay * ri, ri);
			const spinPromise = reel.spin();
			reelSpinStartedAt[ri] = performance.now();
			if (stateGame.forceFastAnimations) void stopReelAfterSkipWindow(reel, ri);
			await spinPromise;
		}),
	);

	// Copy final symbols into the board cells and switch to settle mode.
	// Locked cells (superspin carry) keep their cluster symbol — skip them entirely.
	for (let ri = 0; ri < BOARD_DIMENSIONS.x; ri++) {
		for (let rowi = 0; rowi < BOARD_DIMENSIONS.y; rowi++) {
			const cell = stateGame.board[ri][rowi];
			if (cell.locked) continue;
			updateCellRaw(cell, rawBoard[ri][rowi]);
			cell.displayY.set(getTargetY(rowi), { duration: 0 });
			cell.displayAlpha.set(1, { duration: 0 });
			cell.displayScale.set(1, { duration: 0 });
			cell.displayX.set(0, { duration: 0 });
			cell.symbolState = 'land';
		}
	}
	stateGame.boardMode = 'settle';
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
	series,
	magnetTargetSymbol,
	totalMultiplier,
}: {
	series: ClusterSeriesSnapshot[];
	magnetTargetSymbol: PaySymbolName | null;
	totalMultiplier: number;
}) => {
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
			cell.displayScale.set(1.12, { duration: 0 });
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
	resetBonusState();
	stateGame.boardSpinning = true;
	stateGame.nextRevealMode = 'spin';
	stateGame.respinIndicator = false;
	stateGame.forceFastAnimations = false;
	resetBoardVisuals();
};

const markNextRevealAsSpin = () => {
	stateGame.nextRevealMode = 'spin';
};

const speedUpMotion = () => {
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

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
	SPIN_OPTIONS_ANTICIPATED,
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

// Pool for flicker animation during respin
const SPIN_SYMBOL_POOL: RawSymbol[] = INITIAL_BOARD.flat().map((r) => ({ ...r }));

// ── motion presets ────────────────────────────────────────────────────────────

const MOTION_NORMAL = {
	respin: {
		dimDurationMs: 110,
		clearGapMs: 50,
		spinCount: 5,
		spinFrameMs: 270,
		durationMs: 220,
		bounceMs: 80,
		groupDelayMs: 200,     // ms between each stop-group of 1–5 cells
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
	cell.magnet = raw.magnet;
	cell.wild = raw.wild;
};

const applyCellVisualState = (cell: BoardCell) => {
	cell.symbolState = cell.highlighted
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
	const availableCanvasWidth = Math.max(BOARD_SIZES.width * mainLayout.scale, canvasSizes.width - padding.left - padding.right);
	const availableCanvasHeight = Math.max(BOARD_SIZES.height * mainLayout.scale, canvasSizes.height - padding.top - padding.bottom);
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
	const { mainLayout, canvasSizes, padding, availableCanvasHeight, availableCanvasWidth } = getBoardViewportMetrics();
	const layoutType = stateLayoutDerived.layoutType();
	const extraLeftShiftPx = layoutType === 'desktop' ? 50 : layoutType === 'landscape' ? 30 : 0;
	const centeredCanvasX = padding.left + availableCanvasWidth * 0.5 - canvasSizes.width * 0.5;
	const centeredCanvasY = padding.top + availableCanvasHeight * 0.5 - canvasSizes.height * 0.5;
	return {
		x: (centeredCanvasX - extraLeftShiftPx + 80) / (mainLayout.scale || 1),
		y: (centeredCanvasY + 18) / (mainLayout.scale || 1),
	};
};

const boardLayout = () => {
	const boardScale = getBoardScale() * 0.92;
	const mainLayout = stateLayoutDerived.mainLayout();
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

// ── sound helpers ─────────────────────────────────────────────────────────────

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const boardRaw = () =>
	stateGame.board.map((reel) =>
		reel.map(({ key, position, symbolState, displayX, displayY, displayAlpha, displayScale, locked, highlighted, anchor, target, persistent, fresh, ...raw }) => raw as RawSymbol),
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
			reel.flatMap((cell) => (freshKeys.has(posKey(cell.position)) ? [pulseScale(cell, 1.12, pulseMs)] : [])),
		),
	);
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			if (freshKeys.has(posKey(cell.position))) cell.fresh = false;
		}
	}
};

const pulseMagnetActivation = async (positions: Position[]) => {
	stateGame.magnetPulseKeys = positions.map(posKey);
	const isFast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const dimMs = isFast ? 100 : 280;
	const pullMs = isFast ? 180 : 400;
	const pulseMs = isFast ? 120 : 360;

	const targetSymbol = stateGame.magnetTargetSymbol;
	const magnetKeys = new Set(positions.map(posKey));
	const targetCells = targetSymbol
		? stateGame.board.flat().filter((cell) => cell.name === targetSymbol && !cell.locked)
		: [];
	const targetKeys = new Set(targetCells.map((c) => posKey(c.position)));

	const magnetCenterReel =
		positions.reduce((s, p) => s + p.reel, 0) / Math.max(1, positions.length);
	const magnetCenterRow =
		positions.reduce((s, p) => s + p.row, 0) / Math.max(1, positions.length);

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

	// Phase 2 (fly-to-exact-position) runs in animateClusterFormation after clusterSeriesUpdate
	// fires — at that point we have the final lockedPositions. Leave target cells visible here.
	stateGame.magnetPulseKeys = [];
};

// Fly each pulled target-symbol cell to its exact final cluster position.
// Called from clusterSeriesUpdate (after magnetActivated) where lockedPositions are known.
const animateClusterFormation = async ({
	series,
	magnetTargetSymbol,
}: {
	series: ClusterSeriesSnapshot[];
	magnetTargetSymbol: PaySymbolName | null;
}) => {
	// Only run for the initial pull — subsequent respins join the cluster by landing in-place.
	if (!magnetTargetSymbol || !series.length || stateGame.activeSeries.length > 0) return;

	const isFast = stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations;
	const flyMs = isFast ? 220 : 600;
	const landMs = isFast ? 100 : 220;

	const entry = series[0];
	const lockedPositions = entry.lockedPositions;

	const magnetCells = stateGame.board.flat().filter((cell) => cell.magnet);
	const magnetPosKeys = new Set(magnetCells.map((cell) => posKey(cell.position)));

	// Destination positions (non-magnet cluster spots — magnet transforms in-place).
	const nonMagnetDests = lockedPositions.filter((p) => !magnetPosKeys.has(posKey(p)));

	const magnetCenter = magnetCells.length > 0
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

	// Pair sources to destinations by proximity to magnet (closest source → closest dest).
	const sortedSources = [...sourceCells].sort(
		(a, b) => distToMagnet(a.position.reel, a.position.row) - distToMagnet(b.position.reel, b.position.row),
	);
	const sortedDests = [...nonMagnetDests].sort(
		(a, b) => distToMagnet(a.reel, a.row) - distToMagnet(b.reel, b.row),
	);
	const pairCount = Math.min(sortedSources.length, sortedDests.length);

	await Promise.all(
		Array.from({ length: pairCount }, (_, i) => {
			const source = sortedSources[i];
			const dest = sortedDests[i];
			return (async () => {
				// Cell is already at its grid position (visible, from Phase 1 of pulseMagnetActivation).
				const sameCell = source.position.reel === dest.reel && source.position.row === dest.row;
				if (sameCell) {
					// Target symbol already at its cluster position — just pulse.
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
					destCell.name = magnetTargetSymbol;
					destCell.scatter = false;
					destCell.wild = false;
					destCell.magnet = false;
					destCell.symbolState = 'static';
					destCell.displayAlpha.set(1, { duration: 0 });
					destCell.displayScale.set(1.14, { duration: 0 });
					void destCell.displayScale.set(1, { duration: landMs, easing: backOut });
				}

				// Hide source at its original grid position (respin will reuse it).
				void source.displayAlpha.set(0, { duration: 60 });
				source.displayX.set(0, { duration: 0 });
				source.displayY.set(getTargetY(source.position.row), { duration: 0 });
				source.displayScale.set(1, { duration: 0 });
			})();
		}),
	);

	// Magnet cell transforms to cluster symbol in-place.
	for (const magnetCell of magnetCells) {
		magnetCell.name = magnetTargetSymbol;
		magnetCell.magnet = false;
		magnetCell.scatter = false;
		magnetCell.wild = false;
		magnetCell.symbolState = 'static';
		magnetCell.displayScale.set(1.2, { duration: 0 });
		void magnetCell.displayScale.set(1, { duration: landMs, easing: backOut });
	}
};

const getCurrentLockedKeys = () =>
	new Set(stateGame.activeSeries.flatMap((e) => e.lockedPositions.map(posKey)));

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
		// Bonus spins always use base speed — no turbo/fast
		if (!stateGame.bonusMode) {
			if (stateBet.isSuperTurbo || stateGame.forceFastAnimations) return SPIN_OPTIONS_TURBO;
			if (stateBet.isTurbo) return SPIN_OPTIONS_FAST;
		}
		if (reel.reelState.spinType === 'anticipated') return SPIN_OPTIONS_ANTICIPATED;
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
	clusterWinBadges: [] as Array<{ id: string; reel: number; row: number; text: string }>,
	boardSpinning: false,
	scatterCounter: 0,
	pendingStop: false,
	awaitingFirstReveal: false,
	stopAutoOnBonus: false,
	selectedBonusSymbol: null as PaySymbolName | null,
	tempMultiplier: null as number | null,
	magnetPulseKeys: [] as string[],
	nextRevealMode: 'spin' as 'spin' | 'respin',
	forceFastAnimations: false,
	hasAnticipationPending: false,
	anticipationSkipped: false,
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

const animateSpinReels = async ({
	rawBoard,
	anticipation,
}: {
	rawBoard: RawSymbol[][];
	anticipation?: number[];
}) => {
	stateGame.boardMode = 'spin';

	const inBonus = !!stateGame.bonusMode;
	const isTurbo = !inBonus && (stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations);

	// Prepare all reels — accumulate paddingSize across reels (forest-gang pattern)
	stateGame.spinBoard.reduce((prevPaddingSize, reel, ri) => {
		const symbols = makeSpinSymbols(rawBoard[ri]);
		const paddingReel = makeSpinSymbols(INITIAL_BOARD[ri]);
		const isAnticipated = !isTurbo && (anticipation?.[ri] ?? false);
		const spinType = isTurbo ? 'fast' : isAnticipated ? 'anticipated' : 'normal';
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
			if (!isTurbo && ri > 0) await waitForTimeout(opts.reelSpinDelay * ri);
			await reel.spin();
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
};

// ── respin animation ──────────────────────────────────────────────────────────
//
// Flow:
//   1. Fade: whole grid dims (alpha→0.15 over dimDurationMs) EXCEPT locked/cluster cells
//      (stay at alpha=1, pulse scale). Await full fade before spins start so user sees dark grid.
//   2. Per cell (staggered with random jitter): flash through N symbols using alpha pulses.
//      No Y movement during spin → no row-overlap bleed. The cluster symbol is injected
//      into each cell's spin sequence (~30% probability) so it pops up visibly, making
//      the player feel like any cell might join the cluster. Cluster flashes are brighter.
//   3. Final symbol lands: slides in from above starting invisible, fades to alpha=1 on arrival.
//      Scale bounce. Locked cells skip animation entirely.

const animateRespinCells = async ({ rawBoard }: { rawBoard: RawSymbol[][] }) => {
	const rm = getMotion().respin;

	// Cluster symbol to inject into spin sequences — makes non-locked cells feel like
	// candidates for locking in.
	const clusterRaw: RawSymbol | null = stateGame.activeSeries[0]
		? { name: stateGame.activeSeries[0].symbol }
		: null;

	// ── Phase 1: reset positions, fade non-locked to dark, pulse locked ──────
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			cell.displayX.set(0, { duration: 0 });
			cell.displayY.set(getTargetY(cell.position.row), { duration: 0 });
			cell.displayScale.set(cell.locked ? 1.06 : 1, { duration: 0 });
		}
	}

	// Await the full dim fade so the dark grid is rendered before spins start.
	await Promise.all(
		stateGame.board.flat().map((cell) => {
			if (cell.locked) {
				cell.displayAlpha.set(1, { duration: 0 });
				return cell.displayScale.set(1, { duration: rm.lockPulseMs, easing: backOut });
			}
			return cell.displayAlpha.set(0.15, { duration: rm.dimDurationMs });
		}),
	);

	await waitForTimeout(rm.clearGapMs);

	// ── Pre-compute stop groups: shuffle non-locked cells, split into groups of 1–5 ──
	const cellList: Array<{ ri: number; rowi: number }> = [];
	for (let ri = 0; ri < stateGame.board.length; ri++) {
		for (let rowi = 0; rowi < stateGame.board[ri].length; rowi++) {
			if (!stateGame.board[ri][rowi].locked) cellList.push({ ri, rowi });
		}
	}
	for (let i = cellList.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cellList[i], cellList[j]] = [cellList[j], cellList[i]];
	}
	const stopStagger = new Map<string, number>();
	let pos = 0;
	let groupIdx = 0;
	while (pos < cellList.length) {
		const groupSize = Math.floor(Math.random() * 5) + 1;
		const delay = groupIdx * rm.groupDelayMs;
		for (let i = pos; i < Math.min(pos + groupSize, cellList.length); i++) {
			stopStagger.set(`${cellList[i].ri}:${cellList[i].rowi}`, delay);
		}
		pos += groupSize;
		groupIdx++;
	}

	// ── Phase 2 + 3: grouped stop spin (alpha flash) → slide-in land ─────────
	await Promise.all(
		stateGame.board.flatMap((reel, ri) =>
			reel.map(async (cell, rowi) => {
				if (cell.locked) {
					// Keep the cluster symbol — do NOT overwrite with rawBoard which may contain
					// the original MAGNET or a different symbol at this grid position.
					cell.symbolState = 'static';
					return;
				}

				const stagger = stopStagger.get(`${ri}:${rowi}`) ?? 0;
				if (stagger > 0) await waitForTimeout(stagger);

				// Show cluster symbol once at most, 25% chance, in the middle of the spin
				const clusterFrameIdx =
					clusterRaw !== null && rm.spinCount > 2 && Math.random() < 0.25
						? Math.floor(rm.spinCount / 2)
						: -1;

				let cursor = (ri * BOARD_DIMENSIONS.y + rowi + 3) % SPIN_SYMBOL_POOL.length;
				for (let f = 0; f < rm.spinCount; f++) {
					if (f === clusterFrameIdx) {
						updateCellRaw(cell, clusterRaw!);
						cell.symbolState = 'static';
						await cell.displayAlpha.set(0.9, { duration: Math.round(rm.spinFrameMs * 0.28) });
						await waitForTimeout(Math.round(rm.spinFrameMs * 0.44));
						await cell.displayAlpha.set(0.15, { duration: Math.round(rm.spinFrameMs * 0.28) });
					} else {
						updateCellRaw(cell, SPIN_SYMBOL_POOL[cursor++ % SPIN_SYMBOL_POOL.length]);
						cell.symbolState = 'spin';
						await cell.displayAlpha.set(0.32, { duration: Math.round(rm.spinFrameMs * 0.35) });
						await cell.displayAlpha.set(0.15, { duration: Math.round(rm.spinFrameMs * 0.65) });
					}
				}

				const targetY = getTargetY(rowi);
				updateCellRaw(cell, rawBoard[ri][rowi]);
				cell.symbolState = 'spin';
				cell.displayY.set(targetY - SYMBOL_H, { duration: 0 });
				cell.displayAlpha.set(0, { duration: 0 });

				await Promise.all([
					cell.displayY.set(targetY, { duration: rm.durationMs, easing: cubicOut }),
					cell.displayAlpha.set(1, { duration: Math.round(rm.durationMs * 0.65) }),
					cell.displayScale.set(1.08, { duration: Math.round(rm.durationMs * 0.75), easing: cubicOut }),
				]);

				cell.symbolState = 'land';
				playLandSound(rawBoard[ri][rowi]);
				await cell.displayScale.set(1, { duration: rm.bounceMs, easing: backOut });
				applyCellVisualState(cell);
				// Pulse cells that land on the target symbol adjacent to the cluster — they will join next respin.
				const neighborLocked =
					stateGame.board[ri - 1]?.[rowi]?.locked ||
					stateGame.board[ri + 1]?.[rowi]?.locked ||
					stateGame.board[ri]?.[rowi - 1]?.locked ||
					stateGame.board[ri]?.[rowi + 1]?.locked;
				if (stateGame.magnetTargetSymbol && rawBoard[ri][rowi].name === stateGame.magnetTargetSymbol && neighborLocked) {
					cell.displayScale.set(1.18, { duration: 0 });
					void cell.displayScale.set(1, { duration: 220, easing: backOut });
				}
			}),
		),
	);
};

// ── combined reveal animation ─────────────────────────────────────────────────

const animateReveal = async ({
	rawBoard,
	gameType,
	anticipation,
}: {
	rawBoard: RawSymbol[][];
	gameType: GameType;
	anticipation?: number[];
}) => {
	stateGame.gameType = gameType;
	stateGame.boardSpinning = true;

	const isRespin = stateGame.nextRevealMode === 'respin';

	if (!isRespin) {
		await animateSpinReels({ rawBoard, anticipation });
		stateGame.hasAnticipationPending = false;
		stateGame.boardSpinning = false;
		stateGame.nextRevealMode = 'respin';
		return;
	}

	await animateRespinCells({ rawBoard });

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
	stateGame.clusterWinBadges = [];
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

	applySeriesDecorations({ board: stateGame.board, series, magnetTargetSymbol, freshKeys });

	// Stamp the cluster symbol onto every locked cell.  Required when the math physically
	// relocates symbols near the magnet — those grid cells may still show their original symbol
	// until the next reveal event overwrites them.
	for (const entry of series) {
		for (const position of entry.lockedPositions) {
			const cell = stateGame.board[position.reel]?.[position.row];
			if (!cell) continue;
			cell.name = entry.symbol as PaySymbolName;
			cell.scatter = false;
			cell.wild = false;
			cell.magnet = false;
			applyCellVisualState(cell);
			cell.displayAlpha.set(1, { duration: 0 });
		}
	}

	void pulseFreshPositions(freshKeys);
};

const setClusterBadgesFromWinInfo = (wins: Array<{ id: string; reel: number; row: number; text: string }>) => {
	stateGame.clusterWinBadges = wins;
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
	await waitForTimeout(stateBet.isTurbo || stateBet.isSuperTurbo ? 120 : 480);
	const scaleMs = stateBet.isTurbo || stateBet.isSuperTurbo ? 60 : 200;
	await Promise.all(
		stateGame.board.flatMap((reel) =>
			reel.flatMap((cell) => {
				if (!keys.has(posKey(cell.position))) return [];
				cell.highlighted = false;
				applyCellVisualState(cell);
				return [cell.displayScale.set(1, { duration: scaleMs, easing: backOut })];
			}),
		),
	);
};

const applyReveal = async ({
	rawBoard,
	gameType,
	anticipation,
}: {
	rawBoard: RawSymbol[][];
	gameType: GameType;
	anticipation?: number[];
}) => {
	await animateReveal({ rawBoard, gameType, anticipation });
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
	stateGame.forceFastAnimations = false;
	resetBoardVisuals();
};

const markNextRevealAsSpin = () => {
	stateGame.nextRevealMode = 'spin';
};

const speedUpMotion = () => {
	stateGame.forceFastAnimations = true;
};

const activateMagnetPulse = async (positions: Position[]) => {
	await pulseMagnetActivation(positions);
};

const resetBonusState = () => {
	stateGame.bonusMode = null;
	stateGame.globalMultiplier = 1;
	stateGame.seriesTotalMultiplier = 1;
	stateGame.magnetTargetSymbol = null;
	stateGame.activeSeries = [];
	stateGame.persistentSeries = null;
	stateGame.clusterWinBadges = [];
	stateGame.selectedBonusSymbol = null;
	stateGame.tempMultiplier = null;
	stateGame.magnetPulseKeys = [];
	stateGame.nextRevealMode = 'spin';
	applySeriesDecorations({ board: stateGame.board, series: [], magnetTargetSymbol: null });
};

export const { getWinLevelDataByWinLevelAlias } = createGetWinLevelDataByWinLevelAlias({
	winLevelMap,
});

export const stateGameDerived = {
	boardLayout,
	boardRaw,
	scatterLandIndex,
	resetBoardVisuals,
	setBoardFromRaw,
	setSeriesSnapshots,
	animateClusterFormation,
	setClusterBadgesFromWinInfo,
	animateWinningPositions,
	applyReveal,
	beginSpin,
	markNextRevealAsSpin,
	speedUpMotion,
	activateMagnetPulse,
	resetBonusState,
	getWinLevelDataByWinLevelAlias,
};

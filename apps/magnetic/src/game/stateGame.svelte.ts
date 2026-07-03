import { backOut, cubicOut } from 'svelte/easing';
import { Tween } from 'svelte/motion';

import { stateBet } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type {
	BoardCell,
	ClusterSeriesSnapshot,
	GameType,
	PaySymbolName,
	Position,
	RawSymbol,
} from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import {
	BOARD_DIMENSIONS,
	BOARD_MOTION_DEFAULT,
	BOARD_MOTION_FAST,
	BOARD_SIZES,
	INITIAL_BOARD,
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
	SYMBOL_H,
	SYMBOL_W,
} from './constants';
import { eventEmitter } from './eventEmitter';

const posKey = ({ reel, row }: Position) => `${reel}:${row}`;
const getCellKey = (reel: number, row: number) => `${reel}:${row}`;
const getTargetY = (row: number) => SYMBOL_H * (row + 0.5);

const cloneRawSymbol = (rawSymbol: RawSymbol): RawSymbol => ({ ...rawSymbol });

const createBoardCell = (rawSymbol: RawSymbol, reel: number, row: number): BoardCell => ({
	...cloneRawSymbol(rawSymbol),
	key: getCellKey(reel, row),
	position: { reel, row },
	symbolState: INITIAL_SYMBOL_STATE,
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

const createBoardCells = (rawBoard: RawSymbol[][]): BoardCell[][] =>
	rawBoard.map((reel, reelIndex) => reel.map((rawSymbol, rowIndex) => createBoardCell(rawSymbol, reelIndex, rowIndex)));

const boardRaw = () => stateGame.board.map((reel) => reel.map(({ key, position, symbolState, displayY, displayAlpha, displayScale, locked, highlighted, anchor, target, persistent, fresh, ...raw }) => raw));

const setRawSymbol = (cell: BoardCell, rawSymbol: RawSymbol) => {
	for (const key of Object.keys(cell)) {
		if (['key', 'position', 'symbolState', 'displayY', 'displayAlpha', 'displayScale', 'locked', 'highlighted', 'anchor', 'target', 'persistent', 'fresh'].includes(key)) continue;
		// @ts-expect-error dynamic cleanup
		delete cell[key];
	}
	Object.assign(cell, cloneRawSymbol(rawSymbol));
};

const setNeutralCellState = (cell: BoardCell) => {
	cell.highlighted = false;
	cell.locked = false;
	cell.anchor = false;
	cell.target = false;
	cell.persistent = false;
	cell.fresh = false;
	cell.symbolState = cell.name === 'MAGNET' ? 'magnet' : 'static';
};

const applyCellVisualState = (cell: BoardCell) => {
	cell.symbolState = cell.highlighted
		? 'win'
		: cell.locked
			? 'locked'
			: cell.name === 'MAGNET'
				? 'magnet'
				: 'static';
};

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
	const locked = new Set(series.flatMap((entry) => entry.lockedPositions.map(posKey)));
	const anchors = new Set(series.flatMap((entry) => entry.anchorPositions.map(posKey)));
	const persistent = new Set(
		series.filter((entry) => entry.persistent).flatMap((entry) => entry.lockedPositions.map(posKey)),
	);

	for (const reel of board) {
		for (const cell of reel) {
			const key = posKey(cell.position);
			cell.locked = locked.has(key);
			cell.anchor = anchors.has(key);
			cell.persistent = persistent.has(key);
			cell.fresh = freshKeys.has(key);
			cell.target = magnetTargetSymbol != null && cell.name === magnetTargetSymbol && cell.name !== 'MAGNET';
			applyCellVisualState(cell);
		}
	}
};

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
	const frameW = (BOARD_SIZES.width * boardScale * 1.04 * (1.3 / 1.15)) / 0.64;
	const frameH = frameW * (2528 / 3616);
	return {
		x: stateLayoutDerived.mainLayout().width * 0.5 + getBoardOffset().x,
		y: frameH * 0.45,
		boardScale,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: BOARD_SIZES.width / 2, y: BOARD_SIZES.height / 2 },
		...BOARD_SIZES,
	};
};

const scatterLandIndex = () => {
	if (stateGame.scatterCounter > 5) return 5;
	if (stateGame.scatterCounter < 1) return 1;
	return stateGame.scatterCounter as 1 | 2 | 3 | 4 | 5;
};

const playLandSound = (rawSymbol: RawSymbol) => {
	if (rawSymbol.name === 'SCATTER') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({ type: 'soundOnce', name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()] });
	}
	if ((rawSymbol.name === 'MAGNET' && rawSymbol.multiplier && rawSymbol.multiplier > 1)
		|| (rawSymbol.name === 'WILD' && rawSymbol.multiplier)) {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_landing' });
	}
};

const getMotionPreset = () =>
	stateBet.isTurbo || stateBet.isSuperTurbo || stateGame.forceFastAnimations
		? BOARD_MOTION_FAST
		: BOARD_MOTION_DEFAULT;

const getCurrentLockedKeys = () =>
	new Set(stateGame.activeSeries.flatMap((entry) => entry.lockedPositions.map(posKey)));

const pulseScale = async (cell: BoardCell, peak: number, durationMs: number) => {
	await cell.displayScale.set(peak, { duration: 0 });
	await cell.displayScale.set(1, { duration: durationMs, easing: backOut });
};

const pulseFreshPositions = async (freshKeys: Set<string>) => {
	if (!freshKeys.size) return;
	const pulseMs = getMotionPreset().pulse.freshMs;
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
	const pulseMs = getMotionPreset().pulse.magnetMs;
	await Promise.all(
		positions.map(async (position) => {
			const cell = stateGame.board[position.reel]?.[position.row];
			if (!cell) return;
			await pulseScale(cell, 1.1, pulseMs);
		}),
	);
	stateGame.magnetPulseKeys = [];
};

const settleBoardInstant = ({
	rawBoard,
	series = stateGame.activeSeries,
	magnetTargetSymbol = stateGame.magnetTargetSymbol,
}: {
	rawBoard: RawSymbol[][];
	series?: ClusterSeriesSnapshot[];
	magnetTargetSymbol?: PaySymbolName | null;
}) => {
	for (let reelIndex = 0; reelIndex < BOARD_DIMENSIONS.x; reelIndex += 1) {
		for (let rowIndex = 0; rowIndex < BOARD_DIMENSIONS.y; rowIndex += 1) {
			const cell = stateGame.board[reelIndex][rowIndex];
			setRawSymbol(cell, rawBoard[reelIndex][rowIndex]);
			cell.displayY.set(getTargetY(rowIndex), { duration: 0 });
			cell.displayAlpha.set(1, { duration: 0 });
			cell.displayScale.set(1, { duration: 0 });
			setNeutralCellState(cell);
		}
	}
	applySeriesDecorations({ board: stateGame.board, series, magnetTargetSymbol });
	stateGame.boardSpinning = false;
};

const animateReveal = async ({
	rawBoard,
	gameType,
}: {
	rawBoard: RawSymbol[][];
	gameType: GameType;
}) => {
	stateGame.gameType = gameType;
	stateGame.boardSpinning = true;

	const preset = getMotionPreset();
	const mode = stateGame.nextRevealMode;
	const motion = preset[mode];
	const lockedKeys = getCurrentLockedKeys();

	const animations = stateGame.board.flatMap((reel, reelIndex) =>
		reel.map(async (cell, rowIndex) => {
			const nextRaw = rawBoard[reelIndex][rowIndex];
			const targetKey = getCellKey(reelIndex, rowIndex);
			const keepLocked = lockedKeys.has(targetKey) && cell.locked;

			if (keepLocked) {
				setRawSymbol(cell, nextRaw);
				cell.displayY.set(getTargetY(rowIndex), { duration: 0 });
				cell.displayAlpha.set(1, { duration: 0 });
				cell.displayScale.set(1, { duration: 0 });
				applyCellVisualState(cell);
				return;
			}

			setNeutralCellState(cell);

			if (motion.fadeOutMs > 0) {
				await Promise.all([
					cell.displayAlpha.set(0, { duration: motion.fadeOutMs }),
					cell.displayScale.set(0.92, { duration: motion.fadeOutMs }),
				]);
			} else {
				cell.displayAlpha.set(0, { duration: 0 });
			}

			setRawSymbol(cell, nextRaw);
			cell.symbolState = nextRaw.name === 'MAGNET' ? 'magnet' : 'spin';
			cell.displayY.set(getTargetY(rowIndex) - SYMBOL_H * (motion.dropRows + rowIndex * 0.08), { duration: 0 });
			cell.displayAlpha.set(0.12, { duration: 0 });
			cell.displayScale.set(motion.scaleFrom, { duration: 0 });

			const delay = motion.reelDelayMs * reelIndex + motion.rowDelayMs * (BOARD_DIMENSIONS.y - rowIndex - 1);
			if (delay > 0) await waitForTimeout(delay);

			await Promise.all([
				cell.displayY.set(getTargetY(rowIndex), { duration: motion.durationMs, easing: cubicOut }),
				cell.displayAlpha.set(1, { duration: Math.max(80, Math.round(motion.durationMs * 0.75)) }),
				cell.displayScale.set(1.04, { duration: Math.max(90, Math.round(motion.durationMs * 0.82)), easing: cubicOut }),
			]);
			cell.symbolState = nextRaw.name === 'MAGNET' ? 'magnet' : 'land';
			playLandSound(nextRaw);
			await cell.displayScale.set(1, { duration: motion.bounceMs, easing: backOut });
			applyCellVisualState(cell);
		}),
	);

	await Promise.all(animations);
	stateGame.boardSpinning = false;
	stateGame.nextRevealMode = 'respin';
};

export const stateGame = $state({
	board: createBoardCells(INITIAL_BOARD),
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
});

const resetBoardVisuals = () => {
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			cell.highlighted = false;
			cell.fresh = false;
			applyCellVisualState(cell);
			cell.displayScale.set(1, { duration: 0 });
			cell.displayAlpha.set(cell.locked ? 1 : cell.target ? 0.96 : 0.92, { duration: 0 });
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
	const nextLocked = new Set(series.flatMap((entry) => entry.lockedPositions.map(posKey)));
	const freshKeys = new Set([...nextLocked].filter((key) => !prevLocked.has(key)));

	stateGame.activeSeries = series;
	stateGame.seriesTotalMultiplier = totalMultiplier;
	stateGame.globalMultiplier = totalMultiplier;
	stateGame.magnetTargetSymbol = magnetTargetSymbol;
	stateGame.selectedBonusSymbol = magnetTargetSymbol;
	stateGame.persistentSeries = series.find((entry) => entry.persistent) ?? null;

	applySeriesDecorations({
		board: stateGame.board,
		series,
		magnetTargetSymbol,
		freshKeys,
	});

	void pulseFreshPositions(freshKeys);
};

const setClusterBadgesFromWinInfo = (wins: Array<{ id: string; reel: number; row: number; text: string }>) => {
	stateGame.clusterWinBadges = wins;
};

const animateWinningPositions = async (positions: Position[]) => {
	const keys = new Set(positions.map(posKey));
	const winMs = getMotionPreset().pulse.winMs;
	await Promise.all(
		stateGame.board.flatMap((reel) =>
			reel.flatMap(async (cell) => {
				if (!keys.has(posKey(cell.position))) return;
				cell.highlighted = true;
				applyCellVisualState(cell);
				cell.displayAlpha.set(1, { duration: 0 });
				await pulseScale(cell, 1.12, Math.max(80, Math.round(winMs * 0.55)));
			}),
		),
	);
	await waitForTimeout(winMs);
	for (const reel of stateGame.board) {
		for (const cell of reel) {
			if (!keys.has(posKey(cell.position))) continue;
			cell.highlighted = false;
			applyCellVisualState(cell);
		}
	}
};

const applyReveal = async ({ rawBoard, gameType }: { rawBoard: RawSymbol[][]; gameType: GameType }) => {
	await animateReveal({ rawBoard, gameType });
};

const beginSpin = () => {
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

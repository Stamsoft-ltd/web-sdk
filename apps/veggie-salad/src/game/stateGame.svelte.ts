import { stateBet } from 'state-shared';

import type { BonusTier, GameType, Position, RawSymbol } from './types';
import type { ClusterWin } from './typesBookEvent';

type Phase =
	| 'idle'
	| 'spinning-out'
	| 'spinning'
	| 'dropping'
	| 'winning'
	| 'removing'
	| 'transition';
type Overlay = null | {
	kind: 'mystery' | 'bonus' | 'retrigger' | 'win';
	title: string;
	detail: string;
	// Bonus intro/outro share one crisp Pixi board but present different live content. Keeping text
	// out of the raster art makes the screen sharp at every scale and keeps it localizable.
	bonusPresentation?: 'start' | 'end';
	freeSpins?: number;
	gridSize?: number;
	tier?: BonusTier;
	// Snapshot the presented value. Reading the live HUD value made a bonus-spin win jump to the
	// cumulative bonus total as the next event arrived underneath the presentation.
	amount?: number;
	countDurationMs?: number;
};

const INITIAL_NAMES = [
	'CORN',
	'TOMATO',
	'ONION',
	'CARROT',
	'EGGPLANT',
	'BROCCOLI',
	'PEPPER',
] as const;
const makeInitialBoard = (): RawSymbol[][] =>
	Array.from({ length: 7 }, (_, reel) =>
		Array.from({ length: 7 }, (_, row) => ({ name: INITIAL_NAMES[(reel * 3 + row * 5) % 7] })),
	);

export const stateGame = $state({
	// Pending-round "End round" still has to travel through RESUME_BET -> play -> endGame so the
	// RGS round is settled exactly once. The actor consumes this flag instead of replaying events.
	endRoundOnly: false,
	board: makeInitialBoard() as (RawSymbol | null)[][],
	gridSize: 7 as 7 | 8 | 9 | 10,
	gameType: 'basegame' as GameType,
	bonusTier: null as BonusTier | null,
	phase: 'idle' as Phase,
	revealId: 0,
	winningPositions: [] as Position[],
	winningClusters: [] as ClusterWin[],
	// The last CLUSTER_LOG_SIZE clusters paid by the CURRENT SPIN, NEWEST FIRST — the side payout
	// panel reads this so a tumble chain stays readable after its symbols are gone. Cleared at the
	// top of every spin (each free spin included), so the panel only ever describes the tumble
	// chain the player is watching. Newest first keeps a new win in the same place: the top slot.
	spinClusterWins: [] as ClusterWin[],
	freeSpinCurrent: 0,
	freeSpinTotal: 0,
	// During a bonus these values have deliberately different jobs:
	// - roundWin: this free spin only (HUD WIN + per-spin win presentation)
	// - bonusTotalWin: cumulative amount earned by the feature (separate TOTAL WIN board)
	// - bonusSpinStartTotal: cumulative checkpoint used to derive the current spin from the book's
	//   authoritative cumulative setTotalWin events; no payout is recalculated client-side.
	roundWin: 0,
	bonusTotalWin: 0,
	bonusSpinStartTotal: 0,
	overlay: null as Overlay,
	// Full-screen acknowledgement gate. Bonus intro/outro never auto-advance; the event handler
	// remains suspended until the player clicks/taps anywhere (or presses Enter/Space).
	continueGate: null as null | { id: number },
	// Scatters being celebrated on a bonus-entry spin — the cells pulse, and the COUNT is what tells
	// the player which bonus they are going into (3 normal, 4 super, 5 hidden).
	scatterPositions: [] as Position[],
	skipRequested: false,
	// When the skip was pressed, and when the wave currently on screen began (performance.now()).
	// A fall is a CSS animation, so the only way to fast-forward one that is already in the air is
	// to know how far into it we are — see skipAdjust.
	skipRequestedAt: 0,
	waveStartedAt: 0,
	// The profile the wave on screen is playing at, frozen when it started. Turbo flipped mid-wave
	// used to retime cells that were already falling, which landed some of them instantly while
	// their neighbours kept falling — one wave now plays at one speed, start to finish.
	waveFast: false,
	featureLabel: '',
	fallDistances: Array.from({ length: 7 }, () => Array(7).fill(0)) as number[][],
	// Per-cell random 0..1, re-rolled on every reveal. Multiplied into the drop delay so symbols
	// never land in grid lockstep — the loose rain look instead of a rigid strip. Kept in state
	// (not Math.random() in the template) so a re-render mid-fall cannot re-roll a cell's timing.
	fallJitter: Array.from({ length: 7 }, () => Array(7).fill(0)) as number[][],
	pendingRemovedPositions: [] as Position[],
});

// ── drop motion ───────────────────────────────────────────────────────────────
// Ported from the magnetic board rain: every symbol falls under the SAME gravity instead of
// every symbol sharing one duration. Travel time is proportional to sqrt(distance), and the
// fall itself is eased quadIn (CSS `--fall-ease`), which makes the trajectory identical for
// short and long falls — so a symbol can never overtake the one below it, and a one-row tumble
// reads as the same weight as a full board drop. Landing adds a squash + bounce (`land-impact`).
export const FALL_MOTION = {
	// ms per sqrt(cell) of travel: 1 row ≈ 130ms, 9 rows ≈ 390ms.
	unitMs: 130,
	minMs: 120,
	// Bottom rows leave first so each column piles up from the floor.
	spinRowStaggerMs: 40,
	tumbleRowStaggerMs: 22,
	reelDelayMs: 9,
	// Multiplied by the per-cell jitter roll, so nothing lands in lockstep.
	jitterMs: 38,
	impactMs: 220,
	// Trap-door exit on spin start: the old board free-falls out the bottom under the SAME gravity
	// as the drop (duration from the distance, bottom rows first), so leaving reads as a tumble
	// rather than the whole board sliding off as one sheet.
	exitRowStaggerMs: 26,
	exitReelDelayMs: 10,
	exitJitterMs: 26,
	// Cluster harvest (win symbols leaving), plus the per-cell jitter spread on it.
	removeMs: 420,
	removeJitterMs: 55,
} as const;

// Fast profile. Turbo, super turbo and a skip press all switch to THIS instead of scaling every
// duration towards zero: skipping is a fast-forward, so the tumble still plays — cluster, harvest,
// refill, in that order — just in ~a fifth of the time. Scaling to 0 read as a cancel, and the
// board jumped to new symbols without ever showing what had won.
export const FALL_MOTION_FAST = {
	unitMs: 55,
	minMs: 50,
	spinRowStaggerMs: 11,
	tumbleRowStaggerMs: 6,
	reelDelayMs: 3,
	jitterMs: 12,
	impactMs: 90,
	exitRowStaggerMs: 7,
	exitReelDelayMs: 3,
	exitJitterMs: 10,
	removeMs: 180,
	removeJitterMs: 20,
} as const;

// Scatters a tier needs to trigger. The paytable states 3 → normal (8×8) and 4 → super (9×9);
// hidden has no published count, so it takes the next one up. Single source of truth: the
// bonus-entry spin lands exactly this many, which is also how a MYSTERY buy announces what it
// rolled — the player reads the tier off the scatter count before the placard names it.
export const SCATTER_TRIGGER_COUNTS: Record<BonusTier, number> = {
	normal: 3,
	super: 4,
	hidden: 5,
};

// Rows in the side payout panel. The panel reserves this many slots at all times, so it never
// changes size as a cascade fills it.
export const CLUSTER_LOG_SIZE = 5;

export type FallMotion = { [Key in keyof typeof FALL_MOTION]: number };

const isFastMotion = () => stateGame.skipRequested || stateBet.isTurbo || stateBet.isSuperTurbo;

// The profile of the wave on screen. Frozen at the wave's start (see beginWave) so nothing can
// change speed underneath cells that are already moving.
const motion = (): FallMotion => (stateGame.waveFast ? FALL_MOTION_FAST : FALL_MOTION);

// How long a fast-forward takes to bring the board to rest. Short, but not zero: the cells finish
// their fall, they do not teleport.
const SKIP_TAIL_MS = 130;

// ms into the current wave at which the skip landed; <= 0 when the wave began after the press
// (that wave is already on the fast profile and needs no adjustment).
const skipCutMs = () =>
	stateGame.skipRequestedAt > 0 ? stateGame.skipRequestedAt - stateGame.waveStartedAt : 0;

// Rewrites one cell's (delay, duration) so that EVERY cell still in the air lands at the same
// moment — skip time + SKIP_TAIL_MS. Cells that had not started yet start now; cells that were
// mid-fall keep their original start, so their elapsed time is preserved and the browser simply
// re-scales what is left. Retiming with a shared duration instead used to finish the cells that
// were nearly done in the same frame (they read as teleporting into the gaps) while the ones that
// had just started carried on falling.
const skipAdjust = ({ delayMs, durationMs }: { delayMs: number; durationMs: number }) => {
	const cut = skipCutMs();
	if (cut <= 0) return { delayMs, durationMs };
	// Already down. Stretching a finished animation's duration would drop its progress back below
	// 1 and the symbol would climb back up and fall a second time.
	if (delayMs + durationMs <= cut) return { delayMs, durationMs };
	const delay = Math.min(delayMs, cut);
	return { delayMs: delay, durationMs: cut - delay + SKIP_TAIL_MS };
};

// Called by whatever puts a new wave of motion on screen: it stamps the clock the fast-forward
// measures against and freezes the speed for the whole wave.
const beginWave = () => {
	stateGame.waveStartedAt = performance.now();
	stateGame.waveFast = isFastMotion();
};

const fallDurationMs = (distance: number) => {
	const active = motion();
	return Math.max(active.minMs, active.unitMs * Math.sqrt(Math.max(distance, 0)));
};

// Longest per-cell delay in a wave: top row, last reel, worst jitter.
const maxFallDelayMs = (staggerMs: number) =>
	(stateGame.gridSize - 1) * staggerMs +
	(stateGame.gridSize - 1) * motion().reelDelayMs +
	motion().jitterMs;

// What a reveal wave actually takes on screen. The book handler waits this out instead of a
// hardcoded number — otherwise the phase flips back to `idle`, the CSS animation is dropped and
// the symbols snap into place mid-fall (worse the larger the bonus grid).
const revealDurationMs = (kind: 'spin' | 'tumble') => {
	const size = stateGame.gridSize;
	const active = motion();
	const stagger = kind === 'spin' ? active.spinRowStaggerMs : active.tumbleRowStaggerMs;
	// Spin drops enter from `size + 1` rows above (see initialFallDistances); a tumble closes at
	// most `size` rows of gaps.
	const maxDistance = kind === 'spin' ? size + 1 : size;
	const cut = skipCutMs();
	// Fast-forwarded: everything lands at cut + SKIP_TAIL_MS, so that plus the impact is all the
	// time the wave still needs.
	if (cut > 0) return cut + SKIP_TAIL_MS + FALL_MOTION_FAST.impactMs + 60;
	return maxFallDelayMs(stagger) + fallDurationMs(maxDistance) + active.impactMs + 60;
};

// Distance a cell travels to clear the bottom edge: its own row plus a row of margin.
const exitDistance = (row: number) => stateGame.gridSize - row + 1;

const exitDurationMs = () => {
	const cut = skipCutMs();
	if (cut > 0) return cut + SKIP_TAIL_MS;
	return (
		(stateGame.gridSize - 1) * motion().exitRowStaggerMs +
		(stateGame.gridSize - 1) * motion().exitReelDelayMs +
		motion().exitJitterMs +
		fallDurationMs(exitDistance(0))
	);
};

const removeDurationMs = () => motion().removeMs + motion().removeJitterMs;

const rollFallJitter = (size: number) =>
	Array.from({ length: size }, () =>
		Array.from({ length: size }, () => Math.random()),
	) as number[][];

const zeroFallDistances = (size: number) =>
	Array.from({ length: size }, () => Array(size).fill(0)) as number[][];

// Every cell enters from the SAME number of rows above its own target (magnetic's
// DROP_START_ROWS): the column stays a coherent stack, and the bottom row starts only two rows
// above the frame so symbols are visible almost immediately. The old `size + row` put the lower
// rows a whole extra board-height up, which left the board bare for the first ~300ms of the drop.
const initialFallDistances = (size: number) =>
	Array.from({ length: size }, () => Array(size).fill(size + 1)) as number[][];

const tumbleFallDistances = (size: number, removedPositions: Position[]) => {
	const distances = zeroFallDistances(size);
	const removedByReel = Array.from({ length: size }, () => new Set<number>());
	for (const { reel, row } of removedPositions) removedByReel[reel]?.add(row);

	for (let reel = 0; reel < size; reel += 1) {
		const removedRows = removedByReel[reel];
		const removedCount = removedRows.size;
		if (removedCount === 0) continue;

		// Fresh symbols enter above the board. Surviving symbols begin at their exact
		// previous row, then fall into the vacancies below. Cell art never moves.
		for (let row = 0; row < removedCount; row += 1) distances[reel][row] = removedCount;
		const survivingRows = Array.from({ length: size }, (_, row) => row).filter(
			(row) => !removedRows.has(row),
		);
		for (let index = 0; index < survivingRows.length; index += 1) {
			const sourceRow = survivingRows[index];
			const destinationRow = removedCount + index;
			distances[reel][destinationRow] = destinationRow - sourceRow;
		}
	}

	return distances;
};

const setBoard = ({
	board,
	gameType,
	transition = 'settle',
}: {
	board: RawSymbol[][];
	gameType?: GameType;
	transition?: 'settle' | 'spin' | 'tumble';
}) => {
	const size = board.length;
	stateGame.fallDistances =
		transition === 'spin'
			? initialFallDistances(size)
			: transition === 'tumble'
				? tumbleFallDistances(size, stateGame.pendingRemovedPositions)
				: zeroFallDistances(size);
	stateGame.fallJitter = rollFallJitter(size);
	beginWave();
	stateGame.board = board.map((reel) => reel.map((symbol) => ({ ...symbol })));
	stateGame.gridSize = size as 7 | 8 | 9 | 10;
	if (gameType) stateGame.gameType = gameType;
	stateGame.revealId += 1;
	if (transition === 'tumble') stateGame.pendingRemovedPositions = [];
};

const clearWinningState = () => {
	stateGame.winningPositions = [];
	stateGame.winningClusters = [];
};

const requestSkip = () => {
	if (stateGame.skipRequested) return;
	stateGame.skipRequested = true;
	stateGame.skipRequestedAt = performance.now();
};

// Skip is scoped to ONE spin. Without this, a single space press during a bonus zeroed the
// animation scale for every remaining free spin, so a 10-spin bonus resolved in one frame — the
// player pressed skip on a spin and lost the whole feature. Each spin re-arms the animations.
const clearSkip = () => {
	stateGame.skipRequested = false;
	stateGame.skipRequestedAt = 0;
};

// Narrative beats (overlays, win read-outs) scale; motion beats use the profile above. Skip is
// 0.12, never 0 — a beat still happens, it is just brief.
const SKIP_SCALE = 0.12;

const animationScale = () => {
	const base = stateBet.isSuperTurbo ? 0.08 : stateBet.isTurbo ? 0.32 : 1;
	return stateGame.skipRequested ? Math.min(SKIP_SCALE, base) : base;
};

const tick = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// The target is recomputed every tick, so a skip press shortens a wait that is already running
// instead of aborting it. `min` is the floor that survives any skip: the beats a player must see
// for the round to make sense (a cluster lighting up before its symbols are harvested).
const waitFor = async (getMs: () => number) => {
	const started = performance.now();
	for (;;) {
		const elapsed = performance.now() - started;
		const target = getMs();
		if (elapsed >= target) return;
		await tick(Math.min(24, Math.max(1, target - elapsed)));
	}
};

const wait = async (milliseconds: number, options: { min?: number } = {}) =>
	await waitFor(() => Math.max(options.min ?? 0, milliseconds * animationScale()));

// For beats whose length is set by the fall animation itself: the profile already accounts for
// turbo and skip, so it must not be scaled a second time.
const waitMotion = async (getMs: () => number) => await waitFor(getMs);

let continueGateId = 0;
let continueResolver: (() => void) | null = null;

const cancelContinueGate = () => {
	const resolve = continueResolver;
	continueResolver = null;
	resolve?.();
	stateGame.continueGate = null;
};

const waitForContinue = () => {
	// Defensive: never strand an older event if malformed book playback opens two gates.
	cancelContinueGate();
	const id = ++continueGateId;
	stateGame.continueGate = { id };
	return new Promise<void>((resolve) => {
		continueResolver = () => {
			if (stateGame.continueGate?.id !== id) return;
			continueResolver = null;
			stateGame.continueGate = null;
			resolve();
		};
	});
};

const continuePresentation = () => continueResolver?.();

// ── bonus-entry spin ──────────────────────────────────────────────────────────
// A bought bonus (and a mystery pick) used to cut straight to the placard, which read as the game
// skipping the part the player paid for. It now plays one ordinary base-game spin first, landing
// the scatters that would have triggered that bonus naturally: same drop, same board, and the
// scatters then pulse so the count is legible.

const randomBaseSymbol = (): RawSymbol => ({
	name: INITIAL_NAMES[Math.floor(Math.random() * INITIAL_NAMES.length)],
});

// One scatter per reel, spread across the board, so counting them takes no effort. Falls back to
// stacking extras on random rows if a tier ever needs more scatters than there are reels.
const scatterTriggerPositions = (count: number): Position[] => {
	const size = stateGame.gridSize;
	const reels = Array.from({ length: size }, (_, reel) => reel);
	for (let index = reels.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(Math.random() * (index + 1));
		[reels[index], reels[swap]] = [reels[swap], reels[index]];
	}
	return Array.from({ length: count }, (_, index) => ({
		reel: reels[index % size],
		row: Math.floor(Math.random() * size),
	}));
};

const scatterTriggerBoard = (positions: Position[]): RawSymbol[][] => {
	const size = stateGame.gridSize;
	const board = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => randomBaseSymbol()),
	);
	for (const { reel, row } of positions) {
		if (board[reel]?.[row]) board[reel][row] = { name: 'SCATTER', scatter: true };
	}
	return board;
};

// Holds on landed scatters so the count is legible. Shortened by a skip, never dropped: on a
// bonus entry the count is what tells the player which bonus they are going into.
const celebrateScatters = async (positions: Position[]) => {
	if (positions.length === 0) return;
	stateGame.scatterPositions = positions;
	await wait(950, { min: 320 });
	stateGame.scatterPositions = [];
};

// Fallback for books that carry no entry spin of their own (older packages, and the synthetic
// max-win books): compose one locally rather than cutting straight to the placard.
const playBonusEntrySpin = async ({
	tier,
	scatterCount,
	positions,
}: {
	tier: BonusTier;
	scatterCount?: number;
	positions?: Position[];
}) => {
	const size = stateGame.gridSize;
	const inBounds = (position: Position) =>
		position.reel >= 0 && position.reel < size && position.row >= 0 && position.row < size;
	// Prefer what the book actually rolled; synthesise only when it gives nothing to show.
	const bookPositions = (positions ?? []).filter(inBounds);
	const count = Math.max(1, scatterCount || SCATTER_TRIGGER_COUNTS[tier]);
	const scatters = bookPositions.length === count ? bookPositions : scatterTriggerPositions(count);

	clearWinningState();
	stateGame.scatterPositions = [];
	stateGame.gameType = 'basegame';
	stateGame.phase = 'spinning';
	setBoard({ board: scatterTriggerBoard(scatters), gameType: 'basegame', transition: 'spin' });
	await waitMotion(() => revealDurationMs('spin'));
	stateGame.phase = 'idle';

	// Hold on the landed scatters. Survives a skip (shortened, not dropped) — the count is the
	// whole point of the spin.
	await celebrateScatters(scatters);
};

const resetRound = () => {
	cancelContinueGate();
	clearSkip();
	stateGame.spinClusterWins = [];
	stateGame.roundWin = 0;
	stateGame.bonusTotalWin = 0;
	stateGame.bonusSpinStartTotal = 0;
	stateGame.overlay = null;
	stateGame.featureLabel = '';
	stateGame.pendingRemovedPositions = [];
	stateGame.fallDistances = zeroFallDistances(stateGame.gridSize);
	stateGame.fallJitter = rollFallJitter(stateGame.gridSize);
	clearWinningState();
	// The exit is a wave too: it is what a skip pressed at the very start of a spin acts on.
	beginWave();
	stateGame.phase = 'spinning-out';
};

const settle = (board?: RawSymbol[][]) => {
	if (board) setBoard({ board });
	stateGame.phase = 'idle';
	clearSkip();
	stateGame.pendingRemovedPositions = [];
	stateGame.fallDistances = zeroFallDistances(stateGame.gridSize);
	clearWinningState();
};

const positionKey = ({ reel, row }: Position) => `${reel}:${row}`;

export const stateGameDerived = {
	setBoard,
	motion,
	skipAdjust,
	celebrateScatters,
	playBonusEntrySpin,
	fallDurationMs,
	removeDurationMs,
	exitDistance,
	clearSkip,
	waitMotion,
	waitForContinue,
	continuePresentation,
	cancelContinueGate,
	revealDurationMs,
	exitDurationMs,
	clearWinningState,
	requestSkip,
	wait,
	animationScale,
	resetRound,
	settle,
	positionKey,
	isWinning: (reel: number, row: number) =>
		stateGame.winningPositions.some((position) => position.reel === reel && position.row === row),
};

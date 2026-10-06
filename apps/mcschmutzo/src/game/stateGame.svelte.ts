import _ from 'lodash';
import type { Tween } from 'svelte/motion';

import { createEnhanceBoard, createReelForSpinning } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, Position, RawSymbol, SymbolState } from './types';
import { stateLayoutDerived } from './stateLayout';
import { winLevelMap } from './winLevelMap';
import { eventEmitter } from './eventEmitter';
import { setChefMood } from './chefMood.svelte';
import {
	SYMBOL_SIZE,
	BOARD_SIZES,
	INITIAL_BOARD,
	BOARD_DIMENSIONS,
	SPIN_OPTIONS_DEFAULT,
	SPIN_OPTIONS_FAST,
	INITIAL_SYMBOL_STATE,
	scatterLandRate,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	// a WILD hitting the board: the chef lunges at it and smacks the counter
	if (rawSymbol.name === 'W') setChefMood('wild');
	if (rawSymbol.name === 'S') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		// every scatter that lands sounds (forcePlay: several can land within the clip's length), each
		// one a step higher than the last (the counter was just bumped by the broadcast above)
		const nth = Math.max(1, stateGame.scatterCounter);
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_scatter_land',
			forcePlay: true,
			rate: scatterLandRate(nth),
		});
	}
};

// Reel-stop sound sync. The stop clip leads in with ~455 ms of ticks before its thud, so it's started
// that long BEFORE the reel's impact (the reel reports its time-to-impact as its result slide begins:
// onReelImpactIn), landing the thud on the stop. A stop that comes sooner than planned (skipped spin)
// or too soon for the lead (turbo) plays just the thud at the real impact (onReelStopping).
const REEL_STOP_HIT_MS = 455; // the thud's onset in sfx_reel_stop
const AUDIO_LATENCY_MS = 10; // WebAudio output latency, less the ~10 ms a reel lands after its forecast (frame timing)
const reelStopPlan = _.range(BOARD_DIMENSIONS.x).map(() => ({
	timer: undefined as ReturnType<typeof setTimeout> | undefined,
	startedAt: -1,
	impactAt: -1,
}));
let lastReelHitAt = -1e9;
// Which reels have landed in the current spin (a skip must stop every reel still to land — moving
// or not yet started — and never latch a stop onto one that already landed: see Board.svelte).
export const reelLanded: boolean[] = _.range(BOARD_DIMENSIONS.x).map(() => true);
export const beginReelSpin = () => reelLanded.fill(false);
const planReelStopSound = (reelIndex: number, ms: number) => {
	const plan = reelStopPlan[reelIndex];
	clearTimeout(plan.timer);
	plan.startedAt = -1;
	plan.impactAt = performance.now() + ms;
	const lead = REEL_STOP_HIT_MS + AUDIO_LATENCY_MS;
	if (ms < lead) return; // too soon for the ticks: the thud plays at the impact instead
	plan.timer = setTimeout(() => {
		plan.timer = undefined;
		plan.startedAt = performance.now();
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop', forcePlay: true });
	}, ms - lead);
};
const reelStopImpact = (reelIndex: number) => {
	reelLanded[reelIndex] = true;
	const plan = reelStopPlan[reelIndex];
	clearTimeout(plan.timer);
	const now = performance.now();
	const inSync = plan.startedAt >= 0 && Math.abs(now - plan.impactAt) < 90;
	if (!inSync) {
		// skipped: the early-started clip's thud would now come late — cut it (its latest instance)
		if (plan.startedAt >= 0) eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_reel_stop' });
		// (several reels snapping together on a skip make ONE thud, not a stack of them)
		if (now - lastReelHitAt > 40) {
			lastReelHitAt = now;
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_reel_stop_hit', forcePlay: true });
		}
	}
	plan.timer = undefined;
	plan.startedAt = -1;
	plan.impactAt = -1;
};

const board = _.range(BOARD_DIMENSIONS.x).map((reelIndex) => {
	const reel = createReelForSpinning({
		reelIndex,
		symbolHeight: SYMBOL_SIZE,
		initialSymbols: INITIAL_BOARD[reelIndex],
		initialSymbolState: INITIAL_SYMBOL_STATE,
		onReelImpactIn: (ms) => planReelStopSound(reelIndex, ms),
		onReelStopping: () => reelStopImpact(reelIndex),
		onSymbolLand,
	});

	reel.reelState.spinOptions = () =>
		reel.reelState.spinType === 'fast' ? SPIN_OPTIONS_FAST : SPIN_OPTIONS_DEFAULT;

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
	bonusMode: null as 'freegame' | null,
	multiplierBoard: [] as (MultiplierSymbol | undefined)[][],
	scatterCounter: 0,
	lockedPositions: [] as Position[],
	lockSymbol: undefined as RawSymbol['name'] | undefined,
	collectedScatters: 0,
	globalMultiplier: 1,
	featureMessage: '',
	// Which free-games mode is running: 3 scatters / bought Normal = 'normal', 4 scatters / Super = 'super'.
	bonusTier: 'normal' as 'normal' | 'super',
	paylineWins: [] as Array<{
		lineIndex: number;
		/** The paying symbol (picks the line's sauce, PaylineOverlay). */
		symbol?: string;
		path: Array<{ reel: number; row: number }>;
	}>,
	roundWin: 0,
	// While a win screen (big-win pad / bonus total) counts up, the HUD WIN readout shows THIS value
	// instead of roundWin, so the two never disagree. null = no win screen owns the readout.
	winCountUp: null as number | null,
	pendingStop: false,
	awaitingFirstReveal: false,
	hasAnticipationPending: false,
	resumeModalOpen: false,
	buyModalOpen: false,
	freeSpinPopupShowing: false,
	wheel: undefined as
		| {
				scatterEntry: number;
				freeSpins: number;
				addedSteps: number;
				globalMult: number;
		  }
		| undefined,
	// Set by the bonusWheel book-event handler; WheelBonus calls it once the player has spun the wheel
	// and it settles on the RGS-resolved segment, letting the handler continue into the free games.
	wheelResolve: undefined as (() => void) | undefined,
	// Win popup dim (0..1 black alpha) while a win screen is up — the pixi overlay only darkens the
	// canvas, so the HTML layers (HUD, free-games panels) read this to dim themselves to match.
	winDim: 0,
});

const boardLayout = () => {
	// Portrait sits the board a touch higher so its top tucks under the logo header (which slightly
	// overlaps it); desktop sits a little low to leave the logo room. Landscape centres the board on the screen
	// (it used to sit left of centre, which looked crowded against the balance/bet gutter).
	const layoutType = stateLayoutDerived.layoutType();
	const isPortrait = layoutType === 'portrait';
	const isLandscape = layoutType === 'landscape';
	return {
		x: stateLayoutDerived.mainLayout().width * (isLandscape ? 0.5 : 0.494),
		// Landscape drops the board toward the bottom so the title logo (drawn just above the board
		// top by FeatureOverlay) has clear space at the top instead of clipping off-screen.
		// Desktop sits it 0.45 down (was 0.42): the board top at ~56 main units leaves the logo its full
		// 36%-of-board width (boardLogo shrinks it to fit whatever room is above the board).
		// Short portrait (main height < 1422, see stateLayout): the board sits just under the tight
		// logo header and clear of the bottom HUD.
		y:
			stateLayoutDerived.mainLayout().height *
			(isPortrait ? (stateLayoutDerived.mainLayout().height < 1422 ? 0.425 : 0.435) : isLandscape ? 0.53 : 0.45),
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
};

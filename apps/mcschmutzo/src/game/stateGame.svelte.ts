import _ from 'lodash';
import type { Tween } from 'svelte/motion';

import { stateBet } from 'state-shared';
import { createEnhanceBoard, createReelForSpinning } from 'utils-slots';
import { createGetWinLevelDataByWinLevelAlias } from 'utils-shared/winLevel';

import type { GameType, Position, RawSymbol, SymbolState } from './types';
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
	INITIAL_SYMBOL_STATE,
	SCATTER_LAND_SOUND_MAP,
} from './constants';

const onSymbolLand = ({ rawSymbol }: { rawSymbol: RawSymbol }) => {
	if (rawSymbol.name === 'S') {
		eventEmitter.broadcast({ type: 'soundScatterCounterIncrease' });
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: SCATTER_LAND_SOUND_MAP[scatterLandIndex()],
		});
	}

	if (rawSymbol.name === 'W') {
		eventEmitter.broadcast({
			type: 'soundOnce',
			name: 'sfx_multiplier_landing',
		});
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
				forcePlay: !stateBet.isTurbo,
			});
		},
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
	paylineWins: [] as Array<{
		lineIndex: number;
		path: Array<{ reel: number; row: number }>;
	}>,
	roundWin: 0,
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
});

const boardLayout = () => {
	// Portrait sits the board a touch higher so its top tucks under the logo header (which slightly
	// overlaps it); desktop keeps the original centring. Landscape nudges the board left of centre
	// so the right control rail (and free-spin panels) have clear gutter beside it (matches design).
	const layoutType = stateLayoutDerived.layoutType();
	const isPortrait = layoutType === 'portrait';
	const isLandscape = layoutType === 'landscape';
	return {
		x: stateLayoutDerived.mainLayout().width * (isLandscape ? 0.47 : 0.494),
		// Landscape drops the board toward the bottom so the title logo (drawn just above the board
		// top by FeatureOverlay) has clear space at the top instead of clipping off-screen.
		y: stateLayoutDerived.mainLayout().height * (isPortrait ? 0.435 : isLandscape ? 0.53 : 0.42),
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

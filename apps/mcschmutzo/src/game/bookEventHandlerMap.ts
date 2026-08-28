import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { sequence } from 'utils-shared/sequence';
import { waitForTimeout } from 'utils-shared/wait';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import { BOARD_DIMENSIONS } from './constants';
import config from './config';

const getWinLevelData = (winLevel: number): WinLevelData => {
	const clamped = Math.min(10, Math.max(1, Math.round(winLevel))) as WinLevel;
	return winLevelMap[clamped];
};

// Pick the win screen from the win AMOUNT (bet multiplier), so bigger wins escalate
// through the pads (SWEET → LEGENDARY → EPIC → WILD → MYTHIC) — same ladder as the
// previous games. Levels 1–5 have no pad, so small wins just count up in place.
const getWinLevelDataForAmount = (amount: number): WinLevelData => {
	const multiplier = amount / 100;
	const level =
		multiplier <= 0
			? 1
			: multiplier < 2
				? 2
				: multiplier < 5
					? 3
					: multiplier < 10
						? 4
						: multiplier < 20
							? 5
							: multiplier < 50
								? 6
								: multiplier < 100
									? 7
									: multiplier < 250
										? 8
										: multiplier < 1000
											? 9
											: 10;
	return getWinLevelData(level);
};

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.sound?.sfx) {
		eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	}
	if (winLevelData?.sound?.bgm) {
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	}
	if (winLevelData?.type === 'big') {
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_bigwin_coinloop' });
	}
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bigwin_coinloop' });
	if (stateGame.gameType === 'freegame') {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
	} else {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
	}
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({
		type: 'boardWithAnimateSymbols',
		symbolPositions: positions,
	});
};

const scatterOnlyAnticipation = (bookEvent: BookEventOfType<'reveal'>) => {
	// Free-game / bought-bonus reveals may omit `anticipation`; fall back to a per-reel zero array.
	const zeros = bookEvent.board.map(() => 0);
	const anticipation = bookEvent.anticipation ?? zeros;
	if (bookEvent.gameType !== 'basegame') return zeros;

	const visibleScatterCount = bookEvent.board.reduce((total, reel) => {
		const visibleSymbols = reel.length === BOARD_DIMENSIONS.y + 2 ? reel.slice(1, -1) : reel;
		return total + visibleSymbols.filter((symbol) => symbol.name === 'S').length;
	}, 0);

	return visibleScatterCount >= 2 ? anticipation : zeros;
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		stateGame.roundWin = 0;
		stateGame.paylineWins = [];
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		if (bookEvent.gameType !== 'respin') {
			stateGame.lockedPositions = [];
			stateGame.lockSymbol = undefined;
			stateGame.featureMessage = '';
		}
		stateGame.gameType = bookEvent.gameType;
		const hadPendingStop = stateGame.pendingStop && stateGame.awaitingFirstReveal;
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;
		const revealEvent = {
			...bookEvent,
			anticipation: scatterOnlyAnticipation(bookEvent),
		};
		const spinPromise = stateGameDerived.enhancedBoard.spin({
			revealEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
		});
		if (hadPendingStop) stateGameDerived.enhancedBoard.stop();
		await spinPromise;
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		stateGame.roundWin = bookEvent.totalWin;
		if (bookEvent.wins.length === 0) {
			stateGame.paylineWins = [];
			return;
		}
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_winlevel_small' });
		await sequence(bookEvent.wins, async (win) => {
			await animateSymbols({ positions: win.positions });
		});
		stateGame.paylineWins = bookEvent.wins.map((win) => ({
			lineIndex: win.meta.lineIndex,
			path: [...win.positions]
				.sort((left, right) => left.reel - right.reel)
				.map(({ reel, row }) => ({ reel, row: row - 1 })),
		}));
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		// animate scatters
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
		await animateSymbols({ positions: bookEvent.positions });
		// show free spin intro
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			totalFreeSpins: bookEvent.totalFs,
		});
		stateGame.gameType = 'freegame';
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		stateUi.freeSpinCounterShow = true;
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: undefined,
			total: bookEvent.totalFs,
		});
		stateUi.freeSpinCounterTotal = bookEvent.totalFs;
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerButtonShow' });
		eventEmitter.broadcast({ type: 'drawerFold' });
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		stateUi.freeSpinCounterShow = true;
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: bookEvent.amount + 1,
			total: bookEvent.total,
		});
		stateUi.freeSpinCounterCurrent = bookEvent.amount + 1;
		stateUi.freeSpinCounterTotal = bookEvent.total;
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = getWinLevelDataForAmount(bookEvent.amount);

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		stateGame.gameType = 'basegame';
		stateGame.bonusMode = null;
		stateGame.globalMultiplier = 1;
		stateGame.collectedScatters = 0;
		stateGame.lockedPositions = [];
		stateGame.lockSymbol = undefined;
		stateGame.featureMessage = '';
		stateGame.paylineWins = [];
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_youwon_panel' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
		eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
		stateUi.freeSpinCounterShow = false;
		await eventEmitter.broadcastAsync({ type: 'transition' });
		await eventEmitter.broadcastAsync({ type: 'uiShow' });
		await eventEmitter.broadcastAsync({ type: 'drawerUnfold' });
		eventEmitter.broadcast({ type: 'drawerButtonHide' });
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = getWinLevelDataForAmount(bookEvent.amount);

		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		// Do nothing
	},
	wincap: async (bookEvent: BookEventOfType<'wincap'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	lockRespinStart: async (bookEvent: BookEventOfType<'lockRespinStart'>) => {
		stateGame.paylineWins = [];
		stateGame.lockSymbol = bookEvent.symbol;
		stateGame.lockedPositions = bookEvent.lockedPositions;
		stateGame.globalMultiplier = bookEvent.globalMult;
		stateGame.featureMessage = `LOCK & RE-SPIN · ${bookEvent.symbol}`;
		await waitForTimeout(250);
	},
	lockRespinUpdate: async (bookEvent: BookEventOfType<'lockRespinUpdate'>) => {
		const positions = [...stateGame.lockedPositions, ...bookEvent.newLockedPositions];
		stateGame.lockedPositions = _.uniqBy(positions, ({ reel, row }) => `${reel}:${row}`);
		stateGame.collectedScatters = bookEvent.collectedScatters;
		stateGame.globalMultiplier = bookEvent.globalMult;
		if (bookEvent.addedSteps > 0) {
			stateGame.featureMessage = `CHEF +${bookEvent.addedSteps} STEP${bookEvent.addedSteps === 1 ? '' : 'S'}`;
			await waitForTimeout(350);
		}
	},
	lockRespinEnd: async (bookEvent: BookEventOfType<'lockRespinEnd'>) => {
		stateGame.lockedPositions = bookEvent.lockedPositions;
		stateGame.collectedScatters = bookEvent.collectedScatters;
		stateGame.globalMultiplier = bookEvent.globalMult;
		stateGame.featureMessage = '';
		await waitForTimeout(250);
	},
	updateGlobalMult: async (bookEvent: BookEventOfType<'updateGlobalMult'>) => {
		stateGame.globalMultiplier = bookEvent.globalMult;
		stateGame.featureMessage =
			bookEvent.addedSteps > 0 ? `MULTIPLIER +${bookEvent.addedSteps} STEPS` : '';
	},
	bonusWheel: async (bookEvent: BookEventOfType<'bonusWheel'>) => {
		stateGame.gameType = 'freegame';
		stateGame.bonusMode = 'freegame';
		stateGame.globalMultiplier = bookEvent.globalMult;
		stateGame.wheel = bookEvent;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
		stateGame.featureMessage = bookEvent.scatterEntry === 4 ? 'SUPER BONUS' : 'NORMAL BONUS';
		stateUi.freeSpinCounterShow = true;
		stateUi.freeSpinCounterCurrent = 1;
		stateUi.freeSpinCounterTotal = bookEvent.freeSpins;
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: 1,
			total: bookEvent.freeSpins,
		});
		// Intro/scale (0.32s), wheel spin (2.2s), then hold the resolved award.
		await waitForTimeout(2200);
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_up' });
		await waitForTimeout(800);
		stateGame.wheel = undefined;
	},
	// customised
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		function findLastBookEvent<T>(type: T) {
			return _.findLast(bookEvents, (bookEvent) => bookEvent.type === type) as
				| BookEventOfType<T>
				| undefined;
		}

		const lastFreeSpinTriggerEvent = findLastBookEvent('freeSpinTrigger' as const);
		const lastUpdateFreeSpinEvent = findLastBookEvent('updateFreeSpin' as const);
		const lastSetTotalWinEvent = findLastBookEvent('setTotalWin' as const);
		const lastUpdateGlobalMultEvent = findLastBookEvent('updateGlobalMult' as const);

		if (lastFreeSpinTriggerEvent) await playBookEvent(lastFreeSpinTriggerEvent, { bookEvents });
		if (lastUpdateFreeSpinEvent) playBookEvent(lastUpdateFreeSpinEvent, { bookEvents });
		if (lastSetTotalWinEvent) playBookEvent(lastSetTotalWinEvent, { bookEvents });
		if (lastUpdateGlobalMultEvent) playBookEvent(lastUpdateGlobalMultEvent, { bookEvents });
	},
};

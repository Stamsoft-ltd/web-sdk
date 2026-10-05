import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { sequence } from 'utils-shared/sequence';
import { waitForTimeout } from 'utils-shared/wait';

const FREE_SPIN_LANDED_HOLD_MS = 1200;
// Free games (the special bg) are paced so every landing and every lock animation can be seen before
// the reels move again. The base game keeps its own (quicker) pace.
const inFreeGames = () => stateGame.bonusMode === 'freegame';
const RESPIN_LANDED_HOLD_MS = 500; // after a re-spin lands
const NEXT_FREE_SPIN_PAUSE_MS = 800; // before the next free spin's reels start
const LOCK_SETTLE_MS = LOCK_SLAM_MS + 300; // new yellow boxes fully arrived + a beat
// Soups (M) currently showing on the board (rows 1..5), as book-event positions.
// DEV check: soups that land in free games but are followed by NO multiplier step before the next
// spin. The client only animates the steps the book reports, so this tells a math-side "the soup
// didn't qualify" apart from a missing animation.
let soupCheck: null | { index: number; soups: { reel: number; row: number }[] } = null;
const reportSoupCheck = () => {
	if (soupCheck && import.meta.env.DEV)
		console.warn('[pot] soup(s) landed but the book added no multiplier steps', soupCheck);
	soupCheck = null;
};
const soupsOnBoard = () =>
	stateGame.board.flatMap((reel, r) =>
		reel.reelState.symbols
			.map((s, row) => ({ reel: r, row, name: s?.rawSymbol?.name }))
			.filter((p) => p.row >= 1 && p.row <= BOARD_DIMENSIONS.y && p.name === 'M')
			.map(({ reel: rr, row }) => ({ reel: rr, row })),
	);

// A bought bonus (bonus1 = 100×, bonus2 = 500×) is a one-shot purchase, but its mode used to stay
// selected after the round: the HUD then priced the next spin at 100×/500× and, if the balance
// couldn't cover that, disabled spin / Space / autoplay with nothing to reset it (a soft-lock).
// Once the bought round is being played (its request already went out with the right mode),
// drop back to the base mode. The Lock-Feature / Extra-Chance toggles are left alone.
const releaseBoughtMode = () => {
	if (stateBet.activeBetModeKey === 'bonus1' || stateBet.activeBetModeKey === 'bonus2') {
		stateBet.activeBetModeKey = 'base';
	}
};
const WHEEL_FADE_OUT_MS = 280; // keep in sync with WheelBonus.svelte's out:fade duration

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { beginReelSpin, stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import { BOARD_DIMENSIONS, LOCK_SLAM_MS } from './constants';
import { beginPotReveal, flushPot, queuePotShots, resetPot } from './potState.svelte';
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
	// big wins: the win track replaces the bed (the count-up is timed to end on its final hit)
	if (winLevelData?.sound?.bgm) {
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	}
};

const winLevelSoundsStop = () => {
	// STOP (not just pause) the one-shot win tracks, so the next big win starts from the top
	eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_bigwin' });
	eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_bigwin_top' });
	if (stateGame.gameType === 'freegame' || stateGame.bonusMode === 'freegame') {
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
		beginPotReveal();
		beginReelSpin();
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
		reportSoupCheck();
		if (inFreeGames()) {
			const soups = soupsOnBoard();
			if (soups.length) soupCheck = { index: bookEvent.index, soups };
		}
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		// Free games: hold the landed board a moment after the last reel stops, so the player clearly
		// sees what was rolled before the win presentation / next free spin kicks in.
		if (bookEvent.gameType === 'freegame') await waitForTimeout(FREE_SPIN_LANDED_HOLD_MS);
		else if (bookEvent.gameType === 'respin' && inFreeGames()) await waitForTimeout(RESPIN_LANDED_HOLD_MS);
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		stateGame.roundWin = bookEvent.totalWin;
		if (bookEvent.wins.length === 0) {
			stateGame.paylineWins = [];
			return;
		}
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_normal', forcePlay: true });
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
		stateGame.bonusTier = bookEvent.positions.length >= 4 ? 'super' : 'normal';
		// animate scatters
		await animateSymbols({ positions: bookEvent.positions });
		// show free spin intro (waits for the click to start)
		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		await eventEmitter.broadcastAsync({ type: 'transition' });
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_screen' });
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
		reportSoupCheck();
		// Safety net: anything still queued (normally already shot when its step event came) goes now.
		if (bookEvent.amount === 0) resetPot(stateGame.globalMultiplier);
		else await flushPot(stateGame.globalMultiplier);
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		stateUi.freeSpinCounterShow = true;
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: bookEvent.amount + 1,
			total: bookEvent.total,
		});
		stateUi.freeSpinCounterCurrent = bookEvent.amount + 1;
		stateUi.freeSpinCounterTotal = bookEvent.total;
		// a breath between free spins (not before the first one — the wheel / intro just closed)
		if (bookEvent.amount > 0) await waitForTimeout(NEXT_FREE_SPIN_PAUSE_MS);
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = getWinLevelDataForAmount(bookEvent.amount);
		reportSoupCheck();
		// (safety net — soups shoot when their step event comes)
		await flushPot(stateGame.globalMultiplier);

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
		if (bookEvent.amount > 0 && winLevelData?.type !== 'big') eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_normal' });
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
		releaseBoughtMode();
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
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_lock_grow', forcePlay: true });
		await waitForTimeout(inFreeGames() ? LOCK_SETTLE_MS : 250);
	},
	lockRespinUpdate: async (bookEvent: BookEventOfType<'lockRespinUpdate'>) => {
		const positions = [...stateGame.lockedPositions, ...bookEvent.newLockedPositions];
		stateGame.lockedPositions = _.uniqBy(positions, ({ reel, row }) => `${reel}:${row}`);
		stateGame.collectedScatters = bookEvent.collectedScatters;
		stateGame.globalMultiplier = bookEvent.globalMult;
		const newLocks = bookEvent.newLockedPositions.length > 0;
		if (newLocks) eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_lock_grow', forcePlay: true });
		if (newLocks && inFreeGames()) await waitForTimeout(LOCK_SETTLE_MS);
		if (bookEvent.addedSteps > 0) soupCheck = null;
		if (import.meta.env.DEV && bookEvent.addedSteps > 0)
			console.info('[pot] lockRespinUpdate', { addedSteps: bookEvent.addedSteps, globalMult: bookEvent.globalMult, multiplierPositions: bookEvent.multiplierPositions, soupsOnBoard: soupsOnBoard() });
		// The soups shoot NOW, while they're still in their cells (the next re-spin rolls them away) and
		// before this spin's win is shown — not deferred to the end of the free spin.
		if (bookEvent.addedSteps > 0 && inFreeGames()) {
			queuePotShots(bookEvent.addedSteps, bookEvent.multiplierPositions);
			await flushPot(stateGame.globalMultiplier);
		}
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
		await waitForTimeout(inFreeGames() ? 600 : 250);
	},
	updateGlobalMult: async (bookEvent: BookEventOfType<'updateGlobalMult'>) => {
		stateGame.globalMultiplier = bookEvent.globalMult;
		if (bookEvent.addedSteps > 0) soupCheck = null;
		if (import.meta.env.DEV && bookEvent.addedSteps > 0)
			console.info('[pot] updateGlobalMult', { source: bookEvent.source, addedSteps: bookEvent.addedSteps, previousGlobalMult: bookEvent.previousGlobalMult, globalMult: bookEvent.globalMult, soupsOnBoard: soupsOnBoard() });
		// (the wheel's steps aren't soups — they're shown by the wheel itself)
		if (bookEvent.addedSteps > 0 && inFreeGames() && bookEvent.source !== 'wheel') {
			queuePotShots(bookEvent.addedSteps, soupsOnBoard());
			await flushPot(stateGame.globalMultiplier);
		}
		stateGame.featureMessage =
			bookEvent.addedSteps > 0 ? `MULTIPLIER +${bookEvent.addedSteps} STEPS` : '';
	},
	bonusWheel: async (bookEvent: BookEventOfType<'bonusWheel'>) => {
		stateGame.gameType = 'freegame';
		stateGame.bonusMode = 'freegame';
		stateGame.globalMultiplier = bookEvent.globalMult;
		stateGame.wheel = bookEvent;
		stateGame.bonusTier = bookEvent.scatterEntry === 4 ? 'super' : 'normal';
		releaseBoughtMode();
		// the wheel screen waits for SPIN: bonus music + the "click to start" sting
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_screen' });
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
		// Manual spin: wait for the player to press SPIN and the wheel to settle on the RGS segment
		// (WheelBonus calls stateGame.wheelResolve), then hold the resolved award briefly.
		await new Promise<void>((resolve) => {
			stateGame.wheelResolve = resolve;
		});
		stateGame.wheelResolve = undefined;
		// the wheel's steps boost the multiplier (the soup badge)
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_soup_boost' });
		await waitForTimeout(800);
		stateGame.wheel = undefined;
		// Let the wheel screen finish fading out (WheelBonus out:fade, 280ms) plus a short beat on the
		// clear board, so the first free spin's reels start in full view instead of under the fade.
		await waitForTimeout(WHEEL_FADE_OUT_MS + 250);
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

import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { sequence } from 'utils-shared/sequence';
import { waitForTimeout } from 'utils-shared/wait';

// Free games (the special bg) are paced so every landing and every lock animation can be seen before
// the reels move again. The base game keeps its own (quicker) pace.
const inFreeGames = () => stateGame.bonusMode === 'freegame';
// Dead time: a landed board holds only as long as it needs to be read. When something follows (a win,
// a lock, a soup step, the trigger / end) it holds a bit longer so the reaction lands on a still board;
// a quiet spin moves on quickly. Turbo halves every hold.
const FREE_SPIN_LANDED_HOLD_MS = 700; // after a free spin lands, before what it set off
const FREE_SPIN_QUIET_HOLD_MS = 450; // after a free spin lands with nothing to show
const RESPIN_LANDED_HOLD_MS = 500; // after a re-spin lands with nothing new
const RESPIN_LOCK_HOLD_MS = 300; // after a re-spin lands with new locks (their slam is the reaction)
const NEXT_FREE_SPIN_PAUSE_MS = 450; // before the next free spin's reels start
// The next re-spin starts during the last 300ms of the lock slam (its damped wobble), not after it.
const LOCK_SETTLE_MS = LOCK_SLAM_MS - 300;
const LOCK_END_HOLD_MS = 400; // the lock feature ends, before its win is shown
const hold = (ms: number) => waitForTimeout(stateBet.isTurbo ? ms / 2 : ms);
// Does anything get shown between this reveal and the next spin?
const revealHasFollowUp = (bookEvent: BookEvent, bookEvents: BookEvent[]) => {
	const at = bookEvents.findIndex((event) => event.index === bookEvent.index);
	for (const event of bookEvents.slice(at + 1)) {
		if (event.type === 'reveal' || event.type === 'updateFreeSpin') return false;
		if (event.type === 'winInfo' && event.wins.length > 0) return true;
		if (event.type === 'lockRespinStart' || event.type === 'freeSpinTrigger' || event.type === 'freeSpinEnd')
			return true;
		if (event.type === 'lockRespinUpdate' && (event.newLockedPositions.length > 0 || event.addedSteps > 0))
			return true;
		if (event.type === 'updateGlobalMult' && event.addedSteps > 0) return true;
	}
	return false;
};
// Win beat: after the win lines light up, the winners pulse and the rest dim (Symbol / winFocus)
// before anything else happens — the win screen, or the lock & re-spin that follows a win.
const WIN_BEAT_MS = 520;
const WIN_BEAT_TURBO_MS = 260;
// A short held breath between the board landing and its win lighting up.
const WIN_PRE_PAUSE_MS = 130;
// Wins below this multiplier get no win screen: the amount pops on the board and the WIN readout
// counts it up. Bigger ones keep their plaque.
const BOARD_ONLY_WIN_MULTIPLIER = 5;
const BOARD_ONLY_WIN_HOLD_MS = 900;
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
const WHEEL_ENTRY_DELAY_MS = 500; // the board holds the triggering scatters this long before the wheel
const WHEEL_FADE_OUT_MS = 280; // keep in sync with WheelBonus.svelte's out:fade duration

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { beginReelSpin, stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import { BOARD_DIMENSIONS, LOCK_SLAM_MS } from './constants';
import { beginPotReveal, flushPot, potState, queuePotShots, resetPot } from './potState.svelte';
import { setChefMood } from './chefMood.svelte';
import { releaseLocks } from './lockRelease.svelte';
import config from './config';

const getWinLevelData = (winLevel: number): WinLevelData => {
	const clamped = Math.min(10, Math.max(1, Math.round(winLevel))) as WinLevel;
	return winLevelMap[clamped];
};

// Pick the win screen from the win AMOUNT (bet multiplier), so bigger wins escalate
// through the pads: SWEET 20× → WILD 50× → EPIC 100× → MYTHIC 200× → LEGENDARY 500×+. The two
// top tiers share the longer bgm_bigwin_top track. Levels 1–5 have no pad, so small wins just
// count up in place.
// The chef's reaction to a presented win: a nod for a plaque win, a laugh for a big win, the full
// celebration from the EPIC tier (100×) up.
const chefMoodForWin = (data: WinLevelData) => (data.level >= 8 ? 'hugeWin' : data.type === 'big' ? 'bigWin' : 'win');
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
									: multiplier < 200
										? 8
										: multiplier < 500
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

	const scattersPerReel = bookEvent.board.map((reel) => {
		const visibleSymbols = reel.length === BOARD_DIMENSIONS.y + 2 ? reel.slice(1, -1) : reel;
		return visibleSymbols.filter((symbol) => symbol.name === 'S').length;
	});
	const visibleScatterCount = scattersPerReel.reduce((total, n) => total + n, 0);
	if (visibleScatterCount < 2) return zeros;

	// 4 scatters is the most there is to win (3 = Normal Bonus, 4 = Super Bonus): once the reels
	// already stopped show 4, the reels after them have nothing left to wait for — no tease.
	let landed = 0;
	return anticipation.map((value, reel) => {
		const tease = landed >= MAX_TRIGGER_SCATTERS ? 0 : value;
		landed += scattersPerReel[reel] ?? 0;
		return tease;
	});
};
const MAX_TRIGGER_SCATTERS = 4;
// …and those reels don't spin on one more stagger behind a long tease either: they stop TOGETHER
// with the reel that brought the 4th scatter (utils-slots `stopWithPrevious`). Without a tease the
// normal stagger is short, so they keep it.
const stopWithPreviousReels = (bookEvent: BookEventOfType<'reveal'>, anticipation: number[]) => {
	if (!anticipation.some(Boolean)) return undefined;
	let landed = 0;
	return bookEvent.board.map((reel) => {
		const settled = landed >= MAX_TRIGGER_SCATTERS;
		const visibleSymbols = reel.length === BOARD_DIMENSIONS.y + 2 ? reel.slice(1, -1) : reel;
		landed += visibleSymbols.filter((symbol) => symbol.name === 'S').length;
		return settled;
	});
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		// A lock re-spin continues the same win: only a new spin clears the WIN readout.
		if (bookEvent.gameType !== 'respin') stateGame.roundWin = 0;
		stateGame.paylineWins = [];
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		if (bookEvent.gameType !== 'respin') {
			releaseLocks(); // (usually already done when the round started — actor onNewGameStart)
			stateGame.featureMessage = '';
		}
		stateGame.gameType = bookEvent.gameType;
		beginPotReveal();
		beginReelSpin();
		setChefMood('spin');
		const hadPendingStop = stateGame.pendingStop && stateGame.awaitingFirstReveal;
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;
		const anticipation = scatterOnlyAnticipation(bookEvent);
		const revealEvent = {
			...bookEvent,
			anticipation,
			stopWithPrevious: stopWithPreviousReels(bookEvent, anticipation),
		};
		const spinPromise = stateGameDerived.enhancedBoard.spin({
			revealEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
		});
		if (hadPendingStop) {
			stateGameDerived.enhancedBoard.stop();
			// teasing reels only take a forced skip, and only once their slide has begun
			// (Board.svelte stopButtonClick) — pass the early press on to it
			setTimeout(() => eventEmitter.broadcast({ type: 'stopButtonClick' }), 0);
		}
		await spinPromise;
		reportSoupCheck();
		if (inFreeGames()) {
			const soups = soupsOnBoard();
			if (soups.length) soupCheck = { index: bookEvent.index, soups };
		}
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
		// Free games: hold the landed board a moment after the last reel stops, so the player clearly
		// sees what was rolled before the win presentation / next free spin kicks in.
		const followUp = revealHasFollowUp(bookEvent, bookEvents);
		// nothing came of it: the chef shrugs
		if (!followUp) setChefMood('dead');
		if (bookEvent.gameType === 'freegame')
			await hold(followUp ? FREE_SPIN_LANDED_HOLD_MS : FREE_SPIN_QUIET_HOLD_MS);
		else if (bookEvent.gameType === 'respin' && inFreeGames())
			await hold(followUp ? RESPIN_LOCK_HOLD_MS : RESPIN_LANDED_HOLD_MS);
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>, { bookEvents }: BookEventContext) => {
		// When a win screen presents this amount next (setWin), it counts the readout up itself;
		// setting it here would show the final value before the count-up starts.
		const at = bookEvents.findIndex((event) => event.index === bookEvent.index);
		if (bookEvents[at + 1]?.type !== 'setWin') stateGame.roundWin = bookEvent.totalWin;
		if (bookEvent.wins.length === 0) {
			stateGame.paylineWins = [];
			return;
		}
		await waitForTimeout(stateBet.isTurbo ? WIN_PRE_PAUSE_MS / 2 : WIN_PRE_PAUSE_MS);
		setChefMood('win');
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_normal', forcePlay: true });
		await sequence(bookEvent.wins, async (win) => {
			await animateSymbols({ positions: win.positions });
		});
		stateGame.paylineWins = bookEvent.wins.map((win) => ({
			lineIndex: win.meta.lineIndex,
			symbol: win.symbol,
			path: [...win.positions]
				.sort((left, right) => left.reel - right.reel)
				.map(({ reel, row }) => ({ reel, row: row - 1 })),
		}));
		await waitForTimeout(stateBet.isTurbo ? WIN_BEAT_TURBO_MS : WIN_BEAT_MS);
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
		if (bookEvent.amount > 0) await hold(NEXT_FREE_SPIN_PAUSE_MS);
		// The last spin is announced: the room dims, the pot pulses and the chef reacts, FINAL SPIN slams
		// down (FinalSpinHtml) — the spin starts once it has landed.
		if (bookEvent.total > 1 && bookEvent.amount + 1 === bookEvent.total) {
			potState.nudge += 1;
			await eventEmitter.broadcastAsync({ type: 'finalSpin' });
		}
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = getWinLevelDataForAmount(bookEvent.amount);
		reportSoupCheck();
		// (safety net — soups shoot when their step event comes)
		await flushPot(stateGame.globalMultiplier);

		await eventEmitter.broadcastAsync({ type: 'uiHide' });
		// The ending (BonusEndingHtml), on the bonus board before the TOTAL WIN plaque: BONUS COMPLETE,
		// then the final multiplier flies out of the pot; the pot boils over and the chef celebrates.
		setChefMood(bookEvent.amount > 0 ? (winLevelData.level >= 8 ? 'hugeWin' : 'bigWin') : 'dead');
		potState.overflowAt = performance.now();
		potState.nudge += 1;
		await eventEmitter.broadcastAsync({ type: 'bonusEnding', mult: stateGame.globalMultiplier });
		stateGame.gameType = 'basegame';
		stateGame.bonusMode = null;
		stateGame.globalMultiplier = 1;
		stateGame.collectedScatters = 0;
		releaseLocks();
		stateGame.featureMessage = '';
		stateGame.paylineWins = [];
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		// The WIN readout follows the bonus total's count-up, then keeps the total back in the base game.
		stateGame.winCountUp = 0;
		eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
		if (bookEvent.amount > 0) setChefMood(chefMoodForWin(winLevelData));
		if (bookEvent.amount > 0 && winLevelData?.type !== 'big') eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_win_normal' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'freeSpinOutroCountUp',
			amount: bookEvent.amount,
			winLevelData,
		});
		stateGame.roundWin = bookEvent.amount;
		stateGame.winCountUp = null;
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

		// Small win: no win screen. The amount pops on the board (BoardWinPop) while the WIN readout
		// counts it up, and the win lines keep playing.
		if (bookEvent.amount > 0 && bookEvent.amount / 100 < BOARD_ONLY_WIN_MULTIPLIER) {
			stateGame.roundWin = bookEvent.amount;
			eventEmitter.broadcast({ type: 'boardWinPop', amount: bookEvent.amount });
			await waitForTimeout(stateBet.isTurbo ? BOARD_ONLY_WIN_HOLD_MS / 2 : BOARD_ONLY_WIN_HOLD_MS);
			return;
		}

		// The WIN readout follows the win screen's count-up (WinReadoutSync), then holds the amount.
		stateGame.winCountUp = 0;
		setChefMood(chefMoodForWin(winLevelData));
		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		stateGame.roundWin = bookEvent.amount;
		stateGame.winCountUp = null;
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
		await hold(inFreeGames() ? LOCK_SETTLE_MS : 250);
	},
	lockRespinUpdate: async (bookEvent: BookEventOfType<'lockRespinUpdate'>) => {
		const positions = [...stateGame.lockedPositions, ...bookEvent.newLockedPositions];
		stateGame.lockedPositions = _.uniqBy(positions, ({ reel, row }) => `${reel}:${row}`);
		stateGame.collectedScatters = bookEvent.collectedScatters;
		stateGame.globalMultiplier = bookEvent.globalMult;
		const newLocks = bookEvent.newLockedPositions.length > 0;
		if (newLocks) eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_lock_grow', forcePlay: true });
		if (newLocks && inFreeGames()) await hold(LOCK_SETTLE_MS);
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
		await hold(inFreeGames() ? LOCK_END_HOLD_MS : 250);
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
		// a beat on the board first: the last scatter has just landed, let it be seen before the wheel
		// screen takes over
		await waitForTimeout(WHEEL_ENTRY_DELAY_MS);
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
		// Into the bonus board: the CONGRATS card (FreeSpinIntroHtml, Figma 8808:12044) announces the
		// spins won; the wheel is taken away under its backdrop, and the press (or autoplay's timer)
		// reveals the board. Every bonus comes through the wheel — natural and bought alike — so this is
		// where players actually see the card. (It replaced the ketchup wipe, SauceWipeHtml, 2026-10-06.)
		eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
		const pressed = eventEmitter.broadcastAsync({
			type: 'freeSpinIntroUpdate',
			totalFreeSpins: bookEvent.freeSpins,
			steps: bookEvent.addedSteps, // the card's soups: the multiplier steps won, not the spins
		});
		await waitForTimeout(400); // the card is up over the wheel
		stateGame.wheel = undefined;
		// (and the wheel's fade-out has finished under it before the card leaves)
		await Promise.all([pressed, waitForTimeout(WHEEL_FADE_OUT_MS)]);
		eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		await waitForTimeout(120);
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

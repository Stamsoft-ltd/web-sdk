import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';
import type { ClusterSeriesSnapshot, Position } from './types';
import { logMagneticDiagnostic } from '../utils/magneticDiagnostics';

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.sound?.sfx)
		eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	if (winLevelData?.sound?.bgm)
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	if (winLevelData?.type === 'big')
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_bigwin_coinloop' });
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bigwin_coinloop' });
	// gameType is the truth here — activeBetModeKey can still be SUPER right after a bought
	// bonus ended, which used to restart the bonus music instead of the base track.
	if (stateGame.gameType !== 'basegame') {
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

const positionKey = (position: Position) => `${position.reel}:${position.row}`;

const getVisibleWinPositions = (bookEvent: BookEventOfType<'winInfo'>) => {
	const activeSeriesIds = new Set(stateGame.activeSeries.map((entry) => entry.id));
	const activeLockedPositions = new Set(
		stateGame.activeSeries.flatMap((entry) => entry.lockedPositions.map(positionKey)),
	);
	const wins = activeSeriesIds.size
		? bookEvent.wins.filter((win) => activeSeriesIds.has(win.seriesId))
		: bookEvent.wins;
	const positions = _.uniqBy(
		wins.flatMap((win) => win.positions),
		positionKey,
	);

	if (!activeLockedPositions.size) return positions;
	return positions.filter((position) => activeLockedPositions.has(positionKey(position)));
};

const didSeriesGrow = (previous: ClusterSeriesSnapshot[], next: ClusterSeriesSnapshot[]) => {
	if (previous.length !== next.length) return true;
	const previousSizes = new Map(previous.map((entry) => [entry.id, entry.lockedPositions.length]));
	return next.some((entry) => previousSizes.get(entry.id) !== entry.lockedPositions.length);
};

const isFinalSuperWinInfo = (bookEvent: BookEvent, bookEvents: BookEvent[]) => {
	const currentIndex = bookEvents.findIndex((event) => event.index === bookEvent.index);
	if (currentIndex < 0) return false;
	for (const event of bookEvents.slice(currentIndex + 1)) {
		if (event.type === 'freeSpinEnd') return true;
		if (event.type === 'updateFreeSpin' || event.type === 'finalWin') return false;
	}
	return false;
};

const shouldSkipNoGrowthNormalSuperRespin = (bookEvent: BookEvent, bookEvents: BookEvent[]) => {
	const currentIndex = bookEvents.findIndex((event) => event.index === bookEvent.index);
	if (currentIndex < 0) return false;

	const previousRevealIndex = (() => {
		for (let i = currentIndex - 1; i >= 0; i -= 1) {
			if (bookEvents[i].type === 'reveal') return i;
		}
		return -1;
	})();
	if (previousRevealIndex < 0) return false;

	// Only the first respin after a normal free-spin reveal may be suppressed. Later respins
	// must still show, even if they fail to add new symbols.
	let previousRevealWasNormalSpin = false;
	for (let i = previousRevealIndex - 1; i >= 0; i -= 1) {
		if (bookEvents[i].type === 'reveal') break;
		if (bookEvents[i].type === 'updateFreeSpin') {
			previousRevealWasNormalSpin = true;
			break;
		}
	}
	if (!previousRevealWasNormalSpin) return false;

	const carry = (() => {
		for (let i = previousRevealIndex - 1; i >= 0; i -= 1) {
			const event = bookEvents[i];
			if (event.type === 'superSeriesCarry') return event.series;
			if (event.type === 'updateFreeSpin' || event.type === 'reveal') return [];
		}
		return [];
	})();

	const normalUpdate = (() => {
		for (let i = previousRevealIndex + 1; i < currentIndex; i += 1) {
			const event = bookEvents[i];
			if (event.type === 'clusterSeriesUpdate') return event.series;
			if (
				event.type === 'reveal' ||
				event.type === 'updateFreeSpin' ||
				event.type === 'freeSpinEnd'
			)
				return null;
		}
		return null;
	})();

	return !!normalUpdate && !didSeriesGrow(carry, normalUpdate);
};

const getBonusModeFromScatters = (positions: Position[]) =>
	positions.length >= 4 ? 'superspin' : 'freegame';

let pendingMagnetActivationPositions: Position[] = [];

const nextBookEventAfter = (bookEvent: BookEvent, bookEvents: BookEvent[]) => {
	const currentIndex = bookEvents.findIndex((event) => event.index === bookEvent.index);
	return currentIndex < 0 ? null : bookEvents[currentIndex + 1];
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		const revealMode = stateGame.nextRevealMode;
		// Clear the RESPIN indicator on normal reveals only — during a chain of consecutive
		// cluster respins it stays lit steadily instead of blinking at each reveal boundary.
		if (revealMode !== 'respin') stateGame.respinIndicator = false;
		if (isBonusGame) eventEmitter.broadcast({ type: 'stopButtonEnable' });
		if (isBonusGame) recordBookEvent({ bookEvent });

		if (bookEvent.gameType === 'basegame' && revealMode !== 'respin') {
			// Only reset on a fresh basegame spin — NOT on cluster respins where
			// we need activeSeries (locked positions) and nextRevealMode='respin' intact.
			stateGameDerived.resetBonusState();
		} else if (bookEvent.gameType !== 'basegame' && !stateBet.isSuperTurbo) {
			await waitForTimeout(220);
		}
		if (revealMode === 'respin' && !stateBet.isSuperTurbo) {
			// Bonus respins get a longer pause so the player can appreciate the growing cluster.
			const isBonus = bookEvent.gameType !== 'basegame';
			await waitForTimeout(stateBet.isTurbo ? 160 : isBonus ? 480 : 300);
		}

		// A new reveal always ends any lingering win presentation on the board (bonus spins
		// present wins via winInfo with no setWin, so nothing else clears them).
		stateGameDerived.clearWinCellStates();

		const hadPendingStop = stateGame.pendingStop && stateGame.awaitingFirstReveal;
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;
		stateGame.tempMultiplier = null;
		pendingMagnetActivationPositions = [];

		// Super bonus: if the normal spin did not grow the persistent cluster, old books may still
		// contain a respin reveal. Ignore it so the board does not flash/re-spin with no cluster add.
		if (stateGame.bonusMode === 'superspin' && revealMode === 'respin') {
			if (shouldSkipNoGrowthNormalSuperRespin(bookEvent, bookEvents)) {
				stateGameDerived.markNextRevealAsSpin();
				eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
				return;
			}
		}

		// RESPIN indicator: this reveal is a free re-spin awarded by cluster growth (the player
		// effectively gains an extra spin) — base game and bonus alike.
		stateGame.respinIndicator = revealMode === 'respin' && stateGame.activeSeries.length > 0;

		const revealPromise = stateGameDerived.applyReveal({
			rawBoard: bookEvent.board,
			gameType: bookEvent.gameType,
		});
		if (hadPendingStop) stateGameDerived.speedUpMotion();
		await revealPromise;
		const nextEvent = nextBookEventAfter(bookEvent, bookEvents);
		if (nextEvent?.type !== 'magnetActivated' && nextEvent?.type !== 'clusterSeriesUpdate') {
			stateGame.forceFastAnimations = false;
		}
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });
	},
	magnetActivated: async (
		bookEvent: BookEventOfType<'magnetActivated'>,
		{ bookEvents }: BookEventContext,
	) => {
		pendingMagnetActivationPositions = bookEvent.positions;
		stateGame.selectedBonusSymbol = bookEvent.symbol;
		stateGame.magnetTargetSymbol = bookEvent.symbol;
		stateGame.globalMultiplier = bookEvent.totalMultiplier;
		stateGame.seriesTotalMultiplier = bookEvent.totalMultiplier;
		stateGame.tempMultiplier = bookEvent.multiplier > 1 ? bookEvent.multiplier : null;
		if (bookEvent.multiplier > 1)
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_landing' });
		await stateGameDerived.activateMagnetPulse(bookEvent.positions);
		if (nextBookEventAfter(bookEvent, bookEvents)?.type !== 'clusterSeriesUpdate') {
			stateGame.forceFastAnimations = false;
			pendingMagnetActivationPositions = [];
		}
		if (bookEvent.persistent) {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			eventEmitter.broadcast({
				type: 'globalMultiplierUpdate',
				multiplier: bookEvent.totalMultiplier,
			});
		}
	},
	clusterSeriesUpdate: async (bookEvent: BookEventOfType<'clusterSeriesUpdate'>) => {
		const activatedPositions = pendingMagnetActivationPositions;
		pendingMagnetActivationPositions = [];
		// Fly pulled symbols to their exact final cluster positions.
		await stateGameDerived.animateClusterFormation({
			series: bookEvent.series,
			magnetTargetSymbol: bookEvent.magnetTargetSymbol,
			activatedPositions,
		});
		stateGameDerived.setSeriesSnapshots({
			series: bookEvent.series,
			magnetTargetSymbol: bookEvent.magnetTargetSymbol,
			totalMultiplier: bookEvent.totalMultiplier,
		});
		if (stateGame.bonusMode === 'superspin') {
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
			eventEmitter.broadcast({
				type: 'globalMultiplierUpdate',
				multiplier: bookEvent.totalMultiplier,
			});
		}
	},
	clusterSeriesResolved: async () => {
		// marker event for replay readability; no extra UI step in proto build.
	},
	superSeriesCarry: async (bookEvent: BookEventOfType<'superSeriesCarry'>) => {
		stateGameDerived.setSeriesSnapshots({
			series: bookEvent.series,
			magnetTargetSymbol: bookEvent.magnetTargetSymbol,
			totalMultiplier: bookEvent.totalMultiplier,
		});
		eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		eventEmitter.broadcast({
			type: 'globalMultiplierUpdate',
			multiplier: bookEvent.totalMultiplier,
		});
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>, { bookEvents }: BookEventContext) => {
		const isSuperFinal =
			stateGame.bonusMode === 'superspin' && isFinalSuperWinInfo(bookEvent, bookEvents);
		// Super bonus pays at outro; per-spin winInfo badges/anim cause green number overlays and
		// whole-board flash on no-growth spins. Keep only the final cluster win-state pass.
		if (stateGame.bonusMode === 'superspin' && !isSuperFinal) return;
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_winlevel_small' });
		const positions = getVisibleWinPositions(bookEvent);
		if (positions.length) await animateSymbols({ positions });
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		const isFeatureSpin = bookEvent.totalFs === 1;
		const bonusMode = isFeatureSpin ? 'feature' : getBonusModeFromScatters(bookEvent.positions);
		if (!isFeatureSpin && stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}
		if (!isFeatureSpin) {
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_win_v2' });
			await animateSymbols({ positions: bookEvent.positions });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_superfreespin' });
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
			await eventEmitter.broadcastAsync({ type: 'transition' });
			stateGameDerived.clearWinCellStates();
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'jng_intro_fs' });
			eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: bookEvent.totalFs,
			});
		}
		stateGame.gameType = bonusMode;
		stateGame.bonusMode = bonusMode;
		if (!isFeatureSpin) eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		if (!isFeatureSpin) {
			eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
			stateUi.freeSpinCounterShow = true;
			eventEmitter.broadcast({
				type: 'freeSpinCounterUpdate',
				current: undefined,
				total: bookEvent.totalFs,
			});
			stateUi.freeSpinCounterTotal = bookEvent.totalFs;
		}
		if (bonusMode === 'superspin') eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		if (!isFeatureSpin) {
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
			await eventEmitter.broadcastAsync({ type: 'drawerButtonShow' });
			eventEmitter.broadcast({ type: 'drawerFold' });
		}
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		if (stateGame.bonusMode === 'freegame') stateGameDerived.clearSeriesState();
		stateGameDerived.markNextRevealAsSpin();
		if (stateGame.bonusMode === 'feature') {
			stateUi.freeSpinCounterShow = false;
			eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
			return;
		}
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
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		eventEmitter.broadcast({ type: 'winShow' });
		winLevelSoundsPlay({ winLevelData });
		await eventEmitter.broadcastAsync({
			type: 'winUpdate',
			amount: bookEvent.amount,
			winLevelData,
		});
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
		// Win presentation over — stop the looping win flipbooks on the board.
		stateGameDerived.clearWinCellStates();
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		const isFeatureSpin = stateGame.bonusMode === 'feature';
		stateGame.gameType = isFeatureSpin ? 'feature' : 'basegame';
		eventEmitter.broadcast({ type: 'globalMultiplierHide' });
		if (isFeatureSpin) {
			stateUi.freeSpinCounterShow = false;
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
		} else {
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
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
			// The win screen has ended — drop the bonus immediately so the magnetic capsule column and
			// bonus background disappear now (returning to the default game) instead of lingering until
			// the next base spin. The wipe below then reveals the base game.
			stateGameDerived.resetBonusState();
			await eventEmitter.broadcastAsync({ type: 'transition' });
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
			await eventEmitter.broadcastAsync({ type: 'drawerUnfold' });
			eventEmitter.broadcast({ type: 'drawerButtonHide' });
		}
	},
	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		logMagneticDiagnostic('info', 'round_finalized', {
			amount: bookEvent.amount,
			bonusMode: stateGame.bonusMode,
			magnetTarget: stateGame.magnetTargetSymbol,
		});
		// Round is fully over — unlock the stacked cluster and drop all win/lock decorations so
		// the board returns to its normal resting state instead of staying stacked until the
		// next spin.
		stateGameDerived.clearWinCellStates();
		stateGameDerived.clearSeriesState();
	},
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;
		for (const event of bookEvents) {
			await playBookEvent(event, { bookEvents });
		}
	},
};

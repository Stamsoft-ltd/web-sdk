import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { waitForTimeout } from 'utils-shared/wait';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';
import type { ClusterSeriesSnapshot, Position } from './types';
import { capBookWinAmount, getSeriesPreviewAmount } from './bonusWin';
import { logMagneticDiagnostic } from '../utils/magneticDiagnostics';

// An out-of-range server winLevel must not yield undefined winLevelData — Win.svelte only
// wires its winUpdate oncomplete when winLevelData is set, so undefined hangs the awaited
// broadcastAsync and strands the machine. Fall back to the standard small-win level.
const getWinLevelData = (winLevel: number): WinLevelData =>
	winLevelMap[winLevel as WinLevel] ?? winLevelMap[2];

// Each bonus has its own theme: Drop-O-Magnet (freegame, 3 scatters / bought BONUS) runs
// music_bonus, Magnetic Mega Chain (superspin, 4+ scatters / bought SUPER) runs music_super.
// music_super had a player branch and files on disk but was never broadcast, so Mega Chain used
// to play the Drop-O-Magnet theme.
const bonusMusicFor = (mode: string | null) =>
	mode === 'superspin' ? 'music_super' : 'music_bonus';

// How long the bonus hand-off waits before swapping the scene in, in ms. Matches the veil's dim
// ramp (BonusHandoffVeil's IN_MS): the swap has to land after the dim is fully up, or it happens
// in view.
const BONUS_HANDOFF_DIM_MS = 1500;

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	// Big-win boards (and the bonus congratulations panel, which routes through here too) own the
	// mix: pause the ambience so the tier bed + count-up are not competing with it, and let
	// winLevelSoundsStop's `soundMusic` broadcast resume it afterwards. Deliberately NOT done for
	// levels 2-5 — those roll up in ~1-3s on ordinary spins, and ducking the bed that often would
	// leave the soundtrack stuttering in and out for most of the session.
	if (winLevelData?.type === 'big') eventEmitter.broadcast({ type: 'soundMusicDuck' });
	if (winLevelData?.sound?.sfx)
		eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	if (winLevelData?.sound?.bgm)
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	// Two LAYERS, on different clocks:
	//   sfxLoop  - the tier's own bed, stopped by winLevelSoundsStop, so it holds for as long as
	//              the board is on screen.
	//   countup  - the ticking under the rolling number, cut by Win.svelte the moment the counter
	//              settles, so it stops while the board stays up.
	// These were mutually exclusive until the count-up got its own dedicated cue; layering two
	// generic beds muddied the mix, but a bed plus a counter reads as intended.
	if (winLevelData?.sound?.sfxLoop)
		eventEmitter.broadcast({ type: 'soundLoop', name: winLevelData.sound.sfxLoop });
	// EVERY win that rolls a number, not just the big-win boards. Gated on `type === 'big'` this
	// left levels 2-5 — the overwhelming majority of wins — counting up in total silence, since
	// those tiers carry no sfx/sfxLoop/bgm of their own either. presentDuration is the honest test:
	// it IS the roll-up duration, and level 1 ('zero') is the only tier without one.
	if ((winLevelData?.presentDuration ?? 0) > 0)
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_win_countup_loop' });
};

// Stopping is unconditional across every declared bed rather than threaded from the win level:
// the presentation can end down several paths, and stopping an idle sound is a no-op.
const WIN_LEVEL_BEDS = [
	...new Set(
		Object.values(winLevelMap)
			.map((level) => level.sound.sfxLoop)
			.filter((name) => !!name),
	),
];

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_countup_loop' });
	for (const name of WIN_LEVEL_BEDS) eventEmitter.broadcast({ type: 'soundStop', name });
	// gameType is the truth here — activeBetModeKey can still be SUPER right after a bought
	// bonus ended, which used to restart the bonus music instead of the base track.
	// FEATURE rounds never start the free-spin music, so only real bonuses count.
	if (stateGame.gameType === 'freegame' || stateGame.gameType === 'superspin') {
		eventEmitter.broadcast({ type: 'soundMusic', name: bonusMusicFor(stateGame.gameType) });
	} else {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'music_base' });
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
			// A carry with no cluster arrives as series: null — same as "no carry".
			if (event.type === 'superSeriesCarry') return event.series ?? [];
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
let bonusCarryWinAmount = 0;
let presentedBonusWinAmount = 0;
let superSeriesPreviewAmount = 0;

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
		// The magnet engaging and starting to draw symbols in. A multiplier, when there is one,
		// layers on top rather than replacing it — previously this moment was SILENT unless a
		// multiplier happened to be attached.
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_magnet_pull' });
		if (bookEvent.multiplier > 1)
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_hit' });
		await stateGameDerived.activateMagnetPulse(bookEvent.positions);
		if (nextBookEventAfter(bookEvent, bookEvents)?.type !== 'clusterSeriesUpdate') {
			stateGame.forceFastAnimations = false;
			pendingMagnetActivationPositions = [];
		}
	},
	magnetTargetSelected: async (bookEvent: BookEventOfType<'magnetTargetSelected'>) => {
		// The production math emits this before magnetActivated, including sub-threshold pulls that
		// never activate. Populate the capsule immediately and consume the event instead of logging a
		// missing-handler error.
		stateGame.selectedBonusSymbol = bookEvent.symbol;
		stateGame.magnetTargetSymbol = bookEvent.symbol;
	},
	clusterSeriesUpdate: async (bookEvent: BookEventOfType<'clusterSeriesUpdate'>) => {
		const activatedPositions = pendingMagnetActivationPositions;
		pendingMagnetActivationPositions = [];
		// Only when the chain actually GAINS cells. clusterSeriesUpdate also fires on no-growth
		// respins (see shouldSkipNoGrowthNormalSuperRespin), and firing there would sound a growth
		// cue over a board that did not change.
		if (didSeriesGrow(stateGame.activeSeries, bookEvent.series))
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_chain_grow' });
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

		// clusterSeriesResolved/winInfo arrive only after the whole respin chain. Preview the
		// currently locked cluster after every growth step so WIN/TOTAL WIN advances between
		// respins instead of remaining frozen until the next normal spin.
		const previewAmount = getSeriesPreviewAmount(bookEvent.series);
		if (stateGame.bonusMode === 'superspin') {
			superSeriesPreviewAmount = previewAmount;
			presentedBonusWinAmount = Math.max(
				presentedBonusWinAmount,
				capBookWinAmount(bonusCarryWinAmount + previewAmount),
			);
			stateBet.winBookEventAmount = presentedBonusWinAmount;
		} else if (stateGame.bonusMode === 'freegame' || stateGame.bonusMode === 'feature') {
			// Keep the settled total untouched. Each update replaces the active spin preview;
			// growing snapshots must not be added repeatedly.
			stateBet.winBookEventAmount = capBookWinAmount(presentedBonusWinAmount + previewAmount);
		} else {
			stateBet.winBookEventAmount = previewAmount;
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
		superSeriesPreviewAmount = getSeriesPreviewAmount(bookEvent.series);
		presentedBonusWinAmount = Math.max(
			presentedBonusWinAmount,
			capBookWinAmount(bonusCarryWinAmount + superSeriesPreviewAmount),
		);
		stateBet.winBookEventAmount = presentedBonusWinAmount;
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>, { bookEvents }: BookEventContext) => {
		const isSuperFinal =
			stateGame.bonusMode === 'superspin' && isFinalSuperWinInfo(bookEvent, bookEvents);
		// Super bonus pays at outro; per-spin winInfo badges/anim cause green number overlays and
		// whole-board flash on no-growth spins. Keep only the final cluster win-state pass.
		if (stateGame.bonusMode === 'superspin' && !isSuperFinal) return;
		if (stateGame.bonusMode === 'freegame' || stateGame.bonusMode === 'feature') {
			presentedBonusWinAmount = capBookWinAmount(presentedBonusWinAmount + bookEvent.totalWin);
			stateBet.winBookEventAmount = presentedBonusWinAmount;
		}
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_cluster_win' });
		// Per-symbol celebration runs CONCURRENTLY with the win amount — fired, not awaited, so
		// the win screen still comes up immediately. (The old AWAITED flipbook pass held the total
		// back ~1.2s, which is why it was removed; the procedural <SymbolWinFx> choreography this
		// triggers persists until the next reveal's clearWinCellStates.)
		eventEmitter.broadcast({ type: 'boardShow' });
		void stateGameDerived.animateWinningPositions(bookEvent.wins.flatMap((win) => win.positions));
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		const authoritativeAmount =
			stateGame.bonusMode === 'superspin'
				? Math.max(bookEvent.amount, bonusCarryWinAmount + superSeriesPreviewAmount)
				: bookEvent.amount;
		presentedBonusWinAmount = authoritativeAmount;
		stateBet.winBookEventAmount = authoritativeAmount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		const isFeatureSpin = bookEvent.totalFs === 1;
		const bonusMode = isFeatureSpin ? 'feature' : getBonusModeFromScatters(bookEvent.positions);
		bonusCarryWinAmount = stateBet.winBookEventAmount;
		presentedBonusWinAmount = bonusCarryWinAmount;
		superSeriesPreviewAmount = 0;
		if (!isFeatureSpin && stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}
		if (!isFeatureSpin) {
			// Speed is a player preference, not round state. Keep turbo/super-turbo unchanged when
			// entering the bonus; resetting it here made a super-turbo trigger continue at normal speed.
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_scatter_trigger' });
			await animateSymbols({ positions: bookEvent.positions });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_transition' });
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
			// The veil's dim IS the transition into the bonus. No spine wipe here any more: it played
			// OVER the veil, so its bright frames read as a flash of the undimmed base game, and it
			// ended before the congratulations arrived — which is the gap the veil exists to close.
			// The veil stays up until the congratulations is dismissed.
			stateGame.bonusHandoffActive = true;
			await waitForTimeout(BONUS_HANDOFF_DIM_MS);
			// Dim is fully up, so none of this can be seen changing.
			stateGameDerived.clearWinCellStates();
			// Set the mode before the intro mounts its content — it reads bonusMode to
			// pick the bonus title (DROP-O-MAGNET vs MAGNETIC MEGA CHAIN).
			stateGame.gameType = bonusMode;
			stateGame.bonusMode = bonusMode;
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_intro' });
			eventEmitter.broadcast({ type: 'soundMusic', name: bonusMusicFor(bonusMode) });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinIntroUpdate',
				totalFreeSpins: bookEvent.totalFs,
			});
		} else {
			stateGame.gameType = bonusMode;
			stateGame.bonusMode = bonusMode;
		}
		if (!isFeatureSpin) eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		// The bonus is fully in place behind the veil by now; dropping it here is what reveals it.
		if (!isFeatureSpin) stateGame.bonusHandoffActive = false;
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
		const winLevelData = getWinLevelData(bookEvent.winLevel);
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
		const winLevelData = getWinLevelData(bookEvent.winLevel);
		const isFeatureSpin = stateGame.bonusMode === 'feature';
		// The bonus/feature is over — back to basegame so the HUD re-enables Buy Bonus
		// while idle and win music resolves to the base track.
		stateGame.gameType = 'basegame';
		if (isFeatureSpin) {
			stateGame.bonusMode = null;
			stateUi.freeSpinCounterShow = false;
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
		} else {
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			// The congratulations panel belongs to sfx_bonus_outro (MAG_BIG_WIN) alone. This used to
			// call winLevelSoundsPlay() as well, which layered the win-level BED and the count-up
			// loop straight over it — a 15s sting buried under two loops, so the congrats was never
			// heard. Its own count is only 400ms here (the roll-up already happened on the win
			// board), so there is nothing for a count-up loop to track either. Duck the ambience so
			// the sting sits alone; winLevelSoundsStop() below restores it.
			eventEmitter.broadcast({ type: 'soundMusicDuck' });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_outro' });
			await eventEmitter.broadcastAsync({
				type: 'freeSpinOutroCountUp',
				amount: bookEvent.amount,
				winLevelData,
			});
			// Panel dismissed: cut the sting (it runs 15s, far longer than the panel) before the
			// ambience comes back, so the hand-off is clean instead of overlapping.
			eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bonus_outro' });
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
		stateBet.winBookEventAmount = bookEvent.amount;
		bonusCarryWinAmount = 0;
		presentedBonusWinAmount = bookEvent.amount;
		superSeriesPreviewAmount = 0;
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

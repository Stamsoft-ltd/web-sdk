import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet, stateUi } from 'state-shared';
import { sequence } from 'utils-shared/sequence';
import { waitForTimeout } from 'utils-shared/wait';
import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

import { eventEmitter } from './eventEmitter';
import { playBookEvent } from './utils';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import type { SoundEffectName } from './sound';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';
import config from './config';
import { logForestDiagnostic } from '../utils/forestDiagnostics';

const winLevelSoundsPlay = ({
	winLevelData,
	sfxOverride,
	winBgm = true,
}: {
	winLevelData: WinLevelData;
	sfxOverride?: SoundEffectName;
	// Whether to play the looping win-celebration music. Off for the bonus-end congratulations screen.
	winBgm?: boolean;
}) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	const sfx = sfxOverride ?? winLevelData?.sound?.sfx;
	if (sfx) eventEmitter.broadcast({ type: 'soundOnce', name: sfx });
	if (winLevelData?.type === 'big') {
		// Win celebration: looping background music (bgm_win_animation) UNDER the coin-counting loop and
		// the win stings — all three layer (music / loop / once players are independent). The music is
		// stopped when the win ends and the base/bonus track resumes (see winLevelSoundsStop / freeSpinEnd).
		if (winBgm) eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_win_animation' });
		// Layer the coins loop ON TOP of the payline-win jingle so both the win animation sound and the
		// coin-counting sound play together. Both are stopped when the count-up completes (Win.svelte).
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_win_coins_loop' });
	}
};

// Bonus background track: All In (superspin) has its own loop; Deal It / feature use the free-spin loop.
const bonusBgm = () => (stateGame.bonusMode === 'superspin' ? 'bgm_allin_bonus' : 'bgm_dealit_bonus');

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_coins_loop' });
	if (stateBet.activeBetModeKey === 'SUPER' || stateGame.gameType !== 'basegame') {
		eventEmitter.broadcast({ type: 'soundMusic', name: bonusBgm() });
	} else {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_base_game' });
	}
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({ type: 'boardWithAnimateSymbols', symbolPositions: positions });
};

const getBonusModeFromScatters = (positions: Position[]) => (positions.length >= 4 ? 'superspin' : 'freegame');

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		// A new spin begins — stop the previous win's payline loop if it's still playing.
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_payline_win' });
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		const hasAnticipation = bookEvent.anticipation?.some(Boolean);
		if (isBonusGame || hasAnticipation) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
		}
		if (isBonusGame) {
			recordBookEvent({ bookEvent });
		}

		stateGame.gameType = bookEvent.gameType;
		stateGame.tempMultiplier = null;
		if (bookEvent.gameType === 'basegame') {
			stateGameDerived.resetBonusState();
		}

		// Clear expanded overlay BEFORE spin starts so it doesn't persist into the next round
		if (stateGame.expandedSymbol && bookEvent.gameType !== 'basegame') {
			stateGame.expandedSymbol = { ...stateGame.expandedSymbol, reels: [] };
		}
		stateGame.expandedSymbolWon = false;
		stateGame.paylineWins = [];
		stateGame.paylineSnap = false;
		stateGame.hasAnticipationPending = !!hasAnticipation;
		stateGame.anticipationSkipped = false;

		// Add a brief pause between bonus spins so players can read the result
		if (isBonusGame && bookEvent.gameType !== 'basegame' && !stateBet.isSuperTurbo) {
			await waitForTimeout(600);
		}

		const hadPendingStop = stateGame.pendingStop && stateGame.awaitingFirstReveal;
		// Close the buffer window — only works for the first reveal of the round
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;

		const spinPromise = stateGameDerived.enhancedBoard.spin({
			revealEvent: bookEvent,
			paddingBoard: config.paddingReels[bookEvent.gameType],
		});
		// Apply buffered stop immediately after spin starts
		if (hadPendingStop) stateGameDerived.enhancedBoard.stop();
		await spinPromise;
		stateGame.hasAnticipationPending = false;
		eventEmitter.broadcast({ type: 'soundScatterCounterClear' });

		if (stateGame.bonusMode === 'superspin' && bookEvent.gameType !== 'basegame') {
			logForestDiagnostic('info', 'all_in_spin_complete', {
				gameType: bookEvent.gameType,
				totalWin: stateBet.winBookEventAmount,
				globalMultiplier: stateGame.globalMultiplier,
				freeSpinCurrent: stateUi.freeSpinCounterCurrent,
				freeSpinTotal: stateUi.freeSpinCounterTotal,
			});
			console.info('[forest-gang] ALL IN global multiplier after spin', stateGame.globalMultiplier);
		}
	},
	bonusSymbolSelected: async (bookEvent: BookEventOfType<'bonusSymbolSelected'>, { bookEvents }: BookEventContext) => {
		// The deer must reveal the symbol that ACTUALLY expands on the reels. In some modes
		// (e.g. feature spins) the book's bonusSymbolSelected.symbol can differ from the reel's
		// expandedSymbolReveal.symbol, so use the reveal symbol. Prefer the next reveal after this
		// event, but fall back to any reveal in the round if the ordering differs (feature spins can
		// have the reveal before the selection) — otherwise the deer showed the wrong symbol.
		const reveal = (bookEvents.find(
			(e) => e.type === 'expandedSymbolReveal' && e.index > bookEvent.index,
		) ?? bookEvents.find((e) => e.type === 'expandedSymbolReveal')) as
			| BookEventOfType<'expandedSymbolReveal'>
			| undefined;
		const symbol = reveal?.symbol ?? bookEvent.symbol;
		stateGame.selectedBonusSymbol = symbol;
		stateGame.bonusMode = bookEvent.mode;
		if (stateBet.isSuperTurbo) return;
		// Deer presenter reveals the chosen expanding symbol at the start of the round. The reveal
		// sound loops for as long as the deer is on screen, then stops when it hides.
		eventEmitter.broadcast({ type: 'expandedPresenterShow', symbol });
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_deer_reveal' });
		await eventEmitter.broadcastAsync({ type: 'bonusSymbolRollAwait' });
		// Hold the presenter on screen — resolves after ~1.1s, or immediately if the player skips
		// (space / tap, broadcast as stopButtonClick).
		await eventEmitter.broadcastAsync({ type: 'expandedPresenterAwaitClose' });
		eventEmitter.broadcast({ type: 'expandedPresenterHide' });
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_deer_reveal' });
	},
	expandedSymbolReveal: async (bookEvent: BookEventOfType<'expandedSymbolReveal'>) => {
		// Clear any win states from the previous spin before expanding starts
		for (const reel of stateGame.board) {
			for (const sym of reel.reelState.symbols) {
				if (sym.symbolState === 'win' || sym.symbolState === 'postWinStatic') {
					sym.symbolState = 'static';
				}
			}
		}
		stateGame.expandedSymbol = { symbol: bookEvent.symbol, reels: [], positions: bookEvent.positions };

		// Find origin reel: leftmost reel that had the symbol in the original positions
		const originReel = bookEvent.positions.length > 0
			? Math.min(...bookEvent.positions.map((p) => p.reel))
			: bookEvent.reels[0] ?? 0;

		// Sort winning reels by distance from origin so they expand outward
		const reelsByDistance = [...bookEvent.reels].sort((a, b) => {
			const dA = Math.abs(a - originReel);
			const dB = Math.abs(b - originReel);
			return dA !== dB ? dA - dB : a - b;
		});

		// Reveal one by one in distance order (origin first, then outward) — slower for drama.
		for (let i = 0; i < reelsByDistance.length; i++) {
			if (i > 0) await waitForTimeout(190);
			// forcePlay so every expanding column retriggers the sound (the effect is longer than the
			// 190ms step, so without it the once-player would only sound on the first column).
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_symbol_expand', forcePlay: true });
			const reel = reelsByDistance[i];
			stateGame.expandedSymbol = {
				...stateGame.expandedSymbol!,
				reels: [...stateGame.expandedSymbol!.reels, reel],
			};
		}
		// Hold on the fully-expanded board before the win/multiplier sequence begins.
		await waitForTimeout(650);
	},
	applyTempMultiplier: async (bookEvent: BookEventOfType<'applyTempMultiplier'>) => {
		stateGame.tempMultiplier = bookEvent.multiplier;
		// Update the landing target — cycling already running, will land here instead of 1x
		eventEmitter.broadcast({ type: 'dealItMultiplierSetTarget', multiplier: bookEvent.multiplier });
	},
	retriggerFreeSpins: async (bookEvent: BookEventOfType<'retriggerFreeSpins'>) => {
		eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_trigger' });
		await animateSymbols({ positions: bookEvent.positions });
		const newTotal = stateUi.freeSpinCounterTotal + bookEvent.amount;
		stateUi.freeSpinCounterTotal = newTotal;
		eventEmitter.broadcast({
			type: 'freeSpinCounterUpdate',
			current: stateUi.freeSpinCounterCurrent,
			total: newTotal,
		});
	},
	updateGlobalMultiplier: async (bookEvent: BookEventOfType<'updateGlobalMultiplier'>) => {
		stateGame.globalMultiplier = bookEvent.multiplier;
		eventEmitter.broadcast({ type: 'globalMultiplierUpdate', multiplier: bookEvent.multiplier });
		console.info('[forest-gang] ALL IN global multiplier update', bookEvent.multiplier);
	},
	winInfo: async (bookEvent: BookEventOfType<'winInfo'>) => {
		// Loop the payline-win jingle for the whole win sequence; stopped after the animation below.
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_payline_win' });
		// Start Deal It multiplier cycling for every winning bonus spin — always spins, lands on 1x unless multiplier fires
		if ((stateGame.bonusMode === 'freegame' || stateGame.bonusMode === 'feature')) {
			eventEmitter.broadcast({ type: 'dealItMultiplierStart' });
		}
		// Only filter to expanded symbol wins when the overlay is actually showing (reels.length > 0)
		// A cleared expandedSymbol {reels:[]} means a non-expanding spin — show all payline wins normally
		const isExpandedOverlayShowing = (stateGame.expandedSymbol?.reels.length ?? 0) > 0;
		const wins = isExpandedOverlayShowing
			? bookEvent.wins.filter((w) => w.symbol === stateGame.expandedSymbol!.symbol)
			: bookEvent.wins;
		// Store full 5-reel payline paths for vine animation using lineIndex lookup
		const paylines = config.paylines as Record<string, number[]>;
		if (isExpandedOverlayShowing && wins.length > 0) {
			// Expanding symbol wins all 20 paylines — show all
			stateGame.paylineWins = Object.entries(paylines).map(([key, rows]) => ({
				lineIndex: Number(key),
				path: rows.map((row, reel) => ({ reel, row })),
			}));
		} else {
			stateGame.paylineWins = wins
				.map((w) => {
					const rows = paylines[String(w.meta.lineIndex)];
					if (!rows) return null;
					return { lineIndex: w.meta.lineIndex, path: rows.map((row, reel) => ({ reel, row })) };
				})
				.filter((p): p is { lineIndex: number; path: Array<{ reel: number; row: number }> } => p !== null);
		}
		// Deduplicate positions across all wins and animate once — prevents 5-10s freeze
		const seen = new Set<string>();
		const allPositions = wins.flatMap((win) => win.positions).filter((pos) => {
			const key = `${pos.reel},${pos.row}`;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
		await animateSymbols({ positions: allPositions });
		// NOTE: the loop is NOT stopped here — boardWithAnimateSymbols returns instantly (the win pulse
		// isn't awaited), so stopping now cuts the sound before it's audible. It's stopped when the next
		// spin starts (reveal), when a big-win screen takes over (winLevelSoundsPlay), or at round end.
	},
	setTotalWin: async (bookEvent: BookEventOfType<'setTotalWin'>) => {
		stateBet.winBookEventAmount = bookEvent.amount;
	},
	freeSpinTrigger: async (bookEvent: BookEventOfType<'freeSpinTrigger'>) => {
		const isFeatureSpin = bookEvent.totalFs === 1;
		const bonusMode = isFeatureSpin ? 'feature' : getBonusModeFromScatters(bookEvent.positions);
		// Stop on Bonus: stop autoplay when a multi-spin bonus triggers (Deal It / All In)
		if (!isFeatureSpin && stateGame.stopAutoOnBonus && stateBet.autoSpinsCounter > 0) {
			stateBet.autoSpinsCounter = 0;
		}
		if (!isFeatureSpin) {
			// Full bonus intro sequence — only for Deal It / All In (multi-spin)
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_trigger' });
			await animateSymbols({ positions: bookEvent.positions });
			// Hold on the highlighted scatters so the player can read the count before transition.
			if (!stateBet.isSuperTurbo) await waitForTimeout(stateBet.isTurbo ? 300 : 800);
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_bonus_intro' });
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
			await eventEmitter.broadcastAsync({ type: 'transition' });
			// Switch to the bonus background NOW — while the transition veil still covers the screen —
			// so the CONGRATULATIONS intro appears already on the bonus background, not the base one.
			stateGame.gameType = bonusMode;
			stateGame.bonusMode = bonusMode;
			eventEmitter.broadcast({ type: 'freeSpinIntroShow' });
			// Same "congratulations" sting the bonus-end (outro) congratulations uses.
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_congratulations' });
			eventEmitter.broadcast({ type: 'soundMusic', name: bonusMode === 'superspin' ? 'bgm_allin_bonus' : 'bgm_dealit_bonus' });
			await eventEmitter.broadcastAsync({ type: 'freeSpinIntroUpdate', totalFreeSpins: bookEvent.totalFs });
		}
		stateGame.gameType = bonusMode;
		stateGame.bonusMode = bonusMode;
		if (!isFeatureSpin) {
			eventEmitter.broadcast({ type: 'freeSpinIntroHide' });
		}
		eventEmitter.broadcast({ type: 'boardFrameGlowShow' });
		if (!isFeatureSpin) {
			eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
			stateUi.freeSpinCounterShow = true;
			eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', current: undefined, total: bookEvent.totalFs });
			stateUi.freeSpinCounterTotal = bookEvent.totalFs;
		}
		if (bonusMode === 'superspin') {
			eventEmitter.broadcast({ type: 'dealItMultiplierHide' });
			eventEmitter.broadcast({ type: 'globalMultiplierShow' });
		} else if (bonusMode === 'freegame') {
			// Show the Deal It multiplier board (persistent, 1x red X) and the EARNED board from the
			// start of the bonus — not just after the first winning spin.
			eventEmitter.broadcast({ type: 'dealItMultiplierStart' });
		}
		if (!isFeatureSpin) {
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
			await eventEmitter.broadcastAsync({ type: 'drawerButtonShow' });
			eventEmitter.broadcast({ type: 'drawerFold' });
		}
	},
	updateFreeSpin: async (bookEvent: BookEventOfType<'updateFreeSpin'>) => {
		if (stateGame.bonusMode === 'feature') {
			stateUi.freeSpinCounterShow = false;
			eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
			return;
		}
		eventEmitter.broadcast({ type: 'freeSpinCounterShow' });
		stateUi.freeSpinCounterShow = true;
		eventEmitter.broadcast({ type: 'freeSpinCounterUpdate', current: bookEvent.amount + 1, total: bookEvent.total });
		stateUi.freeSpinCounterCurrent = bookEvent.amount + 1;
		stateUi.freeSpinCounterTotal = bookEvent.total;
	},
	freeSpinEnd: async (bookEvent: BookEventOfType<'freeSpinEnd'>) => {
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		const isFeatureSpin = stateGame.bonusMode === 'feature';
		// Clear expanding symbol overlay before total board shows
		stateGame.expandedSymbol = null;
		stateGame.paylineWins = [];
		stateGame.gameType = isFeatureSpin ? 'feature' : 'basegame';
		eventEmitter.broadcast({ type: 'boardFrameGlowHide' });
		eventEmitter.broadcast({ type: 'globalMultiplierHide' });
		eventEmitter.broadcast({ type: 'dealItMultiplierHide' });
		if (isFeatureSpin) {
			// Feature spin: no outro panel, just let the win animate naturally
			stateUi.freeSpinCounterShow = false;
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
		} else {
			await eventEmitter.broadcastAsync({ type: 'uiHide' });
			eventEmitter.broadcast({ type: 'freeSpinOutroShow' });
			// Bonus is over: stop the bonus music loop, then play the finish sting over the outro.
			eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_dealit_bonus' });
			eventEmitter.broadcast({ type: 'soundStop', name: 'bgm_allin_bonus' });
			eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_congratulations' });
			// Congratulations screen: coins loop + stings only — NO bgm_win_animation here.
			winLevelSoundsPlay({ winLevelData, winBgm: false });
			await eventEmitter.broadcastAsync({ type: 'freeSpinOutroCountUp', amount: bookEvent.amount, winLevelData });
			// Back to the base-game music once the bonus summary finishes (not the bonus loop).
			eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_win_coins_loop' });
			eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_base_game' });
			eventEmitter.broadcast({ type: 'freeSpinOutroHide' });
			eventEmitter.broadcast({ type: 'freeSpinCounterHide' });
			stateUi.freeSpinCounterShow = false;
			await eventEmitter.broadcastAsync({ type: 'transition' });
			await eventEmitter.broadcastAsync({ type: 'uiShow' });
			await eventEmitter.broadcastAsync({ type: 'drawerUnfold' });
			eventEmitter.broadcast({ type: 'drawerButtonHide' });
		}
	},
	setWin: async (bookEvent: BookEventOfType<'setWin'>) => {
		// Trigger win-state animation on the expanded symbol overlay if active
		if (stateGame.expandedSymbol) {
			stateGame.expandedSymbolWon = true;
		}
		// Let the multiplier hand appear, spin and land on its value first…
		if ((stateGame.bonusMode === 'freegame' || stateGame.bonusMode === 'feature')) {
			await eventEmitter.broadcastAsync({ type: 'dealItMultiplierAwaitCycle' });
			// Brief beat before coins start flying so the two moments read separately.
			await waitForTimeout(150);
		}
		const winLevelData = winLevelMap[bookEvent.winLevel as WinLevel];
		eventEmitter.broadcast({ type: 'winShow' });
		// True MAX WIN (25000×) shows the dedicated MaxWinScreen (see Win.svelte) — give it its own
		// sting instead of the LEGENDARY sfx it otherwise shares (both are win level 10).
		const isMaxWin =
			winLevelData?.type === 'big' &&
			bookEventAmountToBetAmountMultiplier(bookEvent.amount) >= 25000;
		winLevelSoundsPlay({ winLevelData, sfxOverride: isMaxWin ? 'sfx_win_popup_max' : undefined });
		await eventEmitter.broadcastAsync({ type: 'winUpdate', amount: bookEvent.amount, winLevelData });
		winLevelSoundsStop();
		eventEmitter.broadcast({ type: 'winHide' });
		// NOTE: the Deal It multiplier panel is intentionally NOT hidden here — it stays on
		// screen for the whole bonus and only animates when the multiplier value changes.
		// It is hidden at bonus end (freeSpinEnd) and when switching to the All In bonus.
	},
	finalWin: async () => {
		// Round over — make sure the payline loop isn't left ringing.
		eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_payline_win' });
		// Reset after the base game OR a completed single feature spin. A feature spin sets
		// gameType='feature' / bonusMode='feature'; without resetting it here, bonusMode stayed
		// non-null after the spin, so isInBonus kept the Buy Bonus button disabled once you
		// deactivated the feature. (A multi-spin bonus keeps gameType 'freegame'/'superspin', so it
		// is not reset mid-bonus.)
		if (stateGame.gameType === 'basegame' || stateGame.gameType === 'feature') {
			stateGame.gameType = 'basegame';
			stateGameDerived.resetBonusState();
		}
	},
	createBonusSnapshot: async (bookEvent: BookEventOfType<'createBonusSnapshot'>) => {
		const { bookEvents } = bookEvent;

		const triggerIndex = bookEvents.findIndex((e) => e.type === 'freeSpinTrigger');
		if (triggerIndex === -1) return;

		// Find the reveal (scatter spin) just before the freeSpinTrigger so scatters are shown
		const revealBeforeTrigger = [...bookEvents]
			.slice(0, triggerIndex)
			.reverse()
			.find((e) => e.type === 'reveal');
		const startIndex = revealBeforeTrigger
			? bookEvents.indexOf(revealBeforeTrigger)
			: triggerIndex;

		for (const event of bookEvents.slice(startIndex)) {
			await playBookEvent(event, { bookEvents });
		}
	},
};

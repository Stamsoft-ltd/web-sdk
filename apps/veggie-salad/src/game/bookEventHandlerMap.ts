import { stateBet } from 'state-shared';
import { recordBookEvent, type BookEventHandlerMap } from 'utils-book';
import { bookEventAmountToBetAmountMultiplier } from 'utils-shared/amount';

import { CLUSTER_LOG_SIZE, stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';

const isBonusBook = (bookEvents: BookEvent[]) =>
	bookEvents.some(
		(event) =>
			event.type === 'freeSpinTrigger' ||
			(event.type === 'reveal' && ['normal', 'super', 'hidden'].includes(event.gameType)),
	);

const tierLabel = (tier: 'normal' | 'super' | 'hidden') =>
	tier === 'hidden' ? 'HIDDEN BONUS' : tier === 'super' ? 'SUPER BONUS' : 'NORMAL BONUS';

const winTitle = (amount: number) => {
	const multiplier = bookEventAmountToBetAmountMultiplier(amount);
	if (multiplier >= 500) return 'LEGENDARY WIN';
	if (multiplier >= 200) return 'MYTHIC WIN';
	if (multiplier >= 100) return 'EPIC WIN';
	if (multiplier >= 50) return 'WILD WIN';
	if (multiplier >= 20) return 'SWEET WIN';
	return 'WIN';
};

// Large wins need enough time for the count-up, tier art, and coin fountain to read. A press/skip
// still shortens the wait through stateGameDerived.wait(); normal play gets this full timeline.
const winTiming = (amount: number) => {
	const multiplier = bookEventAmountToBetAmountMultiplier(amount);
	if (multiplier >= 500) return { countDurationMs: 6000, presentDurationMs: 8500 };
	if (multiplier >= 200) return { countDurationMs: 5250, presentDurationMs: 7750 };
	if (multiplier >= 100) return { countDurationMs: 4500, presentDurationMs: 7000 };
	if (multiplier >= 50) return { countDurationMs: 3500, presentDurationMs: 6000 };
	if (multiplier >= 20) return { countDurationMs: 2500, presentDurationMs: 5000 };
	// Small fountain stops emitting early; keep the win up until its last coin falls below view.
	return { countDurationMs: 900, presentDurationMs: 3800 };
};

const presentWin = async (amount: number, detail: 'ROUND WIN' | 'TOTAL WIN') => {
	if (amount <= 0) return;
	const timing = winTiming(amount);
	const title = winTitle(amount);
	const countDurationMs = Math.max(
		title === 'WIN' ? 400 : 900,
		timing.countDurationMs * stateGameDerived.animationScale(),
	);
	stateGame.overlay = {
		kind: 'win',
		title,
		detail,
		amount,
		countDurationMs,
	};
	await stateGameDerived.wait(timing.presentDurationMs, {
		// Even slam-stop/turbo leaves enough time to identify the result and final amount.
		min: title === 'WIN' ? 500 : 1500,
	});
	stateGame.overlay = null;
	await stateGameDerived.wait(230, { min: 120 });
};

// updateFreeSpin starts the NEXT spin. Present the completed spin first, while its board and spin
// counter are still visible. The final spin is flushed by freeSpinEnd instead.
const presentPendingBonusSpinWin = async () => {
	if (!stateGame.bonusTier || stateGame.freeSpinCurrent <= 0 || stateGame.roundWin <= 0) return;
	await presentWin(stateGame.roundWin, 'ROUND WIN');
};

// Resize board atomically. Without blanking first, Svelte renders old 7×7 symbols inside the
// new 8/9/10 grid for one frame before the first bonus reveal arrives.
const prepareBonusGrid = (size: 7 | 8 | 9 | 10) => {
	stateGame.board = Array.from({ length: size }, () => Array(size).fill(null));
	stateGame.gridSize = size;
	stateGame.fallDistances = Array.from({ length: size }, () => Array(size).fill(0));
	stateGame.fallJitter = Array.from({ length: size }, () => Array(size).fill(0));
	stateGame.pendingRemovedPositions = [];
	stateGame.revealId += 1;
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	restoreSnapshot: async (event: BookEventOfType<'restoreSnapshot'>) => {
		if (event.board) stateGameDerived.setBoard({ board: event.board, gameType: event.gameType });
		stateGame.gridSize = event.gridSize;
		stateGame.gameType = event.gameType;
		stateGame.bonusTier = event.tier;
		stateGame.roundWin = event.tier
			? Math.max(0, event.totalWin - event.spinStartTotal)
			: event.totalWin;
		stateGame.bonusTotalWin = event.tier ? event.totalWin : 0;
		stateGame.bonusSpinStartTotal = event.tier ? event.spinStartTotal : 0;
		stateGame.freeSpinCurrent = event.freeSpinCurrent;
		stateGame.freeSpinTotal = event.freeSpinTotal;
		stateBet.winBookEventAmount = event.totalWin;
		stateGame.phase = 'idle';
	},
	featureSpinStart: async () => {
		stateGame.featureLabel = 'GUARANTEED CLUSTER';
		stateGame.gameType = 'feature';
	},
	mysterySelect: async (event: BookEventOfType<'mysterySelect'>) => {
		// Mystery is a selector, not a second presentation. Show/compose its triggering scatters,
		// then let the following freeSpinTrigger display the ONE selected-tier intro. The old
		// MYSTERY PICK plaque followed immediately by NORMAL/SUPER/HIDDEN felt like two awards.
		if (event.positions?.length) await stateGameDerived.celebrateScatters(event.positions);
		else await stateGameDerived.playBonusEntrySpin({ tier: event.tier });
		await stateGameDerived.wait(260, { min: 120 });
	},
	freeSpinTrigger: async (event: BookEventOfType<'freeSpinTrigger'>) => {
		// The scatters that triggered this bonus get their moment before the placard: a natural
		// trigger and a buy both land them on the spin right before this event (the math emits a
		// real entry spin for buys), and a mystery pick has already celebrated them.
		if (event.source !== 'mystery') {
			if (event.positions.length) await stateGameDerived.celebrateScatters(event.positions);
			else if (event.source === 'buy')
				// Book with no entry spin (older package, or a synthetic max-win book).
				await stateGameDerived.playBonusEntrySpin({
					tier: event.tier,
					scatterCount: event.scatterCount,
					positions: event.positions,
				});
		}
		stateGame.phase = 'transition';
		stateGame.bonusTier = event.tier;
		prepareBonusGrid(event.gridSize);
		stateGame.gameType = event.tier;
		stateGame.freeSpinCurrent = 0;
		stateGame.freeSpinTotal = event.totalFs;
		stateGame.roundWin = 0;
		stateGame.bonusTotalWin = 0;
		stateGame.bonusSpinStartTotal = 0;
		stateGame.overlay = {
			kind: 'bonus',
			title: 'CONGRATULATIONS!',
			detail: tierLabel(event.tier),
			bonusPresentation: 'start',
			freeSpins: event.totalFs,
			gridSize: event.gridSize,
			tier: event.tier,
		};
		// Match Forest Gang/Magnetic: finish the entrance, then hold until explicit acknowledgement.
		await stateGameDerived.wait(700, { min: 700 });
		await stateGameDerived.waitForContinue();
		stateGame.overlay = null;
		await stateGameDerived.wait(230, { min: 120 });
	},
	updateFreeSpin: async (event: BookEventOfType<'updateFreeSpin'>) => {
		// New free spin, new skip budget: a skip press belongs to the spin it was pressed on.
		stateGameDerived.clearSkip();
		await presentPendingBonusSpinWin();
		stateGame.bonusSpinStartTotal = stateGame.bonusTotalWin;
		stateGame.roundWin = 0;
		// Math emits a zero-based spin index. HUD is player-facing: 1 / total … total / total.
		stateGame.freeSpinCurrent = Math.min(event.amount + 1, event.total);
		stateGame.freeSpinTotal = event.total;
		stateGame.bonusTier = event.tier;
	},
	retrigger: async (event: BookEventOfType<'retrigger'>) => {
		stateGame.freeSpinTotal = event.total;
		// Retriggers use the same landed-scatter celebration as initial bonus triggers. Run it before
		// the plaque so the board remains visible and each triggering scatter receives its aura.
		if (event.positions?.length) await stateGameDerived.celebrateScatters(event.positions);
		stateGame.overlay = {
			kind: 'retrigger',
			title: 'EXTRA FREE SPINS',
			detail: `+${event.spinsAdded} · ${event.total} TOTAL`,
		};
		await stateGameDerived.wait(2200, { min: 650 });
		stateGame.overlay = null;
		await stateGameDerived.wait(230, { min: 120 });
	},
	reveal: async (event: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		if (event.cascadeIndex === 0) {
			stateGameDerived.clearSkip();
			// The payout panel describes ONE spin's tumble chain, so it empties as each spin starts —
			// free spins included, where the log would otherwise carry over from the spin before.
			stateGame.spinClusterWins = [];
		}
		stateGameDerived.clearWinningState();
		stateGame.phase = event.cascadeIndex === 0 ? 'spinning' : 'dropping';
		stateGameDerived.setBoard({
			board: event.board,
			gameType: event.gameType,
			transition: event.cascadeIndex === 0 ? 'spin' : 'tumble',
		});
		await stateGameDerived.waitMotion(() =>
			stateGameDerived.revealDurationMs(event.cascadeIndex === 0 ? 'spin' : 'tumble'),
		);
		stateGame.phase = 'idle';
		if (isBonusBook(bookEvents)) recordBookEvent({ bookEvent: event });
	},
	clusterWin: async (event: BookEventOfType<'clusterWin'>) => {
		stateGame.winningClusters = event.wins;
		stateGame.spinClusterWins = [...event.wins, ...stateGame.spinClusterWins].slice(
			0,
			CLUSTER_LOG_SIZE,
		);
		stateGame.winningPositions = event.wins.flatMap((win) => win.positions);
		stateGame.phase = 'winning';
		// The win read is the point of the round: even on a skip the cluster stays lit, with its
		// amount on screen, before anything is harvested. Without this floor a skip press removed
		// the cluster in the same frame it was found, and all the player saw was replacements
		// falling into holes they never saw open.
		await stateGameDerived.wait(850, { min: 280 });
	},
	setTotalWin: async (event: BookEventOfType<'setTotalWin'>) => {
		// setTotalWin is authoritative and cumulative. During a bonus, show its delta from the
		// current spin's checkpoint in WIN while preserving the cumulative value on TOTAL WIN.
		stateBet.winBookEventAmount = event.amount;
		if (stateGame.bonusTier) {
			stateGame.bonusTotalWin = event.amount;
			stateGame.roundWin = Math.max(0, event.amount - stateGame.bonusSpinStartTotal);
		} else {
			stateGame.roundWin = event.amount;
		}
	},
	tumbleRemove: async (event: BookEventOfType<'tumbleRemove'>) => {
		stateGame.phase = 'removing';
		stateGame.pendingRemovedPositions = event.positions.map((position) => ({ ...position }));
		// The harvest animation's own length (motion profile), so the symbols are seen leaving.
		await stateGameDerived.waitMotion(() => stateGameDerived.removeDurationMs());
		const nextBoard = stateGame.board.map((reel) => [...reel]);
		for (const { reel, row } of event.positions) {
			if (nextBoard[reel]) nextBoard[reel][row] = null;
		}
		stateGame.board = nextBoard;
		stateGameDerived.clearWinningState();
		// A beat on the open holes, so the gap the tumble is about to close is visible.
		await stateGameDerived.wait(120, { min: 70 });
	},
	setWin: async (event: BookEventOfType<'setWin'>) => {
		stateBet.winBookEventAmount = event.amount;
		if (!stateGame.bonusTier) stateGame.roundWin = event.amount;
		if (event.amount > 0 && !stateGame.bonusTier) {
			await presentWin(event.amount, 'TOTAL WIN');
		}
	},
	freeSpinEnd: async (event: BookEventOfType<'freeSpinEnd'>) => {
		stateGameDerived.clearSkip();
		await presentPendingBonusSpinWin();
		stateGame.roundWin = event.amount;
		stateGame.bonusTotalWin = event.amount;
		stateBet.winBookEventAmount = event.amount;
		const countDurationMs = Math.max(
			1200,
			Math.min(6000, Math.max(3000, winTiming(event.amount).countDurationMs)) *
				stateGameDerived.animationScale(),
		);
		stateGame.overlay = {
			kind: 'win',
			title: 'CONGRATULATIONS!',
			detail: 'TOTAL WIN',
			amount: event.amount,
			countDurationMs,
			bonusPresentation: 'end',
			tier: event.tier,
		};
		// Show the full counted total, then require a click/tap exactly like the reference games.
		await stateGameDerived.waitMotion(() => Math.max(1800, countDurationMs + 450));
		await stateGameDerived.waitForContinue();
		stateGame.overlay = null;
		await stateGameDerived.wait(230, { min: 120 });
	},
	finalWin: async (event: BookEventOfType<'finalWin'>) => {
		stateBet.winBookEventAmount = event.amount;
		stateGame.roundWin = event.amount;
		stateGame.phase = 'idle';
		stateGame.skipRequested = false;
		stateGameDerived.clearWinningState();
		// Actual bonus buys fall back to BASE. CHANCE and FEATURE remain armed per-spin modes.
		if (['BONUS', 'MYSTERY', 'SUPER'].includes(stateBet.activeBetModeKey.toUpperCase())) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateGame.featureLabel = '';
		stateGame.bonusTier = null;
		stateGame.freeSpinCurrent = 0;
		stateGame.freeSpinTotal = 0;
		stateGame.bonusSpinStartTotal = 0;
	},
};

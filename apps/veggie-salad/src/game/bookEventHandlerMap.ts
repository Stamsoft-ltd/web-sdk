import { stateBet } from 'state-shared';
import { recordBookEvent, type BookEventHandlerMap } from 'utils-book';

import {
	CLUSTER_LOG_SIZE,
	SCATTER_TRIGGER_COUNTS,
	stateGame,
	stateGameDerived,
} from './stateGame.svelte';
import type { BookEvent, BookEventContext, BookEventOfType } from './typesBookEvent';

const isBonusBook = (bookEvents: BookEvent[]) =>
	bookEvents.some(
		(event) =>
			event.type === 'freeSpinTrigger' ||
			(event.type === 'reveal' && ['normal', 'super', 'hidden'].includes(event.gameType)),
	);

const tierLabel = (tier: 'normal' | 'super' | 'hidden') =>
	tier === 'hidden' ? 'HIDDEN BONUS' : tier === 'super' ? 'SUPER BONUS' : 'NORMAL BONUS';

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	restoreSnapshot: async (event: BookEventOfType<'restoreSnapshot'>) => {
		if (event.board) stateGameDerived.setBoard({ board: event.board, gameType: event.gameType });
		stateGame.gridSize = event.gridSize;
		stateGame.gameType = event.gameType;
		stateGame.bonusTier = event.tier;
		stateGame.roundWin = event.totalWin;
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
		// The mystery result is ANNOUNCED BY THE SCATTER COUNT (3 normal, 4 super, 5 hidden): the
		// book's entry spin has already dropped them, so hold on them before the placard names the
		// tier. Books without the payload get a locally composed entry spin instead.
		if (event.positions?.length) await stateGameDerived.celebrateScatters(event.positions);
		else await stateGameDerived.playBonusEntrySpin({ tier: event.tier });
		stateGame.phase = 'transition';
		stateGame.overlay = {
			kind: 'mystery',
			title: 'MYSTERY PICK',
			detail: `${SCATTER_TRIGGER_COUNTS[event.tier]} SCATTERS · ${tierLabel(event.tier)} · ${
				event.gridSize
			}×${event.gridSize}`,
		};
		await stateGameDerived.wait(1500, { min: 320 });
		stateGame.overlay = null;
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
		stateGame.gridSize = event.gridSize;
		stateGame.gameType = event.tier;
		stateGame.freeSpinCurrent = 0;
		stateGame.freeSpinTotal = event.totalFs;
		stateGame.overlay = {
			kind: 'bonus',
			title: tierLabel(event.tier),
			detail: `${event.totalFs} FREE SPINS · ${event.gridSize}×${event.gridSize} GRID`,
		};
		await stateGameDerived.wait(event.source === 'natural' ? 1900 : 1400, { min: 400 });
		stateGame.overlay = null;
	},
	updateFreeSpin: async (event: BookEventOfType<'updateFreeSpin'>) => {
		// New free spin, new skip budget: a skip press belongs to the spin it was pressed on.
		stateGameDerived.clearSkip();
		// Math emits a zero-based spin index. HUD is player-facing: 1 / total … total / total.
		stateGame.freeSpinCurrent = Math.min(event.amount + 1, event.total);
		stateGame.freeSpinTotal = event.total;
		stateGame.bonusTier = event.tier;
	},
	retrigger: async (event: BookEventOfType<'retrigger'>) => {
		stateGame.freeSpinTotal = event.total;
		stateGame.overlay = {
			kind: 'retrigger',
			title: 'EXTRA FREE SPINS',
			detail: `+${event.spinsAdded} · ${event.total} TOTAL`,
		};
		await stateGameDerived.wait(1300, { min: 320 });
		stateGame.overlay = null;
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
		stateGame.roundWin = event.amount;
		stateBet.winBookEventAmount = event.amount;
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
		stateGame.roundWin = event.amount;
		if (event.amount > 0 && !stateGame.bonusTier) await stateGameDerived.wait(420, { min: 140 });
	},
	freeSpinEnd: async (event: BookEventOfType<'freeSpinEnd'>) => {
		stateGame.roundWin = event.amount;
		stateBet.winBookEventAmount = event.amount;
		stateGame.overlay = {
			kind: 'win',
			title: `${tierLabel(event.tier)} COMPLETE`,
			detail: 'TOTAL WIN',
		};
		await stateGameDerived.wait(1900, { min: 400 });
		stateGame.overlay = null;
	},
	finalWin: async (event: BookEventOfType<'finalWin'>) => {
		stateBet.winBookEventAmount = event.amount;
		stateGame.roundWin = event.amount;
		stateGame.phase = 'idle';
		stateGame.skipRequested = false;
		stateGameDerived.clearWinningState();
		// FEATURE is an activate-type mode (a toggle the player turns off themselves), so it is
		// deliberately absent here — only the one-shot buys fall back to BASE after the round.
		if (['BONUS', 'MYSTERY', 'SUPER'].includes(stateBet.activeBetModeKey.toUpperCase())) {
			stateBet.activeBetModeKey = 'BASE';
		}
		stateGame.featureLabel = '';
		stateGame.bonusTier = null;
		stateGame.freeSpinCurrent = 0;
		stateGame.freeSpinTotal = 0;
	},
};

import _ from 'lodash';

import { stateBet } from 'state-shared';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';
import { beginReelSpin, stateGame, stateGameDerived } from './stateGame.svelte';
import { RELEASE_HOLD_MS, releaseLocks } from './lockRelease.svelte';
import config from './config';
import type { RawSymbol } from './types';
import { roundFlowState, finalWinBookAmount } from '../state/roundFlow.svelte';

// The settled board as it was before this round's pre-spin started. A failed play request has to
// put it back: the reels are mid pre-spin (showing padding) when the error arrives.
let boardBeforeSpin: RawSymbol[][] | null = null;

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastRevealEvent = _.findLast(
			betToResume.state,
			(bookEvent) => bookEvent?.type === 'reveal',
		);

		if (lastRevealEvent) stateGameDerived.enhancedBoard.settle(lastRevealEvent.board);
	},
	onNewGameStart: async () => {
		// the last round's locked cells let go as the reels start (handed back to their reels, which
		// carry them away) — before the board snapshot, so an error restores them as plain symbols
		const released = releaseLocks();
		boardBeforeSpin = stateGameDerived.boardRaw();
		stateGame.paylineWins = [];
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) return;
		stateBet.winBookEventAmount = 0;
		stateGame.roundWin = 0;
		stateGame.winCountUp = null;
		stateGame.pendingStop = false;
		stateGame.awaitingFirstReveal = true;
		// let the locked boxes go in place first: the reels start once they've faded off
		if (released) await new Promise((r) => setTimeout(r, stateBet.isTurbo ? RELEASE_HOLD_MS / 2 : RELEASE_HOLD_MS));
		beginReelSpin();
		await stateGameDerived.enhancedBoard.preSpin({
			paddingBoard: config.paddingReels[stateGame.gameType],
		});
	},
	// The request failed (or the balance check did, before any pre-spin). `settle()` with no board
	// used to empty every reel, which is the blank board players saw behind the error modal. Put back
	// the last settled board instead, so the game is visibly ready to play once the modal is closed.
	onNewGameError: () => {
		stateGame.awaitingFirstReveal = false;
		stateGame.pendingStop = false;
		const restore = boardBeforeSpin ?? stateGameDerived.boardRaw();
		boardBeforeSpin = null;
		stateGameDerived.enhancedBoard.settle(restore);
	},
	onPlayGame: async (bet) => {
		boardBeforeSpin = null;
		if (roundFlowState.endRoundOnly) {
			// END ROUND on the resume dialog: skip the presentation; the machine still runs endGame,
			// which ends the round on the RGS and credits the balance. Show what the round paid.
			roundFlowState.endRoundOnly = false;
			const win = finalWinBookAmount(bet);
			stateBet.winBookEventAmount = win;
			stateGame.roundWin = win;
			return;
		}
		await playBet(bet);
	},
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);

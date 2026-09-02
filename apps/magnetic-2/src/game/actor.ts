import _ from 'lodash';

import { stateBet } from 'state-shared';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertTorResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastRevealEvent = _.findLast(
			betToResume.state,
			(bookEvent) => bookEvent?.type === 'reveal',
		);
		if (lastRevealEvent) stateGameDerived.setBoardFromRaw({ rawBoard: lastRevealEvent.board });
	},
	onNewGameStart: async () => {
		if ((stateBet.isSuperTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) {
			// Fast paths skip the spin presentation, but round state must still reset —
			// otherwise nextRevealMode stays 'respin' (first reveal misclassified as a
			// respin, fresh-spin reset skipped) and bonusMode leaks across rounds.
			stateGameDerived.resetBonusState();
			return;
		}
		stateBet.winBookEventAmount = 0;
		stateGame.pendingStop = false;
		stateGame.awaitingFirstReveal = true;
		stateGameDerived.beginSpin();
	},
	onNewGameError: () => {
		// The request can fail after beginSpin has already started dropping the old board out.
		// Restore that authoritative settled board so a 429/network error leaves a playable screen
		// behind the modal instead of an empty or half-fallen grid.
		stateGameDerived.setBoardFromRaw({ rawBoard: stateGameDerived.boardRaw() });
	},
	onPlayGame: async (bet) => {
		if (stateGame.endRoundOnly) {
			stateGame.endRoundOnly = false;
			return; // skip animation — the machine still flows to endGame, which ends the round + credits balance
		}
		await playBet(bet);
	},
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);

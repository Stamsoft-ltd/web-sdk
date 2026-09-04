import _ from 'lodash';

import { stateBet, stateBetDerived } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet, shouldDeferEndRound } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import { eventEmitter } from './eventEmitter';
import config from './config';

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
		stateGame.revealPreparing = false;
		// Physical spin press owns payline teardown. Waiting for the RGS reveal left the prior line
		// cycle visible over pre-spin/network latency.
		stateGame.paylineWins = [];
		// Start the full-reel roll-out at the same physical boundary as reel pre-spin. Do not await it:
		// the feature should travel down with the live reels rather than delay their next motion.
		void eventEmitter.broadcastAsync({ type: 'rollerWildsRollOut' });
		stateGame.activeRollerReels = [];
		if ((stateBet.isSuperTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold)
			return;
		stateBet.winBookEventAmount = 0;
		stateGame.pendingStop = false;
		stateGame.awaitingFirstReveal = true; // open the buffer window
		await stateGameDerived.enhancedBoard.preSpin({
			paddingBoard: config.paddingReels[stateGame.gameType],
		});
	},
	onNewGameError: () => {
		stateGame.revealPreparing = false;
		stateGameDerived.enhancedBoard.settle();
	},
	onPlayGame: async (bet) => {
		// Switch before the trigger reveal, not only when the later bonus event arrives.
		if (shouldDeferEndRound(bet)) stateBetDerived.setNormalSpeed();
		if (stateGame.endRoundOnly) {
			stateGame.endRoundOnly = false;
			return; // skip animation — endGame calls handleRequestEndRound and credits balance
		}
		await playBet(bet);
	},
	checkIsBonusGame: shouldDeferEndRound,
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);

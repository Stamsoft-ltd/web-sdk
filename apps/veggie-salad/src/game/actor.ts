import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet, BookEventOfType } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertToResumableBet } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';

// Spin choreography against the network. The machine awaits onNewGameStart before it calls the
// RGS, and the result can take anything from 50ms to a second to come back. Emptying the board
// on the press and hoping the result beat the exit left the board bare for the difference on
// every slow response, so the press only arms the round (the old board holds in place) and the
// trap door opens in onPlayGame, once the result is in hand — exit and drop then run back to
// back with a fixed overlap, whatever the latency.
const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (betToResume) => convertToResumableBet(betToResume),
	onResumeGameInactive: (betToResume) => {
		const lastReveal = _.findLast(betToResume.state, (event) => event?.type === 'reveal') as
			| BookEventOfType<'reveal'>
			| undefined;
		if (lastReveal) stateGameDerived.settle(lastReveal.board);
	},
	onNewGameStart: async () => {
		if ((stateBet.isSuperTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold)
			return;
		stateBet.winBookEventAmount = 0;
		stateGameDerived.resetRound();
	},
	onNewGameError: () => stateGameDerived.settle(),
	onPlayGame: async (bet) => {
		// Never call requestEndRound outside the machine. A pending bonus the player chooses to end
		// resumes through the normal state path, skips only book playback, then reaches endGame.
		if (stateGame.endRoundOnly) {
			stateGame.endRoundOnly = false;
			return;
		}
		// The exit plays on its own layer (the prototype's exit ghost), so the result only waits
		// for the old board to be visibly on its way out: the two waves overlap and the board is
		// never bare — new symbols enter the top a beat after this, by which time the old top row
		// has dropped clear (magnetic does the same).
		stateGameDerived.startExit();
		await stateGameDerived.waitMotion(() => stateGameDerived.exitDurationMs() * 0.35);
		await playBet(bet);
	},
	checkIsBonusGame: (bet) =>
		bet.state.some(
			(event) =>
				event.type === 'freeSpinTrigger' ||
				(event.type === 'reveal' && ['normal', 'super', 'hidden'].includes(event.gameType)),
		),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);

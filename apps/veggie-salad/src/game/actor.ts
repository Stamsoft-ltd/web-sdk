import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet, BookEventOfType } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertToResumableBet } from './utils';
import { stateGame, stateGameDerived } from './stateGame.svelte';

// The trap-door exit and the bet request run side by side: the machine awaits onNewGameStart
// before it calls the RGS, so waiting for the exit THERE put a whole network round trip between
// the board emptying and the result raining in (a long bare board on a phone). The exit's wait
// moves to onPlayGame instead, where it only holds the reveal back if the response beat it.
let exitSettled: Promise<void> = Promise.resolve();

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
		// The exit plays on its own layer (the prototype's exit ghost), so the next result only
		// waits for the old board to be visibly on its way out: the two waves overlap and the
		// board is never bare — new symbols enter the top a beat after this, by which time the
		// old top row has dropped clear (magnetic does the same).
		exitSettled = stateGameDerived.waitMotion(() => stateGameDerived.exitDurationMs() * 0.35);
	},
	onNewGameError: () => stateGameDerived.settle(),
	onPlayGame: async (bet) => {
		// Never call requestEndRound outside the machine. A pending bonus the player chooses to end
		// resumes through the normal state path, skips only book playback, then reaches endGame.
		if (stateGame.endRoundOnly) {
			stateGame.endRoundOnly = false;
			return;
		}
		await exitSettled;
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

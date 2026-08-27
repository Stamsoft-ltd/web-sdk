import _ from 'lodash';

import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet, BookEventOfType } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertToResumableBet } from './utils';
import { stateGameDerived } from './stateGame.svelte';

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
		// Let the trap-door exit get most of the way out before the next result rains in — the two
		// waves overlap slightly, so the board is never left bare (magnetic does the same).
		await stateGameDerived.waitMotion(() => stateGameDerived.exitDurationMs() * 0.75);
	},
	onNewGameError: () => stateGameDerived.settle(),
	onPlayGame: async (bet) => await playBet(bet),
	checkIsBonusGame: (bet) =>
		bet.state.some(
			(event) =>
				event.type === 'freeSpinTrigger' ||
				(event.type === 'reveal' && ['normal', 'super', 'hidden'].includes(event.gameType)),
		),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);

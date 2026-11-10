import { stateBet } from 'state-shared';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';
import { restorePrefix } from './reducer';
import { runtime, resetRound, restoreBet, playEvents } from './playback.svelte';
import type { Bet } from './contract';
// Actors cannot be restarted after stop(). Own one per mounted game, including
// primary-machine balance holders, rather than reusing a stopped module singleton.
export function createGatesActor() {
	const primary = createPrimaryMachines<Bet>({
		onResumeGameActive: (bet) => {
			try {
				return restoreBet(bet);
			} catch (error) {
				runtime.error = String(error);
				stateBet.autoSpinsCounter = 0;
				throw error;
			}
		},
		onResumeGameInactive: (bet) => {
			runtime.game = restorePrefix(bet.state, bet.state.length);
		},
		onNewGameStart: async () => {
			resetRound();
		},
		onNewGameError: () => {
			runtime.phase = 'idle';
		},
		onPlayGame: async (bet) => {
			try {
				await playEvents(bet.state, false, String(bet.betID ?? bet.roundID ?? 'book'));
			} catch (error) {
				runtime.error = String(error);
				stateBet.autoSpinsCounter = 0;
				throw error;
			}
			if (['BONUS', 'SUPER', 'MYSTERY'].includes(stateBet.activeBetModeKey))
				stateBet.activeBetModeKey = 'BASE';
		},
		checkIsBonusGame: (bet) => bet.state.some((e) => e.type === 'freeSpinTrigger'),
	});
	return createGameActor(createIntermediateMachines(primary));
}

import _ from 'lodash';

import { loadReplayBet } from 'components-shared';
import { stateBet, stateBetDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import type { BaseBet } from 'utils-bet';

// Round-flow state that lives outside the game's book-event state: the END ROUND choice of the
// Unfinished Round dialog, and replay mode (Stake's `?replay=true` links).

export const roundFlowState = $state({
	/**
	 * END ROUND on the resume dialog: the resumed round goes through the xstate machine as usual
	 * (RESUME_BET -> play -> endGame, which calls /wallet/end-round and credits the balance), but the
	 * presentation is skipped. Ending outside the machine would leave it holding the round, and the
	 * next play would fail with "player already has an active bet".
	 */
	endRoundOnly: false,
	/** A replay round is staged and can be (re)started. */
	replayReady: false,
	/** The player has started the replay at least once (the prompt then offers PLAY AGAIN). */
	replayHasPlayed: false,
	/** A retry of the replay request is in flight. */
	replayLoading: false,
	/** Cost multiplier of the replayed mode (reactive: the HUD derives the replay cost from it). */
	replayCostMultiplier: 1,
});

export const isReplayMode = () => stateUi.config.mode === 'replay' || stateUrlDerived.replay();

// The replay round as the RGS returned it. betToResume is consumed (nulled) by the resume machine,
// so every start replays a fresh copy of this snapshot.
let replaySnapshot: BaseBet | null = null;

/** Book amount of the round's final win (100 = 1x the base bet), read from the round's own events. */
export const finalWinBookAmount = (bet: BaseBet | null | undefined) => {
	const state = (bet?.state ?? []) as Array<{ type?: string; amount?: number }>;
	const last = _.findLast(state, (event) =>
		['finalWin', 'wincap', 'setTotalWin'].includes(event?.type ?? ''),
	);
	return Number(last?.amount) || 0;
};

/** Stage the replay round that Authenticate loaded into betToResume (call once, on mount). */
export const captureReplaySnapshot = () => {
	const bet = stateBet.betToResume;
	if (!bet || !Array.isArray(bet.state) || bet.state.length === 0) {
		roundFlowState.replayReady = false;
		return;
	}
	replaySnapshot = $state.snapshot(bet) as BaseBet;
	const fromRgs = Number((bet as { costMultiplier?: unknown }).costMultiplier);
	roundFlowState.replayCostMultiplier =
		Number.isFinite(fromRgs) && fromRgs > 0
			? fromRgs
			: Number(stateBetDerived.activeBetMode()?.costMultiplier) || 1;
	roundFlowState.replayReady = true;
};

/** Total cost of the replayed round (base bet x the mode's cost multiplier) — wallet money. */
export const replayCostAmount = () => stateBet.betAmount * roundFlowState.replayCostMultiplier;

/**
 * Start (or restart) the replay. Returns true when a round was handed to the resume machine; the
 * caller broadcasts `resumeBet`. When the replay request failed at boot this retries it first.
 */
export const prepareReplayStart = async () => {
	if (!replaySnapshot) {
		if (roundFlowState.replayLoading) return false;
		roundFlowState.replayLoading = true;
		try {
			await loadReplayBet();
			stateModal.modal = null;
			captureReplaySnapshot();
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error, code: 'replay', recoverable: true };
			return false;
		} finally {
			roundFlowState.replayLoading = false;
		}
		if (!replaySnapshot) return false;
	}
	const snapshot = structuredClone(replaySnapshot) as BaseBet;
	if (snapshot.mode) stateBet.activeBetModeKey = snapshot.mode;
	stateBet.betToResume = snapshot;
	roundFlowState.replayHasPlayed = true;
	return true;
};

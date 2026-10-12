import _ from 'lodash';

import { loadReplayBet } from 'components-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet, stateBetDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import type { BaseBet } from 'utils-bet';

import config from '../game/config';

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
// Reactive copy of the round's summary fields for the replay window (replaySnapshot itself is not
// reactive). `null` until a replay round has been captured.
const replaySummary = $state<{
	value: {
		mode: string;
		amount: number | null;
		payout: number | null;
		payoutMultiplier: number | null;
		finalWinBook: number;
	} | null;
}>({ value: null });

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
	const raw = bet as { costMultiplier?: unknown; amount?: unknown; payout?: unknown; payoutMultiplier?: unknown };
	const fromRgs = Number(raw.costMultiplier);
	roundFlowState.replayCostMultiplier =
		Number.isFinite(fromRgs) && fromRgs > 0
			? fromRgs
			: Number(stateBetDerived.activeBetMode()?.costMultiplier) || configCostMultiplier(bet.mode) || 1;
	const num = (value: unknown) => (value == null || !Number.isFinite(Number(value)) ? null : Number(value));
	replaySummary.value = {
		mode: String(bet.mode || stateBet.activeBetModeKey || stateUrlDerived.mode() || 'base'),
		amount: num(raw.amount),
		payout: num(raw.payout),
		payoutMultiplier: num(raw.payoutMultiplier),
		finalWinBook: finalWinBookAmount(bet),
	};
	roundFlowState.replayReady = true;
};

/** The mode's cost from game/config.ts betModes (case-insensitive: the URL carries e.g. `BASE`). */
const configCostMultiplier = (mode: unknown) => {
	const key = Object.keys(config.betModes).find((k) => k.toLowerCase() === String(mode ?? '').toLowerCase());
	return key ? Number(config.betModes[key as keyof typeof config.betModes].cost) || 0 : 0;
};

/** Mode key of the replayed round, as the URL / RGS spell it. */
export const replayModeKey = () =>
	replaySummary.value?.mode || stateBet.activeBetModeKey || stateUrlDerived.mode() || 'base';

/**
 * Base bet of the replayed round. The URL's `amount` (loaded into stateBet.betAmount) is what the
 * playback itself scales its wins by, so the card uses it too; the response's `amount` covers a
 * link without one.
 */
export const replayBaseBetAmount = () => {
	if (stateBet.betAmount > 0) return stateBet.betAmount;
	const amount = replaySummary.value?.amount;
	return amount != null && amount > 0 ? amount / API_AMOUNT_MULTIPLIER : 0;
};

/**
 * Win / base bet (Stake's own definition of payoutMultiplier). The round's book is the one source a
 * replay always carries (`finalWin`, 100 = 1x the base bet); the live RGS may omit `payout` and
 * `payoutMultiplier` on /bet/replay, so those are fallbacks (STAKE_REVIEW_LESSONS R-09).
 */
export const replayPayoutMultiplier = () => {
	const summary = replaySummary.value;
	if (!summary) return 0;
	if (summary.finalWinBook > 0) return summary.finalWinBook / 100;
	if (summary.payout != null && summary.amount) return summary.payout / summary.amount;
	return summary.payoutMultiplier != null && summary.payoutMultiplier > 0 ? summary.payoutMultiplier : 0;
};

/** Total win of the replayed round: base bet x payout multiplier, so the card always reconciles. */
export const replayWinAmount = () => replayBaseBetAmount() * replayPayoutMultiplier();

/** Total cost of the replayed round (base bet x the mode's cost multiplier) — wallet money. */
export const replayCostAmount = () => replayBaseBetAmount() * roundFlowState.replayCostMultiplier;

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

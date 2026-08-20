import { stateBet, stateI18nDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER, BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import type { BaseBet } from 'utils-bet';
import {
	formatCurrencyAmountForCurrency,
	formatWinCurrencyAmountForCurrency,
	normalizeCurrency,
} from '../lib/utils/currency';
import { logForestDiagnostic } from '../utils/forestDiagnostics';

type BootStatus = 'booting' | 'ready' | 'error';

export const forestStakeState = $state({
	bootStatus: 'booting' as BootStatus,
	bootError: '',
	replaySnapshot: null as BaseBet | null,
	replayEventId: '',
	replayHasPlayed: false,
	replayRunning: false,
	replayStartRequested: false,
	replayObservedRunning: false,
	pendingRoundDetected: false,
});

const safeAmount = (value: unknown) => {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
};

const cloneReplayBet = <T>(value: T): T | null => {
	const seen = new WeakSet<object>();
	try {
		return JSON.parse(
			JSON.stringify(value, (_key, item) => {
				if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') return undefined;
				if (!item || typeof item !== 'object') return item;
				if (typeof window !== 'undefined' && item === window) return undefined;
				if (seen.has(item)) return undefined;
				seen.add(item);
				const ctor = (item as { constructor?: { name?: string } }).constructor?.name;
				if (!Array.isArray(item) && ctor && ctor !== 'Object') return undefined;
				return item;
			}),
		) as T;
	} catch (error) {
		logForestDiagnostic('error', 'replay_clone_failed', { message: String(error) });
		return null;
	}
};

const isReplayMode = () => stateUi.config.mode === 'replay' || stateUrlDerived.replay();

const replayModeKey = () =>
	String(
		(forestStakeState.replaySnapshot as { mode?: string })?.mode ||
			stateBet.activeBetModeKey ||
			stateUrlDerived.mode() ||
			'BASE',
	).toUpperCase();

const modeTitleKey = (mode: string) => {
	if (mode === 'CHANCE') return 'BET MODE CHANCE TITLE';
	if (mode === 'FEATURE') return 'BET MODE FEATURE TITLE';
	if (mode === 'BONUS') return 'BET MODE BONUS TITLE';
	if (mode === 'SUPER') return 'BET MODE SUPER TITLE';
	return 'BET MODE BASE TITLE';
};

const modeCostMultiplier = (mode: string) =>
	mode === 'CHANCE' ? 2 : mode === 'FEATURE' ? 20 : mode === 'BONUS' ? 100 : mode === 'SUPER' ? 400 : 1;

const selectedModeLabel = () => t(modeTitleKey(replayModeKey()));

const bootReady = () => {
	forestStakeState.bootStatus = 'ready';
	if (!forestStakeState.bootError) return;
	forestStakeState.bootError = '';
};

const setBootError = (message: string) => {
	forestStakeState.bootStatus = 'error';
	forestStakeState.bootError = message;
	logForestDiagnostic('error', 'boot_error', {
		message,
		mode: stateUi.config.mode,
		replay: isReplayMode(),
		pendingRoundDetected: forestStakeState.pendingRoundDetected,
	});
};

const captureReplaySnapshot = (bet: BaseBet | null) => {
	if (!bet) return;
	const snapshot = cloneReplayBet(bet);
	if (!snapshot) {
		setBootError(t('REPLAY ERROR GENERIC'));
		return;
	}
	forestStakeState.replaySnapshot = snapshot;
	forestStakeState.replayEventId = stateUrlDerived.event() || String((bet as { event?: string | number })?.event ?? '');
	logForestDiagnostic('info', 'replay_snapshot_captured', {
		eventId: forestStakeState.replayEventId,
		mode: (bet as { mode?: string })?.mode,
	});
};

const syncReplayStatus = ({ idle }: { idle: boolean }) => {
	if (!isReplayMode()) {
		forestStakeState.replayRunning = false;
		forestStakeState.replayStartRequested = false;
		forestStakeState.replayObservedRunning = false;
		return;
	}

	forestStakeState.replayRunning = !idle;

	if (!idle) {
		forestStakeState.replayStartRequested = false;
		forestStakeState.replayObservedRunning = true;
		return;
	}

	// Only a round we actually watched leave idle counts as played. This used to key off the
	// snapshot alone, which is present from boot — so the flag flipped on the first idle tick and
	// the button read "Replay Event" before the player had started anything.
	if (forestStakeState.replayObservedRunning) {
		forestStakeState.replayHasPlayed = true;
		forestStakeState.replayObservedRunning = false;
	}
};

const requestReplayStart = () => {
	if (!forestStakeState.replaySnapshot) {
		setBootError(t('REPLAY ERROR GENERIC'));
		logForestDiagnostic('error', 'replay_start_missing_snapshot');
		return false;
	}

	forestStakeState.replayStartRequested = true;
	forestStakeState.replayHasPlayed = false;
	forestStakeState.replayRunning = true;
	logForestDiagnostic('info', 'replay_start_requested', {
		eventId: forestStakeState.replayEventId,
		mode: selectedModeLabel(),
	});
	return true;
};

// The replay snapshot keeps the RGS round untouched (the resume flow consumes it as-is), so its
// amount/payout are in API micro-units (1e6 = $1) and must be scaled down for display — without
// this the replay HUD shows a $1 bet as $1,000,000.
const replayBetAmount = () => {
	const raw = (forestStakeState.replaySnapshot as { amount?: number })?.amount;
	return raw != null ? safeAmount(raw / API_AMOUNT_MULTIPLIER) : safeAmount(stateBet.betAmount);
};

const replayCostAmount = () => {
	return replayBetAmount() * modeCostMultiplier(replayModeKey());
};

const replayCostMultiplier = () => modeCostMultiplier(replayModeKey());

const replayPayoutAmount = () => {
	const raw = (forestStakeState.replaySnapshot as { payout?: number })?.payout;
	return raw != null ? safeAmount(raw / API_AMOUNT_MULTIPLIER) : 0;
};

// The round's own book is the one source that is always present in a replay — the endpoint has to
// return `state` for the replay to run at all, whereas `payout` / `payoutMultiplier` are optional
// on that response and the live RGS omits them. `finalWin` carries the round total in book units
// (100 = 1x the base bet), exactly as `setTotalWin` does during playback.
const replayBookPayoutMultiplier = () => {
	const state = (forestStakeState.replaySnapshot as { state?: unknown })?.state;
	if (!Array.isArray(state)) return 0;
	// Last one wins: a bonus book ends with the grand total, and re-scanning from the back also
	// skips the per-spin `setTotalWin` events entirely.
	for (let index = state.length - 1; index >= 0; index -= 1) {
		const event = state[index] as { type?: string; amount?: number } | null;
		if (event?.type === 'finalWin' && typeof event.amount === 'number') {
			return safeAmount(event.amount / BOOK_AMOUNT_MULTIPLIER);
		}
	}
	return 0;
};

// Stake defines this as payout / amount — both against the BASE bet the round was placed with
// (`/wallet/play` is sent `betAmount`, not the cost-multiplied total), so a 100x buy that pays
// back 150x the base bet reports 150x, not 1.5x. Dividing by the total cost, as this used to,
// under-reported every buy mode.
const replayPayoutMultiplier = () => {
	const snapshot = forestStakeState.replaySnapshot as
		| { payoutMultiplier?: number; payout?: number; amount?: number }
		| null;

	const reported = safeAmount(snapshot?.payoutMultiplier);
	if (reported > 0) return reported;

	const payout = safeAmount(snapshot?.payout);
	const wagered = safeAmount(snapshot?.amount);
	if (payout > 0 && wagered > 0) return payout / wagered;

	return replayBookPayoutMultiplier();
};

const replayWinAmount = () => {
	const payout = replayPayoutAmount();
	if (payout > 0) return payout;
	// No payout on the response — rebuild it from the multiplier the book gives us. (The old
	// fallback handed `winBookEventAmount` straight to the currency formatter, but that is a book
	// amount: a 3x win on a $1 bet would have rendered as $300.)
	return safeAmount(replayPayoutMultiplier() * replayBetAmount());
};

// Two formatters, not one with an optional digit count — the choice of function IS the compliance
// decision. Each currency carries its own decimal count in the RGS table (JPY/KRW/IDR are 0, the
// Gulf dinars are 3), so neither hardcodes 2.

/** Wallet money: balance, bet, buy-bonus costs, replay bet/cost. */
const formatCurrencyAmount = (amount: number) =>
	formatCurrencyAmountForCurrency(normalizeCurrency(stateBet.currency), safeAmount(amount));

/** Win money: replay payout/win. Expands to 4 decimals so sub-cent payouts stay exact. */
const formatWinCurrencyAmount = (amount: number) =>
	formatWinCurrencyAmountForCurrency(normalizeCurrency(stateBet.currency), safeAmount(amount));

const t = (key: string) => stateI18nDerived.translate(key);

const syncModalError = () => {
	if (stateModal.modal?.name !== 'error') return;
	const message =
		(stateModal.modal.error as { message?: string; error?: string } | undefined)?.message ||
		(stateModal.modal.error as { error?: string } | undefined)?.error ||
		t('REPLAY_ERROR_GENERIC');
	setBootError(String(message));
};

export const forestStakeDerived = {
	isReplayMode,
	selectedModeLabel,
	bootReady,
	setBootError,
	captureReplaySnapshot,
	cloneReplayBet,
	syncReplayStatus,
	requestReplayStart,
	syncModalError,
	replayBetAmount,
	replayCostAmount,
	replayCostMultiplier,
	replayPayoutAmount,
	replayPayoutMultiplier,
	replayWinAmount,
	formatCurrencyAmount,
	formatWinCurrencyAmount,
	t,
};

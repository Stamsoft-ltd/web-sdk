import { stateBet, stateI18nDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import type { BaseBet } from 'utils-bet';
import { formatCurrencyAmountForCurrency, normalizeCurrency } from '../lib/utils/currency';
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
		return;
	}

	forestStakeState.replayRunning = !idle;

	if (idle && forestStakeState.replaySnapshot) {
		forestStakeState.replayHasPlayed = true;
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

const replayBetAmount = () =>
	safeAmount((forestStakeState.replaySnapshot as { amount?: number })?.amount ?? stateBet.betAmount);

const replayCostAmount = () => {
	return replayBetAmount() * modeCostMultiplier(replayModeKey());
};

const replayCostMultiplier = () => modeCostMultiplier(replayModeKey());

const replayPayoutAmount = () =>
	safeAmount((forestStakeState.replaySnapshot as { payout?: number })?.payout);

const replayWinAmount = () => {
	const payout = replayPayoutAmount();
	return payout > 0 ? payout : safeAmount(stateBet.winBookEventAmount);
};

const replayPayoutMultiplier = () => {
	const cost = replayCostAmount();
	if (cost <= 0) return 0;
	return replayWinAmount() / cost;
};

const formatCurrencyAmount = (amount: number, fractionDigits = 2) =>
	formatCurrencyAmountForCurrency(normalizeCurrency(stateBet.currency), safeAmount(amount), fractionDigits);

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
	t,
};

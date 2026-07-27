import { stateBet, stateI18nDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import type { BaseBet } from 'utils-bet';
import { formatCurrencyAmountForCurrency, normalizeCurrency } from '../lib/utils/currency';
import { logDiagnostic } from '../utils/diagnostics';

type BootStatus = 'booting' | 'ready' | 'error';

export const templateStakeState = $state({
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
		logDiagnostic('error', 'replay_clone_failed', { message: String(error) });
		return null;
	}
};

const isReplayMode = () => stateUi.config.mode === 'replay' || stateUrlDerived.replay();

const replayModeKey = () =>
	String(
		(templateStakeState.replaySnapshot as { mode?: string })?.mode ||
			stateBet.activeBetModeKey ||
			stateUrlDerived.mode() ||
			'BASE',
	).toUpperCase();

const modeTitleKey = (mode: string) => {
	if (mode === 'ANTE') return 'BET MODE ANTE TITLE';
	if (mode === 'FSPIN1') return 'BET MODE FSPIN1 TITLE';
	if (mode === 'FSPIN2') return 'BET MODE FSPIN2 TITLE';
	if (mode === 'DUCK') return 'BET MODE DUCK TITLE';
	if (mode === 'ROLLER') return 'BET MODE ROLLER TITLE';
	if (mode === 'COASTER') return 'BET MODE COASTER TITLE';
	return 'BET MODE BASE TITLE';
};

const modeCostMultiplier = (mode: string) => {
	const multipliers: Record<string, number> = {
		BASE: 1,
		ANTE: 3,
		FSPIN1: 20,
		FSPIN2: 60,
		DUCK: 100,
		ROLLER: 200,
		COASTER: 500,
	};
	return multipliers[mode] ?? 1;
};

const selectedModeLabel = () => t(modeTitleKey(replayModeKey()));

const bootReady = () => {
	templateStakeState.bootStatus = 'ready';
	if (!templateStakeState.bootError) return;
	templateStakeState.bootError = '';
};

const setBootError = (message: string) => {
	templateStakeState.bootStatus = 'error';
	templateStakeState.bootError = message;
	logDiagnostic('error', 'boot_error', {
		message,
		mode: stateUi.config.mode,
		replay: isReplayMode(),
		pendingRoundDetected: templateStakeState.pendingRoundDetected,
	});
};

const captureReplaySnapshot = (bet: BaseBet | null) => {
	if (!bet) return;
	const snapshot = cloneReplayBet(bet);
	if (!snapshot) {
		setBootError(t('REPLAY ERROR GENERIC'));
		return;
	}
	templateStakeState.replaySnapshot = snapshot;
	templateStakeState.replayEventId = stateUrlDerived.event() || String((bet as { event?: string | number })?.event ?? '');
	logDiagnostic('info', 'replay_snapshot_captured', {
		eventId: templateStakeState.replayEventId,
		mode: (bet as { mode?: string })?.mode,
	});
};

const syncReplayStatus = ({ idle }: { idle: boolean }) => {
	if (!isReplayMode()) {
		templateStakeState.replayRunning = false;
		templateStakeState.replayStartRequested = false;
		return;
	}

	templateStakeState.replayRunning = !idle;

	if (idle && templateStakeState.replaySnapshot) {
		templateStakeState.replayHasPlayed = true;
	}
};

const requestReplayStart = () => {
	if (!templateStakeState.replaySnapshot) {
		setBootError(t('REPLAY ERROR GENERIC'));
		logDiagnostic('error', 'replay_start_missing_snapshot');
		return false;
	}

	templateStakeState.replayStartRequested = true;
	templateStakeState.replayHasPlayed = false;
	templateStakeState.replayRunning = true;
	logDiagnostic('info', 'replay_start_requested', {
		eventId: templateStakeState.replayEventId,
		mode: selectedModeLabel(),
	});
	return true;
};

const replayBetAmount = () => {
	const raw = (templateStakeState.replaySnapshot as { amount?: number })?.amount;
	return raw != null ? safeAmount(raw / API_AMOUNT_MULTIPLIER) : safeAmount(stateBet.betAmount);
};

const replayCostAmount = () => replayBetAmount() * modeCostMultiplier(replayModeKey());

const replayCostMultiplier = () => modeCostMultiplier(replayModeKey());

const replayPayoutAmount = () => {
	const raw = (templateStakeState.replaySnapshot as { payout?: number })?.payout;
	return raw != null ? safeAmount(raw / API_AMOUNT_MULTIPLIER) : 0;
};

const replayWinAmount = () => {
	const payout = replayPayoutAmount();
	return payout > 0 ? payout : safeAmount(stateBet.winBookEventAmount);
};

const replayPayoutMultiplier = () => {
	const cost = replayCostAmount();
	return cost > 0 ? replayWinAmount() / cost : 0;
};

const formatCurrencyAmount = (amount: number, fractionDigits = 2) =>
	formatCurrencyAmountForCurrency(normalizeCurrency(stateBet.currency), safeAmount(amount), fractionDigits);

const t = (key: string) => stateI18nDerived.translate(key);

const syncModalError = () => {
	if (stateModal.modal?.name !== 'error') return;
	const message =
		(stateModal.modal.error as { message?: string; error?: string } | undefined)?.message ||
		(stateModal.modal.error as { error?: string } | undefined)?.error ||
		t('REPLAY ERROR GENERIC');
	setBootError(String(message));
};

export const templateStakeDerived = {
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

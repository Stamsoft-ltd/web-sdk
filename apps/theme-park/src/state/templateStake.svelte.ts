import { stateBet, stateI18nDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import type { BaseBet } from 'utils-bet';
import { bookEventAmountToNormalisedAmount } from 'utils-shared/amount';
import { formatWalletAmount, formatWinAmount } from '../lib/utils/currency';
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
	if (payout > 0) return payout;
	// winBookEventAmount is a BOOK amount (100 = one times the wagered bet), not currency. Handing
	// it straight to a money formatter printed a 50.01x win as "$5,001.00".
	return safeAmount(bookEventAmountToNormalisedAmount(safeAmount(stateBet.winBookEventAmount)));
};

const replayPayoutMultiplier = () => {
	// The RGS reports payoutMultiplier as payout / amount, so it reconciles exactly against the
	// base bet and the settled payout. Deriving it from win / total-cost instead yields repeating
	// decimals — a $50.00 win on a $3.00 ANTE cost reads 16.67x, and 16.67 x 3 is $50.01, not
	// $50.00 — which is how this reached review as a wrong payout.
	const raw = (templateStakeState.replaySnapshot as { payoutMultiplier?: number })?.payoutMultiplier;
	if (raw != null && Number.isFinite(Number(raw))) return safeAmount(raw);

	const bet = replayBetAmount();
	return bet > 0 ? replayWinAmount() / bet : 0;
};

/**
 * The two money contracts, in this game's currency. Never one function with a digit count — that
 * optional argument is exactly how a balance grew a third decimal past review (R-01).
 */
/** Balance, bet, buy prices, replay cost: the currency's own decimals, no expansion. */
const formatWallet = (amount: number) => formatWalletAmount(stateBet.currency, safeAmount(amount));
/** Anything the player WON: the exact settled value, expanding past those decimals when needed. */
const formatWin = (amount: number) => formatWinAmount(stateBet.currency, safeAmount(amount));

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
	formatWallet,
	formatWin,
	t,
};

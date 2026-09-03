import { API_AMOUNT_MULTIPLIER, BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet, stateI18nDerived, stateModal, stateUi, stateUrlDerived } from 'state-shared';
import type { BaseBet } from 'utils-bet';
import { formatWalletAmount, formatWinAmount } from 'utils-shared/currency';

type BootStatus = 'booting' | 'ready' | 'error';

export const veggieStakeState = $state({
	bootStatus: 'booting' as BootStatus,
	bootError: '',
	replaySnapshot: null as BaseBet | null,
	replayEventId: '',
	replayRunning: false,
	replayHasPlayed: false,
	replayStartRequested: false,
	replayObservedRunning: false,
	pendingRoundDetected: false,
});

const safeNumber = (value: unknown) => {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
};

const cloneReplayBet = <T>(value: T): T | null => {
	const seen = new WeakSet<object>();
	try {
		return JSON.parse(
			JSON.stringify(value, (_key, item) => {
				if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint')
					return undefined;
				if (!item || typeof item !== 'object') return item;
				if (typeof window !== 'undefined' && item === window) return undefined;
				if (seen.has(item)) return undefined;
				seen.add(item);
				const constructorName = (item as { constructor?: { name?: string } }).constructor?.name;
				if (!Array.isArray(item) && constructorName && constructorName !== 'Object')
					return undefined;
				return item;
			}),
		) as T;
	} catch {
		return null;
	}
};

const isReplayMode = () => stateUi.config.mode === 'replay' || stateUrlDerived.replay();
const replayMode = () =>
	String(
		(veggieStakeState.replaySnapshot as { mode?: string })?.mode ||
			stateBet.activeBetModeKey ||
			stateUrlDerived.mode() ||
			'BASE',
	).toUpperCase();

const modeCostMultiplier = () => {
	const snapshotCost = safeNumber(
		(veggieStakeState.replaySnapshot as { costMultiplier?: number })?.costMultiplier,
	);
	if (snapshotCost > 0) return snapshotCost;
	return replayMode() === 'CHANCE'
		? 2
		: replayMode() === 'FEATURE'
			? 20
			: replayMode() === 'BONUS'
				? 100
				: replayMode() === 'MYSTERY'
					? 300
					: replayMode() === 'SUPER'
						? 400
						: 1;
};

const modeTitle = () => {
	const mode = replayMode();
	const key =
		mode === 'CHANCE'
			? 'MODE CHANCE TITLE'
			: mode === 'FEATURE'
				? 'MODE FEATURE TITLE'
				: mode === 'BONUS'
					? 'MODE BONUS TITLE'
					: mode === 'MYSTERY'
						? 'MODE MYSTERY TITLE'
						: mode === 'SUPER'
							? 'MODE SUPER TITLE'
							: 'BET MODE BASE TITLE';
	return stateI18nDerived.translate(key);
};

const bootReady = () => {
	veggieStakeState.bootStatus = 'ready';
	veggieStakeState.bootError = '';
};

const setBootError = (message: string) => {
	veggieStakeState.bootStatus = 'error';
	veggieStakeState.bootError = message;
};

const captureReplaySnapshot = (bet: BaseBet | null) => {
	if (!bet) return;
	const clone = cloneReplayBet(bet);
	if (!clone) {
		setBootError(stateI18nDerived.translate('REPLAY ERROR GENERIC'));
		return;
	}
	veggieStakeState.replaySnapshot = clone;
	veggieStakeState.replayEventId =
		stateUrlDerived.event() || String((bet as { event?: string | number })?.event ?? '');
};

const syncReplayStatus = (idle: boolean) => {
	if (!isReplayMode()) {
		veggieStakeState.replayRunning = false;
		veggieStakeState.replayStartRequested = false;
		veggieStakeState.replayObservedRunning = false;
		return;
	}

	veggieStakeState.replayRunning = !idle;
	if (!idle) {
		veggieStakeState.replayStartRequested = false;
		veggieStakeState.replayObservedRunning = true;
		return;
	}
	if (veggieStakeState.replayObservedRunning) {
		veggieStakeState.replayObservedRunning = false;
		veggieStakeState.replayHasPlayed = true;
	}
};

const requestReplayStart = () => {
	if (!veggieStakeState.replaySnapshot) {
		setBootError(stateI18nDerived.translate('REPLAY ERROR GENERIC'));
		return false;
	}
	veggieStakeState.replayHasPlayed = false;
	veggieStakeState.replayRunning = true;
	veggieStakeState.replayStartRequested = true;
	stateBet.activeBetModeKey = replayMode();
	return true;
};

// Replay response amounts are RGS micro-units. Book finalWin amounts remain x100 multipliers.
const replayBetAmount = () => {
	const raw = (veggieStakeState.replaySnapshot as { amount?: number })?.amount;
	return raw == null ? safeNumber(stateBet.betAmount) : safeNumber(raw) / API_AMOUNT_MULTIPLIER;
};
const replayCostAmount = () => replayBetAmount() * modeCostMultiplier();
const replayBookPayoutMultiplier = () => {
	const events = (veggieStakeState.replaySnapshot as { state?: unknown })?.state;
	if (!Array.isArray(events)) return 0;
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index] as { type?: string; amount?: number };
		if (event?.type === 'finalWin') return safeNumber(event.amount) / BOOK_AMOUNT_MULTIPLIER;
	}
	return 0;
};
const replayPayoutMultiplier = () => {
	const snapshot = veggieStakeState.replaySnapshot as {
		payoutMultiplier?: number;
		payout?: number;
		amount?: number;
	} | null;
	const reported = safeNumber(snapshot?.payoutMultiplier);
	if (reported > 0) return reported;
	if (safeNumber(snapshot?.payout) > 0 && safeNumber(snapshot?.amount) > 0)
		return safeNumber(snapshot?.payout) / safeNumber(snapshot?.amount);
	return replayBookPayoutMultiplier();
};
const replayWinAmount = () => {
	const payout = safeNumber((veggieStakeState.replaySnapshot as { payout?: number })?.payout);
	return payout > 0 ? payout / API_AMOUNT_MULTIPLIER : replayBetAmount() * replayPayoutMultiplier();
};

const formatAmount = (amount: number) => formatWalletAmount(stateBet.currency, safeNumber(amount));
const formatWin = (amount: number) => formatWinAmount(stateBet.currency, safeNumber(amount));

const syncModalError = () => {
	if (stateModal.modal?.name !== 'error') return;
	const error = stateModal.modal.error as { message?: string; error?: string } | undefined;
	setBootError(
		String(error?.message || error?.error || stateI18nDerived.translate('REPLAY ERROR GENERIC')),
	);
};

export const veggieStakeDerived = {
	isReplayMode,
	replayMode,
	modeTitle,
	modeCostMultiplier,
	bootReady,
	setBootError,
	captureReplaySnapshot,
	cloneReplayBet,
	syncReplayStatus,
	requestReplayStart,
	syncModalError,
	replayBetAmount,
	replayCostAmount,
	replayPayoutMultiplier,
	replayWinAmount,
	formatAmount,
	formatWin,
	t: (key: string) => stateI18nDerived.translate(key),
};

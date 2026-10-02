import { fromPromise } from 'xstate';

import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import {
	stateBet,
	stateBetDerived,
	stateConfig,
	stateUrlDerived,
	stateModal,
	modalErrorCodeFrom,
} from 'state-shared';
import { requestBet, requestEndRound } from 'rgs-requests';

import type { BaseBet } from './types';

const handleRequestBet = async ({ onError }: { onError: () => void }) => {
	try {
		const data = await requestBet({
			rgsUrl: stateUrlDerived.rgsUrl(),
			sessionID: stateUrlDerived.sessionID(),
			currency: stateBet.currency,
			mode: stateBet.activeBetModeKey,
			amount: stateBet.betAmount,
		});

		if (data?.error) {
			throw data;
		}

		if (data?.round?.state && data?.round?.state?.length > 0) {
			stateBet.wageredBetAmount = stateBet.betAmount;

			return data;
		} else {
			throw {
				error: 'Empty state in data.round',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		onError();
		stateBet.autoSpinsCounter = 0;
		// A held-spin loop must not fire another play request as soon as the failed actor settles.
		stateBet.isSpaceHold = false;
		// The bet machine falls through to 'end' -> parent 'idle' from here, so the game stays
		// playable: let the player dismiss this and retry rather than stranding them on the modal.
		// Only a dead session has nothing to go back to. The modal shows translated copy for the
		// code; the raw payload stays in the console (STAKE_REVIEW_LESSONS R-06 / R-07).
		const code = modalErrorCodeFrom(error);
		stateModal.modal = { name: 'error', error, code, recoverable: code !== 'session' };
		console.error(error);
		throw error;
	}
};

const handleRequestEndRound = async () => {
	if (stateUrlDerived.replay()) return;

	try {
		const data = await requestEndRound({
			sessionID: stateUrlDerived.sessionID(),
			rgsUrl: stateUrlDerived.rgsUrl(),
		});

		if (data?.error) {
			throw data;
		}

		if (data?.balance?.amount !== undefined) {
			return data;
		} else {
			throw {
				error: 'Empty amount in data.balance',
				message: JSON.stringify({ data }),
			};
		}
	} catch (error) {
		console.error(error);
	}
};

const handleUpdateBalance = ({ balanceAmountFromApi }: { balanceAmountFromApi: number }) => {
	stateBet.balanceAmount = balanceAmountFromApi / API_AMOUNT_MULTIPLIER;
};

// Jurisdiction `minimumRoundDuration`: a round (request -> presentation -> settle) may not finish
// faster than this, whatever the turbo setting. 0 (the default everywhere) is a no-op.
// The RGS config does not document the unit; values of 60 or less are read as seconds and larger
// values as milliseconds, so both "2.5" and "2500" mean two and a half seconds.
const minimumRoundDurationMs = () => {
	const raw = Number(stateConfig.jurisdiction?.minimumRoundDuration ?? 0);
	if (!Number.isFinite(raw) || raw <= 0) return 0;
	return raw <= 60 ? raw * 1000 : raw;
};

let roundStartedAt = 0;
const markRoundStart = () => {
	roundStartedAt = Date.now();
};
const waitForMinimumRoundDuration = async () => {
	const minimum = minimumRoundDurationMs();
	if (!minimum || !roundStartedAt || stateUrlDerived.replay()) return;
	const remaining = minimum - (Date.now() - roundStartedAt);
	if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
};

type Options<TBet extends BaseBet> = {
	onResumeGameActive: (betToResume: TBet) => TBet;
	onResumeGameInactive: (betToResume: TBet) => void;
	onNewGameStart: () => Promise<void> | undefined;
	onNewGameError: () => any;
	onPlayGame: (bet: TBet) => Promise<void>;
	checkIsBonusGame: (bet: TBet) => boolean;
};

function createPrimaryMachines<TBet extends BaseBet>(options: Options<TBet>) {
	const {
		onResumeGameActive,
		onResumeGameInactive,
		onNewGameStart,
		onNewGameError,
		onPlayGame,
		checkIsBonusGame,
	} = options;

	let balanceAmountFromApiHolder: null | number = null;

	const failInsufficientFunds = (onError: () => void) => {
		onError();
		stateBet.autoSpinsCounter = 0;
		// Console-only description: the modal renders the translated copy for the code, so no
		// player-facing English is produced down here (STAKE_REVIEW_LESSONS R-07).
		const error = new Error('Insufficient balance for the selected bet cost');
		// Nothing was wagered — the player only has to lower the bet level, so this must be
		// dismissible. `code` lets the modal show the translated (and social-override) copy.
		stateModal.modal = { name: 'error', error, code: 'insufficientFunds', recoverable: true };
		throw error;
	};

	const BET_TYPE_METHODS_MAP = {
		noWin: {
			newGame: async () => undefined,
			endGame: async () => undefined,
		},
		singleRoundWin: {
			newGame: async () => {
				const endRoundData = await handleRequestEndRound();
				if (endRoundData?.balance) {
					balanceAmountFromApiHolder = endRoundData.balance.amount;
				}
			},
			endGame: async () => {
				if (balanceAmountFromApiHolder !== null) {
					handleUpdateBalance({ balanceAmountFromApi: balanceAmountFromApiHolder });
					balanceAmountFromApiHolder = null;
				}
			},
		},
		bonusWin: {
			newGame: async () => undefined,
			endGame: async () => {
				const data = await handleRequestEndRound();
				if (data?.balance) {
					handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
					balanceAmountFromApiHolder = null;
				}
			},
		},
	} as const;

	const getBetType: (args: { bet: TBet }) => keyof typeof BET_TYPE_METHODS_MAP = ({ bet }) => {
		const isBonusGame = checkIsBonusGame(bet);

		if (bet.active === true) {
			if (isBonusGame) return 'bonusWin';
		}

		if (bet.payoutMultiplier && bet.payoutMultiplier > 0) {
			if (isBonusGame) return 'bonusWin';
			return 'singleRoundWin';
		}

		return 'noWin';
	};

	// newGame
	const newGame = fromPromise(async () => {
		markRoundStart();
		if (!stateBetDerived.isBetCostAvailable()) {
			failInsufficientFunds(onNewGameError);
		}

		await onNewGameStart();

		const data = await handleRequestBet({ onError: onNewGameError });

		if (data) {
			if (data.balance) {
				handleUpdateBalance({ balanceAmountFromApi: data.balance.amount });
			}

			const bet = data.round as TBet;
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet };
		}

		return { bet: null };
	});

	// resumeGame
	const resumeGame = fromPromise(async () => {
		const betToResume = stateBet.betToResume as TBet;

		if (betToResume && betToResume.active) {
			markRoundStart();
			// Optional chaining doesn't work here with build-node. 🤷‍♂️
			stateBet.betToResume = null;

			//End Round resumed active bet
			const bet = betToResume as TBet;
			const betType = getBetType({ bet });
			await BET_TYPE_METHODS_MAP[betType].newGame();

			return { bet: onResumeGameActive(betToResume), rawBet: betToResume };
		}

		if (betToResume && betToResume.state && betToResume.state.length > 0) {
			onResumeGameInactive(betToResume);
		}

		throw new Error('inactive Bet');
	});

	// playGame
	const playGame = fromPromise<void, { bet: TBet | null }>(async ({ input }) => {
		if (input.bet) await onPlayGame(input.bet); // context.bet is hydrated from newGame
	});

	// endGame
	const endGame = fromPromise<void, { bet: TBet | null; rawBet: TBet | null }>(
		async ({ input }) => {
			const targetBet = input.rawBet || input.bet;
			if (targetBet) {
				const betType = getBetType({ bet: targetBet });
				await BET_TYPE_METHODS_MAP[betType].endGame();
			}
			await waitForMinimumRoundDuration();
		},
	);

	return {
		newGame,
		playGame,
		endGame,
		resumeGame,
	};
}

export { createPrimaryMachines };

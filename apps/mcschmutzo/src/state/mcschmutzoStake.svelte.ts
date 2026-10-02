import { stateBet } from 'state-shared';

import { formatWalletAmount, formatWinAmount, normalizeCurrency } from '../lib/utils/currency';

const safeAmount = (value: unknown) => {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
};

/** Wallet money (balance, bet, buy costs, autoplay limits): exactly the currency's decimals. */
const formatCurrencyAmount = (amount: number) =>
	formatWalletAmount(normalizeCurrency(stateBet.currency), safeAmount(amount));

/** Win money in currency units: the exact settled value, up to 4 decimals, never "0.00". */
const formatWinCurrencyAmount = (amount: number) =>
	formatWinAmount(normalizeCurrency(stateBet.currency), safeAmount(amount));

export const mcschmutzoStakeDerived = {
	formatCurrencyAmount,
	formatWinCurrencyAmount,
};

import { stateBet } from 'state-shared';

import {
	formatCurrencyAmountForCurrency,
	normalizeCurrency,
} from '../lib/utils/currency';

const safeAmount = (value: unknown) => {
	const amount = Number(value);
	return Number.isFinite(amount) ? amount : 0;
};

const formatCurrencyAmount = (amount: number, fractionDigits = 2) =>
	formatCurrencyAmountForCurrency(
		normalizeCurrency(stateBet.currency),
		safeAmount(amount),
		fractionDigits,
	);

export const mcschmutzoStakeDerived = {
	formatCurrencyAmount,
};

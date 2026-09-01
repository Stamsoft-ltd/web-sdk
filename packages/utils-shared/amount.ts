import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

import { formatWinAmount } from './currency';

// bookEventAmount: is the amount or win numbers in the events of books, e.g. the amount in setTotalWin bookEvent
// {
// 	"index": 3,
// 	"type": "setTotalWin",
// 	"amount": 100
// },
// if betting on $1,   100 bookEventAmount equals to $1.    betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $1,    50 bookEventAmount equals to $0.5.  betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5
// if betting on $0.5, 100 bookEventAmount equals to $0.5.  betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $0.5,  50 bookEventAmount equals to $0.25. betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5

export const bookEventAmountToBetAmountMultiplier = (bookEventAmount: number) =>
	bookEventAmount / BOOK_AMOUNT_MULTIPLIER;

export const bookEventAmountToNormalisedAmount = (bookEventAmount: number) => {
	const betAmountMultiplier = bookEventAmountToBetAmountMultiplier(bookEventAmount);
	return stateBet.wageredBetAmount * betAmountMultiplier;
};

export const numberToFloat = (value: number) => Number.parseFloat(`${value}`);

// Sub-cent payouts: a genuine non-zero win must never render as a flat "0.00" (Stake
// pre-submission requirement). Re-exported from the currency module so the win readout and the
// HUD balance/bet agree on precision.
export { fractionDigitsForAmount } from './currency';

// Formats via the RGS-documented currency table rather than Intl's own currency rendering, so a
// win shows the same symbol, decimal count and symbol placement as the balance. Previously only
// XGC/XSC were special-cased here and every other code went through Intl, which disagreed with the
// spec for ~20 currencies (e.g. "PLN 10.00" instead of "10.00 zł") and omitted XEC entirely.
//
// Everything that reaches this function is WIN money — it is fed from book-event amounts — so it
// takes the win contract: the currency's decimals as a floor, expanding to show the exact settled
// value. See `formatWinAmount`, and R-01 in STAKE_REVIEW_LESSONS.md for why the two classes of
// money cannot share one formatter.
export const numberToCurrencyString = (value: number) => formatWinAmount(stateBet.currency, value);

export const bookEventAmountToCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToCurrencyString(normalisedAmount);
};

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

import { formatWalletAmount, formatWinAmount } from './currency';

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

export { fractionDigitsForAmount } from './currency';

// Money on screen has TWO display contracts, and Stake reviews them separately:
//
//   wallet (balance, bet, costs) -> exactly the currency's decimals. A balance must never grow a
//     third decimal just because the float is precise; "$999.946" was rejected 2026-08-20.
//   win (spin/round/total, countups) -> the exact settled value, up to 4 decimals, so a sub-cent
//     payout reads "$0.0016" rather than "$0.00".
//
// These two used to share one expanding formatter, which satisfied the win rule and broke the
// wallet rule. Keep them separate: the function you call IS the compliance decision.
//
// Both format via the RGS-documented currency table rather than Intl's own currency rendering, so
// symbol, decimal count and symbol placement match the spec (Intl renders PLN as "PLN 10.00"
// rather than "10.00 zł", and has no notion of XGC/XSC/XEC at all).

/** Wallet money in currency units: balance, bet, total cost, buy-bonus prices, autoplay limits. */
export const numberToCurrencyString = (value: number) =>
	formatWalletAmount(stateBet.currency, value);

/** Win money in currency units. Prefer `bookEventAmountToCurrencyString` for book amounts. */
export const numberToWinCurrencyString = (value: number) =>
	formatWinAmount(stateBet.currency, value);

/** Win money from a book-event amount — the normal path for every win readout. */
export const bookEventAmountToCurrencyString = (bookEventAmount: number) =>
	numberToWinCurrencyString(bookEventAmountToNormalisedAmount(bookEventAmount));

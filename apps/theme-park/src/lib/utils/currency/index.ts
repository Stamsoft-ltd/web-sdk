/**
 * Money formatting for this game, which is the shared RGS currency table and nothing else.
 *
 * This module used to carry its own 21-entry copy of that table, and both of the things it did
 * differently were review findings waiting to happen (R-01 in STAKE_REVIEW_LESSONS.md):
 *
 *   - A code outside its 21 was coerced to USD, so a player holding NOK, SGD, PKR or any of the
 *     other 28 the RGS actually supports saw their balance in dollars.
 *   - Every amount was rendered with two decimals, so JPY, KRW, IDR, VND, CLP and XOF — all
 *     zero-decimal currencies — read `¥1,234.50`, and the three-decimal Gulf dinars lost a digit.
 *
 * Both are fixed by not having a second table. `utils-shared/currency` is transcribed from the RGS
 * specification, renders an unrecognised code after the amount instead of guessing a symbol, and
 * splits wallet money from win money into two functions that cannot be confused at a call site.
 */
export {
	formatWalletAmount,
	formatWinAmount,
	metaFor,
	normalizeCurrency,
	SUPPORTED_CURRENCIES,
	type Currency,
} from 'utils-shared/currency';

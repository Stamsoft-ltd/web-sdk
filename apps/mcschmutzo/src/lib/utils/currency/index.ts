// McSchmutzo money formatting is the shared Stake currency table (packages/utils-shared/currency.ts).
// The game used to carry its own copy here, which expanded precision on EVERY amount — so a wallet
// balance could grow a third decimal ("$999.946") and a 0.0016 win was cut to "$0.002". Both
// contracts are now the shared ones (STAKE_REVIEW_LESSONS R-01):
//   wallet (balance, bet, costs, autoplay) -> exactly the currency's decimals (0 for JPY, 3 for KWD)
//   win (spin/round/total)                 -> the exact settled value, up to 4 decimals, never 0.00
import {
	normalizeCurrency as normalizeCurrencyShared,
	formatWalletAmount,
	formatWinAmount,
	isSupportedCurrency,
	SUPPORTED_CURRENCIES as SUPPORTED_CURRENCIES_SHARED,
	type Currency,
} from 'utils-shared/currency';

export type SupportedCurrency = Currency;

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = SUPPORTED_CURRENCIES_SHARED;

/** Uppercased currency code. Unknown codes are kept (rendered as "1.00 ABC"), never coerced to USD. */
export const normalizeCurrency = (raw: unknown): string => normalizeCurrencyShared(raw);

export { formatWalletAmount, formatWinAmount, isSupportedCurrency };

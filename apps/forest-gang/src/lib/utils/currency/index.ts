// The canonical Stake Engine currency table lives in utils-shared so the HUD formatter
// (utils-shared/amount) and this module cannot drift apart. See packages/utils-shared/currency.ts.
import {
	formatWalletAmount,
	formatWinAmount,
	normalizeCurrency as normalizeCurrencyCode,
	SUPPORTED_CURRENCIES as SUPPORTED,
	type Currency,
} from 'utils-shared/currency';

export type SupportedCurrency = Currency;
export const SUPPORTED_CURRENCIES = SUPPORTED;

export { normalizeCurrencyCode as normalizeCurrency };

/**
 * Wallet money: balance, bet, costs. Fixed at the currency's decimal count.
 *
 * This used to forward to the expanding `formatCurrencyAmount`, which rendered a balance of
 * 999.946 as "$999.946" — the formatting Stake rejected on magnetic 2026-08-20. Wins go through
 * `formatWinCurrencyAmountForCurrency` instead, which keeps the sub-cent expansion.
 */
export function formatCurrencyAmountForCurrency(currency: string, amount: number) {
	return formatWalletAmount(currency, amount);
}

/** Win money: spin/round/total wins and replay payout. Exact value, up to 4 decimals. */
export function formatWinCurrencyAmountForCurrency(currency: string, amount: number) {
	return formatWinAmount(currency, amount);
}

// The canonical Stake Engine currency table lives in utils-shared so the HUD formatter
// (utils-shared/amount) and this module cannot drift apart. See packages/utils-shared/currency.ts.
import {
	formatCurrencyAmount,
	normalizeCurrency as normalizeCurrencyCode,
	SUPPORTED_CURRENCIES as SUPPORTED,
	type Currency,
} from 'utils-shared/currency';

export type SupportedCurrency = Currency;
export const SUPPORTED_CURRENCIES = SUPPORTED;

export { normalizeCurrencyCode as normalizeCurrency };

export function formatCurrencyAmountForCurrency(
	currency: string,
	amount: number,
	fractionDigits?: number,
) {
	return formatCurrencyAmount(currency, amount, fractionDigits);
}

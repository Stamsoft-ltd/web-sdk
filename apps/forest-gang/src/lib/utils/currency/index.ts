export type SupportedCurrency =
	| 'USD'
	| 'CAD'
	| 'JPY'
	| 'EUR'
	| 'RUB'
	| 'CNY'
	| 'PHP'
	| 'INR'
	| 'IDR'
	| 'KRW'
	| 'BRL'
	| 'MXN'
	| 'DKK'
	| 'PLN'
	| 'VND'
	| 'TRY'
	| 'CLP'
	| 'ARS'
	| 'PEN'
	| 'XGC'
	| 'XSC';

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
	'USD',
	'CAD',
	'JPY',
	'EUR',
	'RUB',
	'CNY',
	'PHP',
	'INR',
	'IDR',
	'KRW',
	'BRL',
	'MXN',
	'DKK',
	'PLN',
	'VND',
	'TRY',
	'CLP',
	'ARS',
	'PEN',
	'XGC',
	'XSC',
];

const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);
// Social-coin display prefixes. Must match the codes shown across the game (Gold Coins =
// "GC", Sweeps Coins = "SC") — a bare "G" mismatched the HUD formatter in utils-shared.
const SOCIAL_CURRENCY_SYMBOL: Record<'XGC' | 'XSC', string> = {
	XGC: 'GC',
	XSC: 'SC',
};

export function normalizeCurrency(raw: unknown): SupportedCurrency {
	const code = String(raw ?? '').trim().toUpperCase();
	return CURRENCY_SET.has(code) ? (code as SupportedCurrency) : 'USD';
}

// Sub-cent payouts must never render as a flat "0.00": grow the fraction digits until the
// value shows a non-zero figure, capped so we never spill trailing noise. Normal amounts
// keep the requested precision (default 2).
const MAX_FRACTION_DIGITS = 8;
function effectiveFractionDigits(value: number, min: number) {
	const abs = Math.abs(value);
	if (abs === 0) return min;
	let digits = min;
	while (digits < MAX_FRACTION_DIGITS && Number(abs.toFixed(digits)) === 0) {
		digits += 1;
	}
	return digits;
}

export function formatCurrencyAmountForCurrency(
	currency: SupportedCurrency,
	amount: number,
	fractionDigits = 2,
) {
	const value = Number.isFinite(amount) ? amount : 0;
	const digits = effectiveFractionDigits(value, fractionDigits);
	if (currency === 'XGC' || currency === 'XSC') {
		const sign = value < 0 ? '-' : '';
		const abs = Math.abs(value);
		return `${sign}${SOCIAL_CURRENCY_SYMBOL[currency]}${abs.toFixed(digits)}`;
	}
	try {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency,
			currencyDisplay: 'symbol',
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: digits,
		}).format(value);
	} catch {
		return `${value.toFixed(digits)} ${currency}`;
	}
}

// Stake Engine supported currencies and their display rules.
//
// Transcribed from the RGS specification's `CurrencyMeta` table:
// https://stake-engine.com/docs/rgs  ("Supported Currencies")
//
// Symbol, decimal count and symbol placement all come from that table — they are NOT what
// `Intl.NumberFormat('en-US', { style: 'currency' })` produces for many of these codes (it renders
// PLN as "PLN 10.00" rather than "10.00 zł", NOK as "NOK 10.00" rather than "kr10.00", and so on),
// which is why the formatting below is done by hand instead of delegating to Intl.

export type Currency =
	| 'USD' // United States Dollar
	| 'CAD' // Canadian Dollar
	| 'JPY' // Japanese Yen
	| 'EUR' // Euro
	| 'RUB' // Russian Ruble
	| 'CNY' // Chinese Yuan
	| 'PHP' // Philippine Peso
	| 'INR' // Indian Rupee
	| 'IDR' // Indonesian Rupiah
	| 'KRW' // South Korean Won
	| 'BRL' // Brazilian Real
	| 'MXN' // Mexican Peso
	| 'DKK' // Danish Krone
	| 'PLN' // Polish Złoty
	| 'VND' // Vietnamese Đồng
	| 'TRY' // Turkish Lira
	| 'CLP' // Chilean Peso
	| 'ARS' // Argentine Peso
	| 'PEN' // Peruvian Sol
	| 'NGN' // Nigerian Naira
	| 'SAR' // Saudi Riyal
	| 'ILS' // Israeli New Shekel
	| 'AED' // UAE Dirham
	| 'TWD' // Taiwan New Dollar
	| 'NOK' // Norwegian Krone
	| 'KWD' // Kuwaiti Dinar
	| 'JOD' // Jordanian Dinar
	| 'CRC' // Costa Rican Colon
	| 'TND' // Tunisian Dinar
	| 'SGD' // Singapore Dollar
	| 'MYR' // Malaysian Ringgit
	| 'OMR' // Omani Rial
	| 'QAR' // Qatari Riyal
	| 'BHD' // Bahraini Dinar
	| 'PKR' // Pakistani Rupee
	| 'EGP' // Egyptian Pound
	| 'NZD' // New Zealand Dollar
	| 'BOB' // Bolivian Boliviano
	| 'GHS' // Ghanaian Cedi
	| 'KES' // Kenyan Shilling
	| 'MAD' // Moroccan Dirham
	| 'BAM' // Bosnia Convertible Mark
	| 'ISK' // Icelandic Krona
	| 'TZS' // Tanzanian Shilling
	| 'UGX' // Ugandan Shilling
	| 'XOF' // West African CFA Franc
	| 'XGC' // Stake Gold Coin
	| 'XSC' // Stake Cash
	| 'XEC'; // Stake Euro Cash

export type CurrencyMeta = { symbol: string; decimals: number; symbolAfter?: boolean };

export const CURRENCY_META: Record<Currency, CurrencyMeta> = {
	USD: { symbol: '$', decimals: 2 },
	CAD: { symbol: 'CA$', decimals: 2 },
	JPY: { symbol: '¥', decimals: 0 },
	EUR: { symbol: '€', decimals: 2 },
	RUB: { symbol: '₽', decimals: 2 },
	CNY: { symbol: 'CN¥', decimals: 2 },
	PHP: { symbol: '₱', decimals: 2 },
	INR: { symbol: '₹', decimals: 2 },
	IDR: { symbol: 'Rp', decimals: 0 },
	KRW: { symbol: '₩', decimals: 0 },
	BRL: { symbol: 'R$', decimals: 2 },
	MXN: { symbol: 'MX$', decimals: 2 },
	DKK: { symbol: 'KR', decimals: 2, symbolAfter: true },
	PLN: { symbol: 'zł', decimals: 2, symbolAfter: true },
	VND: { symbol: '₫', decimals: 0, symbolAfter: true },
	TRY: { symbol: '₺', decimals: 2 },
	CLP: { symbol: 'CLP', decimals: 0, symbolAfter: true },
	ARS: { symbol: 'ARS', decimals: 2, symbolAfter: true },
	PEN: { symbol: 'S/', decimals: 2, symbolAfter: true },
	NGN: { symbol: '₦', decimals: 2 },
	SAR: { symbol: 'SAR', decimals: 2, symbolAfter: true },
	ILS: { symbol: '₪', decimals: 2 },
	AED: { symbol: 'AED', decimals: 2, symbolAfter: true },
	TWD: { symbol: 'NT$', decimals: 2 },
	NOK: { symbol: 'kr', decimals: 2, symbolAfter: true },
	KWD: { symbol: 'KD', decimals: 3 },
	JOD: { symbol: 'JD', decimals: 3 },
	CRC: { symbol: '₡', decimals: 2 },
	TND: { symbol: 'TND', decimals: 3, symbolAfter: true },
	SGD: { symbol: 'SG$', decimals: 2 },
	MYR: { symbol: 'RM', decimals: 2 },
	OMR: { symbol: 'OMR', decimals: 3, symbolAfter: true },
	QAR: { symbol: 'QAR', decimals: 2, symbolAfter: true },
	BHD: { symbol: 'BD', decimals: 3 },
	PKR: { symbol: '₨', decimals: 2 },
	EGP: { symbol: 'ج.م', decimals: 2 },
	NZD: { symbol: 'NZ$', decimals: 2 },
	BOB: { symbol: 'Bs', decimals: 2 },
	GHS: { symbol: 'GH₵', decimals: 2 },
	KES: { symbol: 'KSh', decimals: 2 },
	MAD: { symbol: 'MAD', decimals: 2, symbolAfter: true },
	BAM: { symbol: 'KM', decimals: 2 },
	ISK: { symbol: 'kr', decimals: 0, symbolAfter: true },
	TZS: { symbol: 'TSh', decimals: 2 },
	UGX: { symbol: 'USh', decimals: 0 },
	XOF: { symbol: 'CFA', decimals: 0, symbolAfter: true },
	// The three Stake social currencies follow the RGS docs' *table*, not its `CurrencyMeta` snippet.
	// The two disagree: the snippet ({ symbol: 'GC', decimals: 0 }) renders "GC10" while the table
	// shows "10.00 GC". We take the table here because (a) these are Stake's own currencies, so the
	// table is the only description of intent — there is no ISO 4217 truth to appeal to, and (b)
	// decimals: 0 rounds fractional coins, so a 1234.50 GC balance displayed as "GC1,235" overstates
	// what the player holds. For real currencies we keep the snippet, which is factually correct
	// about subunits (KWD really has 3 decimals, ISK really has none).
	XGC: { symbol: 'GC', decimals: 2, symbolAfter: true },
	XSC: { symbol: 'SC', decimals: 2, symbolAfter: true },
	XEC: { symbol: 'SC', decimals: 2, symbolAfter: true },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META) as Currency[];

const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

export const isSupportedCurrency = (raw: unknown): raw is Currency =>
	CURRENCY_SET.has(String(raw ?? '').trim().toUpperCase());

/** Uppercase the code and keep it as-is. Unknown codes are NOT coerced to USD — showing "$" for a
 *  currency we do not recognise misstates the player's balance; `metaFor` renders the raw code
 *  after the amount instead, exactly as the RGS spec's reference `DisplayBalance` does. */
export const normalizeCurrency = (raw: unknown): string =>
	String(raw ?? '').trim().toUpperCase() || 'USD';

export const metaFor = (currency: string): CurrencyMeta =>
	CURRENCY_META[currency as Currency] ?? { symbol: currency, decimals: 2, symbolAfter: true };

// Sub-cent payouts must never render as a flat "0.00" — a genuine non-zero win has to show a
// non-zero figure. Grow the fraction digits until it does, capped so no trailing noise appears.
const MAX_FRACTION_DIGITS = 8;
export const fractionDigitsForAmount = (value: number, min: number) => {
	const abs = Math.abs(value);
	if (abs === 0) return min;
	let digits = min;
	while (digits < MAX_FRACTION_DIGITS && Number(abs.toFixed(digits)) === 0) digits += 1;
	return digits;
};

/**
 * `new Intl.NumberFormat(...)` is expensive — expensive enough to matter here, because this runs on
 * every tick of every count-up (the PIXI win text, the HUD win readout and the styles all read it at
 * frame rate). JavaScriptCore pays far more per construction than V8 does, and the allocation churn
 * was showing up on Safari as 100-200ms GC pauses in the middle of win presentations. There are only
 * ever a handful of (min, max) pairs in play, so build each formatter once.
 */
const groupingFormatters = new Map<string, Intl.NumberFormat>();
const groupingFormatter = (min: number, max: number) => {
	const key = `${min}:${max}`;
	let formatter = groupingFormatters.get(key);
	if (!formatter) {
		formatter = new Intl.NumberFormat('en-US', {
			minimumFractionDigits: min,
			maximumFractionDigits: max,
		});
		groupingFormatters.set(key, formatter);
	}
	return formatter;
};

/**
 * Format an amount for display using the documented symbol, decimals and placement.
 * `minFractionDigits` overrides the currency's default decimal count when a caller needs more.
 */
export const formatCurrencyAmount = (
	currency: string,
	amount: number,
	minFractionDigits?: number,
) => {
	const meta = metaFor(currency);
	const value = Number.isFinite(amount) ? amount : 0;
	const min = minFractionDigits ?? meta.decimals;
	const digits = fractionDigitsForAmount(value, min);
	const sign = value < 0 ? '-' : '';
	// Group the digits (Intl for the NUMBER only) and attach the symbol ourselves, so the currency
	// rendering stays exactly as specified rather than however Intl localises that code.
	const body = groupingFormatter(min, digits).format(Math.abs(value));
	return meta.symbolAfter ? `${sign}${body} ${meta.symbol}` : `${sign}${meta.symbol}${body}`;
};

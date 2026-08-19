import { describe, expect, it } from 'vitest';

import {
	formatCurrencyAmount,
	fractionDigitsForAmount,
} from '../../../packages/utils-shared/currency';

describe('currency precision', () => {
	it('keeps exact sub-cent payouts instead of rounding to the first non-zero value', () => {
		expect(fractionDigitsForAmount(0.0008, 2)).toBe(4);
		expect(formatCurrencyAmount('USD', 0.0008)).toBe('$0.0008');
		expect(formatCurrencyAmount('USD', 0.001)).toBe('$0.001');
	});

	it('keeps normal currency precision for ordinary values', () => {
		expect(formatCurrencyAmount('USD', 1.2)).toBe('$1.20');
		expect(formatCurrencyAmount('KWD', 1.2)).toBe('KD1.200');
	});

	it('keeps exact sub-cent social-currency payouts', () => {
		expect(formatCurrencyAmount('XGC', 0.0008)).toBe('0.0008 GC');
		expect(formatCurrencyAmount('XSC', 0.001)).toBe('0.001 SC');
	});
});

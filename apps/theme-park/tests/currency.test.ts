import { describe, expect, it } from 'vitest';

import {
	formatWalletAmount,
	formatWinAmount,
	formatWinAmountAtTargetPrecision,
} from '../src/lib/utils/currency';

/**
 * R-01 in STAKE_REVIEW_LESSONS.md, as executable assertions.
 *
 * Two separate reviewer rejections live in here, pulling in opposite directions: a wallet value must
 * never grow a decimal past the currency's own count, and a win value must never lose one to the
 * point of printing zero. They are two functions for that reason, and these are the cases that were
 * actually flagged rather than a sampling of round numbers.
 */
describe('wallet money shows exactly the currency decimals', () => {
	it('does not expand a precise balance — the rejected screenshot said $999.946', () => {
		expect(formatWalletAmount('USD', 999.946)).toBe('$999.95');
	});

	it('pads up to the currency decimals as well as trimming down to them', () => {
		expect(formatWalletAmount('USD', 1.2)).toBe('$1.20');
		expect(formatWalletAmount('USD', 0)).toBe('$0.00');
	});

	it('honours a currency whose decimal count is not two', () => {
		expect(formatWalletAmount('JPY', 1234.5)).toBe('¥1,235');
		expect(formatWalletAmount('KRW', 1234.5)).toBe('₩1,235');
		expect(formatWalletAmount('KWD', 1.2)).toBe('KD1.200');
	});

	it('renders a currency outside the table by its code, never as dollars', () => {
		expect(formatWalletAmount('ZZZ', 10)).toBe('10.00 ZZZ');
	});

	it('places the symbol where the RGS table puts it', () => {
		expect(formatWalletAmount('NOK', 10)).toBe('10.00 kr');
		expect(formatWalletAmount('XSC', 10)).toBe('10.00 SC');
	});
});

describe('win money shows the exact settled value', () => {
	it('never prints a non-zero win as zero — a 0.16x at a 0.01 bet', () => {
		expect(formatWinAmount('USD', 0.0016)).toBe('$0.0016');
	});

	it('still reads as ordinary money when it does not need the extra digits', () => {
		expect(formatWinAmount('USD', 1.2)).toBe('$1.20');
		expect(formatWinAmount('USD', 12.5)).toBe('$12.50');
	});

	it('stops at four decimals rather than trailing noise', () => {
		expect(formatWinAmount('USD', 0.00123456)).toBe('$0.0012');
	});

	it('goes past four rather than print zero, because that rule wins', () => {
		expect(formatWinAmount('USD', 0.00001)).toBe('$0.00001');
	});

	it('locks count-up precision to the settled result', () => {
		expect(formatWinAmountAtTargetPrecision('USD', 1.001, 50)).toBe('$1.00');
		expect(formatWinAmountAtTargetPrecision('USD', 1.001, 1.002)).toBe('$1.001');
	});

	it('runs the whole book-amount range at the smallest bet without a zero', () => {
		// The pipeline the reviewer exercises: bet x bookAmount / 100.
		const zeros: number[] = [];
		for (let book = 1; book <= 2000; book += 1) {
			const amount = (0.01 * book) / 100;
			const text = formatWinAmount('USD', amount);
			if (/^\$0(\.0+)?$/.test(text)) zeros.push(book);
		}
		expect(zeros).toEqual([]);
	});
});

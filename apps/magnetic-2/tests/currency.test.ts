import { describe, expect, it } from 'vitest';

import {
	formatCurrencyAmount,
	formatWalletAmount,
	formatWinAmount,
	fractionDigitsForAmount,
} from '../../../packages/utils-shared/currency';

const BOOK_AMOUNT_MULTIPLIER = 100;

// The real win pipeline from utils-shared/amount.ts, minus the Svelte state dependency.
const winFromBook = (bookAmount: number, bet: number, currency = 'USD') =>
	formatWinAmount(currency, bet * (bookAmount / BOOK_AMOUNT_MULTIPLIER));

// Stake requires balance/bet at 2 decimals but in-game win values at up to 4. One formatter cannot
// serve both, so these two suites pin the two contracts against each other.

describe('wallet amounts (balance, bet, costs)', () => {
	it('never expands past the currency decimals', () => {
		// The exact value Stake rejected on magnetic 2026-08-20.
		expect(formatWalletAmount('USD', 999.946)).toBe('$999.95');
		expect(formatWalletAmount('USD', 1234.5678)).toBe('$1,234.57');
		expect(formatWalletAmount('USD', 0.016)).toBe('$0.02');
	});

	it('pads to the currency decimals', () => {
		expect(formatWalletAmount('USD', 1.2)).toBe('$1.20');
		expect(formatWalletAmount('USD', 1)).toBe('$1.00');
	});

	it('honours each currency decimal count rather than assuming 2', () => {
		expect(formatWalletAmount('KWD', 1.2)).toBe('KD1.200');
		expect(formatWalletAmount('JPY', 1234.5)).toBe('¥1,235');
		expect(formatWalletAmount('XGC', 1.2)).toBe('1.20 GC');
	});

	it('keeps the sign outside the symbol', () => {
		expect(formatWalletAmount('USD', -1.5)).toBe('-$1.50');
	});
});

describe('win amounts (spin/round/total wins, countups)', () => {
	it('shows sub-cent payouts exactly instead of rounding them to zero', () => {
		expect(fractionDigitsForAmount(0.0008, 2)).toBe(4);
		expect(formatWinAmount('USD', 0.0008)).toBe('$0.0008');
		expect(formatWinAmount('USD', 0.001)).toBe('$0.001');
	});

	it('keeps ordinary wins at the plain currency precision', () => {
		expect(formatWinAmount('USD', 1.2)).toBe('$1.20');
		expect(formatWinAmount('USD', 12.5)).toBe('$12.50');
	});

	it('caps at 4 decimals', () => {
		expect(formatWinAmount('USD', 0.00123456)).toBe('$0.0012');
	});

	it('breaks the 4-decimal cap rather than render a real win as zero', () => {
		// Capping blindly would print "$0.0000" here, which is the exact failure the requirement
		// exists to prevent — so precision wins over the ceiling in this case.
		expect(formatWinAmount('USD', 0.00001)).toBe('$0.00001');
		expect(formatWinAmount('USD', 0.000004)).not.toMatch(/^\$0\.0+$/);
	});

	it('keeps sub-cent social-currency payouts', () => {
		expect(formatWinAmount('XGC', 0.0008)).toBe('0.0008 GC');
		expect(formatWinAmount('XSC', 0.001)).toBe('0.001 SC');
	});

	it('renders every book amount at the 0.01 minimum bet without vanishing', () => {
		for (let book = 1; book <= 2000; book += 1) {
			expect(winFromBook(book, 0.01)).not.toMatch(/^\$0\.0+$/);
		}
	});

	it('stays within 4 decimals across the USD bet ladder', () => {
		for (const bet of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 5, 100]) {
			for (let book = 1; book <= 500; book += 1) {
				const decimals = winFromBook(book, bet).split('.')[1]?.length ?? 0;
				expect(decimals).toBeLessThanOrEqual(4);
			}
		}
	});

	it('matches the reviewer-reported values', () => {
		expect(winFromBook(16, 0.01)).toBe('$0.0016'); // 0.16x on the minimum bet
		expect(winFromBook(160, 0.01)).toBe('$0.016'); // the WIN readout in the rejection screenshot
	});
});

describe('the two contracts disagree, and that is the point', () => {
	it('formats the same amount differently for wallet and win', () => {
		expect(formatWalletAmount('USD', 0.0016)).toBe('$0.00');
		expect(formatWinAmount('USD', 0.0016)).toBe('$0.0016');
	});
});

describe('deprecated formatCurrencyAmount', () => {
	it('still expands, which is why wallet callers must not use it', () => {
		expect(formatCurrencyAmount('USD', 999.946)).toBe('$999.946');
	});
});

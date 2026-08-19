import { describe, expect, it } from 'vitest';

import { normalizeRgsBetConfig } from '../../../packages/components-shared/src/betConfig';

describe('RGS betting configuration', () => {
	it('uses returned bet levels and default level', () => {
		const result = normalizeRgsBetConfig(
			{
				minBet: 100_000,
				maxBet: 5_000_000,
				stepBet: 100_000,
				defaultBetLevel: 500_000,
				betLevels: [100_000, 200_000, 500_000, 1_000_000, 5_000_000],
			},
			[1],
		);

		expect(result.betAmountOptions).toEqual([0.1, 0.2, 0.5, 1, 5]);
		expect(result.betMenuOptions).toEqual([0.1, 0.2, 0.5, 1, 5]);
		expect(result.defaultBetAmount).toBe(0.5);
		expect(result.minBetAmount).toBe(0.1);
		expect(result.maxBetAmount).toBe(5);
		expect(result.stepBetAmount).toBe(0.1);
	});

	it('builds valid levels from min, max, and step when betLevels is absent', () => {
		const result = normalizeRgsBetConfig(
			{
				minBet: 100_000,
				maxBet: 500_000,
				stepBet: 100_000,
				defaultBetLevel: 300_000,
			},
			[1],
		);

		expect(result.betAmountOptions).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
		expect(result.defaultBetAmount).toBe(0.3);
	});

	it('removes returned levels outside the RGS min and max', () => {
		const result = normalizeRgsBetConfig(
			{
				minBet: 200_000,
				maxBet: 500_000,
				defaultBetLevel: 900_000,
				betLevels: [100_000, 200_000, 300_000, 500_000, 900_000],
			},
			[1],
		);

		expect(result.betAmountOptions).toEqual([0.2, 0.3, 0.5]);
		expect(result.defaultBetAmount).toBe(0.5);
	});

	it('keeps first and last returned levels in the bet menu', () => {
		const betLevels = Array.from({ length: 40 }, (_, index) => (index + 1) * 100_000);
		const result = normalizeRgsBetConfig({ betLevels, defaultBetLevel: 100_000 }, [1]);

		expect(result.betMenuOptions[0]).toBe(0.1);
		expect(result.betMenuOptions.at(-1)).toBe(4);
	});
});

import { describe, expect, it } from 'vitest';

import {
	fallbackModeCostMultiplier,
	formatReplayMultiplier,
	resolveReplayCostMultiplier,
} from '../src/state/replay';

describe('replay metadata', () => {
	it('uses the cost multiplier returned by the replay endpoint', () => {
		expect(resolveReplayCostMultiplier({ costMultiplier: 37.5 }, 'FEATURE')).toBe(37.5);
	});

	it('uses mode defaults only for legacy replay responses without metadata', () => {
		expect(resolveReplayCostMultiplier({}, 'BASE')).toBe(1);
		expect(resolveReplayCostMultiplier({}, 'CHANCE')).toBe(2);
		expect(resolveReplayCostMultiplier({}, 'FEATURE')).toBe(50);
		expect(resolveReplayCostMultiplier({}, 'BONUS')).toBe(100);
		expect(resolveReplayCostMultiplier({}, 'SUPER')).toBe(500);
		expect(fallbackModeCostMultiplier('UNKNOWN')).toBe(1);
	});

	it('does not truncate small payout multipliers', () => {
		expect(formatReplayMultiplier(0.0008)).toBe('0.0008');
		expect(formatReplayMultiplier(12)).toBe('12');
	});
});

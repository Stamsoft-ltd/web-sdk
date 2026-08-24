import { describe, expect, it } from 'vitest';

import { shouldDeferEndRound } from '../src/game/utils';
import type { Bet } from '../src/game/typesBookEvent';

const betWithEventTypes = (...types: string[]) =>
	({
		state: types.map((type, index) => ({ type, index })),
	}) as Pick<Bet, 'state'>;

describe('Theme Park round settlement', () => {
	it('defers Duck Your Luck settlement until every interactive Duck event completes', () => {
		expect(shouldDeferEndRound(betWithEventTypes('reveal', 'duckPickStart', 'duckPickEnd'))).toBe(
			true,
		);
		expect(
			shouldDeferEndRound(betWithEventTypes('reveal', 'duckCollectStart', 'duckCollectEnd')),
		).toBe(true);
	});

	it('keeps ordinary single-reveal wins on the prefetched settlement path', () => {
		expect(shouldDeferEndRound(betWithEventTypes('reveal', 'winInfo', 'setWin'))).toBe(false);
	});

	it('still defers normal multi-reveal bonuses', () => {
		expect(shouldDeferEndRound(betWithEventTypes('reveal', 'reveal'))).toBe(true);
	});
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { shouldDeferEndRound, shouldForceNormalSpeed } from '../src/game/utils';
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

/**
 * The two predicates above and below answer different questions and must disagree on exactly one
 * event type. Asserting them side by side is the point: they were one function, and collapsing
 * "keep the round open" into "drop out of turbo" is what pushed a turbo player back to normal speed
 * every time a collect duck landed.
 */
describe('Theme Park bonus speed', () => {
	it('keeps a Duck Collect spin in turbo', () => {
		const duckCollect = betWithEventTypes(
			'reveal',
			'duckCollectStart',
			'duckReveal',
			'duckCollectEnd',
		);
		expect(shouldForceNormalSpeed(duckCollect)).toBe(false);
		// ...while still deferring its settlement. This is the whole distinction.
		expect(shouldDeferEndRound(duckCollect)).toBe(true);
	});

	it('drops the Duck Your Luck pond to normal speed', () => {
		expect(
			shouldForceNormalSpeed(
				betWithEventTypes('reveal', 'duckPickStart', 'duckPick', 'duckPickEnd'),
			),
		).toBe(true);
	});

	it('drops free-spin games to normal speed', () => {
		expect(shouldForceNormalSpeed(betWithEventTypes('reveal', 'freeSpinTrigger', 'reveal'))).toBe(
			true,
		);
	});

	it('leaves an ordinary win in turbo', () => {
		expect(shouldForceNormalSpeed(betWithEventTypes('reveal', 'winInfo', 'setWin'))).toBe(false);
	});
});

/**
 * The same two questions, asked of every published book rather than of hand-written event lists.
 *
 * Synthetic events only prove the predicates read the array they were given; these are the books the
 * RGS actually serves, so this is what the player will hit. Whole files, not samples — the claim
 * "no FSPIN1 book drops the player out of turbo" is only worth making about all 25 of them.
 */
const booksForMode = (mode: string): Pick<Bet, 'state'>[] =>
	readFileSync(resolve(import.meta.dirname, '..', `library/books/books_${mode}.jsonl`), 'utf8')
		.split('\n')
		.filter((line) => line.trim().length > 0)
		.map((line) => ({ state: JSON.parse(line).events }) as Pick<Bet, 'state'>);

describe('Theme Park bonus speed, against the published books', () => {
	it('keeps every DUCK COLLECT SPIN book in turbo', () => {
		// FSPIN1 is the 20x "one paid spin with at least 1 collect duck" mode — a paid base spin, so
		// none of its books may force normal speed, and every one of them must still defer settlement.
		const books = booksForMode('FSPIN1');
		expect(books.length).toBeGreaterThan(0);
		expect(books.filter(shouldForceNormalSpeed)).toHaveLength(0);
		expect(books.filter(shouldDeferEndRound)).toHaveLength(books.length);
	});

	it('drops every DUCK YOUR LUCK book to normal speed', () => {
		const books = booksForMode('DUCK');
		expect(books.length).toBeGreaterThan(0);
		expect(books.filter(shouldForceNormalSpeed)).toHaveLength(books.length);
	});

	it('keeps every ROLLER WILDS SPIN book in turbo', () => {
		// FSPIN2 is the other paid feature spin: one reveal plus rollerWildsApply, no trigger and no
		// free spins. It is the same class of thing as Duck Collect and belongs on the same side of
		// the line — asserted here because "feature spin" and "bonus" are easy to conflate, which is
		// the conflation that caused this bug in the first place.
		const books = booksForMode('FSPIN2');
		expect(books.length).toBeGreaterThan(0);
		expect(books.filter(shouldForceNormalSpeed)).toHaveLength(0);
	});

	it('drops every bought free-spin book to normal speed', () => {
		for (const mode of ['COASTER', 'ROLLER']) {
			const books = booksForMode(mode);
			expect(books.length, mode).toBeGreaterThan(0);
			expect(books.filter(shouldForceNormalSpeed), mode).toHaveLength(books.length);
		}
	});

	it('slows a base or ante book only when it reaches a real bonus', () => {
		for (const mode of ['BASE', 'ANTE']) {
			for (const book of booksForMode(mode)) {
				const types = book.state.map(({ type }) => type);
				const reachesBonus =
					types.filter((type) => type === 'reveal').length > 1 || types.includes('duckPickStart');
				expect(shouldForceNormalSpeed(book), `${mode}: ${types.join(',')}`).toBe(reachesBonus);
			}
		}
	});
});

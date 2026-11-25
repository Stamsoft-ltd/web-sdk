import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { convertTorResumableBet, getResumingIndex } from '../src/game/utils';
import type { Bet } from '../src/game/typesBookEvent';

const firstBookWith = (mode: string, type: string) => {
	const lines = readFileSync(
		resolve(import.meta.dirname, '..', `library/books/books_${mode}.jsonl`),
		'utf8',
	).split('\n');
	for (const line of lines) {
		if (!line.trim()) continue;
		const book = JSON.parse(line);
		if (book.events.some((event: { type: string }) => event.type === type)) return book.events;
	}
	throw new Error(`no ${mode} book with ${type}`);
};

const activeBet = (state: Bet['state'], event?: unknown) =>
	({ active: true, mode: 'BASE', state, event }) as unknown as Bet;

const types = (bet: Bet) => bet.state.map(({ type }) => type);

describe('Theme Park bonus resume', () => {
	const duckBook = firstBookWith('BASE', 'duckPickStart');

	// The RGS never receives an event index for a Duck round (one reveal, nothing recorded), so
	// whatever it hands back must still reopen the pond instead of resuming an empty book.
	for (const event of [undefined, null, '', '0', '7', '999', 'abc']) {
		it(`reopens Duck Your Luck when the saved event is ${JSON.stringify(event)}`, () => {
			const resumed = convertTorResumableBet(activeBet(duckBook, event));
			expect(types(resumed)).toContain('duckPickStart');
			expect(types(resumed).filter((type) => type === 'duckPick')).toHaveLength(10);
			expect(types(resumed)).toContain('duckPickEnd');
		});
	}

	it('still resumes a free-spin game from its saved reveal', () => {
		const freeSpins = firstBookWith('ROLLER', 'freeSpinTrigger');
		const reveals = freeSpins
			.map((event: { type: string; index: number }, i: number) => ({ ...event, i }))
			.filter((event: { type: string }) => event.type === 'reveal');
		const saved = reveals[2].i;
		expect(getResumingIndex(activeBet(freeSpins, String(saved)))).toBe(saved);
		expect(getResumingIndex(activeBet(freeSpins, undefined))).toBe(0);
		expect(getResumingIndex(activeBet(freeSpins, String(freeSpins.length + 5)))).toBe(0);
	});
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import config from '../src/game/config';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

/**
 * R-03 in STAKE_REVIEW_LESSONS.md: a hand-typed paytable cell drifts from the math.
 *
 * The screens no longer type any of these — `CustomInfoModal` and `CustomBuyBonusModal` read
 * `config.ts` directly, which is what actually prevents the drift. This test guards the two things
 * that reading cannot: that nobody puts the literals back, and that the PROSE in the info copy,
 * which cannot be interpolated without wrecking the translations, still says what the math pays.
 */
describe('every quoted pay figure comes from the math config', () => {
	const pays = (symbol: 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'L1') => {
		const table = config.symbols[symbol].paytable;
		if (!table) throw new Error(`no paytable for ${symbol}`);
		return { three: table[2]['3'], four: table[1]['4'], five: table[0]['5'] };
	};

	it('reads them rather than restating them', () => {
		const info = source('components/CustomInfoModal.svelte');
		const buy = source('components/CustomBuyBonusModal.svelte');
		expect(info).toContain("const table = config.symbols[symbol].paytable");
		expect(info).toContain("const costOf = (mode: BetMode) => config.betModes[mode].cost");
		expect(buy).toContain("const costOf = (mode: BetMode) => config.betModes[mode].cost");
		// The literal arrays this replaces, so a revert is a failing test rather than a silent one.
		expect(info).not.toContain("pays: ['0.5', '2.5', '5']");
		expect(info).not.toContain("pays: ['0.1', '0.5', '1']");
		expect(buy).not.toContain('costMultiplier: 100,');
	});

	it('quotes the same RTP and max win the math is built to', () => {
		const info = source('components/CustomInfoModal.svelte');
		expect(info).toContain('config.rtp * 100');
		expect(info).toContain('config.wincap.toLocaleString');
		expect(config.rtp).toBe(config.betModes.BASE.rtp);
		expect(config.wincap).toBe(config.betModes.BASE.max_win);
	});

	/**
	 * The info copy spells the figures out in sentences ("COASTER CAR pays 2 / 10 / 20x"), and both
	 * the base map and the social overrides carry their own wording. Interpolating them would put
	 * placeholders through every translation, so instead the numbers are asserted here — in both
	 * maps, because social mode renders the override and nothing else.
	 */
	it('spells the same figures out in the info copy, in both wordings', async () => {
		const en = (await import('../src/i18n/messagesMap/en')).default as Record<string, string>;
		const { socialOverridesEn } = await import('../src/i18n/socialOverridesEn');
		// The copy writes a symbol's three figures as one run, "0.5 / 2.5 / 5x". Asserting the run
		// rather than parsing every number out keeps the card ranks in "A, K, Q, J and 10" from being
		// read as pay figures, which is exactly what a looser check does.
		const run = (symbol: 'H1' | 'H2' | 'H4' | 'L1') => {
			const { three, four, five } = pays(symbol);
			return `${three} / ${four} / ${five}x`;
		};

		for (const map of [en, { ...en, ...socialOverridesEn }]) {
			expect(map['PAYTABLE H1_H2']).toContain(run('H1'));
			expect(map['PAYTABLE H1_H2']).toContain(run('H2'));
			expect(map['PAYTABLE H3_H5']).toContain(run('H4'));
			expect(map['PAYTABLE LOWS']).toContain(run('L1'));
			expect(map['PAYTABLE TEXT PAYLINES']).toContain(
				String(Object.keys(config.paylines).length),
			);
			expect(map['RULE GAME TEXT']).toContain(config.wincap.toLocaleString('en-US'));
		}
	});
});

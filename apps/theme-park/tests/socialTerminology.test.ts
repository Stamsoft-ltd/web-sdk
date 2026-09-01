import { describe, expect, it } from 'vitest';

import en from '../src/i18n/messagesMap/en';
import { socialOverridesEn } from '../src/i18n/socialOverridesEn';

/**
 * R-02 in STAKE_REVIEW_LESSONS.md: Stake.us rejects gambling terminology, and it has rejected two
 * of our games for it already.
 *
 * The restricted list is at stake-engine.com/docs/approval-guidelines/jurisdiction-requirements.
 * Reviewers apply it as SUBSTRINGS, not whole words, which is the part that keeps catching us out:
 * `payline`, `paytable`, `pays` and `paying` are none of them on the list, and all of them fail on
 * `pay -> win`. This test is over the MERGED map because that is what social mode renders —
 * `SocialI18nSync` calls `init('en', { ...messagesMap.en, ...socialOverridesEn })`, so base `en.ts`
 * is free to keep the gambling terms for stake.com and only the merge has to be clean.
 */
const RESTRICTED = [
	'pay',
	'bet',
	'buy',
	'cash',
	'money',
	'wager',
	'gambl',
	'casino',
	'jackpot',
	'deposit',
	'withdraw',
	'credit',
	'stake',
	'purchase',
	'bought',
	'fund',
	'currency',
	'rebet',
	'cost of',
	'place your bets',
];

/**
 * The only strings allowed to trip the scan. Both carry "Stake Engine", which is the required legal
 * mark rather than a terminology slip — it is the one place the word has to stay.
 *
 * Anything else that shows up here is a real hit. Adding a key to this list is a decision about
 * what a reviewer will accept, so it wants a reason next to it, not just an entry.
 */
const EXPECTED_HITS: Record<string, string> = {
	'DISCLAIMER TEXT': '"Stake Engine" is the required legal mark',
	'INFO GI LEGAL TM': '"Stake Engine" is the required legal mark',
};

describe('social mode carries no restricted terminology', () => {
	const merged: Record<string, string> = { ...en, ...socialOverridesEn };

	it('has a clean merged English map', () => {
		const dirty: string[] = [];
		for (const [key, value] of Object.entries(merged)) {
			if (typeof value !== 'string' || key in EXPECTED_HITS) continue;
			const low = value.toLowerCase();
			const found = RESTRICTED.filter((word) => low.includes(word));
			if (found.length) dirty.push(`${key} [${found.join(', ')}]: ${value}`);
		}
		expect(dirty).toEqual([]);
	});

	it('overrides every shared-package key that renders its own text verbatim', () => {
		// `i18n._()` returns the KEY when it finds no message, and the shared packages use whole
		// English sentences as keys — so an un-overridden shared key renders its gambling wording
		// silently. This is the exact path magnetic was rejected on (2026-08-20).
		for (const key of ['BET', 'BET MENU', 'SELECT YOUR BET', 'BUY BONUS', 'PAYTABLE']) {
			expect(socialOverridesEn[key], `shared key '${key}' needs a social override`).toBeTruthy();
		}
	});
});

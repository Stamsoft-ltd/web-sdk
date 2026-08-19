import { describe, expect, it } from 'vitest';

import en from '../src/i18n/messagesMap/en';
import { socialOverridesEn } from '../src/i18n/socialOverridesEn';

const restrictedTerms = [
	/win feature/i,
	/pay out/i,
	/paid out/i,
	/pays out/i,
	/\bbetting\b/i,
	/total bet/i,
	/\bbets?\b/i,
	/\bcash\b/i,
	/\bpayer\b/i,
	/\bpays?\b/i,
	/\bpaid\b/i,
	/\bmoney\b/i,
	/\bbuy\b/i,
	/\bbought\b/i,
	/\bpurchase\b/i,
	/at the cost of/i,
	/\brebet\b/i,
	/cost of/i,
	/\bcredit\b/i,
	/buy bonus/i,
	/\bgamble\b/i,
	/\bwager\b/i,
	/\bdeposit\b/i,
	/\bwithdraw\b/i,
	/bonus buy/i,
	/place your bets/i,
	/\bcurrency\b/i,
	/\bfunds?\b/i,
];

describe('social-mode English', () => {
	it('overrides every catalog entry containing Stake social restricted wording', () => {
		const catalog = { ...en, ...socialOverridesEn };
		const failures = Object.entries(catalog).flatMap(([key, value]) =>
			restrictedTerms.some((term) => term.test(value)) ? [`${key}: ${value}`] : [],
		);

		expect(failures).toEqual([]);
	});
});

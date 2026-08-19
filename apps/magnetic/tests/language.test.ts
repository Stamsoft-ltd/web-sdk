import { describe, expect, it } from 'vitest';

import { normalizeLanguageParam } from '../../../packages/state-shared/src/language';

describe('language fallback', () => {
	it.each([undefined, null, '', 'zz', 'invalid', 'en-US', '123'])(
		'falls back to English for %s',
		(value) => {
			expect(normalizeLanguageParam(value)).toBe('en');
		},
	);

	it('normalizes supported values and aliases', () => {
		expect(normalizeLanguageParam('DE')).toBe('de');
		expect(normalizeLanguageParam(' br ')).toBe('pt');
		expect(normalizeLanguageParam('da')).toBe('da');
	});
});

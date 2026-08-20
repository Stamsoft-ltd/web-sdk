import { describe, expect, it } from 'vitest';

import ar from '../src/i18n/messagesMap/ar';
import da from '../src/i18n/messagesMap/da';
import de from '../src/i18n/messagesMap/de';
import en from '../src/i18n/messagesMap/en';
import es from '../src/i18n/messagesMap/es';
import fi from '../src/i18n/messagesMap/fi';
import fr from '../src/i18n/messagesMap/fr';
import hi from '../src/i18n/messagesMap/hi';
import id from '../src/i18n/messagesMap/id';
import ja from '../src/i18n/messagesMap/ja';
import ko from '../src/i18n/messagesMap/ko';
import pl from '../src/i18n/messagesMap/pl';
import pt from '../src/i18n/messagesMap/pt';
import ru from '../src/i18n/messagesMap/ru';
import tr from '../src/i18n/messagesMap/tr';
import vi from '../src/i18n/messagesMap/vi';
import zh from '../src/i18n/messagesMap/zh';

const catalogs = { ar, da, de, en, es, fi, fr, hi, id, ja, ko, pl, pt, ru, tr, vi, zh };
const placeholders = (value: string) =>
	[...value.matchAll(/%[A-Za-z0-9_]+%/g)].map((match) => match[0]).sort();

describe('Magnetic localization catalogs', () => {
	it('uses the approved Magnetic Wild explanation', () => {
		expect(en['INFO FEAT WILD TITLE']).toBe('Wild Symbol');
		expect(en['INFO FEAT WILD TEXT']).toBe(
			'Substitutes for all pay symbols except Scatter. When activated, the Magnetic Wild randomly selects one regular pay symbol currently on the grid and attracts all matching symbols together. Wilds and Scatters cannot be selected. A Magnetic Wild activates only when it lands and does not reactivate during the resulting respin.',
		);
	});

	it.each(Object.entries(catalogs))('%s contains every English key', (_locale, catalog) => {
		expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
		expect(Object.values(catalog).every((value) => value.trim().length > 0)).toBe(true);
	});

	it.each(Object.entries(catalogs))(
		'%s preserves interpolation placeholders',
		(_locale, catalog) => {
			for (const key of Object.keys(en) as Array<keyof typeof en>) {
				expect(placeholders(catalog[key]), key).toEqual(placeholders(en[key]));
			}
		},
	);
});

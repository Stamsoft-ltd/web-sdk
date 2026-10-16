import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { draftCatalogs } from '../src/i18n/draftCatalogs.ts';
import { nativeSocialLabel, needsSocialFallback } from '../src/i18n/socialCatalogs.ts';
const configured = [
	'ar',
	'de',
	'es',
	'fr',
	'id',
	'ja',
	'ko',
	'pl',
	'pt',
	'ru',
	'tr',
	'vi',
	'zh',
	'fi',
	'hi',
	'bg',
];
test('all configured non-English locales and Bulgarian have equally covered draft UI catalogs', () => {
	assert.deepEqual(Object.keys(draftCatalogs).sort(), configured.sort());
	const keys = Object.keys(draftCatalogs.de).sort();
	assert.ok(keys.length >= 100);
	for (const [lang, catalog] of Object.entries(draftCatalogs)) {
		assert.deepEqual(Object.keys(catalog).sort(), keys, lang);
		for (const [key, value] of Object.entries(catalog)) {
			assert.equal(typeof value, 'string');
			assert.ok(value.trim().length, `${lang}:${key}`);
			assert.doesNotMatch(value, /undefined|\{\{|TODO|TRANSLATE/);
		}
		assert.equal(catalog['MODE FEATURE TITLE'], catalog.FEATURE);
		assert.equal(catalog['MODE SUPER TITLE'], catalog.SUPER);
		for (const amount of ['65', '30', '5', '15'])
			assert.ok(catalog['MYSTERY DESC'].includes(amount), lang);
	}
});
test('native social action labels use play; wagering-related unreviewed copy is explicitly detected', () => {
	for (const [lang, catalog] of Object.entries(draftCatalogs)) {
		for (const key of ['BET', 'BET LABEL', 'BUY', 'COST', 'TOTAL COST'])
			assert.equal(nativeSocialLabel(key, catalog, lang), catalog.PLAY);
		assert.ok(nativeSocialLabel('PAYTABLE', catalog, lang));
		assert.equal(nativeSocialLabel('BONUS BUTTON', catalog, lang), undefined);
	}
	assert.equal(needsSocialFallback('Payouts use the base bet, not the purchase cost.'), true);
	assert.equal(needsSocialFallback('Paying symbols. Every paid spin.'), true);
	assert.equal(needsSocialFallback('15 free spins. Sticky Wilds persist.'), false);
});
test('catalog integration preserves canonical English and existing Bulgarian rule fallback', () => {
	const source = readFileSync(new URL('../src/i18n/index.ts', import.meta.url), 'utf8');
	assert.match(
		source,
		/\.\.\.en,\s*\.\.\.draftCatalogs\[lang\],\s*\.\.\.\(lang === 'bg' \? bg : \{\}\)/,
	);
	assert.match(source, /needsSocialFallback\(en\[key\] \?\? ''\)/);
	assert.equal(draftCatalogs.de['GENERAL DISCLAIMER'], undefined);
});

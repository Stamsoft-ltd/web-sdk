import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numericTextEm, numericSlotEm, numericFontScale } from '../src/game/numberFit.ts';
import {
	SUPPORTED_CURRENCIES,
	formatWalletAmount,
	formatWinAmount,
} from '../../../packages/utils-shared/currency.ts';

test('large money/counters shrink inside fixed slots without moving neighbouring controls', () => {
	for (const text of [
		'$4,999,990.85',
		'$2,500,000,000.00',
		'9,999,999.9999 €',
		'-10,000,000,000.00',
		'999999999×',
		'9999 / 99999',
	]) {
		const scale = numericFontScale(text, 115, 20);
		assert.ok(scale > 0 && scale < 1, text);
		assert.ok(numericTextEm(text) * 20 * scale <= 115 * 0.94 + 1e-9, text);
	}
	assert.equal(numericFontScale('$1.00', 115, 20), 1);
	assert.equal(numericFontScale('$1.00', 0, 20), 0);
});
test('countup reserves final width rather than pumping the font each frame', () => {
	const final = '$2,500,000,000.00';
	for (const text of ['$0.00', '$9.50', '$999,999.99'])
		assert.equal(numericSlotEm(text, final), numericTextEm(final));
});
test('win precision follows final amount, not arbitrary tween frames', () => {
	for (const value of [0, 0.123456789, 0.87654321, 1.99999999, 2]) {
		assert.match(formatWinAmount('USD', value, 2), /^\$[\d,]+\.\d{2}$/);
		assert.ok((formatWinAmount('USD', value, 2.0025).split('.')[1]?.length ?? 0) <= 4);
	}
	assert.equal(formatWinAmount('USD', 2.0025, 2.0025), '$2.0025');
	assert.equal(formatWinAmount('USD', 1.125, 1.125), '$1.125');
	assert.equal(formatWinAmount('USD', 0.0025, 0.0025), '$0.0025');
	assert.equal(formatWinAmount('USD', 0.00000125, 0.00000125), '$0.00000125');
	assert.equal(formatWinAmount('USD', 0.1 + 0.2, 0.3), '$0.30');
	assert.equal(formatWalletAmount('USD', 4_999_990.85), '$4,999,990.85');
	assert.equal(formatWalletAmount('USD', 999.946), '$999.95');
});
test('Pixi amounts pass exact book target to shared formatter', () => {
	for (const name of ['GpuWinArt', 'GpuBonusArt']) {
		const source = readFileSync(
			new URL(`../src/components/${name}.svelte`, import.meta.url),
			'utf8',
		);
		assert.match(source, /format\(count.value, target\)/);
		assert.doesNotMatch(source, /Math\.round\(count.value\)/);
	}
});
test('all currency symbols and suffixes fit; three-decimal currencies keep their precision', () => {
	for (const currency of SUPPORTED_CURRENCIES) {
		const text = formatWalletAmount(currency, 4_999_990.85);
		const scale = numericFontScale(text, 90, 20);
		assert.ok(numericTextEm(text) * 20 * scale <= 90 * 0.94 + 1e-9, currency);
	}
	assert.equal(formatWalletAmount('KWD', 1.125), 'KD1.125');
	assert.equal(formatWalletAmount('TND', 1.125), '1.125 TND');
	assert.equal(formatWinAmount('EUR', 2.0025, 2.0025), '€2.0025');
	assert.equal(formatWinAmount('PLN', 2.0025, 2.0025), '2.0025 zł');
});
test('numeric containers cannot inherit legacy inline label layout', () => {
	const source = readFileSync(
		new URL('../src/components/FitNumber.svelte', import.meta.url),
		'utf8',
	);
	assert.match(source, /style=\{`[^`]*display:block;width:100%;min-width:0;max-width:100%/);
	assert.match(source, /container-type: inline-size/);
});

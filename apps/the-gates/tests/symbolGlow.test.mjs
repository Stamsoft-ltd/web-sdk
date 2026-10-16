import test from 'node:test';
import assert from 'node:assert/strict';
import { ambientSymbolGlow, PREMIUM_GLOW_SYMBOLS, SYMBOL_GLOW } from '../src/game/symbolGlow.ts';
import { SYMBOLS } from '../src/game/contract.ts';

test('only five premium symbols have an idle halo', () => {
	assert.deepEqual(PREMIUM_GLOW_SYMBOLS, [
		'GUARDIAN_MASK',
		'SUN_MEDALLION',
		'SACRED_EYE',
		'RUNE_CHALICE',
		'CRYSTAL_ORB',
	]);
	for (const name of SYMBOLS) {
		if (PREMIUM_GLOW_SYMBOLS.includes(name)) assert.notEqual(ambientSymbolGlow(name), 0x0b192c);
		else assert.equal(ambientSymbolGlow(name), 0x0b192c);
		assert.equal(typeof SYMBOL_GLOW[name], 'number', `${name} retains its paying-highlight color`);
	}
	assert.equal(ambientSymbolGlow(), 0x0b192c);
});

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

test('premium idle glow is strengthened in Pixi, including clean Eye and Envelope art', () => {
	for (const name of PREMIUM_GLOW_SYMBOLS) {
		const accent=SYMBOL_GLOW[name], base=0x0b192c;
		const old=[16,8,0].map(shift=>Math.round(((base>>shift)&255)*.72+((accent>>shift)&255)*.28));
		const next=ambientSymbolGlow(name);
		const distance=(rgb)=>[16,8,0].reduce((n,shift,i)=>n+Math.abs(rgb[i]-((base>>shift)&255)),0);
		assert.ok(distance([16,8,0].map(shift=>(next>>shift)&255))>distance(old),name);
	}
});

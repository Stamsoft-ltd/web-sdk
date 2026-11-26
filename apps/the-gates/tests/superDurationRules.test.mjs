import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesCopy } from '../src/i18n/rulesCopy.ts';
import { COSTS } from '../src/game/contract.ts';

test('Super rules disclose the long-bonus floor and rarity without including entry credit', () => {
	const copy = rulesCopy['INFO SUPER BONUS COPY'];
	assert.match(copy, /30\+.*500×/);
	assert.match(copy, /at most 1% of Super bonuses/);
	assert.match(copy, /free-spin winnings only/);
});
test('duration balancing does not change buy costs or Mystery tier selections', () => {
	assert.equal(COSTS.SUPER, 300);
	assert.equal(COSTS.MYSTERY, 400);
	assert.equal(COSTS.MYSTERY_EXTREME, 400);
	assert.match(rulesCopy['INFO MYSTERY BONUS BUY COPY'], /65%.*30%.*5%/);
	assert.match(rulesCopy['INFO MYSTERY EXTREME BUY COPY'], /50%.*35%.*15%/);
});

test('Hidden shares reward types, not the newly reduced Super retrigger frequency', () => {
	assert.match(rulesCopy['INFO HIDDEN BONUS COPY'], /same reward types.*own reward frequencies/);
});

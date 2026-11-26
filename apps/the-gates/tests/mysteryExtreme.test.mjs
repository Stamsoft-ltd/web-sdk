import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COSTS } from '../src/game/contract.ts';
import { canAffordMode, modeOptionAvailable } from '../src/game/buyAvailability.ts';
import { RULE_BUYS, RULE_BUY_INFO } from '../src/game/rulesPages.ts';
import { rulesCopy } from '../src/i18n/rulesCopy.ts';
import { previewEvents } from '../src/game/preview.ts';
const src = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('both mystery buys stay distinct and cost 400x, with no affordability bypass', () => {
	assert.equal(COSTS.MYSTERY, 400);
	assert.equal(COSTS.MYSTERY_EXTREME, 400);
	for (const mode of ['MYSTERY', 'MYSTERY_EXTREME']) {
		assert.equal(canAffordMode(mode, 1, 400), true);
		assert.equal(canAffordMode(mode, 1, 399.999999), false);
		assert.equal(modeOptionAvailable(mode, mode, 1, 0), false);
		assert.ok(RULE_BUYS.includes(mode));
		assert.ok(RULE_BUY_INFO[mode]);
	}
});
test('Extreme copy discloses 50/35/15 and separate payouts without changing old Mystery odds', () => {
	const copy = rulesCopy['INFO MYSTERY EXTREME BUY COPY'];
	assert.match(copy, /400×.*50%.*35%.*15%/);
	assert.match(copy, /separately balanced payout distribution/);
	assert.match(rulesCopy['INFO MYSTERY BONUS BUY COPY'], /65%.*30%.*5%/);
});
test('Extreme is a one-shot buy with its own replay title/cost, never an old-mode alias', () => {
	for (const file of ['components/Game.svelte', 'game/actor.ts'])
		assert.match(src(file), /\['BONUS', 'SUPER', 'MYSTERY', 'MYSTERY_EXTREME'\]/);
	assert.match(src('state/gatesStake.svelte.ts'), /MODE MYSTERY_EXTREME TITLE/);
	assert.match(src('state/gatesStake.svelte.ts'), /replayMode\(\) === 'MYSTERY_EXTREME'/);
	const events = previewEvents('MYSTERY_EXTREME');
	assert.equal(events.filter((e) => e.type === 'mysterySelect').length, 1);
	assert.equal(events.find((e) => e.type === 'freeSpinTrigger').source, 'mystery');
});

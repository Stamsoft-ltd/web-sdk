import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, reduceEvent, restorePrefix } from '../src/game/reducer.ts';
import { bonusScatterKeys } from '../src/game/scatterCelebration.ts';
const events = JSON.parse(
	readFileSync(new URL('./fixtures/v12-refill-key-entry.json', import.meta.url), 'utf8'),
);
test('v12 authoritative refill Key lands before payout/bonus; resume sees final three Keys', () => {
	let state = initialState(),
		initial = null,
		settled = null;
	for (const e of events) {
		state = reduceEvent(state, e);
		if (e.type === 'reveal' && initial === null) initial = bonusScatterKeys(state.board).length;
		if (e.type === 'spinWin') {
			settled = e;
			assert.equal(e.scatterCount, 3);
			assert.equal(e.scatterAmount, 200);
			assert.equal(state.wins[0].symbol, 'KEY');
			assert.equal(state.wins[0].positions.length, 3);
		}
	}
	assert.equal(initial, 2);
	assert.equal(bonusScatterKeys(state.board).length, 3);
	assert.equal(state.tier, 'normal');
	assert.equal(state.total, settled.amount);
	const restored = restorePrefix(events, events.length);
	assert.equal(restored.total, state.total);
	assert.equal(restored.tier, 'normal');
	assert.equal(bonusScatterKeys(restored.board).length, 3);
});

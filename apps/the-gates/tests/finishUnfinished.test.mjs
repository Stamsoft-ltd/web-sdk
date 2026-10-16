import test from 'node:test';
import assert from 'node:assert/strict';
import { finishUnfinishedRound } from '../src/game/finishUnfinished.ts';
test('skip calls end-round exactly once and accepts authoritative balance', async () => {
	let calls = 0;
	const data = { balance: { amount: 1234000 } };
	assert.equal(
		await finishUnfinishedRound(async () => {
			calls++;
			return data;
		}),
		data,
	);
	assert.equal(calls, 1);
});
test('failed or malformed settlement rejects instead of reporting successful skip', async () => {
	for (const response of [
		undefined,
		{},
		{ error: 'round active' },
		{ balance: {} },
		{ balance: { amount: NaN } },
		{ balance: { amount: '100' } },
	])
		await assert.rejects(() => finishUnfinishedRound(async () => response));
	await assert.rejects(
		() =>
			finishUnfinishedRound(async () => {
				throw new Error('offline');
			}),
		/offline/,
	);
});

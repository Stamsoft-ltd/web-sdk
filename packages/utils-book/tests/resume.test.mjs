import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getResumeEventIndex } from '../src/resume.ts';

// Regression: Number(undefined) produced NaN; both resume filters then dropped the whole bonus.
const unusable = [
	['missing', undefined],
	['null', null],
	['empty', ''],
	['whitespace', '  '],
	['nonnumeric', 'abc'],
	['NaN', NaN],
	['Infinity', Infinity],
	['negative', -1],
	['negative string', '-1'],
	['fraction', 1.5],
	['fraction string', '1.5'],
	['at end', 5],
	['past end', '999'],
	['boolean', true],
	['object', { valueOf: () => 2 }],
];
for (const [name, event] of unusable) {
	test(`${name} checkpoint restarts the book instead of discarding it`, () => {
		const state = Array.from({ length: 5 }, (_, index) => ({ index }));
		const cursor = getResumeEventIndex(event, state.length);
		assert.equal(cursor, 0);
		assert.deepEqual(state.slice(cursor), state);
	});
}
for (const event of [0, '0', 2, '2', 4, '4']) {
	test(`valid checkpoint ${JSON.stringify(event)} preserves its position`, () => {
		assert.equal(getResumeEventIndex(event, 5), Number(event));
	});
}
test('an empty book has a safe zero cursor', () => {
	assert.equal(getResumeEventIndex('2', 0), 0);
});

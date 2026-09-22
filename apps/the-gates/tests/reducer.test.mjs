import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reduceEvent, restorePrefix } from '../src/game/reducer.ts';
import { COSTS, PAYS } from '../src/game/contract.ts';
const apply = (s, type, data = {}) => reduceEvent(s, { index: s.cursor, type, ...data });
const board = () =>
	Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => ({ name: 'PURPLE_GEM' })));
const reward = (state, data = {}) =>
	apply(state, 'gateReward', {
		spinId: 0,
		gate: 1,
		order: 1,
		reward: { kind: 'addMultiplier', value: 5 },
		previousMultiplier: 1,
		multiplier: 5,
		multiplierActive: true,
		totalFs: 15,
		stickyPositions: [],
		...data,
	});
test('quarter pays and mode costs preserved', () => {
	assert.deepEqual(PAYS[8], [0.25, 0.75, 2]);
	assert.deepEqual(COSTS, {
		BASE: 1,
		CHANCE: 2,
		FEATURE: 20,
		BONUS: 100,
		SUPER: 300,
		MYSTERY: 400,
	});
});
test('cascade displays raw amount without crediting a win', () => {
	const s = apply(initialState(), 'cascadeWin', { wins: [], rawSpinWin: 25 });
	assert.equal(s.raw, 25);
	assert.equal(s.total, 0);
});
test('cumulative setters replace rather than add', () => {
	let s = initialState();
	for (const type of ['setTotalWin', 'setWin', 'finalWin']) s = apply(s, type, { amount: 25 });
	assert.equal(s.total, 25);
});
test('spin settlement uses supplied capped amount, never raw times multiplier', () => {
	const s = apply(initialState(), 'spinWin', {
		amount: 2500000,
		rawAmount: 600000,
		multiplier: 5,
		capped: true,
	});
	assert.equal(s.spinWin, 2500000);
	assert.equal(s.total, 0);
	assert.equal(s.capped, true);
});
test('bonus summary does not lose the entry win', () => {
	let s = apply(initialState(), 'setTotalWin', { amount: 125 });
	s = apply(s, 'freeSpinEnd', { amount: 100 });
	assert.equal(s.total, 125);
	assert.equal(s.bonusWin, 100);
});
test('bonus starts with authoritative 15 spins, resets entry multiplier', () => {
	let s = reward(initialState());
	s = apply(s, 'freeSpinTrigger', { tier: 'normal', totalFs: 15 });
	assert.equal(s.totalFs, 15);
	assert.equal(s.remaining, 15);
	assert.equal(s.multiplier, 1);
	assert.equal(s.multiplierActive, false);
});
test('free spin ordinal is not incremented again', () => {
	const s = apply(initialState(), 'updateFreeSpin', {
		amount: 1,
		total: 15,
		remaining: 14,
		tier: 'super',
	});
	assert.equal(s.freeSpin, 1);
	assert.equal(s.remaining, 14);
});
test('sticky reward changes current board before removal without mutating snapshot', () => {
	const before = apply(initialState(), 'reveal', { board: board(), movements: [] });
	const s = reward(before, {
		reward: { kind: 'stickyWild', positions: [{ reel: 0, row: 0 }] },
		stickyPositions: [{ reel: 0, row: 0 }],
	});
	assert.equal(s.board[0][0].name, 'WILD');
	assert.equal(before.board[0][0].name, 'PURPLE_GEM');
	const next = apply(s, 'tumbleRemove', { positions: [{ reel: 0, row: 1 }] });
	assert.equal(next.board[0][0].name, 'WILD');
	assert.equal(next.board[0][1], null);
});
test('hidden rewards retain supplied order and multiplier', () => {
	let s = apply(initialState(), 'gateOpen', { gate: 1, rewardCount: 2 });
	s = reward(s);
	s = reward(s, { order: 2, reward: { kind: 'multiplyMultiplier', value: 3 }, multiplier: 15 });
	assert.equal(s.rewardCount, 2);
	assert.equal(s.rewardOrder, 2);
	assert.equal(s.multiplier, 15);
});
test('gate extension changes remaining count, no client award formula', () => {
	let s = apply(initialState(), 'updateFreeSpin', {
		amount: 3,
		total: 15,
		remaining: 12,
		tier: 'super',
	});
	s = reward(s, { reward: { kind: 'retrigger', spinsAdded: 5 }, totalFs: 20 });
	assert.equal(s.totalFs, 20);
	assert.equal(s.remaining, 17);
});
test('restore every cursor matches uninterrupted reduction including sticky placement', () => {
	const events = [
		{ type: 'reveal', board: board(), movements: [] },
		{ type: 'gateProgress', progress: 3 },
		{ type: 'gateOpen', gate: 1, rewardCount: 2 },
		{
			type: 'gateReward',
			spinId: 0,
			gate: 1,
			order: 1,
			reward: { kind: 'stickyWild', positions: [{ reel: 2, row: 2 }] },
			multiplier: 5,
			multiplierActive: true,
			totalFs: 15,
			stickyPositions: [{ reel: 2, row: 2 }],
		},
		{ type: 'setTotalWin', amount: 25 },
	].map((e, index) => ({ ...e, index }));
	const final = events.reduce(reduceEvent, initialState());
	for (let cursor = 0; cursor <= events.length; cursor++)
		assert.deepEqual(
			events.slice(cursor).reduce(reduceEvent, restorePrefix(events, cursor)),
			final,
		);
});
test('invalid cursor and unsupported events fail closed', () => {
	for (const cursor of [-1, 1, NaN, 0.5]) assert.throws(() => restorePrefix([], cursor));
	assert.throws(() => apply(initialState(), 'inventedWin'));
});

test('refill moves only affected symbols, keeps surviving cells still', () => {
	let s = apply(initialState(), 'reveal', { board: board(), movements: [], cascadeIndex: 0 });
	s = apply(s, 'tumbleRemove', { positions: [{ reel: 0, row: 1 }] });
	const next = board();
	next[0][0] = { name: 'BLUE_GEM' };
	s = apply(s, 'reveal', {
		board: next,
		cascadeIndex: 1,
		movements: [{ reel: 0, fromRow: 0, toRow: 1, name: 'PURPLE_GEM' }],
	});
	assert.equal(s.fallOffsets[0][1], -100);
	assert.equal(s.fallOffsets[0][0], -100);
	assert.equal(s.fallOffsets[0][2], 0);
	assert.equal(s.fallOffsets[1][0], 0);
});

test('final result returns visual mode to base without discarding total', () => {
	let s = apply(initialState(), 'freeSpinTrigger', { tier: 'hidden', totalFs: 15 });
	s = apply(s, 'finalWin', { amount: 25 });
	assert.equal(s.tier, null);
	assert.equal(s.total, 25);
	assert.equal(s.totalFs, 0);
});

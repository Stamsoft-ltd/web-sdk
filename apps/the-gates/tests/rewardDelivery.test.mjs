import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialState, reduceEvent } from '../src/game/reducer.ts';
import { displayBoard, previewPresentationEvents } from '../src/game/preview.ts';
import {
	createRewardDelivery,
	presentedReward,
	deliveryTargets,
	rewardFlight,
	rewardFlightPoint,
	REWARD_FLIGHT_START_MS,
	REWARD_FLIGHT_MS,
	REWARD_PULSE_MS,
} from '../src/game/rewardDelivery.ts';
import { GATE_REWARD_DURATION_MS } from '../src/game/gatePlayback.ts';
const before = () => ({
	...initialState(),
	board: displayBoard(),
	gateEventId: 'g1',
	tier: 'super',
	freeSpin: 7,
	totalFs: 15,
	remaining: 8,
	multiplier: 2,
});
const event = (reward) => ({
	index: 12,
	type: 'gateReward',
	spinId: 1,
	gate: 1,
	order: 1,
	reward,
	previousMultiplier: 2,
	multiplier:
		'value' in reward ? (reward.kind === 'addMultiplier' ? 2 + reward.value : 2 * reward.value) : 2,
	multiplierActive: true,
	totalFs: 'spinsAdded' in reward ? 15 + reward.spinsAdded : 15,
	stickyPositions: reward.kind === 'stickyWild' ? reward.positions : [],
});
test('multiplier add/multiply and extra/retrigger spins settle visually on arrival without changing authoritative state', () => {
	for (const reward of [
		{ kind: 'addMultiplier', value: 5 },
		{ kind: 'multiplyMultiplier', value: 3 },
		{ kind: 'extraSpin', spinsAdded: 3 },
		{ kind: 'retrigger', spinsAdded: 5 },
	]) {
		const old = before(),
			e = event(reward),
			delivery = createRewardDelivery(e, old, 1000, 'r1'),
			actual = reduceEvent(old, e),
			snapshot = JSON.stringify(actual);
		const shown = presentedReward(actual, delivery);
		assert.equal(shown.multiplier, old.multiplier);
		assert.equal(shown.totalFs, old.totalFs);
		assert.equal(shown.remaining, old.remaining);
		assert.deepEqual(deliveryTargets(delivery), ['value' in reward ? 'multiplier' : 'spins']);
		assert.equal(JSON.stringify(actual), snapshot);
		delivery.arrived = [0];
		assert.equal(presentedReward(actual, delivery), actual);
		assert.equal(presentedReward(actual, null), actual);
	}
});
test('each awarded Wild cell remains original until its own flight lands; original sticky Wilds stay intact', () => {
	const positions = [
			{ reel: 0, row: 0 },
			{ reel: 2, row: 3 },
			{ reel: 5, row: 4 },
		],
		old = before();
	old.sticky = [positions[0]];
	old.board[0][0] = { name: 'WILD' };
	const e = event({ kind: 'stickyWild', positions }),
		delivery = createRewardDelivery(e, old, 100, 'r'),
		actual = reduceEvent(old, e);
	assert.deepEqual(deliveryTargets(delivery), ['cell:0:0', 'cell:2:3', 'cell:5:4']);
	assert.equal(actual.board[2][3].name, 'WILD');
	assert.equal(presentedReward(actual, delivery).board[2][3].name, old.board[2][3].name);
	assert.deepEqual(presentedReward(actual, delivery).sticky, [positions[0]]);
	delivery.arrived = [1];
	const first = presentedReward(actual, delivery);
	assert.equal(first.board[2][3].name, 'WILD');
	assert.equal(first.board[5][4].name, old.board[5][4].name);
	assert.deepEqual(first.sticky, [positions[0], positions[1]]);
	delivery.arrived = [0, 1, 2];
	assert.equal(presentedReward(actual, delivery), actual);
});
test('all 30 possible flights and arrival pulses finish inside playback barrier, including reduced motion', () => {
	for (const reduced of [false, true])
		for (let i = 0; i < 30; i++) {
			assert.equal(
				rewardFlight(reduced ? -1 : REWARD_FLIGHT_START_MS - 1, i, reduced).started,
				false,
			);
			if (reduced) assert.equal(rewardFlight(100, i, true).arrived, true);
			assert.equal(rewardFlight(GATE_REWARD_DURATION_MS - 1, i, reduced).arrived, true);
			assert.equal(rewardFlight(GATE_REWARD_DURATION_MS - 1, i, reduced).pulse, 1);
		}
	assert.equal(rewardFlight(REWARD_FLIGHT_START_MS + REWARD_FLIGHT_MS, 0).arrived, true);
	assert.ok(REWARD_PULSE_MS >= 250);
});
test('swoop endpoints exact, bounded progress, and resize targets resolve without resetting timeline', () => {
	const from = { x: 400, y: 300 },
		to = { x: 100, y: 650 };
	assert.deepEqual(rewardFlightPoint(from, to, -1), from);
	assert.deepEqual(rewardFlightPoint(from, to, 2), to);
	assert.ok(rewardFlightPoint(from, to, 0.5).y < from.y + (to.y - from.y) * 0.75);
	const end = rewardFlightPoint(from, { x: 80, y: 120 }, 1);
	assert.ok(Math.abs(end.x - 80) < 1e-9 && Math.abs(end.y - 120) < 1e-9);
});
test('presentation cleanup, scoped targets, one renderer and no rendered match8+ hint', () => {
	const source = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
	assert.doesNotMatch(source('components/Game.svelte'), /t\('HINT'\)/);
	assert.doesNotMatch(source('game/welcome.ts'), /text: 'HINT'/);
	assert.match(source('game/gpuRewardFlight.ts'), /engine.rewardTargets.get\(key\)/);
	assert.doesNotMatch(
		source('game/gpuRewardFlight.ts'),
		/new Application|requestAnimationFrame|setTimeout/,
	);
	assert.match(
		source('components/TempleGate.svelte'),
		/if \(arriveGateReward\(id, index\)\)\s*dingRewardArrival\(index, runtime.rewardDelivery\?\.reward.kind\)/,
	);
	assert.match(
		source('game/playback.svelte.ts'),
		/delivery.id !== id \|\| delivery.arrived.includes\(index\)/,
	);
	assert.match(
		source('game/playback.svelte.ts'),
		/reward.kind === 'stickyWild'\) await loadRig\('WILD', 'symbols'\)/,
	);
	assert.match(source('game/gpuRenderer.ts'), /this.rewardTargets.clear\(\)/);
});
test('developer fixtures cover each delivered reward type, never a production path', () => {
	const kinds = ['addMultiplier', 'multiplyMultiplier', 'extraSpin', 'retrigger', 'stickyWild'];
	for (const [i, key] of ['add', 'multiply', 'spins', 'retrigger', 'wild'].entries()) {
		const events = previewPresentationEvents('reward-' + key);
		assert.equal(events.find((e) => e.type === 'gateReward').reward.kind, kinds[i]);
		assert.equal(events.filter((e) => e.type === 'gateOpen').length, 1);
	}
});

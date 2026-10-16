import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	gatePlaybackTime,
	gatePresentationFrame,
	GATE_REWARD_HOLD_MS,
	GATE_REWARD_ENTER_MS,
	GATE_OPEN_DURATION_MS,
	GATE_REWARD_DURATION_MS,
} from '../src/game/gatePlayback.ts';
import { GATE_CYCLE } from '../src/game/gateAnimation.ts';
import { TIMING } from '../src/game/presentation.ts';

test('award spins out then stays readable 1.8 seconds and closes once within the shared barrier', () => {
	assert.equal(GATE_REWARD_HOLD_MS, 1800);
	assert.equal(TIMING.gateReward, GATE_REWARD_DURATION_MS);
	const rewardAt = 2000;
	let previous = -1,
		ended = false;
	for (let now = rewardAt; now < rewardAt + 5000; now += 17) {
		const f = gatePresentationFrame(now, 100, rewardAt, 1, 1);
		assert.ok(f.time >= previous, 'no backwards clock after disappearance');
		previous = f.time;
		if (now - rewardAt < GATE_REWARD_ENTER_MS + GATE_REWARD_HOLD_MS)
			assert.ok(f.time <= GATE_CYCLE.rewardHoldEnd && !f.ended && f.backdrop === 1);
		if (f.ended) ended = true;
		if (ended)
			assert.ok(f.ended && f.backdrop === 0 && f.time === GATE_CYCLE.finished, 'never reappears');
	}
});
test('Hidden keeps same portal between awards; only final reward collapses it', () => {
	for (let age = GATE_REWARD_ENTER_MS + GATE_REWARD_HOLD_MS + 1; age < 3500; age += 31) {
		const first = gatePresentationFrame(2000 + age, 100, 2000, 1, 2);
		assert.ok(first.portalWaiting && !first.ended && first.backdrop === 1);
	}
	const second = gatePresentationFrame(4200, 100, 4200, 2, 2);
	assert.equal(second.time, GATE_CYCLE.openStart);
	assert.equal(second.backdrop, 1);
	assert.equal(second.portalWaiting, false);
	const end = gatePresentationFrame(4200 + GATE_REWARD_DURATION_MS, 100, 4200, 2, 2);
	assert.ok(end.ended && !end.portalWaiting && end.backdrop === 0);
});
test('doors move through closing before impact; event clocks unaffected by subsequent state updates', () => {
	assert.equal(gatePlaybackTime(1000, 1000, null), 0);
	assert.ok(
		gatePlaybackTime(1120, 1000, null) > 0 &&
			gatePlaybackTime(1120, 1000, null) < GATE_CYCLE.impact,
	);
	assert.equal(gatePlaybackTime(1360, 1000, null), GATE_CYCLE.impact);
	assert.equal(gatePlaybackTime(2100, 1000, null), GATE_CYCLE.openStart);
	const r = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	assert.ok(
		r.indexOf('await loadRig(') < r.indexOf('runtime.gateStartedAt = performance.now()'),
		'decode before starting visible clock',
	);
	const c = readFileSync(new URL('../src/components/TempleGate.svelte', import.meta.url), 'utf8');
	assert.doesNotMatch(
		c,
		/gate-fallback|openedAt =|rewardAt =|lastType === 'gateOpen'/,
		'no closed loading fallback or component-local resets',
	);
	assert.match(c, /runtime.gateStartedAt/);
	assert.match(c, /frame.ended/);
	assert.match(c, /frame.portalStable/);
	assert.match(c, /frame.doorsHidden/);
});

test('developer gate reviews exercise one slide with real ordered reward fixtures for all three tiers', async () => {
	const { previewPresentationEvents } = await import('../src/game/preview.ts');
	for (const tier of ['normal', 'super', 'hidden']) {
		const events = previewPresentationEvents(`gate-${tier}`);
		assert.equal(events.filter((e) => e.type === 'gateOpen').length, 1);
		assert.equal(events.filter((e) => e.type === 'gateReward').length, tier === 'hidden' ? 2 : 1);
		assert.equal(events[0].tier, tier);
		events.forEach((e, i) => assert.equal(e.index, i));
	}
});

test('authoritative first reward starts during opening; Hidden second never repeats doors', () => {
	assert.equal(TIMING.gateOpen, GATE_OPEN_DURATION_MS);
	assert.equal(GATE_OPEN_DURATION_MS, 580);
	assert.equal(GATE_REWARD_ENTER_MS, 520);
	assert.equal(gatePlaybackTime(50000, 0, null), GATE_CYCLE.openStart);
	for (const age of [0, 90, 180, 270, 360]) {
		const first = gatePresentationFrame(2000 + age, 0, 2000, 1, 2);
		const second = gatePresentationFrame(5000 + age, 0, 5000, 2, 2);
		assert.ok(first.time >= GATE_CYCLE.openStart && first.time < GATE_CYCLE.opened);
		assert.equal(first.doorsHidden, false);
		assert.equal(second.time, first.time);
		assert.equal(second.doorsHidden, true);
		assert.equal(second.portalStable, true);
	}
	assert.equal(gatePlaybackTime(2520, 0, 2000), GATE_CYCLE.rewardStart);
	assert.equal(gatePlaybackTime(4320, 0, 2000), GATE_CYCLE.rewardHoldEnd);
});

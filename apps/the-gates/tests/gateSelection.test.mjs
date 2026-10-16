import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gateSelectionHold, waitForTarget } from '../src/game/presentation.ts';
import { previewEvents } from '../src/game/preview.ts';

test('third-win selection completes every native paying cycle before gate closure', () => {
	const maximumTime = (value) => {
		if (Array.isArray(value)) return Math.max(0, ...value.map(maximumTime));
		if (value && typeof value === 'object')
			return Math.max(Number(value.time ?? 0), ...Object.values(value).map(maximumTime));
		return 0;
	};
	for (const name of [
		'GUARDIAN_MASK',
		'SUN_MEDALLION',
		'SACRED_EYE',
		'RUNE_CHALICE',
		'CRYSTAL_ORB',
		'RED_GEM',
		'BLUE_GEM',
		'GREEN_GEM',
		'PURPLE_GEM',
		'AMBER_GEM',
	]) {
		const rig = JSON.parse(
			readFileSync(
				new URL(`../static/assets/the-gates/figma-20261012/motion/${name}.json`, import.meta.url),
			),
		);
		assert.ok(
			gateSelectionHold(false, false) >= (maximumTime(rig.animations.paying) + 0.14) * 1000,
			name,
		);
	}
	assert.equal(
		gateSelectionHold(false, true),
		350,
		'explicit slam-stop retains a static-readable beat',
	);
	assert.equal(gateSelectionHold(true, false), 150);
	assert.equal(gateSelectionHold(true, true), 150);
});

test('gate selection shares cascade clock; no duplicate 1.3s hold after ordinary highlight', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let now = 630,
		complete = false;
	t.mock.method(performance, 'now', () => now);
	const done = waitForTarget(
		() => gateSelectionHold(false, false),
		new AbortController().signal,
		0,
	).then(() => {
		complete = true;
	});
	now = 1299;
	t.mock.timers.tick(669);
	await Promise.resolve();
	assert.equal(complete, false);
	now = 1300;
	t.mock.timers.tick(24);
	await done;
	assert.equal(complete, true);
});

test('resumed gateOpen reads restored selected symbols; skip can shorten, abort cancels', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let now = 5000,
		skipped = false,
		complete = false;
	t.mock.method(performance, 'now', () => now);
	const done = waitForTarget(
		() => gateSelectionHold(false, skipped),
		new AbortController().signal,
	).then(() => {
		complete = true;
	});
	now = 5325;
	t.mock.timers.tick(325);
	await Promise.resolve();
	assert.equal(complete, false);
	skipped = true;
	now = 5350;
	t.mock.timers.tick(25);
	await done;
	const controller = new AbortController();
	const cancelled = waitForTarget(() => gateSelectionHold(false, false), controller.signal);
	controller.abort();
	await assert.rejects(cancelled, { name: 'AbortError' });
	t.mock.timers.tick(10000);
});

test('selection barrier precedes gate clock; awards and actual removals remain authoritative', () => {
	const source = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	const gate = source.slice(
		source.indexOf("if (e.type === 'gateOpen')"),
		source.indexOf("if (e.type === 'gateReward')"),
	);
	assert.ok(
		gate.indexOf('gateSelectionHold(') < gate.indexOf('runtime.gateStartedAt = performance.now()'),
	);
	assert.match(gate, /selectionStartedAt \?\? performance.now\(\)/);
	assert.doesNotMatch(gate, /reduceEvent\(|beginWave\('remove'\)/);
	assert.match(source, /case 'cascadeWin':[\s\S]*?selectionStartedAt = performance.now\(\)/);
	for (const mode of ['BASE', 'BONUS', 'SUPER', 'MYSTERY']) {
		const events = previewEvents(mode);
		const gateIndex = events.findIndex((e) => e.type === 'gateOpen');
		assert.ok(gateIndex > 1);
		assert.equal(events[gateIndex - 2].type, 'cascadeWin');
		assert.equal(events[gateIndex - 1].type, 'gateProgress');
		const removal = events.findIndex((e, i) => i > gateIndex && e.type === 'tumbleRemove');
		assert.ok(events.slice(gateIndex + 1, removal).every((e) => e.type === 'gateReward'));
		assert.equal(
			events.filter(
				(e) =>
					e.type === 'tumbleRemove' &&
					e.spinId === events[gateIndex].spinId &&
					e.cascadeIndex === 3,
			).length,
			1,
		);
	}
});

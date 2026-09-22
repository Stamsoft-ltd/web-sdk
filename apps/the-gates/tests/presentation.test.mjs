import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TIMING, waitForDismissal } from '../src/game/presentation.ts';

test('win screen can dismiss before auto-close; callback and timer cleaned', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const c = new AbortController();
	let dismiss;
	let completed = 0;
	const done = waitForDismissal(
		c.signal,
		(d) => {
			dismiss = d;
		},
		1100,
	).then(() => completed++);
	assert.equal(typeof dismiss, 'function');
	dismiss();
	await done;
	assert.equal(dismiss, null);
	assert.equal(completed, 1);
	t.mock.timers.tick(2000);
	assert.equal(completed, 1);
});
test('autoplay win screen closes on timeout, not a mandatory acknowledgement', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let dismiss;
	let completed = false;
	const done = waitForDismissal(
		new AbortController().signal,
		(d) => {
			dismiss = d;
		},
		TIMING.winAutoClose,
	).then(() => (completed = true));
	t.mock.timers.tick(TIMING.winAutoClose - 1);
	await Promise.resolve();
	assert.equal(completed, false);
	t.mock.timers.tick(1);
	await done;
	assert.equal(completed, true);
	assert.equal(dismiss, null);
});
test('bonus acknowledgement remains explicit with no auto-close', async (t) => {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let dismiss;
	let completed = false;
	const done = waitForDismissal(new AbortController().signal, (d) => {
		dismiss = d;
	}).then(() => (completed = true));
	t.mock.timers.tick(100000);
	await Promise.resolve();
	assert.equal(completed, false);
	dismiss();
	await done;
	assert.equal(completed, true);
});
test('abort before or during presentation resolves and clears callbacks', async () => {
	for (const aborted of [true, false]) {
		const c = new AbortController();
		if (aborted) c.abort();
		let dismiss;
		const done = waitForDismissal(
			c.signal,
			(d) => {
				dismiss = d;
			},
			10000,
		);
		if (!aborted) c.abort();
		await done;
		assert.equal(dismiss, null);
	}
});
test('presentation pacing faster, gate animation and readable rewards retained', () => {
	assert.ok(TIMING.winHighlight < 850);
	assert.ok(TIMING.overlayGuard <= 150);
	assert.ok(TIMING.gateOpen >= 480);
	assert.ok(TIMING.gateReward >= 700);
});

test('live waits react to mid-wait speed/skip, not the initial duration', async (t) => {
	const { waitForTarget } = await import('../src/game/presentation.ts');
	t.mock.timers.enable({ apis: ['setTimeout'] });
	let now = 0;
	t.mock.method(performance, 'now', () => now);
	let target = 1000,
		complete = false;
	const done = waitForTarget(() => target, new AbortController().signal).then(
		() => (complete = true),
	);
	now = 100;
	t.mock.timers.tick(100);
	await Promise.resolve();
	assert.equal(complete, false);
	target = 80;
	now = 124;
	t.mock.timers.tick(24);
	await done;
	assert.equal(complete, true);
});
test('live wait abort cleans timer and rejects, including pre-aborted signal', async (t) => {
	const { waitForTarget } = await import('../src/game/presentation.ts');
	t.mock.timers.enable({ apis: ['setTimeout'] });
	for (const pre of [false, true]) {
		const controller = new AbortController();
		if (pre) controller.abort();
		const done = waitForTarget(() => 1000, controller.signal);
		controller.abort();
		await assert.rejects(done, { name: 'AbortError' });
	}
	t.mock.timers.tick(10000);
});

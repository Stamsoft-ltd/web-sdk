import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { holdBetStep, BET_HOLD_DELAY_MS, BET_HOLD_INTERVAL_MS } from '../src/game/holdBetStep.ts';
import { stepRgsBetLevel } from '../src/game/platformConfig.ts';

class Button extends EventTarget {
	disabled = false;
	captured = new Set();
	focus() {}
	setPointerCapture(id) {
		this.captured.add(id);
	}
	hasPointerCapture(id) {
		return this.captured.has(id);
	}
	releasePointerCapture(id) {
		this.captured.delete(id);
		this.dispatchEvent(new Event('lostpointercapture'));
	}
}
function fire(node, type, extra = {}) {
	const event = new Event(type, { cancelable: true });
	Object.assign(event, { pointerId: 1, button: 0, isPrimary: true, detail: 1, ...extra });
	node.dispatchEvent(event);
	return event;
}
function setup(t) {
	t.mock.timers.enable({ apis: ['setTimeout'] });
	const before = { window: globalThis.window, document: globalThis.document };
	globalThis.window = new EventTarget();
	globalThis.document = Object.assign(new EventTarget(), { hidden: false });
	t.after(() => {
		for (const key of ['window', 'document']) {
			if (before[key] === undefined) delete globalThis[key];
			else globalThis[key] = before[key];
		}
	});
	return new Button();
}

test('tap steps once; hold repeats at bounded cadence without a release-click extra step', (t) => {
	const button = setup(t);
	let steps = 0;
	const action = holdBetStep(button, () => steps++);
	fire(button, 'pointerdown');
	assert.equal(steps, 1);
	t.mock.timers.tick(BET_HOLD_DELAY_MS - 1);
	assert.equal(steps, 1);
	t.mock.timers.tick(1);
	assert.equal(steps, 2);
	t.mock.timers.tick(BET_HOLD_INTERVAL_MS);
	assert.equal(steps, 3);
	fire(button, 'pointerup');
	assert.equal(fire(button, 'click').defaultPrevented, true);
	t.mock.timers.tick(1000);
	assert.equal(steps, 3);
	assert.equal(button.captured.size, 0);
	fire(button, 'click', { detail: 0 });
	assert.equal(steps, 4); // keyboard/assistive technology
	action.destroy();
});

for (const cancel of [
	'pointercancel',
	'lostpointercapture',
	'blur',
	'hidden',
	'destroy',
	'disabled',
]) {
	test(`hold stops on ${cancel}, never leaves a timer dispatching steps`, (t) => {
		const button = setup(t);
		let steps = 0;
		const action = holdBetStep(button, () => steps++);
		fire(button, 'pointerdown');
		if (cancel === 'blur') window.dispatchEvent(new Event('blur'));
		else if (cancel === 'hidden') {
			document.hidden = true;
			document.dispatchEvent(new Event('visibilitychange'));
		} else if (cancel === 'destroy') action.destroy();
		else if (cancel === 'disabled') button.disabled = true;
		else fire(button, cancel);
		t.mock.timers.tick(2000);
		assert.equal(steps, 1);
		action.destroy();
	});
}

test('disabled, nonprimary and secondary pointer input cannot step; callback can update safely', (t) => {
	const button = setup(t);
	let n = 0;
	const action = holdBetStep(button, () => n++);
	button.disabled = true;
	fire(button, 'pointerdown');
	fire(button, 'click', { detail: 0 });
	button.disabled = false;
	fire(button, 'pointerdown', { button: 2 });
	fire(button, 'pointerdown', { isPrimary: false });
	t.mock.timers.tick(1000);
	assert.equal(n, 0);
	action.update(() => (n += 2));
	fire(button, 'pointerdown');
	assert.equal(n, 2);
	fire(button, 'pointerup', { pointerId: 2 });
	t.mock.timers.tick(BET_HOLD_DELAY_MS);
	assert.equal(n, 4);
	fire(button, 'pointerup');
	action.destroy();
});

test('holds traverse only RGS levels and stop at either bound; all four bet controls use the action', (t) => {
	const button = setup(t),
		levels = [0.000001, 0.01, 0.025, 0.1, 1];
	let amount = levels[0],
		direction = 1;
	const action = holdBetStep(button, () => {
		amount = stepRgsBetLevel(levels, amount, direction);
		button.disabled = direction > 0 ? amount === levels.at(-1) : amount === levels[0];
	});
	fire(button, 'pointerdown');
	assert.equal(amount, 0.01);
	for (let i = 0; i < 6; i++) t.mock.timers.tick(BET_HOLD_DELAY_MS);
	assert.equal(amount, 1);
	button.disabled = false;
	direction = -1;
	fire(button, 'pointerdown');
	for (let i = 0; i < 6; i++) t.mock.timers.tick(BET_HOLD_DELAY_MS);
	assert.equal(amount, 0.000001);
	action.destroy();
	const source = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.equal((source.match(/use:holdBetStep=\{\(\) => stepBet\([-]?1\)\}/g) ?? []).length, 4);
});

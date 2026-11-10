import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	bonusTransitionFrame as frame,
	bonusTransitionDuration as duration,
	BONUS_SCENE_SWITCH_MS as switchAt,
	bonusEntryBoundary,
} from '../src/game/bonusTransition.ts';
test('bonus entry emerges only as the doors open; exit retracts before doors close', () => {
	for (const kind of ['entry', 'exit']) {
		const transition = { kind, startedAt: 100, reduced: false };
		let prior = kind === 'entry' ? 0 : 1;
		for (let t = 0; t <= duration(kind, false); t += 10) {
			const f = frame(transition, 100 + t);
			assert.ok(f.artScale >= 0 && f.artScale <= 1);
			assert.ok(f.gateTime >= 0 && f.gateTime <= 2.18);
			assert.ok(kind === 'entry' ? f.artScale >= prior : f.artScale <= prior);
			prior = f.artScale;
		}
		assert.equal(frame(transition, 100 + duration(kind, false)).done, true);
		assert.ok(switchAt[kind] < duration(kind, false));
	}
	assert.equal(frame({ kind: 'entry', startedAt: 0, reduced: false }, 579).artScale, 0);
	assert.equal(frame({ kind: 'exit', startedAt: 0, reduced: false }, 700).artScale, 0);
	assert.equal(frame({ kind: 'exit', startedAt: 0, reduced: false }, 900).gateTime, 0);
});
test('reduced motion fades without spinning/door movement; holds have neutral transform', () => {
	for (const kind of ['entry', 'exit'])
		for (const t of [0, 120, 240]) {
			const f = frame({ kind, startedAt: 0, reduced: true }, t);
			assert.equal(f.rotation, 0);
			assert.equal(f.gateVisible, false);
			assert.equal(f.artScale, 1);
		}
	assert.equal(duration('entry', true), 240);
	assert.equal(duration('exit', true), 240);
	assert.equal(frame(null, 100).artScale, 1);
	assert.equal(frame(null, 100).gateVisible, false);
});
test('entry allows remaining cascades and settlement before first free-spin boundary', () => {
	for (const type of [
		'cascadeWin',
		'tumbleRemove',
		'reveal',
		'gateOpen',
		'gateReward',
		'spinWin',
		'setTotalWin',
		'setWin',
	])
		assert.equal(bonusEntryBoundary({ type }), false);
	assert.equal(bonusEntryBoundary({ type: 'spinStart', gameType: 'basegame' }), false);
	for (const type of ['updateFreeSpin', 'freeSpinEnd', 'finalWin'])
		assert.equal(bonusEntryBoundary({ type }), true);
	assert.equal(bonusEntryBoundary({ type: 'spinStart', gameType: 'freegame' }), true);
	const code = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	assert.match(code, /if \(pendingBonus && bonusEntryBoundary\(e\)\) await enterBonus\(\)/);
	assert.match(code, /await transition\('exit', e.tier\)/);
	assert.match(
		code,
		/finally \{\s*runtime.scatterCelebration = null;\s*runtime.bonusTransition = null/,
	);
});

test('exit never respawns a portal after summary removal while doors reopen to base', () => {
	const transition = { kind: 'exit', startedAt: 100, reduced: false };
	assert.equal(frame(transition, 799).portalVisible, true);
	for (let t = 900; t <= duration('exit', false); t += 10) {
		const f = frame(transition, 100 + t);
		assert.equal(f.portalVisible, false);
		assert.equal(f.artScale, 0);
	}
	assert.equal(frame({ kind: 'entry', startedAt: 0, reduced: false }, 1000).portalVisible, true);
	const component = readFileSync(
		new URL('../src/components/GpuBonusArt.svelte', import.meta.url),
		'utf8',
	);
	assert.match(component, /if \(!transition.portalVisible\)/);
	assert.match(component, /\['portal-vortex', 'portal-rim'\]/);
});

// Retraction reaches the uniform portal close track before the second door cycle.
test('summary portal shrinks closed, never abruptly cuts from its full-size hold', () => {
	const transition = { kind: 'exit', startedAt: 0, reduced: false };
	assert.ok(frame(transition, 850).portalClose >= 0.9);
	assert.equal(frame(transition, 600).portalVisible, true);
	assert.equal(frame(transition, 900).portalVisible, false);
});

test('entry portal stays open indefinitely, then swallows popup before shrinking closed', () => {
	const hold = { kind: 'hold', startedAt: 0, reduced: false };
	for (const age of [0, 600, 10000, 120000]) {
		const f = frame(hold, age);
		assert.equal(f.gateVisible, true);
		assert.equal(f.portalVisible, true);
		assert.equal(f.gateTime, 1.1);
		assert.equal(f.artScale, 1);
		assert.equal(f.done, false);
	}
	assert.equal(frame({ kind: 'entry', startedAt: 0, reduced: false }, 2170).gateTime, 1.1);
	const dismiss = { kind: 'dismiss', startedAt: 0, reduced: false };
	assert.equal(frame(dismiss, 0).artScale, 1);
	assert.equal(frame(dismiss, 400).artScale, 0);
	assert.equal(frame(dismiss, 400).gateTime, 1.85);
	assert.ok(frame(dismiss, 500).gateTime > 1.85);
	assert.equal(frame(dismiss, 900).gateVisible, false);
	assert.equal(frame(dismiss, 900).done, true);
	const reduced = frame({ ...dismiss, reduced: true }, 160);
	assert.equal(reduced.rotation, 0);
	assert.equal(reduced.artScale, 1);
	assert.equal(reduced.artAlpha, 0);
	assert.equal(reduced.done, true);
	const code = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	const entry = code.slice(
		code.indexOf('const enterBonus = async'),
		code.indexOf('let waveDuration'),
	);
	assert.match(
		entry,
		/kind: 'hold'[\s\S]*?await present\(signal, undefined, TIMING.overlayGuard\);[\s\S]*?kind: 'dismiss'[\s\S]*?await delay\(runtime.reduced \? BONUS_ENTRY_DISMISS_MS.reduced : BONUS_ENTRY_DISMISS_MS.normal, signal\)/,
	);
});

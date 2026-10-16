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
	assert.equal(frame({ kind: 'exit', startedAt: 0, reduced: false }, 700).gateTime, 0);
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
	for (let t = 700; t <= duration('exit', false); t += 10) {
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
	assert.ok(frame(transition, 600).gateTime >= 1.98);
	assert.equal(frame(transition, 600).portalVisible, true);
	assert.equal(frame(transition, 700).portalVisible, false);
});

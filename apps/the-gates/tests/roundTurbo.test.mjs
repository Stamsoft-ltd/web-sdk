import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { effectiveSpeed } from '../src/game/uiPolicy.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('spin override shows Turbo without mutating selected preference; resets to original afterward', () => {
	for (const flags of [
		{ isTurbo: false, isSuperTurbo: false },
		{ isTurbo: true, isSuperTurbo: false },
		{ isTurbo: false, isSuperTurbo: true },
	]) {
		const before = { ...flags };
		assert.equal(effectiveSpeed(flags, {}, true), 'turbo');
		assert.equal(
			effectiveSpeed(flags, {}, false),
			flags.isSuperTurbo ? 'turbo' : flags.isTurbo ? 'fast' : 'normal',
		);
		assert.deepEqual(flags, before);
	}
	assert.equal(
		effectiveSpeed({ isTurbo: false, isSuperTurbo: false }, { disabledTurbo: true }, true),
		'normal',
	);
	assert.equal(
		effectiveSpeed({ isTurbo: false, isSuperTurbo: false }, { disabledSuperTurbo: true }, true),
		'fast',
	);
	const playback = src('game/playback.svelte.ts');
	assert.match(playback, /runtime.skipRequested = true;\s*runtime.spinTurbo = true/);
	assert.match(playback, /runtime.busy = false;\s*runtime.spinTurbo = false/);
	const spin = playback.slice(
		playback.indexOf("case 'spinStart':"),
		playback.indexOf("case 'reveal':"),
	);
	assert.match(spin, /spinTurbo = false/);
	assert.doesNotMatch(playback, /skipRequested \? 6/);
});
test('hold-space chooses Turbo, latches current spin, and does not spam Slam Stop', () => {
	const game = src('components/Game.svelte');
	assert.match(game, /runtime.heldTurbo = true;\s*if \(runtime.busy\) runtime.spinTurbo = true/);
	assert.match(game, /runtime.busy && !spaceHeld && !modal/);
	assert.match(
		game,
		/effectiveSpeed\([\s\S]*?\(runtime.busy && runtime.spinTurbo\) \|\| runtime.heldTurbo/,
	);
});

test('keyboard Turbo never writes persistent speed flags and keyup prevents button activation', () => {
	const game = src('components/Game.svelte');
	const keyboard = game.slice(
		game.indexOf('function releaseSpace()'),
		game.indexOf('function screenFastForward'),
	);
	assert.doesNotMatch(keyboard, /stateBet.is(?:Super)?Turbo\s*=/);
	assert.match(keyboard, /runtime.heldTurbo = false/);
	assert.match(game, /if \(e.code === 'Space'\) \{\s*e.preventDefault\(\);\s*releaseSpace\(\)/);
});

test('boost clears after each spin, and speed button can cancel it immediately', () => {
	const playback = src('game/playback.svelte.ts');
	const settle = playback.slice(
		playback.indexOf("case 'spinWin':"),
		playback.indexOf("case 'setTotalWin':"),
	);
	assert.match(settle, /runtime.spinTurbo = false;\s*runtime.skipRequested = false/);
	const game = src('components/Game.svelte');
	const change = game.slice(game.indexOf('function changeSpeed()'), game.indexOf('const replay ='));
	assert.match(change, /nextSpeed\(speed, stateConfig.jurisdiction\)/);
	assert.match(change, /spaceHoldSuppressed = wasHeld/);
	assert.match(game, /e.repeat &&\s*!spaceHoldSuppressed/);
	assert.match(
		change,
		/runtime.spinTurbo = false;\s*runtime.skipRequested = false;[\s\S]*?releaseSpace\(\)/,
	);
});

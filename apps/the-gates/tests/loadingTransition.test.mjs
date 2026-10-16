import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	landingIntroFrame,
	landingExitFrame,
	gameArrivalFrame,
	interpolateBox,
	LANDING_EXIT_MS,
} from '../src/game/entryMotion.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('current McSchmutzo loader selects ten native frames from real progress', () => {
	const code = src('game/gpuScene.ts');
	assert.match(code, /length: 10/);
	assert.match(code, /loading\/p0\$\{i\}.webp/);
	assert.match(code, /Math.min\(9, Math.round\(progress \* 9\)\)/);
	assert.match(code, /press_play_wordmark.webp/);
	assert.doesNotMatch(code, /fill.mask = clip|press_play_p.webp/);
});
test('landing cards drop left to right before logo; exit drops cards and brings game from above', () => {
	assert.deepEqual(landingIntroFrame(0).cards, [1, 1, 1]);
	assert.ok(landingIntroFrame(100).cards[0] < landingIntroFrame(100).cards[1]);
	assert.equal(landingIntroFrame(730).logo, 1);
	assert.deepEqual(landingIntroFrame(1250).cards, [0, 0, 0]);
	assert.equal(landingIntroFrame(1250).logo, 0);
	const exit = landingExitFrame(200);
	assert.ok(exit.cards[0] > exit.cards[1] && exit.cards[1] > exit.cards[2]);
	assert.equal(landingExitFrame(LANDING_EXIT_MS).done, true);
	assert.equal(gameArrivalFrame(0).offset, 1);
	assert.equal(gameArrivalFrame(1250).offset, 0);
	assert.equal(gameArrivalFrame(1250).alpha, 1);
	const a = { x: 0, y: 0, width: 767, height: 418 },
		b = { x: 10, y: 80, width: 76.7, height: 41.8 };
	assert.deepEqual(interpolateBox(a, b, 0), a);
	const end = interpolateBox(a, b, 1);
	assert.ok(Math.abs(end.width - b.width) < 1e-9);
	assert.equal(end.x, b.x);
	const game = src('components/Game.svelte');
	assert.match(game, /clearTimeout\(entryTimer\)/);
	assert.match(game, /!entered \|\| entryLeavingAt/);
	assert.match(game, /!entryLeavingAt &&/);
	assert.match(game, /setEntryTransition/);
});
test('reduced entry avoids positional movement and finishes within 140ms', () => {
	assert.deepEqual(landingIntroFrame(30, true).cards, [0, 0, 0]);
	assert.equal(gameArrivalFrame(30, true).offset, 0);
	assert.equal(landingExitFrame(140, true).done, true);
});
test('bonus presentation accepts tap and Enter after guard but not while doors transition', () => {
	const bonus = src('components/BonusScreen.svelte');
	assert.match(bonus, /onclick=/);
	assert.match(bonus, /runtime.waiting && !runtime.bonusTransition/);
	assert.match(bonus, /pointer-events: auto/);
	assert.match(bonus, /onkeydown=/);
});
test('loader dims native base background and keeps lockup on its own bright layer', () => {
	const scene = src('game/gpuScene.ts');
	assert.match(scene, /PORTRAIT_ART_ROOT\}base-background.png/);
	assert.match(scene, /alpha: 0.62/);
	assert.match(scene, /wordWidth = size \* 2.65/);
	assert.match(scene, /shade, brand/);
});

test('loader remains mounted until landing art is installed; intro starts only after handoff', () => {
	const game = src('components/Game.svelte'),
		welcome = src('components/Welcome.svelte'),
		scene = src('game/gpuScene.ts');
	assert.match(game, /!entered && !landingReady/);
	assert.match(game, /active=\{loadingMinDone && landingReady\}/);
	assert.match(game, /onready=\{\(\) => \(landingReady = true\)\}/);
	assert.match(welcome, /if \(!dead\) onready\(\)/);
	assert.match(scene, /content.visible = false/);
	assert.match(scene, /!state.active \|\| !introInstalled/);
	assert.match(scene, /if \(!introStartedAt\) introStartedAt = now/);
	const install = scene.slice(scene.indexOf('const install = async'));
	assert.ok(install.indexOf('decorations.addChild') < install.indexOf('ready();'));
});

test('base-game canvas and HUD cannot flash before loader registration', () => {
	const game = src('components/Game.svelte');
	assert.match(game, /class:scene-entry=\{!ready \|\| !entered \|\| !gpu.engine\}/);
	assert.match(
		game,
		/\.scene-entry > :global\(\.gpu-surface\),\s*\.scene-entry > \.figma-layout\s*\{\s*visibility: hidden/,
	);
	assert.match(game, /entered \|\| entryLeavingAt \|\| !landingReady \|\| !loadingMinDone/);
});

test('unfinished round never bypasses loading/landing or the board and HUD entrance', () => {
	const game = src('components/Game.svelte');
	assert.match(game, /ready && gpu.engine && \(!entered \|\| entryLeavingAt\)/);
	assert.doesNotMatch(game, /!pending && \(!entered \|\| entryLeavingAt\)/);
	assert.match(game, /else if pending && entered && !entryLeavingAt\}<ResumeRound/);
	assert.match(game, /entryLeavingAt = 0;\s*gpu.engine\?\.setEntryTransition\(null\)/);
	assert.match(game, /runtime.reduced \? 140 : LANDING_EXIT_MS/);
	assert.match(game, /!pending &&\s*!replay/);
});

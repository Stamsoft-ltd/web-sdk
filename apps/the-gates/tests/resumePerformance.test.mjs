import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
} from '@esotericsoftware/spine-core';
import { SpinePose } from '../src/game/spine.ts';
import { portalRemovalTracks } from '../src/game/portalAnimation.ts';
const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const root = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
function data(overrides) {
	const atlas = new TextureAtlas(readFileSync(new URL('symbols-normal.atlas', root), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const json = JSON.parse(readFileSync(new URL('RED_GEM.json', root), 'utf8'));
	if (overrides) json.animations.remove = overrides;
	return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);
}
test('event removal replaces only an actor-local track, not its skeleton or shared cached rig', () => {
	const original = data(),
		a = new SpinePose(original, 'idle'),
		b = new SpinePose(original, 'idle');
	const skeleton = a.skeleton,
		bones = [...a.skeleton.bones];
	const old = original.findAnimation('remove');
	for (let i = 0; i < 8; i++) {
		const animation = data(portalRemovalTracks(`event-${i}`)).findAnimation('remove');
		a.overrideAnimation(animation);
		a.sample('remove', 0.25);
		assert.equal(a.skeleton, skeleton);
		assert.deepEqual(a.skeleton.bones, bones);
		assert.equal(a.data.findAnimation('remove'), animation);
		assert.equal(a.state.getCurrent(0).animation, animation);
		assert.equal(b.data.findAnimation('remove'), old);
		assert.equal(original.findAnimation('remove'), old);
		assert.equal(a.data.animations.length, original.animations.length, 'bounded actor tracks');
	}
});
test('surviving cells stay mounted; covered board actors pause', () => {
	const board = source('components/Board.svelte');
	assert.doesNotMatch(board, /#key runtime.game.revealId/);
	assert.match(board, /reduced: runtime.reduced,\s*paused/);
	assert.match(
		source('components/Game.svelte'),
		/<Board[\s\S]*?paused=\{!ready\s*\|\|\s*!entered\s*\|\|\s*pending/,
	);
	assert.match(source('game/gpuRenderer.ts'), /if \(moving\) this.invalidate\(\)/);
	assert.match(
		source('game/gpuBoard.ts'),
		/state.reduced \|\| \(state.paused && !celebration\?\.keys.includes\(key\)\)/,
	);
	assert.match(source('game/gpuBoard.ts'), /tile.request !== request/);
	assert.match(
		source('components/SpineArt.svelte'),
		/if \(element.dataset.spinePlaying !== playing\)/,
	);
});
test('button captions cannot trigger self-shrinking resize loops; numeric measurements deduplicate', () => {
	const labels = source('components/ButtonLabel.svelte');
	assert.doesNotMatch(labels, /ResizeObserver|measureText|\$effect|fitted/);
	assert.match(labels, /white-space:normal;overflow-wrap:break-word/);
	assert.match(labels, /\{text\}/);
	const numbers = source('components/FitNumber.svelte');
	assert.match(numbers, /measured\?\.text !== value \|\| measured.em !== width/);
});
test('resume is compact, locked and offers play/skip without fitting observers', () => {
	const resume = source('components/ResumeRound.svelte');
	assert.match(resume, /<Modal[\s\S]*?locked compact framed>/);
	assert.doesNotMatch(resume, /confirmation-symbol|<Symbol/);
	assert.match(resume, /disabled=\{busy\} onclick=\{resume\}/);
	assert.match(resume, /\{t\('PLAY ROUND'\)\}/);
	assert.match(resume, /disabled=\{busy\} onclick=\{skip\}/);
	assert.match(resume, /\{t\('SKIP ROUND'\)\}/);
	assert.match(source('game/modalFocus.ts'), /if \(!locked\) close\(\)/);
	assert.doesNotMatch(resume, /ButtonLabel|ResizeObserver/);
	const game = source('components/Game.svelte');
	assert.match(
		game,
		/else if pending && entered && !entryLeavingAt\}<ResumeRound\s+\{busy\}\s+\{resume\}\s+skip=\{skipUnfinished\}/,
	);
	assert.match(game, /stateConfig.jurisdiction.displaySessionTimer\s*\? setInterval/);
	assert.match(game, /function resume\(\)[\s\S]*?if \(busy \|\| !stateBet.betToResume\) return/);
});

test('unfinished-round modal waits for landing entry; the completed game HUD stays visible', () => {
	const game = source('components/Game.svelte');
	assert.match(game, /class:scene-entry=\{!ready \|\| !entered \|\| !gpu.engine\}/);
});

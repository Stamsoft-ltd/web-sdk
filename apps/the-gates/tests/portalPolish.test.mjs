import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
} from '@esotericsoftware/spine-core';
import { portalRemovalTracks } from '../src/game/portalAnimation.ts';
import { gateCycleTracks } from '../src/game/gateAnimation.ts';
import { SpinePose } from '../src/game/spine.ts';
import { scatterCelebrationFrame, SCATTER_CELEBRATION_MS } from '../src/game/scatterCelebration.ts';
import { payingSymbolGlow, SYMBOL_GLOW } from '../src/game/symbolGlow.ts';
import { hudBetAmount } from '../src/game/hudPresentation.ts';
const source = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
function shrinking(keys, start, gone) {
	const frames = keys.filter((key) => key.time >= start);
	let previous = Infinity;
	for (const frame of frames) {
		assert.equal(frame.x, frame.y, 'exit scales uniformly, never squeezes');
		assert.ok(frame.x <= previous, 'no exit expansion');
		previous = frame.x;
	}
	assert.ok(frames.some((frame) => frame.time <= gone && frame.x <= 0.001));
}
test('mini and gate portals collapse uniformly in 60/130 ms after the hold', () => {
	for (const seed of ['round:1', 'round:2', 'round:3']) {
		shrinking(portalRemovalTracks(seed).bones['portal-root'].scale, 0.87, 0.93);
		shrinking(gateCycleTracks(seed).bones['portal-root'].scale, 1.85, 1.98);
	}
	for (const dir of ['figma-20261012/motion', 'portrait-20261015'])
		for (const tier of ['normal', 'super', 'hidden']) {
			const file = new URL(`../static/assets/the-gates/${dir}/gate-${tier}.json`, import.meta.url);
			const rig = JSON.parse(readFileSync(file, 'utf8'));
			shrinking(rig.animations.cycle.bones['portal-root'].scale, 1.85, 1.98);
		}
});
test('gate releases its covering renderer for the full third-cluster removal wave', () => {
	const gate = source('components/TempleGate.svelte');
	assert.match(
		gate,
		/gateOpen = \$derived\(runtime.game.gateOpen && runtime.phase !== 'removing'\)/,
	);
	assert.match(gate, /class:open=\{gateOpen\}/);
	assert.match(gate, /if \(!engine \|\| !element \|\| !gateOpen\) return/);
	const playback = source('game/playback.svelte.ts');
	const removal = playback.slice(
		playback.indexOf("if (e.type === 'tumbleRemove')"),
		playback.indexOf("if (e.type === 'freeSpinTrigger')"),
	);
	assert.match(
		removal,
		/beginWave\('remove'\);\s*runtime.phase = 'removing';\s*await waitMotion\(\)/,
	);
	assert.ok(
		playback.indexOf('runtime.game = reduceEvent(runtime.game, e)') >
			playback.indexOf("if (e.type === 'tumbleRemove')"),
	);
});
test('Keys continue pulsing over repeated cycles until acknowledged; reduced motion stays still', () => {
	for (const duration of Object.values(SCATTER_CELEBRATION_MS)) {
		const early = scatterCelebrationFrame(duration / 4, duration);
		for (const loops of [1, 3, 20])
			assert.deepEqual(scatterCelebrationFrame(duration * loops + duration / 4, duration), early);
		assert.ok(early.scale > 1);
		assert.equal(scatterCelebrationFrame(duration * 20 + 30, duration, true).rotation, 0);
		assert.equal(scatterCelebrationFrame(duration * 20 + 30, duration, true).scale, 1);
	}
	const code = source('game/playback.svelte.ts');
	const celebration = code.slice(
		code.indexOf('const celebrateScatters ='),
		code.indexOf('const enterBonus ='),
	);
	assert.doesNotMatch(celebration, /await delay|scatterCelebration = null/);
	const entry = code.slice(
		code.indexOf('const enterBonus ='),
		code.indexOf('\n\ttry {\n\t\tfor (const e of events)'),
	);
	assert.match(
		entry,
		/await present\(signal, undefined, TIMING.overlayGuard\);\s*runtime.scatterCelebration = null/,
	);
});
test('only landed Keys use the unmasked over-frame layer; controls never bubble into click-skip', () => {
	const board = source('game/gpuBoard.ts');
	assert.match(board, /root.addChild\(background, field, mask, frame, keyLayer\)/);
	assert.match(board, /parent = overFrame \? keyLayer : tile.root/);
	assert.match(board, /overFrame \? tile.root.x \+ tile.width \/ 2/);
	assert.doesNotMatch(board, /keyLayer.mask\s*=/);
	assert.match(
		board,
		/if \(state.reduced \|\| \(state.paused && !celebration\?\.keys.includes\(key\)\)\)/,
	);
	const game = source('components/Game.svelte');
	const handler = game.slice(
		game.indexOf('function screenFastForward'),
		game.indexOf('async function fullscreen'),
	);
	assert.match(
		handler,
		/target.closest\([\s\S]*?button,a,input,select,textarea,label,\[role="button"\]/,
	);
	for (const guard of [
		'!entered',
		'pending',
		'modal',
		'selected',
		'menuOpen',
		'stateModal.modal',
		'runtime.error',
		'!runtime.busy',
		'runtime.waiting',
		'runtime.bonusTransition',
	])
		assert.ok(handler.includes(guard), guard);
	assert.match(handler, /requestSkip\(\)/);
	assert.match(game, /onclick=\{screenFastForward\}/);
});
test('rainbow Wild has a valid native rig, tight count-first reward and cluster-specific glow', () => {
	const root = new URL('../static/assets/the-gates/rainbow-wild-20261016/', import.meta.url);
	const atlas = new TextureAtlas(readFileSync(new URL('symbols.atlas', root), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
		JSON.parse(readFileSync(new URL('WILD.json', root), 'utf8')),
	);
	const pose = new SpinePose(data, 'idle');
	for (const animation of ['setup', 'idle', 'paying']) {
		for (const time of [0, 0.1, 0.3, 1, 2]) {
			pose.sample(animation, time);
			assert.ok(
				pose.skeleton.bones.every((b) => Number.isFinite(b.worldX) && Number.isFinite(b.worldY)),
			);
		}
	}
	const provenance = JSON.parse(readFileSync(new URL('provenance.json', root), 'utf8'));
	assert.equal(
		createHash('sha256')
			.update(readFileSync(new URL('rainbow-wild.png', root)))
			.digest('hex'),
		provenance.sha256,
	);
	const gate = source('components/TempleGate.svelte');
	assert.match(gate, /wild.view.position.set\(46, 0\)/);
	assert.match(gate, /label.x = sticky \? -53 : 0/);
	const wins = [
		{ symbol: 'RED_GEM', positions: [{ reel: 1, row: 2 }] },
		{ symbol: 'BLUE_GEM', positions: [{ reel: 3, row: 0 }] },
	];
	assert.equal(payingSymbolGlow('WILD', '1:2', wins), SYMBOL_GLOW.RED_GEM);
	assert.equal(payingSymbolGlow('WILD', '3:0', wins), SYMBOL_GLOW.BLUE_GEM);
	assert.equal(payingSymbolGlow('WILD', '0:0', wins), SYMBOL_GLOW.WILD);
	assert.equal(payingSymbolGlow('GREEN_GEM', '1:2', wins), SYMBOL_GLOW.GREEN_GEM);
});
test('Chance displays doubled cost; the underlying base bet is untouched', () => {
	for (const bet of [1, 1250000, 2000000]) {
		assert.equal(hudBetAmount(bet, 'CHANCE'), bet * 2);
		assert.equal(hudBetAmount(bet, 'FEATURE'), bet * 20);
		assert.equal(hudBetAmount(bet, 'BASE'), bet);
	}
	assert.match(
		source('components/Game.svelte'),
		/class:feature-cost=\{mode === 'FEATURE' \|\| mode === 'CHANCE'\}/,
	);
});

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
import { SpinePose } from '../src/game/spine.ts';
import { projectFullscreenGate } from '../src/game/gateViewport.ts';
import { SYMBOL_VIEWPORT, symbolViewport } from '../src/game/symbolFit.ts';
import { SYMBOL_ART } from '../src/game/art.ts';
const root = new URL('../static/assets/the-gates/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const source = (path) => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');
test('regular symbols share equal visible ink size, independent of export padding', () => {
	const inventory = JSON.parse(read('figma-20261012/asset-manifest.json'));
	for (const [name, viewport] of Object.entries(SYMBOL_VIEWPORT)) {
		const art = inventory.assets.find((a) => a.path === `symbols/${SYMBOL_ART[name]}.png`);
		const [x, y, right, bottom] = art.alphaBounds;
		const visible =
			(144 * Math.max(right - x, bottom - y)) / Math.max(art.width, art.height) / viewport;
		assert.ok(Math.abs(visible - 0.84) < 1e-8, name);
	}
	assert.match(source('game/gpuBoard.ts'), /symbolViewport\(tile.name\)/);
});
test('base chevron preserves native bytes and gate coverage at every orientation', () => {
	const dir = 'base-gate-20261016/';
	const provenance = JSON.parse(read(dir + 'provenance.json'));
	assert.equal(
		createHash('sha256')
			.update(read(dir + 'base-leaf.png'))
			.digest('hex'),
		provenance.sha256,
	);
	const atlas = new TextureAtlas(read(dir + 'gate-base.atlas').toString());
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
		JSON.parse(read(dir + 'gate-base.json')),
	);
	for (const [width, height] of [
		[1200, 784],
		[390, 844],
		[844, 390],
		[320, 568],
	]) {
		const pose = new SpinePose(data, 'idle');
		pose.sample('cycle', 0.54);
		const scale = projectFullscreenGate(pose.skeleton, width, height);
		for (const name of ['door-left', 'door-right']) {
			const slot = pose.skeleton.findSlot(name),
				v = new Float32Array(8);
			slot.getAttachment().computeWorldVertices(slot, v, 0, 2);
			const ys = [v[1], v[3], v[5], v[7]].map((y) => height / 2 - y * scale);
			assert.ok(Math.min(...ys) <= 0 && Math.max(...ys) >= height, `${width}x${height} ${name}`);
		}
	}
	assert.match(source('components/TempleGate.svelte'), /tier === 'base'\s*\? BASE_GATE_ROOT/);
});
test('Wild uses standalone flower with generated Key-style frame and separate pay animation', () => {
	const rig = JSON.parse(read('rainbow-wild-20261016/WILD.json'));
	assert.equal(rig.skins[0].attachments.body['rainbow-wild'].height, (260 * 117) / 118);
	assert.ok(rig.animations.paying.bones.body.rotate.length >= 4);
	assert.match(source('game/gpuBoard.ts'), /name === 'KEY' \|\| name === 'WILD'/);
	for (const title of ['TUMBLES', 'MULTIPLIER', 'FREE SPINS', 'TOTAL WIN'])
		assert.ok(source('game/gpuPanels.ts').includes(`state.translate('${title}').toUpperCase()`));
	assert.match(source('game/gpuPanels.ts'), /label\(20, titleGold\)/);
});

test('Eye/envelope fill 108%, other premiums 92%; gem, Key and Wild scales unchanged', () => {
	for (const [name, viewport] of Object.entries(SYMBOL_VIEWPORT)) {
		const fill = name === 'SACRED_EYE' || name === 'RUNE_CHALICE' ? 1.08 : 0.92;
		assert.equal(symbolViewport(name), name.endsWith('_GEM') ? viewport : viewport * (0.84 / fill));
	}
	assert.equal(symbolViewport('KEY'), 150);
	assert.equal(symbolViewport('WILD'), 150);
});
test('stat fills stay inset behind the native ornamental frame at every breakpoint', () => {
	const panels = source('game/gpuPanels.ts');
	assert.match(panels, /16 \* scale,\s*12 \* scale,\s*width - 32 \* scale,\s*height - 24 \* scale/);
	assert.doesNotMatch(panels, /roundRect\(2, 2, width - 4, height - 4, 10\)/);
});

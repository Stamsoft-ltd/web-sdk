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
import { portalTier } from '../src/game/art.ts';
import { SpinePose } from '../src/game/spine.ts';
import { runtimeAssets } from '../tools/package-assets.mjs';
const root = new URL('../static/assets/the-gates/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
function parse(path, json) {
	const atlas = new TextureAtlas(read(path).toString());
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
		JSON.parse(read(json)),
	);
}
test('base gate and symbol-removal atlas share approved blue/gold portal layers', () => {
	const folder = 'gates-base/';
	const meta = JSON.parse(read(folder + 'portal-provenance.json'));
	assert.equal(
		createHash('sha256')
			.update(read(folder + meta.path))
			.digest('hex'),
		meta.sha256,
	);
	const actors = [
		[parse(folder + 'gate-base.atlas', folder + 'gate-base.json'), 'cycle'],
		[
			parse('art/animations/symbols-base.atlas', 'art/animations/RED_GEM.json'),
			'remove',
		],
	];
	for (const [data, animation] of actors) {
		for (const name of ['portal-rim', 'portal-vortex']) {
			const attachment = data.defaultSkin.getAttachment(data.findSlot(name).index, name);
			assert.ok(attachment.region.page.name.endsWith(meta.path));
			assert.equal(attachment.region.width, meta.regions[name][2]);
			assert.equal(attachment.region.height, meta.regions[name][3]);
		}
		const pose = new SpinePose(data, animation);
		for (const time of [0, 0.2, 0.5, 0.8, 1.2, 2.4, 5]) {
			pose.sample(animation, time);
			assert.ok(
				pose.skeleton.bones.every((b) => Number.isFinite(b.worldX) && Number.isFinite(b.worldY)),
			);
		}
	}
});
test('base-family chooses base portal; bonus tiers retain distinct original artwork', () => {
	assert.equal(portalTier(null), 'base');
	assert.equal(portalTier(undefined), 'base');
	for (const tier of ['normal', 'super', 'hidden']) {
		assert.equal(portalTier(tier), tier);
		assert.ok(
			read(`art/animations/gate-${tier}.atlas`)
				.toString()
				.includes(`${tier}-portal-layers-v1.png`),
		);
	}
	const board = readFileSync(new URL('../src/components/Board.svelte', import.meta.url), 'utf8');
	assert.match(board, /palette: portalTier\(/);
});
test('production dependency closure includes base portal and both animation atlases', async () => {
	const result = await runtimeAssets();
	const keep = result.keep ?? result;
	for (const path of [
		'assets/the-gates/gates-base/base-portal-layers-v1.png',
		'assets/the-gates/gates-base/portal-provenance.json',
		'assets/the-gates/art/animations/symbols-base.atlas',
	])
		assert.ok(keep.has(path), path);
});

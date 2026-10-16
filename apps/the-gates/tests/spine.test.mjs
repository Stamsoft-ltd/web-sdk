/** Current native/Pixi actor contracts; retired fire/architecture/old title rigs removed. */
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
const root = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
function data(name, atlasName = name) {
	const atlas = new TextureAtlas(readFileSync(new URL(atlasName + '.atlas', root), 'utf8'));
	for (const p of atlas.pages) p.setTexture(new FakeTexture({ width: p.width, height: p.height }));
	return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
		JSON.parse(readFileSync(new URL(name + '.json', root), 'utf8')),
	);
}
test('current win/bonus intros transition to idle once, with finite official Spine transforms', () => {
	for (const name of [
		...['sweet', 'wild', 'epic', 'mythic', 'legendary'].map((t) => 'win-' + t),
		...['normal', 'super', 'hidden'].map((t) => 'bonus-' + t),
	]) {
		const p = new SpinePose(data(name), 'idle');
		p.playIntro('enter', 'idle');
		for (let i = 0; i < 90; i++) p.update(1 / 30);
		assert.equal(p.state.getCurrent(0).animation.name, 'idle');
		assert.ok(
			p.skeleton.bones.every((b) =>
				[b.a, b.b, b.c, b.d, b.worldX, b.worldY].every(Number.isFinite),
			),
		);
	}
});
test('separate actors share immutable native source data, not playback state', () => {
	const d = data('RED_GEM', 'symbols-normal'),
		a = new SpinePose(d, 'idle'),
		b = new SpinePose(d, 'idle');
	a.sample('paying', 0.3);
	assert.equal(b.state.getCurrent(0).animation.name, 'idle');
	assert.notEqual(a.state, b.state);
	assert.notEqual(a.skeleton, b.skeleton);
	assert.equal(a.data.bones, b.data.bones);
});

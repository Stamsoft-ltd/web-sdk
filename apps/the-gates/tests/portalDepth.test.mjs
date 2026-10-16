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
import { SYMBOL_ART } from '../src/game/art.ts';
import {
	portalRemovalTracks,
	SYMBOL_FULL_SIZE_SECONDS,
	SYMBOL_GONE_SECONDS,
	PORTAL_SECONDS,
} from '../src/game/portalAnimation.ts';
const root = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);

test('suction spins over one full turn with consistent direction and no shortest-arc jumps', () => {
	for (let seed = 0; seed < 100; seed++) {
		const tracks = portalRemovalTracks(`strong-spin-${seed}`);
		const keys = tracks.bones.body.rotate;
		const total = keys.at(-1).value;
		assert.ok(Math.abs(total) >= 500 && Math.abs(total) <= 560);
		assert.equal(keys[1].time, SYMBOL_FULL_SIZE_SECONDS);
		assert.equal(keys[1].value, 0, 'neutral orientation during full-size hold');
		for (let i = 2; i < keys.length; i++) {
			const turn = keys[i].value - keys[i - 1].value;
			assert.equal(Math.sign(turn), Math.sign(total));
			assert.ok(Math.abs(turn) < 180, 'no interpolation direction reversal');
		}
	}
});

test('every native symbol and portal palette preserves full start pose, rear rim and gradual suction', () => {
	for (const palette of ['normal', 'super', 'hidden']) {
		const atlas = new TextureAtlas(readFileSync(new URL(`symbols-${palette}.atlas`, root), 'utf8'));
		for (const page of atlas.pages)
			page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
		for (const name of Object.keys(SYMBOL_ART))
			for (const seed of ['round-1', 'round-2']) {
				const json = JSON.parse(readFileSync(new URL(`${name}.json`, root), 'utf8'));
				json.animations.remove = portalRemovalTracks(`${seed}:${name}`);
				const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json);
				const actor = new SpinePose(data, 'setup');
				actor.sample('setup', 0);
				const bone = actor.skeleton.findBone('body');
				const neutral = [bone.worldX, bone.worldY, bone.a, bone.b, bone.c, bone.d];
				actor.sample('paying', 0.18);
				for (const time of [0, 0.04, 0.1, SYMBOL_FULL_SIZE_SECONDS]) {
					actor.sample('remove', time);
					// Spine stores key times in float32; allow only sub-pixel numeric residue.
					const actual = [bone.worldX, bone.worldY, bone.a, bone.b, bone.c, bone.d];
					actual.forEach((value, i) =>
						assert.ok(
							Math.abs(value - neutral[i]) < 1e-6,
							`${name}: no inherited paying squash or reduced start`,
						),
					);
					assert.equal(actor.skeleton.findSlot('body').color.a, 1);
				}
				let lastScale = 1;
				for (let frame = 0; frame <= 60; frame++) {
					actor.sample('remove', (PORTAL_SECONDS * frame) / 60);
					const layers = actor.skeleton.drawOrder.map((slot) => slot.data.name);
					assert.ok(layers.indexOf('portal-rim') < layers.indexOf('body'));
					assert.ok(layers.indexOf('portal-vortex') < layers.indexOf('body'));
					assert.ok(bone.scaleX <= lastScale + 1e-6, 'continuous shrink without a pop');
					lastScale = bone.scaleX;
				}
				actor.sample('remove', 0.5);
				assert.ok(bone.scaleX > 0.7, 'still large at midpoint');
				actor.sample('remove', Math.fround(SYMBOL_GONE_SECONDS));
				assert.equal(actor.skeleton.findSlot('body').color.a, 0);
				assert.ok(
					actor.skeleton.findBone('portal-root').scaleX > 0.95,
					'portal remains open until symbol is gone',
				);
			}
	}
});

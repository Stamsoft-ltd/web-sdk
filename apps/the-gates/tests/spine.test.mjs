import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
	RegionAttachment,
} from '@esotericsoftware/spine-core';
import { SpinePose } from '../src/game/spine.ts';
const base = new URL('../static/assets/the-gates/spine/', import.meta.url);
const json = (name) => JSON.parse(readFileSync(new URL(name + '.json', base), 'utf8'));
function data(name, atlasName) {
	const atlas = new TextureAtlas(readFileSync(new URL(atlasName + '.atlas', base), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	return new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json(name));
}
function sample(pose, t) {
	pose.state.getCurrent(0).trackTime = t;
	pose.update(0);
	return pose.skeleton.bones.flatMap((b) => [b.a, b.b, b.c, b.d, b.worldX, b.worldY]);
}
test('all symbol rigs parse in official Spine 4.2, have independent layers and distinct paying tracks', () => {
	const signatures = new Set();
	for (const name of json('manifest').symbols) {
		const d = data(name, 'symbols');
		assert.ok(d.slots.length >= 3);
		assert.ok(d.findAnimation('idle'));
		assert.ok(d.findAnimation('paying'));
		const pose = new SpinePose(d, 'paying');
		const initial = sample(pose, 0),
			moving = sample(pose, 0.29);
		assert.notDeepEqual(moving, initial, name);
		assert.ok(moving.every(Number.isFinite));
		for (const slot of pose.skeleton.slots)
			assert.ok(slot.getAttachment() instanceof RegionAttachment);
		signatures.add(JSON.stringify(json(name).animations.paying));
	}
	assert.equal(signatures.size, 7, 'shared gem mechanic + six premium/wild mechanisms');
});
test('fire changes source contours with fixed bases; crossfade and loop seams match', () => {
	for (const color of ['gold', 'green', 'red']) {
		const d = data('fire-' + color, 'flames');
		const p = new SpinePose(d, 'burn');
		assert.equal(d.slots.length, 3);
		assert.equal(
			json('fire-' + color).animations.burn.bones,
			undefined,
			'no rigid sway/rotation tracks',
		);
		const start = sample(p, 0);
		const first = p.skeleton.slots[0].getAttachment();
		sample(p, 0.25);
		assert.notEqual(
			p.skeleton.slots[0].getAttachment(),
			first,
			'new actual flame artwork, not transformed old frame',
		);
		for (let t = 0; t < 1.2; t += 0.037) {
			sample(p, t);
			assert.ok(
				Math.abs(p.skeleton.slots[0].color.a + p.skeleton.slots[1].color.a - 0.86) < 0.0001,
				'no crossfade brightness flashes',
			);
		}
		const end = sample(p, 1.2);
		end.forEach((v, i) => assert.ok(Math.abs(v - start[i]) < 0.00001));
		assert.equal(p.skeleton.slots[0].getAttachment(), first);
	}
});
test('each mode has independently staggered architectural pulse slots', () => {
	for (const mode of ['base', 'normal', 'super', 'hidden']) {
		const d = data('ambient-' + mode, 'energy');
		const p = new SpinePose(d, 'pulse');
		assert.ok(d.slots.length >= 9);
		sample(p, 3);
		assert.ok(new Set(p.skeleton.slots.map((s) => s.color.a.toFixed(4))).size > 4);
		assert.ok(p.skeleton.slots.every((s) => s.color.a >= 0.07 && s.color.a <= 0.66));
	}
});
test('win and bonus rigs parse; entrance transitions to idle without replaying entrance', () => {
	for (const [name, atlas] of [
		...['normal', 'super', 'hidden', 'complete'].map((m) => ['bonus-' + m, 'presentations']),
		...['sweet', 'wild', 'epic', 'mythic', 'legendary', 'max'].map((m) => ['win-' + m, 'win-' + m]),
	]) {
		const d = data(name, atlas);
		const pose = new SpinePose(d, 'idle');
		assert.ok(d.slots.length >= 2);
		pose.playIntro('enter', 'idle');
		for (let i = 0; i < 60; i++) pose.update(1 / 30);
		assert.equal(pose.state.getCurrent(0).animation.name, 'idle');
		assert.ok(sample(pose, 1).every(Number.isFinite));
	}
});

function landmark(pose, slotName, sourceX, sourceY) {
	const slot = pose.skeleton.findSlot(slotName),
		a = slot.getAttachment(),
		region = a.region,
		b = slot.bone;
	const x = a.x + ((sourceX - region.x - region.width / 2) * a.width) / region.width;
	const y = a.y + ((region.y + region.height / 2 - sourceY) * a.height) / region.height;
	return [b.a * x + b.b * y + b.worldX, b.c * x + b.d * y + b.worldY];
}
test('sun face and rotating socket stay concentric through full paying rotation', () => {
	const p = new SpinePose(data('SUN_MEDALLION', 'symbols'), 'paying');
	for (const t of [0, 0.2, 0.6, 1.2, 1.8, 2.39]) {
		sample(p, t);
		const ring = landmark(p, 'rays', 976.9, 445.72),
			face = landmark(p, 'face', 1259.5, 447);
		assert.ok(Math.hypot(ring[0] - face[0], ring[1] - face[1]) < 0.01);
	}
});
test('bonus sockets/gems and HD lettering stay centered; source pixels exceed 2x display need', () => {
	for (const mode of ['normal', 'super', 'hidden', 'complete']) {
		const p = new SpinePose(data('bonus-' + mode, 'presentations'), 'idle');
		for (const t of [0, 0.5, 1.2, 2.4, 4]) {
			sample(p, t);
			const socket = landmark(p, 'crest', 1272.34, 252.8);
			const gem = landmark(
				p,
				'gem',
				...{ normal: [180, 903], super: [542, 903], hidden: [904.5, 903.5], complete: [1267, 902] }[
					mode
				],
			);
			assert.ok(Math.hypot(socket[0] - gem[0], socket[1] - gem[1]) < 0.01, mode);
		}
		for (const slot of ['title', 'plaque']) {
			const a = p.skeleton.findSlot(slot).getAttachment();
			assert.ok(a.region.width >= 1800);
			assert.ok(a.region.width >= a.width * (780 / 1100) * 2, 'native pixels cover desktop DPR2');
		}
		assert.equal(p.skeleton.findBone('title').x, 0);
	}
});

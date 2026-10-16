import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
	Skeleton,
	AnimationState,
	AnimationStateData,
	Physics,
} from '@esotericsoftware/spine-core';
import {
	gateCycleTracks,
	gateClockStep,
	gateImpactSparks,
	GATE_SPARK_COUNT,
	GATE_CYCLE,
} from '../tools/gate-cycle-rig.mjs';
import { createHash } from 'node:crypto';
const motion = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', motion), 'utf8'));
function pose(entry, t = 0, animation = 'cycle') {
	const atlas = new TextureAtlas(readFileSync(new URL(entry.atlas + '.atlas', motion), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const json = JSON.parse(readFileSync(new URL(entry.name + '.json', motion), 'utf8'));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json),
		skeleton = new Skeleton(data);
	const state = new AnimationState(new AnimationStateData(data));
	state.setAnimation(0, animation, false).trackTime = t;
	state.apply(skeleton);
	skeleton.updateWorldTransform(Physics.update);
	return { skeleton, data, json, state };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00005, `${a} != ${b}`);
test('all three gates use intact native mode leaves, mirror right, and keep portal/reward behind doors', () => {
	assert.equal(manifest.gates.length, 3);
	for (const entry of manifest.gates) {
		const { skeleton, json } = pose(entry, 0, 'setup');
		assert.deepEqual(
			skeleton.drawOrder.slice(0, 5).map((s) => s.data.name),
			['portal-vortex', 'portal-rim', 'reward', 'door-left', 'door-right'],
		);
		assert.ok(
			skeleton.drawOrder.slice(5).every((s) => s.data.name.startsWith('impact-')),
			'sparks in front of doors',
		);
		assert.equal(skeleton.findBone('door-right').scaleX, -1);
		assert.equal(
			skeleton.findSlot('door-left').getAttachment().region,
			skeleton.findSlot('door-right').getAttachment().region,
		);
		assert.ok(entry.leaf.endsWith(`${entry.tier}-leaf-original.png`));
		assert.ok(!JSON.stringify(json).includes('reference-only'));
		assert.equal(
			skeleton.findSlot('reward').getAttachment(),
			null,
			'actual reward comes from authoritative localized UI, not baked demo values',
		);
		assert.equal(skeleton.findSlot('portal-rim').color.a, 0);
	}
});
test('gates enter from opposite offscreen sides, collide, settle closed, then fully clear', () => {
	for (const entry of manifest.gates) {
		const start = pose(entry).skeleton;
		assert.ok(start.findBone('door-left').worldX + 128 < -500);
		assert.ok(start.findBone('door-right').worldX - 128 > 500);
		const impact = pose(entry, GATE_CYCLE.impact).skeleton;
		assert.ok(impact.findBone('door-left').worldX + 128 > 0);
		assert.ok(impact.findBone('door-right').worldX - 128 < 0);
		const closed = pose(entry, 0.54).skeleton;
		near(closed.findBone('door-left').worldX + 128, 0);
		near(closed.findBone('door-right').worldX - 128, 0);
		const open = pose(entry, GATE_CYCLE.opened).skeleton;
		assert.ok(open.findBone('door-left').worldX + 128 < -500);
		assert.ok(open.findBone('door-right').worldX - 128 > 500);
		const { data } = pose(entry),
			end = pose(entry, data.findAnimation('cycle').duration).skeleton;
		assert.equal(data.findAnimation('cycle').duration, Math.fround(GATE_CYCLE.finished));
		assert.ok(end.slots.every((s) => s.color.a === 0));
	}
});
test('impact shake is little, deterministic per eventId, returns neutral before reward', () => {
	const tracks = gateCycleTracks('event-2:gate-1');
	assert.deepEqual(tracks, gateCycleTracks('event-2:gate-1'));
	assert.notDeepEqual(tracks.bones.stage, gateCycleTracks('event-2:gate-2').bones.stage);
	assert.deepEqual(tracks.bones['door-left'], gateCycleTracks('event-2:gate-2').bones['door-left']);
	for (const entry of manifest.gates) {
		const shake = pose(entry, 0.388).skeleton.findBone('stage');
		assert.ok(Math.abs(shake.x) > 1 && Math.abs(shake.x) <= 7);
		assert.ok(Math.abs(shake.y) <= 2 && Math.abs(shake.rotation) <= 0.45);
		const settled = pose(entry, 0.54).skeleton.findBone('stage');
		near(settled.x, 0);
		near(settled.y, 0);
		near(settled.rotation, 0);
	}
});
test('reward spins and grows out while doors open, settles upright, then removes both', () => {
	for (const entry of manifest.gates) {
		const closed = pose(entry, GATE_CYCLE.openStart).skeleton;
		near(closed.findSlot('reward').color.a, 0);
		assert.ok(closed.findBone('reward').scaleX < 0.021);
		let lastScale = 0;
		for (const time of [0.67, 0.76, 0.85, 0.94]) {
			const emerging = pose(entry, time).skeleton;
			assert.ok(emerging.findSlot('reward').color.a > 0.99);
			assert.equal(emerging.findSlot('door-left').color.a, 1, 'doors still sliding');
			assert.ok(emerging.findBone('reward').scaleX > lastScale);
			lastScale = emerging.findBone('reward').scaleX;
		}
		const rotation = gateCycleTracks('reward').bones.reward.rotate;
		near(rotation.find((k) => k.time === 0.58).value, -720);
		near(rotation.find((k) => k.time === 1.1).value, 0);
		for (let i = 1; i < rotation.length; i++)
			assert.ok(Math.abs(rotation[i].value - rotation[i - 1].value) < 180);

		const a = pose(entry, GATE_CYCLE.rewardStart).skeleton,
			b = pose(entry, GATE_CYCLE.rewardHoldEnd).skeleton;
		near(a.findBone('reward').scaleX, 1);
		near(a.findBone('reward').rotation, 0);
		near(b.findBone('reward').scaleX, 1);
		near(b.findBone('reward').rotation, 0);
		assert.equal(a.findSlot('reward').color.a, 1);
		assert.equal(b.findSlot('reward').color.a, 1);
		assert.equal(a.findSlot('portal-vortex').color.a, 1);
		assert.notEqual(a.findBone('portal-vortex').rotation, b.findBone('portal-vortex').rotation);
		const removed = pose(entry, Math.fround(GATE_CYCLE.rewardGone)).skeleton;
		assert.equal(removed.findSlot('reward').color.a, 0);
		assert.equal(removed.findSlot('portal-rim').color.a, 1);
		const closedPortal = pose(entry, 1.98).skeleton.findBone('portal-root');
		near(closedPortal.scaleX, closedPortal.scaleY);
		assert.ok(closedPortal.scaleX < 0.002);
	}
});
test('live speed scales movement but protects the full 750ms reward hold, including boundary crossings', () => {
	for (const rate of [1, 1.5, 3]) {
		near(gateClockStep(0, 0.1, rate), 0.1 * rate);
		near(gateClockStep(1.2, 0.1, rate), 0.1);
		near(gateClockStep(1.9, 0.1, rate), 0.1 * rate);
		const wallTime =
			GATE_CYCLE.rewardStart / rate +
			0.75 +
			(GATE_CYCLE.finished - GATE_CYCLE.rewardHoldEnd) / rate;
		near(gateClockStep(0, wallTime, rate), GATE_CYCLE.finished);
	}
	near(gateClockStep(1.09, 0.1, 3), 0.10666666666666669);
	near(gateClockStep(1.84, 0.1, 3), 0.28);
	for (const args of [
		[0, -1, 1],
		[0, 1, 0],
		[NaN, 1, 1],
	])
		assert.throws(() => gateClockStep(...args), /Invalid gate clock/);
});
test('gate events fire once in order, even across large updates; cancellation emits no later reward', () => {
	for (const entry of manifest.gates) {
		const { state, skeleton } = pose(entry),
			seen = [];
		state.addListener({ event: (_, event) => seen.push(event.data.name) });
		state.update(2.2);
		state.apply(skeleton);
		state.update(0.1);
		state.apply(skeleton);
		assert.deepEqual(seen, [
			'gateImpact',
			'gateOpened',
			'rewardShown',
			'rewardRemoved',
			'gateFinished',
		]);
		const cancelled = pose(entry),
			afterCancel = [];
		cancelled.state.addListener({ event: (_, event) => afterCancel.push(event.data.name) });
		cancelled.state.clearTracks();
		cancelled.skeleton.setToSetupPose();
		cancelled.state.update(2.2);
		cancelled.state.apply(cancelled.skeleton);
		assert.deepEqual(afterCancel, []);
	}
});
test('cartoon sparks start at center seam only on impact, shoot both sides, clear before gate opens', () => {
	const seed = 'event:round-1:gate-3',
		sparks = gateImpactSparks(seed);
	assert.equal(sparks.length, GATE_SPARK_COUNT);
	assert.deepEqual(sparks, gateImpactSparks(seed));
	assert.notDeepEqual(sparks, gateImpactSparks('another-event'));
	assert.ok(
		sparks.every(
			(s) => Math.abs(s.x) <= 2.5 && Math.abs(s.y) < 130 && s.width >= 28 && s.width < 45,
		),
	);
	assert.equal(sparks.filter((s) => s.dx < 0).length, 6);
	assert.equal(sparks.filter((s) => s.dx > 0).length, 6);
	assert.ok(Math.max(...sparks.map((s) => s.y)) - Math.min(...sparks.map((s) => s.y)) > 220);
	assert.ok(sparks.every((s) => GATE_CYCLE.impact + s.delay + s.life < GATE_CYCLE.openStart));
	for (const entry of manifest.gates) {
		const setup = pose(entry, 0, 'setup').skeleton,
			before = pose(entry, 0.359).skeleton,
			impact = pose(entry, 0.39).skeleton,
			end = pose(entry, GATE_CYCLE.openStart).skeleton;
		const slots = (s) => s.slots.filter((x) => x.data.name.startsWith('impact-'));
		assert.equal(slots(setup).length, GATE_SPARK_COUNT + 1);
		assert.ok(slots(setup).every((s) => s.color.a === 0));
		assert.ok(slots(before).every((s) => s.color.a === 0));
		assert.ok(slots(impact).every((s) => s.color.a === 1));
		assert.ok(slots(end).every((s) => s.color.a === 0));
		assert.ok(impact.findBone('impact-spark-0').x < 0);
		assert.ok(impact.findBone('impact-spark-1').x > 0);
		for (const animation of ['setup', 'idle'])
			assert.ok(slots(pose(entry, 0.4, animation).skeleton).every((s) => s.color.a === 0));
	}
	const source = new URL('../../sparks-20261012/', motion),
		provenance = JSON.parse(readFileSync(new URL('provenance.json', source), 'utf8'));
	assert.deepEqual(provenance.alphaRange, [0, 255]);
	assert.equal(
		createHash('sha256')
			.update(readFileSync(new URL(provenance.path, source)))
			.digest('hex'),
		manifest.gateSparks.sha256,
	);
});

test('evaluated reward makes two continuous outward turns, not shortest-path snapback', () => {
	for (const entry of manifest.gates) {
		let previous = 0,
			total = 0;
		for (let ms = 580; ms <= 1100; ms += 10) {
			const bone = pose(entry, ms / 1000).skeleton.findBone('reward');
			const angle = (Math.atan2(bone.c, bone.a) * 180) / Math.PI;
			if (ms > 580) {
				const delta = ((angle - previous + 540) % 360) - 180;
				assert.ok(delta >= -0.001 && delta < 30, 'smooth forward rotation on every sample');
				total += delta;
			}
			previous = angle;
		}
		assert.ok(Math.abs(total - 720) < 0.01, `${entry.tier}: ${total} degrees`);
	}
});

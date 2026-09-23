import test from 'node:test';
import assert from 'node:assert/strict';
import { ashFragments, ashProgress, SymbolAsh } from '../src/game/symbolAsh.ts';
import { cellMotion } from '../src/game/motion.ts';

test('ash fragments deterministic, bounded, staggered; distinct reveal/cell seeds', () => {
	const flakes = ashFragments('round:reveal:0:1');
	assert.deepEqual(flakes, ashFragments('round:reveal:0:1'));
	assert.notDeepEqual(flakes, ashFragments('round:reveal:1:1'));
	assert.equal(flakes.length, 100);
	assert.equal(new Set(flakes.map((f) => `${f.x}:${f.y}`)).size, 100);
	assert.ok(new Set(flakes.map((f) => f.start)).size > 90);
	assert.ok(flakes.every((f) => Math.abs(f.dx) <= 0.16 && f.dy >= 0.05 && f.dy <= 0.25));
});
test('ash ends inside removal barrier at every speed; live skip never restarts it', () => {
	for (const speed of ['normal', 'fast', 'turbo']) {
		const wave = { speed, kind: 'remove', cut: null, tail: 60 };
		const m = cellMotion(wave, 2, 3, 0);
		const timing = { ...m, startedAt: 1000, seed: 'test' };
		assert.equal(ashProgress(999, timing), 0);
		assert.equal(ashProgress(1000 + m.delay + m.duration + 0.001, timing), 1);
		const cut = cellMotion({ ...wave, cut: 40 }, 2, 3, 0);
		assert.ok(ashProgress(1060, { ...timing, ...cut }) >= ashProgress(1060, timing));
		assert.equal(ashProgress(1100, { ...timing, ...cut }), 1);
	}
});
test('finished ash clears surface without drawing fragments', () => {
	const context = { canvas: { width: 140, height: 140 }, clearRect: () => cleared++ };
	let cleared = 0;
	// No browser allocations required: completion must exit before accessing textures.
	SymbolAsh.prototype.draw.call({}, context, 1);
	assert.equal(cleared, 1);
});

test('ash uses independent Spine flake bones and charred/original texture layers', async () => {
	const { ashRig } = await import('../src/game/symbolAsh.ts');
	const { TextureAtlas, FakeTexture, AtlasAttachmentLoader, SkeletonJson } = await import(
		'@esotericsoftware/spine-core'
	);
	const { SpinePose } = await import('../src/game/spine.ts');
	const rig = ashRig('round:reveal:0:1', 153, 141);
	const atlas = new TextureAtlas(rig.atlas);
	for (const page of atlas.pages) page.setTexture(new FakeTexture({ width: 153, height: 141 }));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(rig.json);
	assert.equal(data.bones.length, 101);
	assert.equal(data.slots.length, 200);
	const pose = new SpinePose(data, 'ash');
	const track = pose.state.getCurrent(0);
	track.loop = false;
	pose.update(0);
	const before = pose.skeleton.bones.slice(1).map((b) => [b.worldX, b.worldY, b.scaleX]);
	track.trackTime = 0.6;
	pose.update(0);
	assert.notDeepEqual(
		pose.skeleton.bones.slice(1).map((b) => [b.worldX, b.worldY, b.scaleX]),
		before,
	);
	assert.ok(
		pose.skeleton.slots
			.filter((s) => s.data.name.startsWith('source-'))
			.every((s) => s.color.a < 1e-6),
	);
	assert.ok(pose.skeleton.slots.some((s) => s.data.name.startsWith('coal-') && s.color.a > 0));
	track.trackTime = 1;
	pose.update(0);
	assert.ok(pose.skeleton.slots.every((s) => s.color.a < 1e-6));
});

// Regression found by reward-wild browser QA: old WILD has no authored setup track;
// sampling it threw on arrival and stalled all GPU rendering. Setup is now a real skeleton rest pose.
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
test('native Wild can rest/freeze on arrival without requiring a fabricated setup animation', () => {
	const root = new URL('../static/assets/the-gates/rainbow-wild-20261016/', import.meta.url);
	const atlas = new TextureAtlas(readFileSync(new URL('symbols.atlas', root), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData({
		...JSON.parse(readFileSync(new URL('WILD.json', root), 'utf8')),
		animations: { idle: {}, paying: {} },
	});
	assert.equal(data.findAnimation('setup'), null);
	const pose = new SpinePose(data, 'idle');
	assert.doesNotThrow(() => pose.sample('setup', 0));
	assert.ok(
		pose.skeleton.bones.every((b) => Number.isFinite(b.worldX) && Number.isFinite(b.worldY)),
	);
	pose.setAnimation('paying');
	pose.update(0.1);
	assert.doesNotThrow(() => pose.sample('setup', 0));
	assert.equal(pose.state.getCurrent(0), null);
	assert.equal(data.width, 280);
	const board = readFileSync(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	assert.match(
		board,
		/tile.name === 'WILD'[\s\S]*?Math.max\(pose.actor.data.width, pose.actor.data.height\)/,
	);
});

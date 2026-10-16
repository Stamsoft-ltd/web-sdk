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
import { gateViewport, projectFullscreenGate } from '../src/game/gateViewport.ts';
import { GATE_CYCLE } from '../src/game/gateAnimation.ts';
const base = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
const sizes = [
	[1200, 784],
	[1920, 1080],
	[768, 1024],
	[390, 844],
	[320, 568],
	[844, 390],
	[2560, 720],
];
function actor(tier) {
	const name = `gate-${tier}`;
	const atlas = new TextureAtlas(readFileSync(new URL(`${name}.atlas`, base), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
		JSON.parse(readFileSync(new URL(`${name}.json`, base), 'utf8')),
	);
	return new SpinePose(data, 'idle');
}
function bounds(pose, name, scale, width, height) {
	const slot = pose.skeleton.findSlot(name),
		v = new Float32Array(8);
	slot.getAttachment().computeWorldVertices(slot, v, 0, 2);
	const x = [],
		y = [];
	for (let i = 0; i < 8; i += 2) {
		x.push(width / 2 + v[i] * scale);
		y.push(height / 2 - v[i + 1] * scale);
	}
	return {
		left: Math.min(...x),
		right: Math.max(...x),
		top: Math.min(...y),
		bottom: Math.max(...y),
	};
}
test('closed leaves cover the whole viewport and center seam for every tier and breakpoint', () => {
	for (const tier of ['normal', 'super', 'hidden'])
		for (const [w, h] of sizes) {
			const p = actor(tier);
			p.sample('cycle', 0.54);
			const scale = projectFullscreenGate(p.skeleton, w, h);
			const l = bounds(p, 'door-left', scale, w, h),
				r = bounds(p, 'door-right', scale, w, h);
			assert.ok(l.left <= 0 && l.right >= w / 2, `${tier} ${w}x${h} left coverage`);
			assert.ok(r.left <= w / 2 && r.right >= w, `${tier} ${w}x${h} right coverage`);
			assert.ok(
				l.top <= 0 && l.bottom >= h && r.top <= 0 && r.bottom >= h,
				'cover HUD and top edge too',
			);
			const left = p.skeleton.findBone('door-left'),
				right = p.skeleton.findBone('door-right');
			if (w >= h) {
				assert.equal(left.scaleX, left.scaleY, 'landscape keeps original leaf proportions');
				assert.equal(-right.scaleX, right.scaleY);
			} else {
				assert.ok(
					l.right - l.left <= w * 0.52,
					'portrait fits each leaf to one half, not height-zoom cropping',
				);
				assert.ok(r.right - r.left <= w * 0.52);
				assert.equal(-right.scaleX, left.scaleX, 'portrait panels remain symmetric');
				assert.equal(right.scaleY, left.scaleY);
			}
		}
});
test('offscreen leaves fully clear both edges; centered portal fits portrait and landscape', () => {
	for (const tier of ['normal', 'super', 'hidden'])
		for (const [w, h] of sizes) {
			const p = actor(tier);
			for (const t of [0, GATE_CYCLE.opened]) {
				p.sample('cycle', t);
				const scale = projectFullscreenGate(p.skeleton, w, h);
				assert.ok(bounds(p, 'door-left', scale, w, h).right < 0);
				assert.ok(bounds(p, 'door-right', scale, w, h).left > w);
			}
			p.sample('cycle', GATE_CYCLE.rewardStart);
			const scale = projectFullscreenGate(p.skeleton, w, h);
			const portal = bounds(p, 'portal-rim', scale, w, h);
			assert.ok(
				portal.left > 0 && portal.right < w && portal.top > 0 && portal.bottom < h,
				'portal remains inside screen',
			);
			const reward = p.skeleton.findBone('reward');
			assert.ok(Math.abs(reward.worldX) < 1e-6, 'float32 settled rotation stays centered');
			assert.ok(Math.abs(reward.worldY) < 1e-6, 'float32 settled translation stays centered');
		}
});
test('resizing re-samples pose without accumulating scale; DPR preserves screen geometry', () => {
	const p = actor('normal');
	p.sample('cycle', 0.54);
	projectFullscreenGate(p.skeleton, 390, 844);
	p.sample('cycle', 0.54);
	const a = projectFullscreenGate(p.skeleton, 1200, 784),
		l = bounds(p, 'door-left', a, 1200, 784);
	p.sample('cycle', 0.54);
	const b = projectFullscreenGate(p.skeleton, 2400, 1568),
		r = bounds(p, 'door-left', b, 2400, 1568);
	for (const key of ['left', 'right', 'top', 'bottom'])
		assert.ok(Math.abs(l[key] - r[key] / 2) < 0.001);
	for (const args of [
		[0, 1, 256, 398],
		[100, 100, 0, 398],
		[NaN, 100, 256, 398],
	])
		assert.throws(() => gateViewport(...args), /Invalid gate viewport/);
});
test('closed portrait gate recoil never exposes the game through the center seam', () => {
	for (const tier of ['normal', 'super', 'hidden']) {
		const p = actor(tier);
		for (const [w, h] of [
			[320, 568],
			[390, 844],
			[440, 956],
		]) {
			for (const time of [0.36, 0.395, 0.44, 0.48, 0.54, 0.58]) {
				p.sample('cycle', time);
				const scale = projectFullscreenGate(p.skeleton, w, h);
				const l = bounds(p, 'door-left', scale, w, h),
					r = bounds(p, 'door-right', scale, w, h);
				assert.ok(l.right >= r.left, `${tier} ${w}x${h} at ${time}: closed seam`);
			}
		}
	}
});
test('live overlay is full viewport above HUD, hidden at idle; old side anchor/breakpoints gone', () => {
	const s = readFileSync(new URL('../src/components/TempleGate.svelte', import.meta.url), 'utf8');
	assert.match(s, /position: fixed;[\s\S]*?inset: 0;[\s\S]*?z-index: 30;/);
	assert.match(s, /\.temple-gate\.open\s*\{\s*visibility: visible/);
	assert.match(s, /aria-hidden=\{!gateOpen\}/);
	assert.doesNotMatch(s, /80\.4%|29%|right: -10px|top: 125px/);
	assert.match(
		s,
		/if \(!engine \|\| !element \|\| !gateOpen\) return/,
		'closed gates register no GPU job',
	);
});

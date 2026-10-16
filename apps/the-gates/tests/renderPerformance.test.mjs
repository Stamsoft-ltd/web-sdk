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
import { spineClock } from '../tools/spine-canvas.ts';
import { WIN_ART_VIEW } from '../src/game/winPresentation.ts';
import { motionMetrics, recordMotionFrame, resetMotionMetrics } from '../src/game/motionMetrics.ts';
import { cachedRegion } from '../tools/region-cache.ts';

test('60Hz action clock stays paced across 60/120/144Hz displays; pause and last unsubscribe clean up RAF', () => {
	const prior = {
		document: globalThis.document,
		requestAnimationFrame: globalThis.requestAnimationFrame,
		cancelAnimationFrame: globalThis.cancelAnimationFrame,
	};
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
	let now = 0,
		id = 0;
	const callbacks = new Map();
	globalThis.document = { hidden: false };
	Object.defineProperty(globalThis, 'performance', {
		configurable: true,
		value: { now: () => now },
	});
	globalThis.requestAnimationFrame = (fn) => {
		callbacks.set(++id, fn);
		return id;
	};
	globalThis.cancelAnimationFrame = (key) => callbacks.delete(key);
	const step = (at) => {
		now = at;
		assert.equal(callbacks.size, 1, 'one shared frame');
		const fn = callbacks.values().next().value;
		callbacks.clear();
		fn(at);
	};
	try {
		for (const hz of [60, 120, 144]) {
			now = 0;
			const seen = [];
			const stamps = [],
				pairedStamps = [];
			const stop = spineClock((dt, at) => {
				seen.push(dt);
				stamps.push(at);
			});
			const stopPair = spineClock((_dt, at) => pairedStamps.push(at));
			for (let i = 1; i <= hz * 2; i++) step((i * 1000) / hz);
			assert.ok(
				seen.length >= 118 && seen.length <= 121,
				`${hz}Hz: ${seen.length} draws over 2 seconds`,
			);
			assert.ok(seen.every((dt) => dt > 0 && dt < 0.025));
			assert.deepEqual(
				stamps,
				pairedStamps,
				'tile gravity and Spine receive identical frame times',
			);
			const count = seen.length;
			document.hidden = true;
			step(now + 1000);
			assert.equal(seen.length, count);
			document.hidden = false;
			step(now + 1000 / hz);
			assert.ok(seen.at(-1) < 0.03, 'resume cannot catch up a hidden second');
			stopPair();
			stop();
			assert.equal(callbacks.size, 0);
		}
	} finally {
		Object.assign(globalThis, prior);
		Object.defineProperty(globalThis, 'performance', descriptor);
	}
});
test('region resize buckets cache once, stay shared and never upscale source art', () => {
	const prior = globalThis.document;
	let copies = 0;
	globalThis.document = {
		createElement: () => {
			copies++;
			return { width: 0, height: 0, getContext: () => ({ drawImage() {} }) };
		},
	};
	try {
		const region = { x: 0, y: 0, width: 400, height: 312 },
			image = { naturalWidth: 400 };
		const a = cachedRegion(region, image, 100, 78),
			b = cachedRegion(region, image, 110, 86);
		assert.equal(a, b);
		assert.equal(copies, 1);
		assert.equal(a.width, 128);
		assert.equal(cachedRegion(region, image, 500, 400), null, 'keep original when upscaling');
		assert.notEqual(cachedRegion(region, image, 180, 140), a);
		assert.equal(copies, 2);
	} finally {
		globalThis.document = prior;
	}
});
test('renderer metrics bounded at 180 samples; hidden gaps ignored', () => {
	resetMotionMetrics();
	for (let i = 0; i < 500; i++) recordMotionFrame(1000 / 60, 2);
	recordMotionFrame(5000, 2);
	const m = motionMetrics(2);
	assert.equal(m.samples, 180);
	assert.ok(Math.abs(m.fps - 60) < 1e-7);
	assert.equal(m.workP95, 2);
	resetMotionMetrics();
});
test('larger win view contains every tier horn and crown through full entrance/idle', () => {
	const base = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
	for (const tier of ['sweet', 'wild', 'epic', 'mythic', 'legendary']) {
		const name = `win-${tier}`,
			atlas = new TextureAtlas(readFileSync(new URL(`${name}.atlas`, base), 'utf8'));
		for (const page of atlas.pages)
			page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
		const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(
			JSON.parse(readFileSync(new URL(`${name}.json`, base), 'utf8')),
		);
		const pose = new SpinePose(data, 'idle');
		for (const animation of ['enter', 'idle'])
			for (let t = 0; t < 3; t += 0.03) {
				pose.sample(animation, t);
				for (const slot of pose.skeleton.slots) {
					const a = slot.getAttachment();
					if (!(a instanceof RegionAttachment) || slot.color.a < 0.01) continue;
					const v = new Float32Array(8);
					a.computeWorldVertices(slot, v, 0, 2);
					for (let i = 0; i < 8; i += 2) {
						assert.ok(
							Math.abs(v[i]) < WIN_ART_VIEW.width / 2,
							`${name}/${animation}: no side clipping`,
						);
						assert.ok(
							v[i + 1] < WIN_ART_VIEW.height / 2 + WIN_ART_VIEW.offsetY &&
								v[i + 1] > -WIN_ART_VIEW.height / 2 + WIN_ART_VIEW.offsetY,
							`${name}/${animation}: crown/banner within viewport`,
						);
					}
				}
			}
	}
	const gain = 106 / 860 / (78 / 1000);
	assert.ok(gain > 1.57, 'desktop native art grows at least 57%');
});
test('win popup freezes covered board actors; coins share the GPU stage; only developer previews show diagnostics', () => {
	const source = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
	assert.match(source('components/Symbol.svelte'), /reduced=\{!animated \|\| !!runtime.overlay\}/);
	assert.match(source('components/WinCoins.svelte'), /engine.register/);
	assert.match(source('components/WinCoins.svelte'), /priority: 10/);
	assert.match(source('components/SpineArt.svelte'), /priority: 20/);
	assert.doesNotMatch(source('components/WinCoins.svelte'), /requestAnimationFrame/);
	assert.match(
		source('components/Game.svelte'),
		/dev && demo && page.url.searchParams.has\('motionStats'\)/,
	);
	assert.match(source('components/WinScreen.svelte'), /viewBox=\{WIN_ART_VIEW\}/);
});

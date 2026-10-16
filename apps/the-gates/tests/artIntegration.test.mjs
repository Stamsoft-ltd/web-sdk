import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
} from '@esotericsoftware/spine-core';
import { ART_ROOT, MOTION_ROOT, SYMBOL_ART, artTier } from '../src/game/art.ts';
import { SpinePose, loadRig } from '../src/game/spine.ts';
import {
	gatePlaybackTime,
	GATE_REWARD_HOLD_MS,
	GATE_REWARD_ENTER_MS,
	GATE_REWARD_DURATION_MS,
} from '../src/game/gatePlayback.ts';
import { gateCycleTracks, GATE_CYCLE } from '../src/game/gateAnimation.ts';
import { portalRemovalTracks, PORTAL_SECONDS } from '../src/game/portalAnimation.ts';
import { ashProgress } from '../src/game/symbolAsh.ts';
import { cellMotion } from '../src/game/motion.ts';
const base = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(`${name}.json`, base), 'utf8'));
function actor(name, atlasName, animations = {}) {
	const atlas = new TextureAtlas(readFileSync(new URL(`${atlasName}.atlas`, base), 'utf8'));
	for (const page of atlas.pages)
		page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
	const json = read(name);
	json.animations = { ...json.animations, ...animations };
	return new SpinePose(
		new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(json),
		'idle',
	);
}
test('11 approved symbol mappings; old WILD is the only explicit fallback', () => {
	assert.equal(Object.keys(SYMBOL_ART).length, 11);
	assert.equal(SYMBOL_ART.WILD, undefined);
	for (const file of Object.values(SYMBOL_ART))
		assert.ok(readFileSync(new URL(`../symbols/${file}.png`, base)).length);
	assert.equal(artTier(null), 'normal');
	assert.equal(artTier('hidden'), 'hidden');
	assert.equal(artTier('super'), 'super');
});
test('normal, fast, turbo and skip scrub the same portal track to completion before removal barrier', () => {
	for (const speed of ['normal', 'fast', 'turbo'])
		for (const cut of [null, 30]) {
			const timing = cellMotion({ speed, kind: 'remove', cut, tail: 65 }, 0, 0, 0);
			const p = actor('PURPLE_GEM', 'symbols-hidden', {
				remove: portalRemovalTracks(`event-42:0:0`),
			});
			const live = { startedAt: 100, seed: 'event-42:0:0', ...timing };
			p.sample(
				'remove',
				ashProgress(100 + timing.delay + timing.duration * 0.5, live) * PORTAL_SECONDS,
			);
			assert.ok(p.skeleton.findSlot('portal-rim').color.a > 0.9);
			p.sample(
				'remove',
				ashProgress(100 + timing.delay + timing.duration + 1, live) * PORTAL_SECONDS,
			);
			assert.equal(p.skeleton.findSlot('body').color.a, 0);
			assert.ok(
				p.skeleton.findSlot('portal-rim').color.a < 1e-6,
				'Spine float32 end key is visually transparent',
			);
			p.sample('idle', 0);
			assert.equal(p.skeleton.findSlot('body').color.a, 1, 'no stale removal alpha');
		}
});
test('contact land uses one bottom-pivot squash; repeated sample stays exact and can restore idle', () => {
	const p = actor('SUN_MEDALLION', 'symbols-normal');
	p.sample('land', 0.024);
	assert.ok(Math.abs(p.skeleton.findBone('impact').scaleX - 1.28) < 1e-6);
	assert.ok(Math.abs(p.skeleton.findBone('impact').scaleY - 0.68) < 1e-6);
	p.sample('land', 0.024);
	assert.ok(Math.abs(p.skeleton.findBone('impact').scaleX - 1.28) < 1e-6);
	p.sample('idle', 0);
	assert.equal(p.skeleton.findBone('impact').scaleX, 1);
});
test('gateOpen waits closed without reward; authoritative reward opens doors and spins out', () => {
	assert.equal(gatePlaybackTime(999999, 100, null), GATE_CYCLE.openStart);
	assert.equal(gatePlaybackTime(300, 100, null), 0.2);
	assert.equal(
		gatePlaybackTime(2000 + GATE_REWARD_ENTER_MS + GATE_REWARD_HOLD_MS, 100, 2000),
		GATE_CYCLE.rewardHoldEnd,
		'extended hold matches playback',
	);
	assert.equal(
		gatePlaybackTime(100, -1, null),
		GATE_CYCLE.openStart,
		'replay waits for its authoritative reward',
	);
	for (const rewardAt of [2000, 3050]) {
		const p = actor('gate-hidden', 'gate-hidden', { cycle: gateCycleTracks('event-42') });
		p.sample('cycle', gatePlaybackTime(rewardAt, 100, rewardAt));
		assert.ok(
			p.skeleton.findSlot('reward').color.a < 1e-6,
			'float32 entrance boundary remains invisible',
		);
		assert.equal(p.skeleton.findSlot('door-left').color.a, 1);
		p.sample('cycle', gatePlaybackTime(rewardAt + GATE_REWARD_ENTER_MS, 100, rewardAt));
		assert.equal(p.skeleton.findSlot('door-left').color.a, 0);
		assert.equal(p.skeleton.findSlot('impact-flash').color.a, 0);
		assert.ok(p.skeleton.findSlot('reward').color.a > 0.99);
		p.sample('cycle', gatePlaybackTime(rewardAt + GATE_REWARD_DURATION_MS, 100, rewardAt));
		assert.equal(p.skeleton.findSlot('reward').color.a, 0);
		assert.ok(
			p.skeleton.findSlot('portal-rim').color.a < 1e-6,
			'Spine float32 end key is visually transparent',
		);
	}
});
test('all five native titles/crowns parse and anchor a blank banner for live amounts', () => {
	for (const tier of ['sweet', 'wild', 'epic', 'mythic', 'legendary']) {
		const p = actor(`win-${tier}`, `win-${tier}`);
		p.sample('enter', 0.45);
		assert.ok(p.skeleton.findBone('crown'));
		assert.ok(p.skeleton.findBone('banner'));
		assert.ok(p.skeleton.bones.every((b) => Number.isFinite(b.worldX)));
	}
});
test('live components use approved rigs; old atmosphere removed; CSS cannot double squash or override award anchor', () => {
	const source = (name) =>
		readFileSync(new URL(`../src/components/${name}.svelte`, import.meta.url), 'utf8');
	assert.match(source('Symbol'), /symbols-\$\{palette\}/);
	assert.match(source('SpineArt'), /actor\.sample\('remove'/);
	assert.match(source('Board'), /data-renderer=\{ready \? 'pixi-webgl'/);
	assert.doesNotMatch(source('Board'), /gate-fllanding/);
	assert.match(source('BonusScreen'), /<GpuBonusArt/);
	assert.doesNotMatch(source('BonusScreen'), /bonus-award|<CountUp|<FitNumber/);
	assert.match(source('GpuBonusArt'), /findBone\('award'\)/);
	assert.match(source('GpuBonusArt'), /award\.setFromMatrix/);
	assert.doesNotMatch(source('TempleGate'), /TempleAtmosphere|gate-doors\.png|scene-\$\{/);
	assert.doesNotMatch(source('Game'), /<GateDust/);
});
test('runtime loader separates art roots and shares native pages; seeded event rigs never reuse a prior event', async () => {
	const prior = { document: globalThis.document, Image: globalThis.Image, fetch: globalThis.fetch };
	const images = [];
	globalThis.document = { baseURI: 'http://asset.test/' };
	globalThis.Image = class {
		set src(value) {
			images.push(value);
		}
		async decode() {}
		width = 1;
		height = 1;
	};
	globalThis.fetch = async (value) => {
		const url = new URL(value, 'http://asset.test/');
		const data = readFileSync(new URL(`../static${url.pathname}`, import.meta.url), 'utf8');
		return { ok: true, status: 200, text: async () => data, json: async () => JSON.parse(data) };
	};
	try {
		const normal = await loadRig('RED_GEM', 'symbols-normal', MOTION_ROOT);
		const hidden = await loadRig('RED_GEM', 'symbols-hidden', MOTION_ROOT);
		assert.notEqual(normal, hidden);
		assert.equal(images.filter((x) => x.endsWith('/symbols/red-gem.png')).length, 1);
		const legacy = await loadRig('WILD', 'symbols');
		assert.ok(legacy.findAnimation('paying'));
		const a = await loadRig('gate-normal', 'gate-normal', MOTION_ROOT, {
			cycle: gateCycleTracks('a'),
		});
		const b = await loadRig('gate-normal', 'gate-normal', MOTION_ROOT, {
			cycle: gateCycleTracks('b'),
		});
		assert.notEqual(a, b);
		const original = await loadRig('gate-normal', 'gate-normal', MOTION_ROOT);
		assert.equal(a.bones, original.bones, 'immutable setup data shared');
		assert.notEqual(
			a.findAnimation('cycle'),
			original.findAnimation('cycle'),
			'seeded animation stays actor-local',
		);
		assert.notEqual(a.findAnimation('cycle'), b.findAnimation('cycle'));

		assert.ok(images.every((x) => x.startsWith('http://asset.test/assets/')));
	} finally {
		Object.assign(globalThis, prior);
	}
});

test('developer art fixtures preserve all win thresholds, cap and summary values; production branch never uses them', async () => {
	const { previewPresentationEvents } = await import('../src/game/preview.ts');
	for (const [key, amount] of Object.entries({
		inline: 1500,
		sweet: 2000,
		wild: 5000,
		epic: 10000,
		mythic: 20000,
		legendary: 50000,
		max: 2500000,
	})) {
		const events = previewPresentationEvents(key);
		assert.equal(events.at(-1).amount, amount);
		assert.equal(
			events.some((e) => e.type === 'maxWin'),
			key === 'max',
		);
	}
	assert.equal(previewPresentationEvents('unknown'), null);
	assert.equal(previewPresentationEvents(null), null);
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	const dev = game.indexOf('if (dev && demo)');
	const fixture = game.indexOf('previewPresentationEvents', dev);
	const paid = game.indexOf("gameActor.send({ type: 'BET' })", fixture);
	assert.ok(dev >= 0 && fixture > dev && paid > fixture);
	for (const tier of ['normal', 'super', 'hidden'])
		assert.equal(previewPresentationEvents(`summary-${tier}`)[1].tier, tier);
});

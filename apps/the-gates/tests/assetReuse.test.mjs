import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAssetImage, assetLoadActivity } from '../src/game/imageAssets.ts';
import { loadRig, SpinePose } from '../src/game/spine.ts';
import { portalRemovalTracks } from '../src/game/portalAnimation.ts';
import { emptyAssetAudit, recordAssetResource } from '../src/game/assetAudit.ts';

test('100 concurrent and sequential preload/FX requests share one canonical decoded image', async () => {
	const prior = { document: globalThis.document, Image: globalThis.Image };
	let starts = 0,
		decodes = 0;
	globalThis.document = { baseURI: 'https://image-cache.test/game/' };
	globalThis.Image = class {
		set src(value) {
			starts++;
			this.url = value;
		}
		async decode() {
			decodes++;
		}
	};
	try {
		const group = await Promise.all(
			Array.from({ length: 100 }, (_, i) =>
				loadAssetImage(
					i % 2 ? './assets/coin.png' : 'https://image-cache.test/game/assets/coin.png',
				),
			),
		);
		for (const image of group) assert.equal(image, group[0]);
		for (let i = 0; i < 100; i++) assert.equal(await loadAssetImage('./assets/coin.png'), group[0]);
		assert.equal(starts, 1);
		assert.equal(decodes, 1);
	} finally {
		Object.assign(globalThis, prior);
	}
});

test('failed image decode cannot become an interaction-driven retry storm', async () => {
	const prior = { document: globalThis.document, Image: globalThis.Image };
	let starts = 0;
	globalThis.document = { baseURI: 'https://image-cache-failure.test/' };
	globalThis.Image = class {
		set src(value) {
			starts++;
		}
		async decode() {
			throw new Error('Blocked image');
		}
	};
	try {
		const before = assetLoadActivity();
		for (let i = 0; i < 100; i++) await assert.rejects(loadAssetImage('./blocked.png'), /Blocked/);
		assert.equal(starts, 1);
		assert.equal(assetLoadActivity().imageStarts - before.imageStarts, 1);
		assert.equal(assetLoadActivity().imageFailures - before.imageFailures, 1);
	} finally {
		Object.assign(globalThis, prior);
	}
});

test('100 rig state/seed updates issue no additional asset fetches or image decodes after warm-up', async () => {
	const prior = { document: globalThis.document, Image: globalThis.Image, fetch: globalThis.fetch };
	const requests = [],
		images = [];
	globalThis.document = { baseURI: 'https://rig-reuse.test/' };
	globalThis.Image = class {
		set src(value) {
			images.push(value);
		}
		async decode() {}
		width = 1;
		height = 1;
	};
	globalThis.fetch = async (value) => {
		const url = new URL(value, document.baseURI);
		requests.push(url.href);
		const content = readFileSync(new URL(`../static${url.pathname}`, import.meta.url), 'utf8');
		return {
			ok: true,
			status: 200,
			text: async () => content,
			json: async () => JSON.parse(content),
		};
	};
	try {
		const root = 'https://rig-reuse.test/assets/the-gates/figma-20261012/motion/';
		const original = await loadRig('RED_GEM', 'symbols-normal', root);
		const warm = { requests: requests.length, images: images.length };
		const actor = new SpinePose(original, 'idle');
		for (let i = 0; i < 100; i++) {
			assert.equal(await loadRig('RED_GEM', 'symbols-normal', root), original);
			const seeded = await loadRig('RED_GEM', 'symbols-normal', root, {
				remove: portalRemovalTracks(`event-${i}`),
			});
			actor.overrideAnimation(seeded.findAnimation('remove'));
			actor.sample('remove', 0.2);
			actor.sample('setup', 0);
			actor.setAnimation('idle');
		}
		assert.equal(requests.length, warm.requests);
		assert.equal(images.length, warm.images);
		assert.equal(new Set(images).size, images.length);
	} finally {
		Object.assign(globalThis, prior);
	}
});

test('failed rig fetch is retained instead of refetched on every new actor attempt', async () => {
	const prior = { document: globalThis.document, fetch: globalThis.fetch };
	let fetches = 0;
	globalThis.document = { baseURI: 'https://rig-failure.test/' };
	globalThis.fetch = async () => {
		fetches++;
		throw new Error('Unavailable');
	};
	try {
		for (let i = 0; i < 100; i++)
			await assert.rejects(
				loadRig('RED_GEM', 'symbols-normal', 'https://rig-failure.test/motion/'),
				/Unavailable/,
			);
		assert.equal(fetches, 2, 'one atlas and one rig request; zero per-interaction retries');
	} finally {
		Object.assign(globalThis, prior);
	}
});

test('asset audit separates transfers, cache hits and unknown timing without collecting URLs or RGS calls', () => {
	const totals = emptyAssetAudit();
	const entry = (path, transferSize, decodedBodySize) => ({
		name: `https://audit.test/${path}`,
		transferSize,
		decodedBodySize,
	});
	recordAssetResource(totals, entry('assets/the-gates/a.png', 1000, 800));
	recordAssetResource(totals, entry('assets/the-gates/a.png', 0, 800));
	recordAssetResource(totals, entry('fonts/cartoon.ttf', 0, 0));
	recordAssetResource(totals, entry('wallet/play?sessionID=private', 3000, 2000));
	assert.equal(totals.resources, 3);
	assert.equal(totals.transferredBytes, 1000);
	assert.equal(totals.cachedResources, 1);
	assert.equal(totals.unknownResources, 1);
	assert.doesNotMatch(JSON.stringify(totals), /audit\.test|private|sessionID/);
});

test('preload, Spine and coin FX use one image loader; audit is dev-only and observers are disposed', () => {
	const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
	for (const path of ['components/Game.svelte', 'components/WinCoins.svelte', 'game/spine.ts']) {
		assert.match(source(path), /loadAssetImage/);
		assert.doesNotMatch(source(path), /new Image\(/);
	}
	assert.doesNotMatch(source('game/spine.ts'), /Cache\.delete/);
	assert.match(
		source('components/Game.svelte'),
		/dev && page.url.searchParams.get\('assetAudit'\) === '1'/,
	);
	const audit = source('components/AssetAudit.svelte');
	assert.match(audit, /resources.disconnect\(\)/);
	assert.match(audit, /mutations.disconnect\(\)/);
	assert.match(audit, /removeEventListener\('click'/);
	assert.doesNotMatch(audit, /setInterval|fetch\(|console\./);
});

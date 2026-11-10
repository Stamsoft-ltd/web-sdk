import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	TextureAtlas,
	FakeTexture,
	AtlasAttachmentLoader,
	SkeletonJson,
} from '@esotericsoftware/spine-core';
import {
	premiumSymbolFrame,
	wildSymbolFrame,
	wildCrystalWeight,
	wildCrystalMask,
	envelopeLidPose,
	ENVELOPE_HINGE_Y,
} from '../src/game/premiumSymbolMotion.ts';
import { SpinePose } from '../src/game/spine.ts';
import { payingSymbolGlow, SYMBOL_GLOW } from '../src/game/symbolGlow.ts';
const root = new URL('../static/assets/the-gates/', import.meta.url),
	read = (p) => readFileSync(new URL(p, root));
const code = (p) => readFileSync(new URL('../src/game/' + p, import.meta.url), 'utf8');
test('Pharaoh and Envelope gestures return to their exact supplied rest and respect reduced motion', () => {
	for (const age of [0, 900, 5000])
		assert.deepEqual(premiumSymbolFrame(age), { blink: 0, brow: 0, flap: 0, seal: 0, parts: 0 });
	for (let age = 0; age <= 1800; age += 3) {
		for (const value of Object.values(premiumSymbolFrame(age))) assert.ok(value >= 0 && value <= 1);
		assert.deepEqual(premiumSymbolFrame(age, true), premiumSymbolFrame(0));
	}
	assert.ok(premiumSymbolFrame(180).blink > 0.9);
	assert.ok(premiumSymbolFrame(430).brow > 0.9);
	assert.ok(premiumSymbolFrame(430).flap > 0.9);
	assert.ok(premiumSymbolFrame(160).seal > premiumSymbolFrame(160).flap);
});
test('Wild keeps neutral gold/jewel; bounded cluster light and six glints cannot shake or recolor center', () => {
	for (let age = 0; age <= 3600; age += 7) {
		const f = wildSymbolFrame(age);
		for (const v of [f.light, f.halo, ...f.glints]) assert.ok(v >= 0 && v <= 1);
		assert.equal('rotation' in f, false);
		assert.deepEqual(wildSymbolFrame(age, true), wildSymbolFrame(0));
	}
	assert.equal(wildSymbolFrame(1800).light, 0);
	assert.equal(wildCrystalWeight(0.5, 0.5, 255, 255, 255, 255), 0);
	assert.equal(wildCrystalWeight(0.5, 0.24, 255, 190, 0, 255), 0);
	assert.ok(wildCrystalWeight(0.5, 0.24, 180, 220, 255, 255) > 0.5);
	const wins = [{ symbol: 'RUNE_CHALICE', positions: [{ reel: 2, row: 3 }] }];
	assert.equal(payingSymbolGlow('WILD', '2:3', wins), SYMBOL_GLOW.RUNE_CHALICE);
	assert.match(
		code('gpuBoard.ts'),
		/tile.cluster.update\([\s\S]*?payingSymbolGlow\(tile.name!, key, state.wins\)/,
	);
});
test('all new source PNGs are unchanged supplied files; ZIP layers retain their native pixels', () => {
	const provenance = JSON.parse(read('symbol-parts/provenance.json'));
	assert.equal(provenance.assets.length, 20);
	for (const asset of provenance.assets) {
		const bytes = read('symbol-parts/' + asset.file);
		assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
	}
	const raw = read('art/symbols/key.png');
	assert.equal(raw.readUInt32BE(16), 930);
	assert.equal(raw.readUInt32BE(20), 926);
	assert.match(read('wild/symbols.atlas').toString(), /^flower.png\n/);
});
test('new Key and Wild atlas crops produce complete finite rest, land/pay and removal poses', () => {
	for (const [name, folder, atlasName] of [
		['KEY', 'art/animations/', 'symbols-normal'],
		['WILD', 'wild/', 'symbols'],
	]) {
		const atlas = new TextureAtlas(read(folder + atlasName + '.atlas').toString());
		for (const page of atlas.pages)
			page.setTexture(new FakeTexture({ width: page.width, height: page.height }));
		const rig = JSON.parse(read(folder + name + '.json')),
			data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(rig),
			pose = new SpinePose(data, 'idle');
		for (const animation of ['setup', 'paying', ...(name === 'KEY' ? ['land', 'remove'] : [])])
			for (const time of [0, 0.1, 0.38, 0.82]) {
				pose.sample(animation, time);
				assert.ok(
					pose.skeleton.bones.every((b) => Number.isFinite(b.worldX) && Number.isFinite(b.worldY)),
				);
			}
		const region = atlas.findRegion(name === 'KEY' ? 'KEY-art' : 'rainbow-wild');
		assert.equal(region.width, name === 'KEY' ? 500 : 278);
		assert.equal(region.height, name === 'KEY' ? 431 : 292);
	}
});
test('real-part assembly has fixed shared pivots; no reconstructed skin, extra ticker or per-frame image extraction', () => {
	const parts = code('premiumSymbolParts.ts'),
		live = code('gpuClusterSymbols.ts');
	assert.match(parts, /source.envelopeClosed, 114, 85, 86, 79/);
	assert.match(parts, /source.envelopeSealLower/);
	assert.match(parts, /source.pharaohEyeLeft, 112, 154, 68, 40/);
	assert.match(live, /envelopeFlap.y = ENVELOPE_HINGE_Y - 150/);
	assert.doesNotMatch(live, /envelopeClosed.alpha|envelopeGroup.alpha = p.parts/);
	assert.match(live, /eye.pivot.y = \(\(154 - 143\) \* 270\) \/ 304/);
	assert.doesNotMatch(live, /requestAnimationFrame|setInterval|\.source\.update\(/);
	assert.doesNotMatch(
		live.slice(live.indexOf('update(pose:')),
		/getImageData|createElement|new Texture/,
	);
});
test('menu rest SVG embeds exactly the supplied parts; browser preview is regenerated from current live code', () => {
	const svg = read('symbol-parts/pharaoh/rest.svg').toString();
	const embedded = [...svg.matchAll(/data:image\/png;base64,([^\"]+)/g)].map((m) =>
		createHash('sha256').update(Buffer.from(m[1], 'base64')).digest('hex'),
	);
	for (const p of ['body', 'eye-left', 'eye-right', 'brow-left', 'brow-right', 'gem'])
		assert.ok(
			embedded.includes(
				createHash('sha256')
					.update(read('symbol-parts/pharaoh/' + p + '.png'))
					.digest('hex'),
			),
		);
	assert.match(read('symbol-parts/key/rest.svg').toString(), /viewBox="215 252 500 431"/);
	execFileSync(process.execPath, [
		new URL('../tools/symbol-motion-preview/build-premium-preview.mjs', import.meta.url).pathname,
		'--check',
	]);
});

test('Wild covers full outer pale facets, not only the six small petal centers', () => {
	for (const [x, y] of [
		[0.22, 0.33],
		[0.79, 0.34],
		[0.2, 0.66],
		[0.78, 0.69],
		[0.5, 0.12],
		[0.5, 0.88],
	])
		assert.ok(wildCrystalWeight(x, y, 200, 225, 250, 255) > 0.95, `${x},${y}`);
	assert.equal(wildCrystalWeight(0.2, 0.33, 255, 200, 30, 255), 0);
});
test('Pharaoh uses both distinct supplied eyes and mirrors the ZIP-identical right brow', () => {
	assert.notDeepEqual(
		read('symbol-parts/pharaoh/eye-left.png'),
		read('symbol-parts/pharaoh/eye-right.png'),
	);
	assert.deepEqual(
		read('symbol-parts/pharaoh/brow-left.png'),
		read('symbol-parts/pharaoh/brow-right.png'),
	);
	const parts = code('premiumSymbolParts.ts');
	assert.match(parts, /pharaohEyeLeft: pharaohPart\(source.pharaohEyeLeft/);
	assert.match(parts, /pharaohEyeRight: pharaohPart\(source.pharaohEyeRight/);
	assert.match(
		parts,
		/pharaohBrowRight: pharaohPart\(source.pharaohBrowRight, 192, 126, 49, 15, true\)/,
	);
	assert.match(
		read('symbol-parts/pharaoh/rest.svg').toString(),
		/translate\(384 0\) scale\(-1 1\)/,
	);
});
test('Envelope hinge overlaps body and split seal follows lid continuously, without paper swaps', () => {
	assert.ok(ENVELOPE_HINGE_Y > 72);
	const closed = envelopeLidPose(0, 0),
		open = envelopeLidPose(1, 1);
	assert.equal(closed.upperY, 178);
	assert.equal(closed.lowerY, 178);
	assert.equal(open.lowerY, 182);
	assert.equal(open.upperY, -22);
	assert.equal(closed.inFront, true);
	assert.equal(open.inFront, false);
	assert.ok(Math.abs(envelopeLidPose(0.5, 1).flapScale) < 1e-10);
	for (let step = 1; step <= 1000; step++) {
		const a = envelopeLidPose((step - 1) / 1000, 1),
			b = envelopeLidPose(step / 1000, 1);
		assert.ok(Math.abs(a.upperY - b.upperY) < 0.315);
	}
	const parts = code('premiumSymbolParts.ts'),
		live = code('gpuClusterSymbols.ts');
	assert.match(parts, /upper.globalCompositeOperation = 'destination-out'/);
	assert.match(live, /envelopeGroup.setChildIndex\(envelopeLid, index\)/);
	assert.match(live, /envelopeSealLower.y = lid.lowerY - 150/);
	assert.match(live, /envelopeSealUpper.y = lid.upperY - 150/);
});

test('Wild one-time mask keeps six full connected petals, not tiny white marks on gold', () => {
	const pixels = new Uint8ClampedArray(100 * 100 * 4),
		put = (x, y) => pixels.set([180, 220, 255, 255], (y * 100 + x) * 4);
	const centers = [
		[50, 22],
		[74, 36],
		[74, 64],
		[50, 78],
		[26, 64],
		[26, 36],
	];
	for (const [x, y] of centers)
		for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) put(x + dx, y + dy);
	put(50, 5);
	put(50, 50);
	const mask = wildCrystalMask(pixels, 100, 100, 0, 100);
	for (const [x, y] of centers) {
		assert.equal(mask[y * 100 + x], 255);
		assert.equal(mask[(y + 4) * 100 + x + 4], 255);
	}
	assert.equal(mask[5 * 100 + 50], 0);
	assert.equal(mask[50 * 100 + 50], 0);
	assert.equal(mask.filter((v) => v > 0).length, 486);
});

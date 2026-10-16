import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { crc32, readPng, optimizePng, samePixelPng } from '../tools/png-encoding.mjs';
import { inspectSourceAssets } from '../tools/clean-assets.mjs';
import { runtimeAssets } from '../tools/package-assets.mjs';
function chunk(type, data) {
	const b = Buffer.alloc(data.length + 12);
	b.writeUInt32BE(data.length);
	b.write(type, 4);
	data.copy(b, 8);
	b.writeUInt32BE(crc32(b.subarray(4, -4)), b.length - 4);
	return b;
}
function png(pixel = 220, note = 'native', split = false) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(16, 0);
	header.writeUInt32BE(16, 4);
	header[8] = 8;
	header[9] = 6;
	const raw = Buffer.alloc((16 * 4 + 1) * 16, pixel);
	for (let y = 0; y < 16; y++) raw[y * 65] = 0;
	const zipped = deflateSync(raw, { level: 0 });
	const idats = split
		? [chunk('IDAT', zipped.subarray(0, 20)), chunk('IDAT', zipped.subarray(20))]
		: [chunk('IDAT', zipped)];
	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk('IHDR', header),
		chunk('tEXt', Buffer.from(note)),
		...idats,
		chunk('IEND', Buffer.alloc(0)),
	]);
}
test('PNG lossless recompression reduces IDAT bytes, preserves exact scanlines and metadata', () => {
	for (const split of [false, true]) {
		const original = png(220, 'native', split),
			result = optimizePng(original);
		assert.ok(result.saved > 800);
		assert.ok(samePixelPng(original, result.bytes));
		assert.equal(result.scanlineSha256.length, 64);
		assert.deepEqual(
			readPng(result.bytes)
				.filter((c) => c.type !== 'IDAT')
				.map((c) => c.bytes),
			readPng(original)
				.filter((c) => c.type !== 'IDAT')
				.map((c) => c.bytes),
		);
	}
});
test('PNG optimizer is idempotent and refuses changed pixels/metadata or invalid CRC', () => {
	const original = png(),
		first = optimizePng(original),
		second = optimizePng(first.bytes);
	assert.equal(second.saved, 0);
	assert.ok(first.bytes.equals(second.bytes));
	assert.equal(samePixelPng(original, png(219)), false);
	assert.equal(samePixelPng(original, png(220, 'edited')), false);
	const corrupt = Buffer.from(original);
	corrupt[20] ^= 1;
	assert.throws(() => optimizePng(corrupt), /CRC/);
	assert.equal(samePixelPng(original, corrupt), false);
	assert.throws(() => readPng(original.subarray(0, 20)), /Truncated/);
});
test('transparent Wild, native backdrops and legal frames retain source encoding semantics', () => {
	for (const file of [
		'rainbow-wild-20261016/rainbow-wild.png',
		'figma-20261012/backgrounds/normal-original.png',
		'figma-20261013/d883a.png',
	]) {
		const original = readFileSync(new URL('../static/assets/the-gates/' + file, import.meta.url));
		const result = optimizePng(original);
		assert.ok(samePixelPng(original, result.bytes));
		assert.ok(result.bytes.length <= original.length);
	}
});
test('source cleanup has no unused public assets left; runtime and authoring dependencies resolve', async () => {
	const { report } = await inspectSourceAssets();
	assert.deepEqual(report.removed, []);
	const { keep } = await runtimeAssets();
	assert.ok(keep.has('assets/the-gates/rainbow-wild-20261016/WILD.json'));
	assert.ok(keep.has('assets/the-gates/rainbow-wild-20261016/symbols.atlas'));
	assert.ok(keep.has('assets/the-gates/rainbow-wild-20261016/rainbow-wild.png'));
	assert.equal(keep.has('assets/the-gates/figma-20261012/backgrounds/base-terrace.png'), false);
	for (const file of keep)
		assert.ok(existsSync(new URL('../static/' + file, import.meta.url)), file);
	for (const file of [
		'scene-super.png',
		'gate-doors.png',
		'spine/flames.png',
		'wins/wild-plaque.png',
	])
		assert.equal(existsSync(new URL('../static/assets/the-gates/' + file, import.meta.url)), false);
});
test('runtime does not import retired Canvas2D renderer or broad shared UI barrels', () => {
	const read = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
	assert.doesNotMatch(
		read('game/spine.ts'),
		/cachedRegion|drawImage|CanvasRenderingContext2D|function spineClock/,
	);
	assert.doesNotMatch(read('game/symbolAsh.ts'), /SymbolAsh|ashRig|createElement/);
	assert.doesNotMatch(read('i18n/index.ts'), /from 'components-ui-html';/);
	assert.doesNotMatch(read('routes/+layout.svelte'), /from 'components-shared';/);
});

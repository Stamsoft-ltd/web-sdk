import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../static/assets/the-gates/figma-20261013/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('asset-manifest.json', root), 'utf8'));
test('Figma UI native files retain original hash, dimensions and non-empty bytes', () => {
	for (const a of manifest.assets) {
		const b = readFileSync(new URL(a.path, root));
		assert.equal(b.length, a.bytes, a.path);
		assert.ok(b.length > 30, a.path);
		assert.equal(createHash('sha256').update(b).digest('hex'), a.sha256, a.path);
		if (a.format === 'png') {
			assert.equal(b.toString('ascii', 12, 16), 'IHDR', a.path);
			assert.equal(b.readUInt32BE(16), a.width, a.path);
			assert.equal(b.readUInt32BE(20), a.height, a.path);
		} else {
			const svg = b.toString();
			assert.ok(svg.includes(`<svg`));
			assert.equal(Number(svg.match(/ width="([\d.]+)"/)[1]), a.width, a.path);
			assert.equal(Number(svg.match(/ height="([\d.]+)"/)[1]), a.height, a.path);
		}
	}
});
test('every fetched UI image has an inventory entry and the requested source file', () => {
	assert.equal(manifest.fileKey, 'XnhcL9KfnIfkShPq3yF1EK');
	const names = new Set(manifest.assets.map((a) => a.path));
	for (const name of readdirSync(root).filter((n) => /\.(png|svg)$/.test(n)))
		assert.ok(names.has(name), name);
	for (const name of [
		'28fc1.png',
		'edb79.png',
		'd7111.png',
		'19460.svg',
		'f05f2.svg',
		'd883a.png',
		'51301.png',
	])
		assert.ok(names.has(name), name);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../static/assets/the-gates/figma-20261013/backgrounds/', import.meta.url);
test('browser-exported cloud backgrounds retain native PNG dimensions and hashes', () => {
	const manifest = JSON.parse(readFileSync(new URL('asset-manifest.json', root), 'utf8'));
	assert.equal(manifest.imageHash, '7f49cc648330d9ba1b9e06b7a21f4026bc697bee');
	for (const asset of manifest.assets) {
		const data = readFileSync(new URL(asset.path, root));
		assert.equal(data.length, asset.bytes);
		assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256);
		assert.equal(data.toString('ascii', 12, 16), 'IHDR');
		assert.equal(data.readUInt32BE(16), asset.width);
		assert.equal(data.readUInt32BE(20), asset.height);
	}
});

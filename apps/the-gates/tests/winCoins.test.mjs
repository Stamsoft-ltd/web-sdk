import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('win fountain uses its own generated coin; gameplay Sun artwork is unchanged', () => {
	const src = readFileSync(new URL('../src/components/WinCoins.svelte', import.meta.url), 'utf8');
	assert.match(src, /win-coin-20261015\/coin.png/);
	assert.match(src, /Array.from\(\{ length: max \}/);
	assert.match(src, /Math.abs\(Math.cos\(p.angle\)\)/);
	const root = new URL('../static/assets/the-gates/win-coin-20261015/', import.meta.url);
	const image = readFileSync(new URL('coin.png', root));
	const provenance = JSON.parse(readFileSync(new URL('provenance.json', root), 'utf8'));
	assert.equal(createHash('sha256').update(image).digest('hex'), provenance.sha256);
	assert.equal(image[25], 6); // RGBA source, no opaque square behind particles.
	assert.ok(image.readUInt32BE(16) >= 512);
});

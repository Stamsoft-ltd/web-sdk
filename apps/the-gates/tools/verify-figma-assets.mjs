import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Read-only acquisition check. Does not certify rendered design fidelity.
const root = fileURLToPath(new URL('../static/assets/the-gates/figma-20261012/', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
const registered = new Set();
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let bytes = 0;
for (const asset of manifest.assets) {
	assert(!path.isAbsolute(asset.path) && !asset.path.split(/[\\/]/).includes('..'), 'Unsafe asset path');
	assert(!registered.has(asset.path), `Duplicate asset: ${asset.path}`);
	registered.add(asset.path);
	const data = await readFile(path.join(root, asset.path));
	assert(data.length >= 33 && data.subarray(0, 8).equals(signature), `Invalid PNG: ${asset.path}`);
	assert.equal(data.toString('ascii', 12, 16), 'IHDR', asset.path);
	assert.equal(data.readUInt32BE(16), asset.width, `${asset.path}: width`);
	assert.equal(data.readUInt32BE(20), asset.height, `${asset.path}: height`);
	assert.equal(data.length, asset.bytes, `${asset.path}: bytes`);
	assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256, `${asset.path}: SHA-256`);
	assert(['ready', 'reference-only', 'pending-node-mapping'].includes(asset.status), asset.path);
	assert(asset.nodeId || asset.nodeIdCandidates?.length || (asset.sourceArchive && asset.exportName),
		`${asset.path}: missing source provenance`);
	bytes += data.length;
}
async function inspect(directory, prefix = '') {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const relative = prefix + entry.name;
		if (entry.isDirectory()) await inspect(path.join(directory, entry.name), relative + '/');
		else if (entry.name.endsWith('.png')) assert(registered.has(relative), `Unregistered PNG: ${relative}`);
	}
}
await inspect(root);
assert.equal(manifest.runtimeRulesToPreserve.initialBonusSpins, 15);
assert.equal(manifest.runtimeRulesToPreserve.internalMysteryMode, 'MYSTERY');
assert.equal(manifest.runtimeRulesToPreserve.visibleMysteryLabel, 'HIDDEN');
assert.equal(manifest.runtimeRulesToPreserve.mathChanges, false);
const fontInfo = JSON.parse(await readFile(new URL('../reports/figma-20261012/font-provenance.json', import.meta.url), 'utf8'));
const font = await readFile(new URL('../static/fonts/figma-20261012/TitanOne-Regular.ttf', import.meta.url));
assert.equal(font.readUInt32BE(0), 0x00010000, 'Titan One: invalid TrueType header');
assert.equal(font.length, fontInfo.bytes, 'Titan One: bytes');
assert.equal(createHash('sha256').update(font).digest('hex'), fontInfo.sha256, 'Titan One: SHA-256');
const license = await readFile(new URL('../static/fonts/figma-20261012/OFL.txt', import.meta.url), 'utf8');
assert(license.includes('SIL OPEN FONT LICENSE'), 'Titan One: missing license');
console.log(JSON.stringify({
	files: registered.size,
	bytes,
	ready: manifest.assets.filter((asset) => asset.status === 'ready').length,
	referenceOnly: manifest.assets.filter((asset) => asset.status === 'reference-only').length,
	font: 'PASS: Titan One TrueType header, byte count, SHA-256, bundled OFL',
	checks: 'PASS: PNG headers, geometry, byte counts, SHA-256, provenance, inventory coverage',
	uiRedesign: 'Desktop Figma layout integrated; acquisition check does not certify rendered fidelity',
}, null, 2));

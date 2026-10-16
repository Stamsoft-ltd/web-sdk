import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('design body font is native Poppins Black, unchanged and licensed', () => {
	const meta = JSON.parse(
		readFileSync(new URL('../reports/figma-20261013/body-font-provenance.json', import.meta.url)),
	);
	const bytes = readFileSync(
		new URL('../static/fonts/figma-20261013/Poppins-Black.ttf', import.meta.url),
	);
	assert.equal(bytes.readUInt32BE(0), 0x00010000);
	assert.equal(bytes.length, meta.bytes);
	assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
	assert.ok(
		readFileSync(
			new URL('../static/fonts/figma-20261013/OFL.txt', import.meta.url),
			'utf8',
		).includes('SIL OPEN FONT LICENSE'),
	);
});

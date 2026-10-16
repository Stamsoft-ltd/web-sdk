/** Native base leaf replacement; no bitmap transforms. Bonus gates remain untouched. */
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../static/assets/the-gates/', import.meta.url);
const output = new URL('base-gate-20261016/', root);
const leaf = readFileSync(new URL('base-leaf.png', output));
const width = leaf.readUInt32BE(16),
	height = leaf.readUInt32BE(20);
const rig = JSON.parse(readFileSync(new URL('figma-20261012/motion/gate-normal.json', root)));
for (const name of ['door-left', 'door-right'])
	rig.skins[0].attachments[name][name].height = (256 * height) / width;
writeFileSync(new URL('gate-base.json', output), JSON.stringify(rig, null, 2) + '\n');
const original = readFileSync(new URL('figma-20261012/motion/gate-normal.atlas', root), 'utf8');
const atlas =
	`base-leaf.png\nsize: ${width},${height}\nfilter: Linear,Linear\npma: false\ngate-leaf\n  bounds: 0,0,${width},${height}` +
	original.slice(original.indexOf('\n\n'));
writeFileSync(
	new URL('gate-base.atlas', output),
	atlas
		.replaceAll('../../portals-20261012/', '../portals-20261012/')
		.replaceAll('../../sparks-20261012/', '../sparks-20261012/'),
);

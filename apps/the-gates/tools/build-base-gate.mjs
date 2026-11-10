/** Native base leaf replacement; no bitmap transforms. Bonus gates remain untouched. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../static/assets/the-gates/', import.meta.url);
const output = new URL('gates-base/', root);
const leaf = readFileSync(new URL('base-leaf.png', output));
const width = leaf.readUInt32BE(16),
	height = leaf.readUInt32BE(20);
const portal = JSON.parse(readFileSync(new URL('portal-provenance.json', output)));
const portalPng = readFileSync(new URL(portal.path, output));
if (createHash('sha256').update(portalPng).digest('hex') !== portal.sha256)
	throw new Error('Base portal hash mismatch');
const portalAtlas = (prefix) =>
	`${prefix}${portal.path}\nsize: ${portal.width},${portal.height}\nfilter: Linear,Linear\npma: false\nportal-rim\n  bounds: ${portal.regions['portal-rim'].join(',')}\nportal-vortex\n  bounds: ${portal.regions['portal-vortex'].join(',')}\n\n`;
const rig = JSON.parse(readFileSync(new URL('art/animations/gate-normal.json', root)));
for (const name of ['door-left', 'door-right'])
	rig.skins[0].attachments[name][name].height = (256 * height) / width;
for (const layer of ['portal-rim', 'portal-vortex']) {
	const attachment = rig.skins[0].attachments[layer][layer];
	const [, , width, height] = portal.regions[layer];
	attachment.height = (attachment.width * height) / width;
}
writeFileSync(new URL('gate-base.json', output), JSON.stringify(rig, null, 2) + '\n');
const original = readFileSync(new URL('art/animations/gate-normal.atlas', root), 'utf8');
const atlas =
	`base-leaf.png\nsize: ${width},${height}\nfilter: Linear,Linear\npma: false\ngate-leaf\n  bounds: 0,0,${width},${height}` +
	original.slice(original.indexOf('\n\n'));
writeFileSync(
	new URL('gate-base.atlas', output),
	atlas
		.replace(
			/\.\.\/\.\.\/portals\/normal-portal-layers-v1\.png[\s\S]*?(?=\.\.\/\.\.\/sparks\/)/,
			portalAtlas(''),
		)
		.replaceAll('../../sparks/', '../sparks/'),
);

const symbols = readFileSync(new URL('art/animations/symbols-normal.atlas', root), 'utf8');
writeFileSync(
	new URL('art/animations/symbols-base.atlas', root),
	symbols.replace(
		/\.\.\/\.\.\/portals\/normal-portal-layers-v1\.png[\s\S]*$/,
		portalAtlas('../../gates-base/'),
	),
);

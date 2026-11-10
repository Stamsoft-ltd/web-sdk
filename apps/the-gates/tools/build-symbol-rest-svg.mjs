/** Static menu/landing versions of the runtime's supplied-component symbols. PNG bytes untouched. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../static/assets/the-gates/', import.meta.url);
const image = async (file, x, y, w, h) =>
	`<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${(await readFile(new URL(file, root))).toString('base64')}"/>`;
let layers = await image('symbol-parts/pharaoh/body.png', 0, 0, 304, 286);
for (const [file, cx, cy, w, h] of [
	['eye-left', 112, 154, 68, 40],
	['eye-right', 192, 154, 68, 40],
	['brow-left', 112, 126, 49, 15],
	['brow-right', 192, 126, 49, 15],
	['gem', 152, 80, 68, 68],
])
	layers +=
		(file === 'brow-right' ? `<g transform="translate(${2 * cx} 0) scale(-1 1)">` : '') +
		(await image('symbol-parts/pharaoh/' + file + '.png', cx - w / 2, cy - h / 2, w, h)) +
		(file === 'brow-right' ? '</g>' : '');
await writeFile(
	new URL('symbol-parts/pharaoh/rest.svg', root),
	`<svg xmlns="http://www.w3.org/2000/svg" width="304" height="286" viewBox="0 0 304 286">${layers}</svg>\n`,
);
await mkdir(new URL('symbol-parts/key/', root), { recursive: true });
await writeFile(
	new URL('symbol-parts/key/rest.svg', root),
	`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="431" viewBox="215 252 500 431">${await image('art/symbols/key.png', 0, 0, 930, 926)}</svg>\n`,
);
console.log('Generated Pharaoh / Key static SVG compositions; original PNGs unchanged.');

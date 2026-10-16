import { MUSIC_FILES } from '../src/game/music.ts';
import { AUDIO_FILES } from '../src/game/audio.ts';
/** Runtime dependency closure. Prunes generated build only; originals remain untouched. */
import { readFile, readdir, stat, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ART_ROOT, UI_ART_ROOT, MOTION_ROOT, SYMBOL_ART } from '../src/game/art.ts';
import { samePixelPng } from './png-encoding.mjs';
import { WIN_TIERS } from '../src/game/winPresentation.ts';

const app = fileURLToPath(new URL('../', import.meta.url));
const roots = { ART_ROOT, UI_ART_ROOT, MOTION_ROOT };
const extensions = ['', '.svelte', '.ts', '.js', '.css', '/index.ts', '/index.js'];
const slash = (value) => value.split(path.sep).join('/');
export async function filesIn(directory) {
	const result = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const full = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in package: ${full}`);
		if (entry.isDirectory()) result.push(...(await filesIn(full)));
		else if (entry.isFile()) result.push(full);
	}
	return result;
}
export function staticAssetReferences(text) {
	const refs = new Set();
	for (const match of text.matchAll(
		/(?:\.\/|%sveltekit\.assets%\/)((?:assets\/the-gates\/|fonts\/)[^'"\s)`{}]+\.(?:png|webp|svg|ttf|woff2?|atlas|json))/g,
	))
		refs.add(match[1]);
	for (const match of text.matchAll(
		/\$\{(ART_ROOT|UI_ART_ROOT|MOTION_ROOT)\}([^'"`\s{}]+\.(?:png|webp|svg|atlas|json))/g,
	)) {
		// Fully literal suffixes only; dynamic symbols/tier families are seeded below.
		if (!match[2].includes('$')) refs.add(`${roots[match[1]]}${match[2]}`.replace(/^\.\//, ''));
	}
	return refs;
}
async function sourceGraph() {
	const visited = new Set();
	async function visit(file) {
		if (visited.has(file)) return;
		visited.add(file);
		const text = await readFile(file, 'utf8');
		for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+)['"]/g)) {
			for (const ext of extensions) {
				const candidate = path.resolve(path.dirname(file), match[1] + ext);
				if (!candidate.startsWith(path.join(app, 'src') + path.sep)) continue;
				if (
					await stat(candidate)
						.then((s) => s.isFile())
						.catch(() => false)
				) {
					await visit(candidate);
					break;
				}
			}
		}
	}
	await visit(path.join(app, 'src/routes/+layout.svelte'));
	await visit(path.join(app, 'src/app.html'));
	return visited;
}
export function atlasPageReferences(text) {
	const lines = text.split(/\r?\n/);
	return lines.filter((line, i) => line && !/^\s/.test(line) && /^size:/.test(lines[i + 1] ?? ''));
}
export async function runtimeAssets() {
	const keep = new Set();
	const add = (value) => {
		const relative = value.replace(/^\.\//, '');
		if (
			relative !== path.posix.normalize(relative) ||
			relative.startsWith('../') ||
			path.isAbsolute(relative)
		)
			throw new Error(`Unsafe runtime asset: ${value}`);
		keep.add(relative);
	};
	for (const file of [...Object.values(AUDIO_FILES), ...Object.values(MUSIC_FILES)])
		add(`assets/the-gates/audio/${file}.mp3`);
	add('assets/the-gates/audio/provenance.json');
	// Distribution notices are required package dependencies, never unused artwork.
	add('assets/the-gates/licenses/THIRD-PARTY.txt');
	for (const file of ['press_play_p.webp', 'press_play_wordmark.webp', 'provenance.json'])
		add(`assets/the-gates/loading/${file}`);
	for (const tier of ['base', 'normal', 'super', 'hidden'])
		add(`assets/the-gates/portrait-20261015/${tier}-background.png`);

	add('assets/the-gates/portrait-20261015/provenance.json');
	add('assets/the-gates/win-coin-20261015/provenance.json');
	const graph = await sourceGraph();
	for (const file of graph)
		for (const ref of staticAssetReferences(await readFile(file, 'utf8'))) add(ref);
	const rig = (root, name, atlas = name) => {
		add(`${root}${name}.json`);
		add(`${root}${atlas}.atlas`);
	};
	for (const tier of ['normal', 'super', 'hidden']) {
		rig('assets/the-gates/portrait-20261015/', `gate-${tier}`);
	}
	for (const [name, bitmap] of Object.entries(SYMBOL_ART)) {
		add(`${ART_ROOT}symbols/${bitmap}.png`);
		rig(MOTION_ROOT, name, 'symbols-normal');
	}
	for (const tier of ['normal', 'super', 'hidden']) {
		add(`${MOTION_ROOT}symbols-${tier}.atlas`);
		rig(MOTION_ROOT, `gate-${tier}`);
		rig(MOTION_ROOT, `bonus-${tier}`);
		add(`${ART_ROOT}backgrounds/${tier}-original.png`);
		add(`${ART_ROOT}bonus/${tier}-title.png`);
	}
	for (const { key } of WIN_TIERS) {
		rig(MOTION_ROOT, `win-${key}`);
		add(`${ART_ROOT}wins/${key}-title.png`);
		add(`${ART_ROOT}wins/${key}-banner.png`);
	}
	rig('./assets/the-gates/rainbow-wild-20261016/', 'WILD', 'symbols');
	add('assets/the-gates/rainbow-wild-20261016/provenance.json');
	// Every atlas page is a real loader dependency, including portal/spark layers.
	for (const file of [...keep].filter((file) => file.endsWith('.atlas'))) {
		for (const page of atlasPageReferences(
			await readFile(path.join(app, 'static', file), 'utf8'),
		)) {
			add(path.posix.normalize(path.posix.join(path.posix.dirname(file), page)));
		}
	}
	for (const file of await filesIn(path.join(app, 'static/fonts'))) {
		if (/OFL|LICENSE/i.test(path.basename(file)))
			add(slash(path.relative(path.join(app, 'static'), file)));
	}
	return { keep, sourceFiles: graph.size };
}
export async function inspectPackage(build = path.join(app, 'build')) {
	const { keep, sourceFiles } = await runtimeAssets();
	const all = await filesIn(build);
	const removals = [];
	let before = 0,
		removedBytes = 0;
	// Validate ALL dependencies and byte identity (or exact lossless PNG encoding) before changing any output file.
	for (const file of keep) {
		const source = await readFile(path.join(app, 'static', file));
		const built = await readFile(path.join(build, file));
		if (!source.equals(built) && !(file.endsWith('.png') && samePixelPng(source, built)))
			throw new Error(`Runtime asset changed or stale: ${file}`);
	}
	for (const file of all) {
		const relative = slash(path.relative(build, file));
		const bytes = (await stat(file)).size;
		before += bytes;
		if (
			(relative.startsWith('assets/the-gates/') || relative.startsWith('fonts/')) &&
			!keep.has(relative)
		) {
			removals.push(file);
			removedBytes += bytes;
		}
	}
	const digest = createHash('sha256');
	for (const file of [...keep].sort())
		digest.update(file).update(await readFile(path.join(build, file)));
	return {
		keep,
		removals,
		report: {
			beforeBytes: before,
			afterBytes: before - removedBytes,
			removedBytes,
			removedFiles: removals.length,
			runtimeAssets: keep.size,
			sourceFiles,
			runtimeAssetSha256: digest.digest('hex'),
			policy:
				'Generated assets only; all referenced files verified byte-identical or exact PNG scanline/metadata-equivalent before pruning. JS/CSS/HTML and source assets untouched.',
		},
	};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { removals, report } = await inspectPackage();
	if (process.argv.includes('--execute')) for (const file of removals) await unlink(file);
	console.log(JSON.stringify({ ...report, execute: process.argv.includes('--execute') }, null, 2));
}

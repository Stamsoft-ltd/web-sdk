/** Explicit source cleanup, never part of an ordinary build. Dry-run by default.
 * Runtime graph + native motion authoring sources + acquisition/license metadata.
 * Hash every proposed deletion first; update inventories only with --execute.
 */
import { readFile, writeFile, stat, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { filesIn, runtimeAssets } from './package-assets.mjs';
const app = fileURLToPath(new URL('../', import.meta.url));
export async function inspectSourceAssets() {
	const { keep: runtime } = await runtimeAssets();
	const keep = new Set(runtime);
	const base = 'assets/the-gates/';
	const motion = `${base}figma-20261012/motion/`;
	const manifest = JSON.parse(
		await readFile(path.join(app, 'static', motion, 'manifest.json'), 'utf8'),
	);
	for (const asset of manifest.sourceAssets) keep.add(`${base}figma-20261012/${asset.path}`);
	for (const file of await filesIn(path.join(app, 'static', motion))) {
		const rel = path.relative(path.join(app, 'static'), file).split(path.sep).join('/');
		if (!rel.includes('/symbol-removal.')) keep.add(rel); // retired shard export
	}
	const inventories = [
		`${base}figma-20261012/asset-manifest.json`,
		`${base}figma-20261013/asset-manifest.json`,
		`${base}figma-20261013/backgrounds/asset-manifest.json`,
	];
	for (const name of [
		...inventories,
		`${base}sparks-20261012/provenance.json`,
		...['normal', 'super', 'hidden'].map((t) => `${base}portals-20261012/${t}-provenance.json`),
		'favicon.svg',
	])
		keep.add(name);
	// Required runtime/authoring dependencies must exist before proposing any removal.
	for (const file of keep) {
		if (path.isAbsolute(file) || file.split('/').includes('..'))
			throw Error(`Unsafe asset ${file}`);
		if (!(await stat(path.join(app, 'static', file))).isFile())
			throw Error(`Missing dependency ${file}`);
	}
	const files = await filesIn(path.join(app, 'static'));
	const removed = [];
	let beforeBytes = 0;
	for (const file of files) {
		const rel = path.relative(path.join(app, 'static'), file).split(path.sep).join('/');
		const bytes = await readFile(file);
		beforeBytes += bytes.length;
		if (!keep.has(rel))
			removed.push({
				path: rel,
				bytes: bytes.length,
				sha256: createHash('sha256').update(bytes).digest('hex'),
			});
	}
	return {
		keep,
		inventories,
		report: {
			beforeFiles: files.length,
			beforeBytes,
			removed,
			removedBytes: removed.reduce((n, f) => n + f.bytes, 0),
			runtimeAssets: runtime.size,
		},
	};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { inventories, keep, report } = await inspectSourceAssets();
	const execute = process.argv.includes('--execute');
	if (execute && report.removed.length) {
		// Save deletion ledger before deletion, including exact hashes. User requested retirement.
		await writeFile(
			path.join(app, 'reports/asset-source-cleanup.json'),
			JSON.stringify({ ...report, execute }, null, 2) + '\n',
		);
		for (const file of report.removed) await unlink(path.join(app, 'static', file.path));
		for (const file of inventories) {
			const absolute = path.join(app, 'static', file);
			const data = JSON.parse(await readFile(absolute, 'utf8'));
			data.assets = data.assets.filter((a) =>
				keep.has(path.posix.join(path.posix.dirname(file), a.path)),
			);
			data.cleanupNote =
				'Unused exports removed 2026-10-14; retained original bytes/hashes unchanged. Deletion ledger: reports/asset-source-cleanup.json.';
			await writeFile(absolute, JSON.stringify(data, null, 2) + '\n');
		}
	}
	console.log(
		JSON.stringify({ ...report, removed: report.removed.map((x) => x.path), execute }, null, 2),
	);
}

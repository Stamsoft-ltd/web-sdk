/** Build-only, dependency-free lossless encoding. Static acquisition originals stay intact. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runtimeAssets } from './package-assets.mjs';
import { optimizePng, samePixelPng } from './png-encoding.mjs';
const app = fileURLToPath(new URL('../', import.meta.url));
export async function optimizeBuildAssets(build = path.join(app, 'build')) {
	const { keep } = await runtimeAssets();
	const files = [];
	let beforeBytes = 0,
		afterBytes = 0;
	for (const file of [...keep].filter((f) => f.endsWith('.png')).sort()) {
		const source = await readFile(path.join(app, 'static', file));
		const built = await readFile(path.join(build, file));
		if (!source.equals(built) && !samePixelPng(source, built))
			throw Error(`Build asset differs from original pixels: ${file}`);
		const optimized = optimizePng(source);
		beforeBytes += source.length;
		afterBytes += optimized.bytes.length;
		if (!built.equals(optimized.bytes)) await writeFile(path.join(build, file), optimized.bytes);
		files.push({
			path: file,
			sourceBytes: source.length,
			bytes: optimized.bytes.length,
			saved: optimized.saved,
			sourceSha256: createHash('sha256').update(source).digest('hex'),
			sha256: createHash('sha256').update(optimized.bytes).digest('hex'),
			scanlineSha256: optimized.scanlineSha256,
		});
	}
	const report = {
		policy:
			'Only PNG IDAT zlib recompression in build output; original scanlines and every non-IDAT chunk verified identical. Static originals untouched.',
		pngFiles: files.length,
		changedFiles: files.filter((f) => f.saved > 0).length,
		beforeBytes,
		afterBytes,
		savedBytes: beforeBytes - afterBytes,
		files,
	};
	await writeFile(path.join(build, 'asset-encoding.json'), JSON.stringify(report, null, 2) + '\n');
	return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { files, ...summary } = await optimizeBuildAssets();
	console.log(JSON.stringify(summary, null, 2));
}

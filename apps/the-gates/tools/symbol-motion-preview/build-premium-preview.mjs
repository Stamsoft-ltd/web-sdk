/** Reproducible browser-only copies of live pure motion / one-time part preparation. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url),
	root = new URL('../../../../', import.meta.url);
const installed = await readdir(new URL('node_modules/.pnpm/', root));
const version = installed.find((n) => /^typescript@5\.8\.3$/.test(n));
if (!version) throw Error('Use the existing workspace TypeScript 5.8.3 compiler; no installs.');
const ts = require(
	new URL(`node_modules/.pnpm/${version}/node_modules/typescript/lib/typescript.js`, root).pathname,
);
const modules = {
	'symbolClusterMotion.ts': 'live-cluster-motion.mjs',
	'premiumSymbolMotion.ts': 'live-premium-motion.mjs',
	'premiumSymbolParts.ts': 'live-premium-parts.mjs',
};
for (const [file, out] of Object.entries(modules)) {
	const source = await readFile(new URL('../../src/game/' + file, import.meta.url), 'utf8');
	let compiled = ts.transpileModule(source, {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
	}).outputText;
	for (const [from, to] of Object.entries(modules))
		for (const spec of [from, from.replace('.ts', '')])
			compiled = compiled.replaceAll("'./" + spec + "'", "'./" + to + "'");
	const text =
		`// Generated from src/game/${file}; source SHA256 ${createHash('sha256').update(source).digest('hex')}.\n// Regenerate: node tools/symbol-motion-preview/build-premium-preview.mjs\n` +
		compiled;
	const target = new URL('./' + out, import.meta.url);
	if (process.argv.includes('--check')) {
		if ((await readFile(target, 'utf8')) !== text) throw Error('Stale preview copy: ' + out);
	} else await writeFile(target, text);
	console.log(out + ': ' + (process.argv.includes('--check') ? 'current' : 'generated'));
}

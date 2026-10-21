// Bundle TS tests for Node. No browser automation, production API, or real wallet calls.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const viteRequire = createRequire(require.resolve('vite/package.json'));
const { build } = viteRequire('esbuild');
const { compile } = require('svelte/compiler');
const { readFileSync } = require('node:fs');
const dir = mkdtempSync(join(tmpdir(), 'split-party-tests-'));
try {
	await build({
		entryPoints: ['tests/contracts.test.ts'],
		outfile: join(dir, 'tests.mjs'),
		bundle: true,
		platform: 'node',
		format: 'esm',
		logLevel: 'warning',
		plugins: [
			{
				name: 'svelte-server-test',
				setup(build) {
					// The Vite-only preload manifest (vite.config.js) is an empty list under test.
					build.onResolve({ filter: /^virtual:preload-list$/ }, () => ({ path: 'preload-list', namespace: 'virtual' }));
					build.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({ contents: 'export default [];', loader: 'js' }));
					build.onLoad({ filter: /\.svelte$/ }, (args) => ({
						contents: compile(readFileSync(args.path, 'utf8'), {
							filename: args.path,
							generate: 'server',
						}).js.code,
						loader: 'js',
					}));
				},
			},
		],
	});
	const result = spawnSync(process.execPath, ['--test', join(dir, 'tests.mjs')], {
		stdio: 'inherit',
	});
	process.exitCode = result.status ?? 1;
} finally {
	rmSync(dir, { recursive: true, force: true });
}

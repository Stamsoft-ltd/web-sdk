import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';
import { fileURLToPath } from 'node:url';

const rootRequire = createRequire(new URL('../../package.json', import.meta.url));

export default defineConfig({
	plugins: [
		svelte({
			configFile: false,
			preprocess: vitePreprocess(),
			compilerOptions: { hmr: false },
		}),
	],
	esbuild: { tsconfigRaw: '{}' },
	optimizeDeps: { esbuildOptions: { tsconfigRaw: '{}' } },
	resolve: {
		alias: {
			'$app/state': fileURLToPath(new URL('./tests/mocks/app-state.ts', import.meta.url)),
			'$env/static/public': fileURLToPath(
				new URL('./tests/mocks/env-public.ts', import.meta.url),
			),
			'pixi.js': rootRequire.resolve('pixi.js'),
			'pixi-filters': rootRequire.resolve('pixi-filters'),
		},
		conditions: ['browser', 'svelte', 'import', 'default'],
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		setupFiles: ['./tests/setup.ts'],
		testTimeout: 10_000,
	},
});

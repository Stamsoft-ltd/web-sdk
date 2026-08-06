// Test-only vite config. Deliberately NOT the app's vite.config.js: SvelteKit's plugin wants a
// dev/build pipeline (routes, service worker, $app aliases) that these tests never touch, and the
// lingui plugin needs a running macro setup. All the tests need is: compile .svelte, resolve
// `pixi.js` the same way the app does, and a DOM.
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';

// Same reason as vite.config.js: pixi.js lives in the workspace root store (a dep of pixi-svelte),
// not in this app's node_modules.
const rootRequire = createRequire(new URL('../../package.json', import.meta.url));

export default defineConfig({
	plugins: [
		svelte({
			// configFile:false — svelte.config.js is the SvelteKit config; loading it here pulls in the
			// adapter and its `kit` block, which vite-plugin-svelte rejects outside a kit build.
			configFile: false,
			preprocess: vitePreprocess(),
			compilerOptions: { hmr: false },
		}),
	],
	// tsconfig.json extends ./.svelte-kit/tsconfig.json, which only exists after `svelte-kit sync`.
	// The tests don't need any of its options, so keep esbuild from resolving it at all.
	// (A raw STRING, not an object: vite only skips the on-disk tsconfig lookup for the string form.)
	esbuild: { tsconfigRaw: '{}' },
	// Same, for the dependency pre-bundler's own esbuild pass (otherwise it warns on every run).
	optimizeDeps: { esbuildOptions: { tsconfigRaw: '{}' } },
	resolve: {
		alias: {
			'pixi.js': rootRequire.resolve('pixi.js'),
			'pixi-filters': rootRequire.resolve('pixi-filters'),
		},
		// pixi-svelte's package exports point at ./dist; the tests import its SOURCE .svelte files by
		// relative path so a regression fix in src is what actually gets exercised.
		conditions: ['browser', 'svelte', 'import', 'default'],
	},
	test: {
		environment: 'jsdom',
		include: ['tests/**/*.test.ts'],
		// Deterministic by construction: no test waits on wall time. Anything that hangs is a bug.
		testTimeout: 10_000,
	},
});

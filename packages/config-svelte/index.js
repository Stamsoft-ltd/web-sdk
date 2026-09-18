import adapter from '@sveltejs/adapter-static';
import { vitePreprocess as ownVitePreprocess } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * vitePreprocess from the APP's copy of vite-plugin-svelte, not this package's.
 *
 * pnpm keeps one vite-plugin-svelte (and one vite) per peer set, and this package's pin of
 * sass-embedded gives it a different set from the apps. The copy imported here therefore brings
 * its own vite module instance, and every scss <style> it preprocesses spins up a sass-embedded
 * compiler in THAT instance's worker cache — which the build (running in the app's vite) never
 * closes, so `vite build` prints "✔ done" and never exits. Resolving the plugin from the app
 * directory (the cwd for both `vite build` and svelte-check) lands on the same module the build
 * itself runs, whose sass workers vite opens and closes with each build.
 */
const vitePreprocess = await (async () => {
	// The plugin's export map hides package.json from require.resolve, so walk to the app's own
	// node_modules link (pnpm makes one for every direct dependency) and realpath it.
	let dir = process.cwd();
	for (;;) {
		const link = path.join(dir, 'node_modules', '@sveltejs', 'vite-plugin-svelte');
		if (fs.existsSync(link)) {
			try {
				const real = fs.realpathSync(link);
				const mod = await import(pathToFileURL(path.join(real, 'src', 'index.js')).href);
				if (mod.vitePreprocess) return mod.vitePreprocess;
			} catch {
				// fall through to this package's copy
			}
			break;
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return ownVitePreprocess;
})();

const styleOptions = {
	configFile: false,
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
			},
		},
	},
};

/** @returns {import('@sveltejs/kit').Config} */
export default () => ({
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	// Style preprocessing gets an INLINE vite config (configFile: false): style compilation only
	// needs the scss compiler option, but loading the real vite config drags in app plugins
	// (lingui) and root-resolved aliases (pixi.js) whose side-effects fail flakily inside
	// svelte-check/editor tooling workers ("No Lingui config found" / "Cannot find module
	// 'pixi.js'" errors pointing at <style> blocks).
	preprocess: vitePreprocess({ style: styleOptions }),
	kit: {
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		output: {
			bundleStrategy: 'inline',
		},
	},
});

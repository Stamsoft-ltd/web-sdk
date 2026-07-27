import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @returns {import('@sveltejs/kit').Config} */
export default () => ({
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	// Style preprocessing gets an INLINE vite config (configFile: false): style compilation only
	// needs the scss compiler option, but loading the real vite config drags in app plugins
	// (lingui) and root-resolved aliases (pixi.js) whose side-effects fail flakily inside
	// svelte-check/editor tooling workers ("No Lingui config found" / "Cannot find module
	// 'pixi.js'" errors pointing at <style> blocks).
	preprocess: vitePreprocess({
		style: {
			configFile: false,
			css: {
				preprocessorOptions: {
					scss: {
						api: 'modern-compiler',
					},
				},
			},
		},
	}),
	kit: {
		// See https://kit.svelte.dev/docs/adapters for more information about adapters.
		adapter: adapter(),
		output: {
			bundleStrategy: 'inline',
		},
	},
});

// @ts-ignore
import config from 'config-svelte';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const shared = config();

// Standalone preprocessing has no Vite closeBundle lifecycle. A persistent
// sass-embedded compiler here kept `vite build` alive after writing the site.
// Compile each style with the modern API; no long-lived compiler or worker pool.
export default {
	...shared,
	preprocess: vitePreprocess({
		style: {
			configFile: false,
			css: {
				preprocessorMaxWorkers: 0,
				preprocessorOptions: { scss: { api: 'modern' } },
			},
		},
	}),
};

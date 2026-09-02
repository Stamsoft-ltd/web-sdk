// @ts-ignore
import config from 'config-vite';
import { createRequire } from 'module';

const base = config();

// pixi.js and pixi-filters are dependencies of pixi-svelte, not of this app or the workspace root
// — resolve them from pixi-svelte itself. Resolving from the root only worked while pnpm happened
// to hoist them there, and broke as soon as a clean install pruned them.
const rootRequire = createRequire(new URL('../../packages/pixi-svelte/package.json', import.meta.url));

export default {
	...base,
	resolve: {
		...(base.resolve ?? {}),
		alias: {
			...(base.resolve?.alias ?? {}),
			'pixi.js': rootRequire.resolve('pixi.js'),
			'pixi-filters': rootRequire.resolve('pixi-filters'),
		},
	},
	build: {
		...(base.build ?? {}),
		rollupOptions: {
			...(base.build?.rollupOptions ?? {}),
			treeshake: { preset: 'safest' },
		},
	},
};

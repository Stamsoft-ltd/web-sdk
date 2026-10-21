import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// `virtual:preload-list`: every image and font in public/ (not the math fixtures), listed at
// build time so the loading screen can fetch and decode the whole game before the splash.
const PRELOAD = /\.(webp|png|svg|woff2|ttf)$/;
function preloadList() {
	const id = 'virtual:preload-list';
	const root = new URL('./public', import.meta.url).pathname;
	const walk = (dir) =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			return statSync(path).isDirectory() ? walk(path) : [path];
		});
	return {
		name: 'preload-list',
		resolveId: (source) => (source === id ? '\0' + id : null),
		load(resolved) {
			if (resolved !== '\0' + id) return null;
			const files = walk(root)
				.map((path) => relative(root, path).split('\\').join('/'))
				.filter((path) => PRELOAD.test(path) && !path.startsWith('fixtures/'))
				.map((path) => ({ path, size: statSync(join(root, path)).size }));
			return `export default ${JSON.stringify(files)};`;
		},
	};
}

export default defineConfig({
	plugins: [svelte(), preloadList()],
	base: './',
	server: { host: '127.0.0.1', port: 3021 },
	build: { target: 'es2022' },
});

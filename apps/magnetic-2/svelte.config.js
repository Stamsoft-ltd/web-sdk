import config from 'config-svelte';

const base = config();

// Wrap the adapter to force-exit after writing completes.
// PixiJS/Spine import browser globals that keep the Node.js event loop
// alive indefinitely after the SSR build — process.exit is the only fix.
//
// `base.kit` and `base.kit.adapter` are optional in @sveltejs/kit's Config type even though
// config-svelte always sets them, so assert rather than leaving six "possibly undefined" errors.
/** @type {import('@sveltejs/kit').Adapter} */
const baseAdapter = /** @type {any} */ (base.kit?.adapter);

/** @type {import('@sveltejs/kit').Adapter} */
const exitAdapter = {
	name: baseAdapter.name,
	/** @param {Parameters<import('@sveltejs/kit').Adapter['adapt']>[0]} builder */
	async adapt(builder) {
		await baseAdapter.adapt(builder);
		process.exit(0);
	},
	supports: baseAdapter.supports,
	emulate: baseAdapter.emulate,
};

export default {
	...base,
	kit: {
		...base.kit,
		adapter: exitAdapter,
	},
};

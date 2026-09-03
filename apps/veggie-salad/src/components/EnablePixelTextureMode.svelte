<script lang="ts">
	import { getContextApp, type Texture } from 'pixi-svelte';

	const context = getContextApp();

	const setNearest = (value: unknown) => {
		const textures = Array.isArray(value) ? value : [value];
		for (const texture of textures as Texture[]) {
			if (texture?.source) texture.source.scaleMode = 'nearest';
		}
	};

	// Assets arrive in waves. Re-run after every loadedAssets merge so generated pixel boards,
	// symbols, coins, and loader frames never get bilinear blur while scaling.
	$effect(() => {
		for (const value of Object.values(context.stateApp.loadedAssets ?? {})) setNearest(value);
	});
</script>

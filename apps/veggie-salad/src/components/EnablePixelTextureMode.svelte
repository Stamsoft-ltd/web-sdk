<script lang="ts">
	import { getContextApp, PIXI, type Texture } from 'pixi-svelte';

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

	// Every BitmapText here is Jersey 10 rendered through pixi's dynamic bitmap fonts, and pixi
	// rasterises those glyph atlases at resolution 1 whatever the renderer runs at. On a retina
	// canvas (renderer resolution 2) inside the overlays' 1.185 design scale that atlas was
	// being blown up ~2.4x with linear filtering — the soft CONGRATS! card. Rasterise the atlas
	// at the renderer's own resolution plus that design scale so the glyphs land near 1:1.
	$effect(() => {
		const renderer = context.stateApp.pixiApplication?.renderer;
		if (!renderer) return;
		PIXI.BitmapFontManager.defaultOptions.resolution = Math.min(4, renderer.resolution * 1.25);
	});
</script>

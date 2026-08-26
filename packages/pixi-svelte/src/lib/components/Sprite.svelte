<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import { type Props as BaseProps } from './BaseSprite.svelte';

	export type Props = Omit<BaseProps, 'texture'> & {
		debug?: boolean;
		key: string;
	};
</script>

<script lang="ts">
	// Deliberately NOT `<BaseSprite {...rest} {texture} />`, which is what this was.
	//
	// That shape put two proxies in front of every prop of every sprite in the game: `...rest` from
	// `$props()` builds a rest-props proxy, and spreading it into a child builds a spread-props
	// object on top, so each read of `x` walked both before reaching the value. This is the most
	// instantiated component there is — every symbol, every marquee bulb, every piece of scenery —
	// and on a spinning board those traps were the single largest block of main-thread time after
	// Svelte's own effect flush. Owning the PIXI.Sprite here reads the props directly and drops a
	// component instance per sprite as well.
	//
	// The cost is that BaseSprite's ten lines are duplicated below. BaseSprite stays exported and
	// unchanged because apps use it directly with a texture they already hold.
	import { propsSyncEffect, textureSizeSyncEffect } from '../utils.svelte';
	import { getContextApp, getContextParent } from '../context.svelte';
	import type { LoadedSprite } from '../types';

	const props: Props = $props();
	const context = getContextApp();
	const parentContext = getContextParent();

	const texture = $derived(
		(context.stateApp.loadedAssets?.[props.key] || PIXI.Texture.EMPTY) as LoadedSprite,
	);

	// Constructed WITH the texture, so `width`/`height` are scaled against the real art rather than
	// against the 1x1 EMPTY. `textureSizeSyncEffect` covers the case where it arrives later.
	const sprite = new PIXI.Sprite(texture);

	propsSyncEffect({ props, target: sprite, ignore: ['isMask', 'debug', 'key'] });

	$effect(() => {
		if (sprite.texture !== texture) sprite.texture = texture;
	});

	textureSizeSyncEffect({ props, target: sprite, texture: () => texture });

	$effect(() => {
		if (props.isMask !== undefined) {
			parentContext.parent.mask = props.isMask ? sprite : null;
		}
	});

	parentContext.addToParent(sprite);
</script>

{#if texture === PIXI.Texture.EMPTY || props.debug}
	{console.error(`Sprite: key "${props.key}" is not found in the loadedAssets`)}
{/if}

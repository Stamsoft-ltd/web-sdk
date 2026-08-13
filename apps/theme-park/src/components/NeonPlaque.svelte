<script lang="ts" module>
	/**
	 * Horizontal 3-slice of a plaque texture: the two rounded end caps keep their aspect and only the
	 * plain middle stretches.
	 *
	 * A plain <Sprite width=… height=…> scales the whole bitmap, which turns a rounded end into an egg
	 * as soon as the drawn box is a different aspect than the source — the reason the bonus banner used
	 * to reach for a separately-authored piece of art per width. Slicing means one 1126x107 bar backs
	 * any width. Only safe on art whose middle is uniform along its length: stretching a run of marquee
	 * bulbs would space them out visibly, so pick the plain bar, not the bulb plate.
	 */
</script>

<script lang="ts">
	import { BaseSprite, PIXI, getContextApp } from 'pixi-svelte';
	// PIXI is exported as a value, not a namespace, so it cannot be used in a type position — the
	// texture type comes from pixi-svelte's own re-export instead (never from a direct pixi.js dep).
	import type { Texture } from 'pixi-svelte';

	type Props = {
		/** Asset key of the plaque art. */
		key: string;
		width: number;
		height: number;
		/** Fraction of the SOURCE width kept unstretched at each end. Must clear the corner curve. */
		cap?: number;
	};
	const { key, width, height, cap = 0.06 }: Props = $props();

	const context = getContextApp();
	const texture = $derived(context.stateApp.loadedAssets?.[key] as Texture | undefined);

	// Cut once per texture (i.e. once, when the asset lands), not once per frame.
	const slices = $derived.by(() => {
		if (!texture || texture === PIXI.Texture.EMPTY) return null;
		const { x, y, width: sw, height: sh } = texture.frame;
		const capW = Math.max(1, Math.round(sw * cap));
		const cut = (fx: number, fw: number) =>
			new PIXI.Texture({ source: texture.source, frame: new PIXI.Rectangle(x + fx, y, fw, sh) });
		return {
			left: cut(0, capW),
			mid: cut(capW, sw - capW * 2),
			right: cut(sw - capW, capW),
			// Caps are drawn at the plate's own vertical scale, so the corner radius stays circular.
			capOut: capW * (height / sh),
		};
	});
</script>

{#if slices}
	<BaseSprite
		texture={slices.left}
		anchor={{ x: 0, y: 0.5 }}
		x={-width / 2}
		width={slices.capOut}
		{height}
	/>
	<BaseSprite
		texture={slices.mid}
		anchor={{ x: 0, y: 0.5 }}
		x={-width / 2 + slices.capOut}
		width={width - slices.capOut * 2}
		{height}
	/>
	<BaseSprite
		texture={slices.right}
		anchor={{ x: 0, y: 0.5 }}
		x={width / 2 - slices.capOut}
		width={slices.capOut}
		{height}
	/>
{/if}

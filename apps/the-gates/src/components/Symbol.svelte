<script lang="ts">
	import { ART_ROOT, MOTION_ROOT, SYMBOL_ART, artTier } from '../game/art';
	import { runtime } from '../game/playback.svelte';
	import type { SymbolName } from '../game/contract';
	import type { AshTiming } from '../game/symbolAsh';
	import SpineArt from './SpineArt.svelte';
	let {
		name,
		decorative = false,
		fit = false,
		animated = false,
		paying = false,
		seed = 0,
		ash,
		landing,
	}: {
		name: SymbolName;
		decorative?: boolean;
		fit?: boolean;
		animated?: boolean;
		paying?: boolean;
		seed?: number;
		ash?: AshTiming;
		landing?: AshTiming;
	} = $props();
	const native = $derived(SYMBOL_ART[name]);
	const palette = $derived(artTier(runtime.game.tier));
</script>

<span
	class="symbol"
	class:animated
	class:paying
	data-art-theme={native ? 'cartoon' : 'spine-wild'}
	role={decorative ? undefined : 'img'}
	aria-label={decorative ? undefined : name.replaceAll('_', ' ')}
	aria-hidden={decorative ? 'true' : undefined}
>
	{#if animated || !fit || !native}<SpineArt
			rig={name}
			atlas={native ? `symbols-${palette}` : 'symbols'}
			assetRoot={native ? MOTION_ROOT : undefined}
			portalRemoval={!!native}
			viewport={native ? (fit ? 180 : name.endsWith('_GEM') ? 165 : 130) : undefined}
			animation={paying ? 'paying' : 'idle'}
			reduced={!animated || !!runtime.overlay}
			{seed}
			{ash}
			{landing}
		/>{:else}<img class="native-icon" src={`${ART_ROOT}symbols/${native}.png`} alt="" />{/if}
</span>

<style>
	.symbol {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 5px 4px #0008);
	}
	/* Intentional static menu/paytable icons, never an alternate gameplay renderer. */
	.native-icon {
		position: absolute;
		inset: 14%;
		width: 72%;
		height: 72%;
		object-fit: contain;
	}
</style>

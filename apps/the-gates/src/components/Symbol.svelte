<script lang="ts">
	import { SYMBOLS, type SymbolName } from '../game/contract';
	import type { AshTiming } from '../game/symbolAsh';
	import SpineArt from './SpineArt.svelte';
	let {
		name,
		decorative = false,
		animated = false,
		paying = false,
		seed = 0,
		ash,
	}: {
		name: SymbolName;
		decorative?: boolean;
		animated?: boolean;
		paying?: boolean;
		seed?: number;
		ash?: AshTiming;
	} = $props();
	const index = $derived(SYMBOLS.indexOf(name));
	let ready = $state(false);
</script>

<span
	class="symbol"
	class:animated
	class:paying
	class:rig-ready={ready && name !== 'KEY'}
	data-motif={index >= 5 && index <= 9 ? 'gem' : name.toLowerCase()}
	role={decorative ? undefined : 'img'}
	aria-label={decorative ? undefined : name.replaceAll('_', ' ')}
	aria-hidden={decorative ? 'true' : undefined}
	style={`--sx:${((index % 4) * 100) / 3}%;--sy:${Math.floor(index / 4) * 50}%;--fallback-clip:${index >= 5 && index <= 9 ? 'inset(0 0 8%)' : 'none'}`}
>
	{#if name !== 'KEY'}
		<SpineArt
			rig={name}
			animation={paying ? 'paying' : 'idle'}
			reduced={!animated}
			{seed}
			{ash}
			onready={(value) => (ready = value)}
		/>
	{/if}
</span>

<style>
	.symbol {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		background-image: url('./assets/the-gates/symbols.png');
		background-size: 400% 300%;
		background-position: var(--sx) var(--sy);
		background-repeat: no-repeat;
		filter: drop-shadow(0 5px 4px #0008);
	}
	.symbol:not(.rig-ready) {
		clip-path: var(--fallback-clip);
	}
	.symbol.rig-ready {
		background-image: none;
	}
</style>

<script lang="ts">
	import { fade } from 'svelte/transition';

	import { ap } from '../lib/preloadArt';
	import { getContext } from '../game/context';

	// Pre-game loading screen: the diner background (dimmed with a shadow) with the Press Play "P"
	// filling in sync with the REAL asset-load progress (not a looping animation). Hides once loaded.
	const context = getContext();
	const bg = ap('/assets/mcschmutzo/splash/bg-desktop.webp');
	const frames = Array.from({ length: 10 }, (_, i) => ap(`/assets/mcschmutzo/loader/p0${i}.webp`));

	const progress = $derived(Math.max(0, Math.min(100, context.stateApp.loadingProgress ?? 0)));
	const frameIndex = $derived(Math.min(9, Math.round((progress / 100) * 9)));
	const loaded = $derived(context.stateApp.loaded);
</script>

{#if !loaded}
	<div class="pp-loader" style={`background-image:url('${bg}')`} out:fade={{ duration: 320 }}>
		<div class="pp-loader__shade"></div>
		<div class="pp-loader__mark">
			<img class="pp-loader__p" src={frames[frameIndex]} alt="" draggable="false" />
			<span class="pp-loader__text">Press Play</span>
		</div>
	</div>
{/if}

<style>
	.pp-loader {
		position: fixed;
		inset: 0;
		z-index: 100;
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		display: grid;
		place-items: center;
	}
	/* Shadow over our background so the P + wordmark read clearly. */
	.pp-loader__shade {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.62);
	}
	.pp-loader__mark {
		position: relative;
		display: flex;
		align-items: center;
		gap: clamp(10px, 1.8vw, 26px);
	}
	/* The P tile fills left→right as progress rises (frame picked by loadingProgress). */
	.pp-loader__p {
		width: clamp(58px, 8vw, 108px);
		height: auto;
		filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.5));
	}
	.pp-loader__text {
		font-family: 'Poppins', sans-serif;
		font-weight: 600;
		color: #fff;
		font-size: clamp(26px, 3.6vw, 52px);
		letter-spacing: 0.005em;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}
</style>

<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import SpecialMascot from './SpecialMascot.svelte';

	const context = getContext();
	const aspect = 1678 / 937;
	// Portrait diner background (mobile-bg): its own 9:16-ish raster, cover-scaled to the phone.
	const portraitAspect = 941 / 1672;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	// Free games swap to the special (grey kitchen) background. Keyed off the free-spin counter
	// (shown for the whole bonus) — the per-spin gameType flips to 'respin'/'basegame' mid-bonus.
	const isFreegame = $derived(
		context.stateGame.gameType === 'freegame' || stateUi.freeSpinCounterShow,
	);
	const wideLayout = $derived(layoutType === 'desktop' || layoutType === 'landscape');
	// Base game: the chef with the ketchup bottle. Free games: the chef salting a pot.
	const showMascot = $derived(!isFreegame && wideLayout);
	const showSpecialMascot = $derived(isFreegame && wideLayout);
	const mascotHeight = $derived(canvas.height * 0.6);
	const mascotWidth = $derived(mascotHeight * (1019 / 1336));

	// Subtle idle so the chef looks alive: a slow breath, a gentle bob and sway. Runs only while a
	// mascot is on screen. (No separate eye art, so this is a whole-figure motion.)
	let idle = $state(0);
	$effect(() => {
		if (!showMascot) return;
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			idle = (ts - start) / 1000;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const breatheW = $derived(1 + 0.008 * Math.sin(idle * 1.7));
	const breatheH = $derived(1 + 0.016 * Math.sin(idle * 1.7));
	const mascotBob = $derived(Math.sin(idle * 1.25) * canvas.height * 0.006);
	const mascotSway = $derived(Math.sin(idle * 0.85) * 0.012);
	const key = $derived(isFreegame ? 'backgroundWideBonus' : 'backgroundBase');
	const portraitKey = $derived(isFreegame ? 'backgroundPortraitBonus' : 'backgroundPortrait');
	const cover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > aspect
			? { width: canvas.width, height: canvas.width / aspect }
			: { width: canvas.height * aspect, height: canvas.height };
	});
	// Cover-scale the portrait bg: the phone is usually narrower than the art, so height fills the
	// screen and the sides overhang (lamp + shelf stay in view).
	const portraitCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > portraitAspect
			? { width: canvas.width, height: canvas.width / portraitAspect }
			: { width: canvas.height * portraitAspect, height: canvas.height };
	});
</script>

<Rectangle {...canvas} backgroundColor={0x170905} zIndex={-3} />
{#if isPortrait}
	<!-- Mobile portrait: the dedicated diner background, no darkening overlay (matches the splash).
	     Swaps to the special grey-kitchen background during free games. -->
	<Sprite
		key={portraitKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={portraitCover.width}
		height={portraitCover.height}
		zIndex={-2}
	/>
{:else}
	<Sprite
		{key}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width}
		height={cover.height}
		zIndex={-2}
	/>
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
{/if}
{#if showMascot}
	<Sprite
		key="mascot"
		x={canvas.width * 0.86}
		y={canvas.height * 0.59 + mascotBob}
		anchor={0.5}
		width={mascotWidth * breatheW}
		height={mascotHeight * breatheH}
		rotation={mascotSway}
		zIndex={0}
	/>
{/if}
{#if showSpecialMascot}
	<SpecialMascot />
{/if}

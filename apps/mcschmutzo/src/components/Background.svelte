<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import SpecialMascot from './SpecialMascot.svelte';
	import AnimatedGuy from './AnimatedGuy.svelte';

	const context = getContext();
	const aspect = 1678 / 937;
	// Portrait diner background (mobile-bg): its own 9:16-ish raster, cover-scaled to the phone.
	const portraitAspect = 941 / 1672;
	// Landscape SPECIAL (free-games) grey kitchen — its own wide crop (special-bg-landscape.webp).
	const specialLandscapeAspect = 1590 / 716;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscape = $derived(layoutType === 'landscape');
	// Free games swap to the special (grey kitchen) background. Keyed off the free-spin counter
	// (shown for the whole bonus) — the per-spin gameType flips to 'respin'/'basegame' mid-bonus.
	const isFreegame = $derived(
		context.stateGame.gameType === 'freegame' || stateUi.freeSpinCounterShow,
	);
	// The chef mascots (base + salting) and the special grey-kitchen bg are DESKTOP-only. Landscape
	// uses its own clean wide diner background with no chef (design ask).
	const showMascot = $derived(!isFreegame && layoutType === 'desktop');
	const showSpecialMascot = $derived(isFreegame && layoutType === 'desktop');
	const mascotHeight = $derived(canvas.height * 0.6);
	const mascotWidth = $derived(mascotHeight * (1019 / 1336));
	// The chef stands still; only his eyes move (AnimatedGuy).
	const mascotPupils = [
		{ key: 'mascotPupilL', nx: 0.3494, ny: 0.3144, nw: 0.0628, nh: 0.0599 },
		{ key: 'mascotPupilR', nx: 0.472, ny: 0.3121, nw: 0.0687, nh: 0.0599 },
	];
	const key = $derived(isFreegame ? 'backgroundWideBonus' : 'backgroundBase');
	const portraitKey = $derived(isFreegame ? 'backgroundPortraitBonus' : 'backgroundPortrait');
	const cover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > aspect
			? { width: canvas.width, height: canvas.width / aspect }
			: { width: canvas.height * aspect, height: canvas.height };
	});
	// Cover for the wide landscape special crop (free games only).
	const specialLandscapeCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > specialLandscapeAspect
			? { width: canvas.width, height: canvas.width / specialLandscapeAspect }
			: { width: canvas.height * specialLandscapeAspect, height: canvas.height };
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
{#if isLandscape}
	<!-- Mobile-landscape: the real full diner (cover-scaled) for the base game, swapping to the
	     dedicated wide grey-kitchen crop for free games. No chef in landscape (design ask). -->
	<Sprite
		key={isFreegame ? 'backgroundLandscapeBonus' : 'backgroundBase'}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={isFreegame ? specialLandscapeCover.width : cover.width}
		height={isFreegame ? specialLandscapeCover.height : cover.height}
		zIndex={-2}
	/>
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
{:else if isPortrait}
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
	<AnimatedGuy
		baseKey="mascotBase"
		x={canvas.width * 0.86}
		y={canvas.height * 0.59}
		width={mascotWidth}
		height={mascotHeight}
		zIndex={0}
		pupils={mascotPupils}
	/>
{/if}
{#if showSpecialMascot}
	<SpecialMascot />
{/if}

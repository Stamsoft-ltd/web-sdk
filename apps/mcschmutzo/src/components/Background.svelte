<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import AnimatedGuy from './AnimatedGuy.svelte';
	import SpecialMascot from './SpecialMascot.svelte';

	type Props = {
		/** False while the loading screen / splash is up: only the dark backdrop renders. */
		showArt?: boolean;
	};
	const { showArt = true }: Props = $props();

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
	// Subtle idle so the chef isn't a frozen cut-out: a slow breathe (no lean — his eyes carry the
	// life, and a rotation would drag the pupils/label out of place).
	let clock = $state(0);
	$effect(() => {
		if (!showMascot) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const mascotPose = $derived(
		mascotIdle(clock, canvas.width * 0.86, canvas.height * 0.59, mascotWidth, mascotHeight, {
			sway: 0,
			breathe: 0.005,
			bob: 0.004,
		}),
	);
	// Pupils (measured from the cut art) + eye-cover boxes for the blink lid; all fractions of the
	// figure. Skin tone sampled by the eyes so the lid is invisible where it overshoots onto skin.
	// Pupils sit low-ish in the (now fully-filled white) sclera for a natural forward gaze. The eye
	// whites in mascot_base were re-filled solid white — they had skin showing where the pupils were
	// cut, so the moving disc used to reveal skin.
	const mascotPupils = [
		{ key: 'mascotPupilL', nx: 0.3415, ny: 0.311, nw: 0.0491, nh: 0.0479 },
		{ key: 'mascotPupilR', nx: 0.473, ny: 0.308, nw: 0.0687, nh: 0.0449 },
	];
	const mascotLids = [
		{ cx: 0.329, cy: 0.305, w: 0.084, h: 0.08 },
		{ cx: 0.4595, cy: 0.299, w: 0.106, h: 0.088 },
	];
	// The held "EXTRA MESSY" ketchup bottle is a separate overlay (cut out of mascotBase) so it can
	// shake about the wrist like the splash chef's bottle. Pivot = the wrist joint (chef fractions).
	const BOTTLE_PIVX = 0.19;
	const BOTTLE_PIVY = 0.8;
	const mascotLeft = $derived(mascotPose.x - mascotPose.width / 2);
	const mascotTop = $derived(mascotPose.y - mascotPose.height / 2);
	const bottlePivotX = $derived(mascotLeft + BOTTLE_PIVX * mascotPose.width);
	const bottlePivotY = $derived(mascotTop + BOTTLE_PIVY * mascotPose.height);
	// A quick damped wiggle, more often now (matching the splash's bottle-shake), otherwise still.
	const BOTTLE_PERIOD = 2800; // ms between shakes
	const SHAKE_DUR = 950; // ms the wiggle lasts
	const bottleShake = $derived.by(() => {
		const t = clock % BOTTLE_PERIOD;
		if (t > SHAKE_DUR) return 0;
		const u = t / SHAKE_DUR; // 0..1 across the shake
		return 0.058 * Math.exp(-2.7 * u) * Math.sin(u * 2 * Math.PI * 2.6); // ~3.3° damped, ~2.6 wiggles
	});
	// Desktop base game uses the new desktop diner art; free games keep the grey-kitchen special bg.
	const key = $derived(isFreegame ? 'backgroundWideBonus' : 'backgroundDesktop');
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
	// A slow, subtle diagonal light-sweep across the diner so it reads as freshly polished / super
	// clean. Sweeps every ~10s and fades in/out; only on the desktop base-game bg (uses the same clock).
	const shine = $derived.by(() => {
		const period = 10000;
		const dur = 2800;
		const t = clock % period;
		if (t > dur) return null;
		const p = t / dur;
		return { x: (-0.2 + 1.4 * p) * canvas.width, a: 0.11 * Math.sin(Math.PI * p) };
	});
</script>

<Rectangle {...canvas} backgroundColor={0x170905} zIndex={-3} />
{#if !showArt}
	<!-- Loading / splash: nothing but the backdrop (the art below would show through). -->
{:else if isLandscape}
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
	{#if showMascot && shine}
		<!-- Clean gleam: a soft light band (wide dim + narrow bright core) sweeping across the diner. -->
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.11} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a} zIndex={-0.6} />
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.04} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a * 1.3} zIndex={-0.6} />
	{/if}
{/if}
{#if showArt && showMascot}
	<!-- The chef breathes, his eyes glance + blink, and his nametag jiggles (layered art). -->
	<AnimatedGuy
		baseKey="mascotBase"
		x={mascotPose.x}
		y={mascotPose.y}
		width={mascotPose.width}
		height={mascotPose.height}
		zIndex={0}
		pupils={mascotPupils}
		lids={mascotLids}
		skin={0xec9c58}
		extras={[
			{
				key: 'mascotLabel',
				nx: 0.4406,
				ny: 0.5973,
				nw: 0.2434,
				nh: 0.1026,
				px: 0.5,
				py: 0.07,
				amp: 0.04,
				period: 320,
			},
		]}
		sparkle={{ nx: 0.44, ny: 0.425, size: 0.075, period: 3400 }}
	/>
	<!-- The held ketchup bottle, overlaid so it can shake about the wrist like the splash chef's. -->
	<Sprite
		key="mascotBottle"
		x={bottlePivotX}
		y={bottlePivotY}
		anchor={{ x: BOTTLE_PIVX, y: BOTTLE_PIVY }}
		width={mascotPose.width}
		height={mascotPose.height}
		rotation={bottleShake}
		zIndex={0.5}
	/>
{/if}
{#if showArt && showSpecialMascot}
	<SpecialMascot />
{/if}

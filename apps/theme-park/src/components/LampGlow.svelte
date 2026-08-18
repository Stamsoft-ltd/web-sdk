<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { LAMPS_Z, backgroundCover } from '../game/sceneBackground';

	/**
	 * The plaza's lamp posts are painted already lit, but painted light is dead light — it is the one
	 * thing in the scene the eye expects to breathe. This hangs a soft additive halo on each lantern
	 * and lets it swell and settle on its own slow cycle, so the lamps read as burning rather than as
	 * drawn.
	 *
	 * Positions are fractions of the backdrop art, not of the canvas: the art is cover-scaled and its
	 * lamps move under a resize.
	 */

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived(backgroundCover(canvas));

	// Measured off background-blur.webp, on the glass of each lantern. `size` is the lantern's size
	// relative to the big one at the front left — the two near lamps carry a real halo, the ones down
	// the avenue only a spark, which is what sells the distance.
	const LAMPS = [
		{ x: 0.1789, y: 0.3652, size: 1.0 },
		{ x: 0.3199, y: 0.4405, size: 0.6 },
		{ x: 0.4352, y: 0.495, size: 0.3 },
		{ x: 0.5846, y: 0.5008, size: 0.3 },
		{ x: 0.6679, y: 0.5083, size: 0.28 },
		{ x: 0.6873, y: 0.4066, size: 0.85 },
	];

	/** Halo and hot-centre diameters at size 1, as fractions of the backdrop's drawn width. */
	const HALO = 0.075;
	const CORE = 0.026;

	// Brightness at rest, and how much of it the breath takes away at the bottom of the cycle. Low on
	// both counts: this is a lamp in daylight, and an additive glow that pumps is a warning light.
	const HALO_ALPHA = 0.34;
	const CORE_ALPHA = 0.5;
	const BREATH_DEPTH = 0.22;
	/** Seconds per breath. Each lamp gets its own, so they never pulse in unison. */
	const BREATH_SECONDS = { min: 3.4, max: 5.6 };

	const HALO_TINT = 0xffd08a;
	const CORE_TINT = 0xfff3d8;

	const random = (min: number, max: number) => min + Math.random() * (max - min);

	// Phase and period are rolled once and kept: unlike the clouds and the balloon, a lamp is never
	// re-launched, so there is nothing to re-roll.
	const lamps = LAMPS.map((lamp) => ({
		...lamp,
		phase: Math.random() * Math.PI * 2,
		period: random(BREATH_SECONDS.min, BREATH_SECONDS.max),
	}));

	let elapsed = $state(0);

	onMount(() => {
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			// Clamped so a backgrounded tab does not resume mid-jump.
			elapsed += Math.min((now - previous) / 1000, 0.1);
			previous = now;
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	const ready = $derived(!!context.stateApp.loadedAssets?.spark);

	// Both bonuses swap the plaza for their own backdrop, and neither has these lamps. Faded on the
	// same 600ms curve <Background> crossfades on, so the glows do not blink out mid-swap.
	const sceneSwapped = $derived(
		!!context.stateGame.duckPicks || context.stateGame.bonusType === 'coaster',
	);
	const sceneFade = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		sceneFade.set(sceneSwapped ? 0 : 1);
	});

	const placed = $derived.by(() =>
		lamps.map((lamp) => {
			const breath =
				1 - BREATH_DEPTH * (0.5 - 0.5 * Math.cos((elapsed / lamp.period) * Math.PI * 2 + lamp.phase));
			return {
				x: cover.left + cover.width * lamp.x,
				y: cover.top + cover.height * lamp.y,
				halo: cover.width * HALO * lamp.size,
				core: cover.width * CORE * lamp.size,
				haloAlpha: HALO_ALPHA * breath * sceneFade.current,
				coreAlpha: CORE_ALPHA * breath * sceneFade.current,
			};
		}),
	);
</script>

<!-- Between the backdrop and the clouds: the lamps stand in the painted plaza, so nothing in the sky
     should pass behind their glow. -->
<Container zIndex={LAMPS_Z}>
	{#if ready}
		{#each placed as lamp, index (index)}
			<Sprite
				key="spark"
				x={lamp.x}
				y={lamp.y}
				anchor={0.5}
				width={lamp.halo}
				height={lamp.halo}
				alpha={lamp.haloAlpha}
				tint={HALO_TINT}
				blendMode="add"
			/>
			<Sprite
				key="spark"
				x={lamp.x}
				y={lamp.y}
				anchor={0.5}
				width={lamp.core}
				height={lamp.core}
				alpha={lamp.coreAlpha}
				tint={CORE_TINT}
				blendMode="add"
			/>
		{/each}
	{/if}
</Container>

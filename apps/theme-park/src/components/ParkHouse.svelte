<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { HOUSE_ASPECT, HOUSE_BULB, HOUSE_BULBS, HOUSE_PANES, PARK_HOUSE } from '../game/parkScene';
	import { HOUSE_Z, backgroundCover } from '../game/sceneBackground';
	import WinCardLights from './WinCardLights.svelte';

	/**
	 * The house at the front of the plaza, and the only thing in the backdrop that is lit rather than
	 * painted lit.
	 *
	 * It is a separate node in the design (Figma 7051:2235) laid over a smaller one the plaza art has
	 * painted into that corner, and it ships separately for exactly that reason: on its own sprite the
	 * bulbs strung along its gables and around its door can be found offline and lit here. Everything
	 * it needs — where it is pinned, every bulb, both lit openings — is generated into
	 * `game/parkScene.ts` by scripts/background/build_background.py.
	 *
	 * It rides the backdrop's cover transform, not the canvas: it has to stay exactly over the house
	 * painted underneath it, and a resize moves that one.
	 */

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived(backgroundCover(canvas));

	// The house's drawn box. Width comes off the art; height is derived from the art's own aspect
	// rather than from the design box, so the sprite is never stretched to close a rounding gap.
	const width = $derived(cover.width * PARK_HOUSE.w);
	const height = $derived(width / HOUSE_ASPECT);
	const x = $derived(cover.left + cover.width * PARK_HOUSE.x);
	const y = $derived(cover.top + cover.height * PARK_HOUSE.y);

	// ── The lighting ────────────────────────────────────────────────────────────────────────────
	//
	// This is a house in full daylight, not a marquee in a dark room, so the chase is nothing like the
	// one on the win cards: a slow, wide wave moves across the bulbs rather than a front running round
	// a sign. Turned up to a win-card chase they read as an alarm going off behind the reels.
	const CYCLES = 2;
	const SPEED = 0.16;
	/**
	 * The bulbs are PAINTED LIT — blown-out cream discs, each with a warm ring already around it —
	 * and the art stays that way. Two other things were tried and are not coming back: shading the
	 * discs down left them looking dirty rather than off, because the painted ring around them stays
	 * on either way; and erasing the discs from the art so they could be lit properly turned a sunlit
	 * house into a derelict one the moment half the run went dark.
	 *
	 * So nothing here ever turns a bulb OFF. The floor is zero because zero is the drawing's own
	 * bulb, which already looks lit, and what travels along the run is a BLOOM on top of it.
	 */
	const FLOOR = 0;
	const INTENSITY = 1;
	/**
	 * The disc is already at white and cannot go brighter, so the halo — the part that lands on the
	 * rail around it — is the whole of the effect, and it is turned up well past what a sign in a
	 * dark room needs.
	 */
	const SPILL = 1.9;
	/** White-hot, so a blooming bulb reads as one that just caught rather than as a warmer smudge. */
	const CORE_COLOUR = 0xfff6e6;
	/**
	 * And on top of the wave, each bulb blinks on its own beat. Without it a run of bulbs this even
	 * reads as one strip that brightens and dims; the blink is what says the strip is made of
	 * separate bulbs. It can be deep here — a bulb at the bottom of its dip is just the painted disc.
	 */
	const BLINK = 0.7;

	/** Both openings breathe on their own slow cycle, so the window and the fanlight never pulse together. */
	const PANE_SECONDS = [7.4, 5.1];
	const PANE_TINT = 0xffcf7a;
	/** How far outside the opening the spill reaches. */
	const PANE_HALO = 2.3;
	const PANE_HALO_ALPHA = 0.2;
	const PANE_CORE_ALPHA = 0.34;
	const PANE_BREATH = 0.28;

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

	const ready = $derived(
		!!context.stateApp.loadedAssets?.parkHouse && !!context.stateApp.loadedAssets?.spark,
	);

	// Both bonuses swap the plaza for their own backdrop, and neither has this house in it. Faded on
	// the same 600ms curve <Background> crossfades on, so it does not blink out mid-swap.
	const sceneSwapped = $derived(
		!!context.stateGame.duckPicks || context.stateGame.bonusType === 'coaster',
	);
	const sceneFade = new Tween(1, { duration: 600, easing: cubicInOut });
	$effect(() => {
		sceneFade.set(sceneSwapped ? 0 : 1);
	});

	const panes = $derived(
		HOUSE_PANES.map((pane, index) => {
			const seconds = PANE_SECONDS[index % PANE_SECONDS.length];
			const breath = 1 - PANE_BREATH * (0.5 - 0.5 * Math.cos((elapsed / seconds) * Math.PI * 2));
			return {
				x: pane.x * width,
				y: pane.y * width,
				w: pane.w * width,
				h: pane.h * width,
				alpha: breath * sceneFade.current,
			};
		}),
	);
</script>

<!-- Directly above the plaza and below the bonus backdrops, which replace the whole scene. -->
<Container zIndex={HOUSE_Z}>
	{#if ready}
		<Container {x} {y} alpha={sceneFade.current}>
			<Sprite key="parkHouse" anchor={0.5} x={0} y={0} {width} {height} />

			<!-- The lit openings, under the bulbs: a soft spill around each and a warmer core in it. -->
			{#each panes as pane, index (index)}
				<Sprite
					key="spark"
					anchor={0.5}
					x={pane.x}
					y={pane.y}
					width={pane.w * PANE_HALO}
					height={pane.h * PANE_HALO}
					alpha={PANE_HALO_ALPHA * pane.alpha}
					tint={PANE_TINT}
					blendMode="add"
				/>
				<Sprite
					key="spark"
					anchor={0.5}
					x={pane.x}
					y={pane.y}
					width={pane.w}
					height={pane.h}
					alpha={PANE_CORE_ALPHA * pane.alpha}
					tint={PANE_TINT}
					blendMode="add"
				/>
			{/each}

			<WinCardLights
				bulbs={HOUSE_BULBS}
				size={width}
				colour={HOUSE_BULB.colour}
				coreColour={CORE_COLOUR}
				bulb={HOUSE_BULB.size}
				cycles={CYCLES}
				speed={SPEED}
				floor={FLOOR}
				spill={SPILL}
				blink={BLINK}
				intensity={INTENSITY * sceneFade.current}
				{elapsed}
			/>
		</Container>
	{/if}
</Container>

<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { BACKGROUND_Z, backgroundCover } from '../game/sceneBackground';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	let driftX = $state(0);
	let driftY = $state(0);

	onMount(() => {
		let frame = 0;
		const started = performance.now();
		const tick = (now: number) => {
			const time = (now - started) / 1000;
			driftX = Math.sin(time * 0.12) * 7;
			driftY = Math.cos(time * 0.09) * 4;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

	// The art is in the counted load pass, not the preload tier, so this component mounts with <Game>
	// a moment before its texture lands; <Sprite> logs an error for an unknown key. The loading screen
	// is opaque over this the whole time.
	const ready = $derived(!!context.stateApp.loadedAssets?.background);

	const cover = $derived(backgroundCover(canvas));

	// Duck Your Luck swaps the plaza for the blurred fishing-booth backdrop for as long as the pond
	// state is live, crossfaded over the base art so entry/exit are not a hard cut.
	const BOOTH_ASPECT = 1200 / 670;
	const pondReady = $derived(!!context.stateApp.loadedAssets?.duckPondBackground);
	const pondActive = $derived(!!context.stateGame.duckPicks);
	const pondFade = new Tween(0, { duration: 600, easing: cubicInOut });
	$effect(() => {
		pondFade.set(pondActive && pondReady ? 1 : 0);
	});
	const boothCover = $derived(backgroundCover(canvas, BOOTH_ASPECT));
</script>

<!-- zIndex is explicit because this sprite is gated on its texture: it mounts a beat after <Clouds>
     and, at an equal zIndex, pixi's stable sort would leave it appended last and painting over the
     sky. The backdrop stack sits below every MainContainer (all at 0): tints, then art, then clouds
     at -2. -->
{#if ready}
	<Sprite
		key="background"
		x={canvas.width * 0.5 + driftX}
		y={canvas.height * 0.5 + driftY}
		anchor={0.5}
		width={cover.width}
		height={cover.height}
		alpha={0.98}
		zIndex={BACKGROUND_Z}
	/>
{/if}
{#if pondReady && pondFade.current > 0}
	<!-- One step above the plaza art, still below the clouds and everything else. -->
	<Sprite
		key="duckPondBackground"
		x={canvas.width * 0.5 + driftX}
		y={canvas.height * 0.5 + driftY}
		anchor={0.5}
		width={boothCover.width}
		height={boothCover.height}
		alpha={0.98 * pondFade.current}
		zIndex={BACKGROUND_Z + 1}
	/>
{/if}
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={BACKGROUND_Z - 2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={BACKGROUND_Z - 1} />

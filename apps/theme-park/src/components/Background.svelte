<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
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
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={BACKGROUND_Z - 2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={BACKGROUND_Z - 1} />

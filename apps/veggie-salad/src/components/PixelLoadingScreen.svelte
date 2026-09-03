<script lang="ts">
	import { onMount } from 'svelte';
	import { MainContainer } from 'components-layout';
	import { BaseSprite, Rectangle, Sprite, type Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = { onloaded: () => void };
	const props: Props = $props();
	const context = getContext();

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	let notified = false;

	onMount(() => {
		const timeout = window.setTimeout(() => (minTimeElapsed = true), MIN_LOADER_MS);
		return () => window.clearTimeout(timeout);
	});

	$effect(() => {
		if (!context.stateApp.loaded || !minTimeElapsed || notified) return;
		notified = true;
		props.onloaded();
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const main = $derived(context.stateLayoutDerived.mainLayout());

	// Native garden art is 1340×550. Cover preserves pixels/aspect and crops excess rather than
	// stretching the meadow on portrait displays.
	const backgroundScale = $derived(Math.max(canvas.width / 1340, canvas.height / 550));
	const backgroundWidth = $derived(1340 * backgroundScale);
	const backgroundHeight = $derived(550 * backgroundScale);

	const barTextures = $derived((context.stateApp.loadedAssets?.loadingBarAnim ?? []) as Texture[]);
	const progress = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);
	const barFrame = $derived(
		barTextures.length
			? Math.min(barTextures.length - 1, Math.round((progress / 100) * (barTextures.length - 1)))
			: 0,
	);
	const barWidth = $derived(Math.min(main.width * 0.58, 720));
	const barHeight = $derived(barWidth * (80 / 856));
	const logoWidth = $derived(Math.min(main.width * 0.38, 430));
	const logoHeight = $derived(logoWidth * (228 / 548));
</script>

<Rectangle {...canvas} backgroundColor={0x1598e2} />
<Sprite
	key="loadingBackground"
	anchor={0.5}
	x={canvas.x + canvas.width * 0.5}
	y={canvas.y + canvas.height * 0.5}
	width={backgroundWidth}
	height={backgroundHeight}
/>
<!-- Dim the garden only. Branding/bar remain full brightness above this layer. -->
<Rectangle {...canvas} backgroundColor={0x061d17} backgroundAlpha={0.53} />

<MainContainer>
	<Sprite
		key="pressPlayLogo"
		anchor={0.5}
		x={main.width * 0.5}
		y={main.height * 0.5 - logoHeight * 0.56}
		width={logoWidth}
		height={logoHeight}
	/>
	{#if barTextures.length}
		<BaseSprite
			texture={barTextures[barFrame]}
			anchor={0.5}
			x={main.width * 0.5}
			y={main.height * 0.5 + logoHeight * 0.72}
			width={barWidth}
			height={barHeight}
		/>
	{/if}
</MainContainer>

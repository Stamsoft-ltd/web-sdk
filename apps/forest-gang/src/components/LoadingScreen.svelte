<script lang="ts">
	import { onMount } from 'svelte';
	import { BaseSprite, Rectangle, Sprite } from 'pixi-svelte';
	import type { Texture } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import { whenArtWarm } from '../lib/preloadArt';

	type Props = { onloaded: () => void; oncanproceed?: (onpress: () => void) => void };
	const props: Props = $props();
	const context = getContext();
	let loadingType = $state<'start' | 'ready'>('start');

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	// The splash and HUD are plain <img>/CSS art fetched by the preloadArt queue — hold the
	// loading screen until that queue drains too, so nothing pops in after the game shows.
	let artWarm = $state(false);
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
		whenArtWarm().then(() => (artWarm = true));
	});

	const canProceed = $derived(context.stateApp.loaded && artWarm && minTimeElapsed);

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			props.oncanproceed?.(() => {
				loadingType = 'ready';
				props.onloaded();
			});
		}
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Loading bar. The source is a 49-frame 0→100% fill (white bar/text on transparency). We DON'T
	// auto-play it: during the loading screen the shared pixi ticker isn't running yet, so autoUpdate
	// never advances. Instead we pick the frame from the real load progress — so the bar reflects the
	// actual download, reaches 100%, and holds there (never repeats). Native frame is 856×80.
	const BAR_ASPECT = 80 / 856;
	const barTextures = $derived((context.stateApp.loadedAssets?.loadingBarAnim ?? []) as Texture[]);
	const barW = $derived(Math.min(context.stateLayoutDerived.mainLayout().width * 0.6, 720));
	const barH = $derived(barW * BAR_ASPECT);

	// Studio "Press Play" branding above the bar (preloaded so it paints immediately). Native 548×228.
	const LOGO_ASPECT = 228 / 548;
	const logoW = $derived(Math.min(context.stateLayoutDerived.mainLayout().width * 0.34, 420));
	const logoH = $derived(logoW * LOGO_ASPECT);
	const hasLogo = $derived(!!context.stateApp.loadedAssets?.pressPlayLogo);
	const barProgress = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);
	const barFrame = $derived(
		barTextures.length
			? Math.min(barTextures.length - 1, Math.round((barProgress / 100) * (barTextures.length - 1)))
			: 0,
	);
</script>

<!-- The loading bar is the ONLY preloaded asset, so this screen paints first (plain dark backdrop +
	 bar) while the splash art and every other asset stream in during the tracked load. The bar fills
	 with real progress and holds at 100%; the themed splash/press screen follows once loaded. -->
<FadeContainer show={loadingType === 'start'}>
	<Rectangle {...canvas} backgroundColor={0x05070a} />
	<MainContainer>
		{#if hasLogo}
			<Sprite
				key="pressPlayLogo"
				anchor={{ x: 0.5, y: 0.5 }}
				x={context.stateLayoutDerived.mainLayout().width * 0.5}
				y={context.stateLayoutDerived.mainLayout().height * 0.5 - logoH * 0.9}
				width={logoW}
				height={logoH}
			/>
		{/if}
		{#if barTextures.length}
			<BaseSprite
				texture={barTextures[barFrame]}
				anchor={{ x: 0.5, y: 0.5 }}
				x={context.stateLayoutDerived.mainLayout().width * 0.5}
				y={context.stateLayoutDerived.mainLayout().height * 0.5}
				width={barW}
				height={barH}
			/>
		{/if}
	</MainContainer>
</FadeContainer>

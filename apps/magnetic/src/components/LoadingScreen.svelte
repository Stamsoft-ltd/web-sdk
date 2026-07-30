<script lang="ts">
	import { onMount } from 'svelte';
	import { BaseSprite, Container, Rectangle, Sprite, type LoadedSpriteSheet } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	// Everything here is wrapped in ONE container carrying this zIndex, and the number has to beat
	// anything else parented to the app root while loading. <Background /> only appends its sprite
	// once the background image has downloaded — i.e. AFTER this screen mounted — so with both at the
	// default zIndex 0 pixi's stable sort put the newcomer last and the background drew straight over
	// the loader. (Its alpha 0.96 is why the logo and bar survived as faint ghosts rather than
	// disappearing.) The zIndex cannot go on <MainContainer>: that component spreads its props onto
	// an INNER container, so the outer node that actually gets sorted keeps zIndex 0.
	const LOADING_SCREEN_Z = 1000;

	type Props = { onloaded: () => void; oncanproceed?: (onpress: () => void) => void };
	const props: Props = $props();
	const context = getContext();
	let loadingType = $state<'start' | 'ready'>('start');

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
	});

	const canProceed = $derived(context.stateApp.loaded && minTimeElapsed);

	// The bar tracks the REAL download. It used to be an orb sliding across a permanently empty
	// slot, which reads as a stalled bar because nothing ever fills — and it sat at 0 for the whole
	// load anyway, since every asset was in the `preload` tier that the progress counter ignores by
	// design. Both halves are fixed: assets.ts now puts base-game art in the counted tier, and the
	// slot actually fills.
	const barProgress = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);

	// Smooth the fill so a wave of assets resolving together doesn't jump the bar, and clamp it to
	// forward-only so it can never appear to lose progress. Driven by rAF rather than the pixi
	// ticker, which is not running yet while this screen is up.
	let shownProgress = $state(0);
	onMount(() => {
		let id: number;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(64, now - last);
			last = now;
			const eased = shownProgress + (barProgress - shownProgress) * (1 - Math.exp(-dt / 110));
			shownProgress = Math.max(shownProgress, eased);
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			const proceed = () => {
				loadingType = 'ready';
				props.onloaded();
			};
			if (props.oncanproceed) props.oncanproceed(proceed);
			else proceed();
		}
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const main = $derived(context.stateLayoutDerived.mainLayout());

	// Loading bar. The source is a 49-frame 0→100% fill (white bar/text on transparency). We DON'T
	// autoplay it: while this screen is up the shared pixi ticker isn't running, so an AnimatedSprite's
	// autoUpdate would never advance. The frame is picked from the smoothed load progress instead, so
	// the bar tracks the real download, reaches 100%, and holds there. Native frame is 856×80.
	const BAR_ASPECT = 80 / 856;
	const barTextures = $derived(
		(context.stateApp.loadedAssets?.loadingBarAnim ?? []) as LoadedSpriteSheet,
	);
	const barW = $derived(Math.min(main.width * 0.6, 720));
	const barH = $derived(barW * BAR_ASPECT);
	const barFrame = $derived(
		barTextures.length
			? Math.min(
					barTextures.length - 1,
					Math.round((shownProgress / 100) * (barTextures.length - 1)),
				)
			: 0,
	);

	// Studio "Press Play" branding above the bar. Native 548×228.
	const LOGO_ASPECT = 228 / 548;
	const logoW = $derived(Math.min(main.width * 0.34, 420));
	const logoH = $derived(logoW * LOGO_ASPECT);
	const hasLogo = $derived(!!context.stateApp.loadedAssets?.pressPlayLogo);
</script>

<!-- Plain dark backdrop rather than the splash art: the bar and logo are the only preloaded assets,
     so this screen paints immediately instead of waiting on a full-screen JPEG that is itself part
     of the download being measured. The themed splash/press screen follows once loading completes.
     Mirrors forest-gang's loader.

     Deliberately NOT wrapped in a <FadeContainer>. <Background /> in Game.svelte renders
     unconditionally, so a container that tweens up from alpha 0 shows the live game background
     straight through this backdrop for the length of the tween — the loader appeared as a ghost
     over the arena art. The Stake Engine gif used to cover that window (it was held until
     stateApp.loaded); with it removed the loader has to be opaque from its very first frame.
     Nothing is lost: the matching fade-OUT was already dead code, because the {#if
     showLoadingScreen} in Game.svelte destroys this component outright rather than letting it
     animate away. -->
{#if loadingType === 'start'}
	<Container zIndex={LOADING_SCREEN_Z}>
		<Rectangle {...canvas} backgroundColor={0x040711} />
		<MainContainer>
			{#if hasLogo}
				<Sprite
					key="pressPlayLogo"
					anchor={{ x: 0.5, y: 0.5 }}
					x={main.width * 0.5}
					y={main.height * 0.5 - logoH * 0.9}
					width={logoW}
					height={logoH}
				/>
			{/if}

			{#if barTextures.length}
				<BaseSprite
					texture={barTextures[barFrame]}
					anchor={{ x: 0.5, y: 0.5 }}
					x={main.width * 0.5}
					y={main.height * 0.5}
					width={barW}
					height={barH}
				/>
			{/if}
		</MainContainer>
	</Container>
{/if}

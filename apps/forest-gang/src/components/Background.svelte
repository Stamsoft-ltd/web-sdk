<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const BACKGROUND_ASPECT = 1920 / 1080;
	const PORTRAIT_ASPECT = 720 / 1600; // bg_mobile_portrait.webp
	const LANDSCAPE_ASPECT = 2400 / 1080; // bg_mobile_landscape.webp
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	// Portrait/landscape base game uses dedicated static forest art; bonus rounds keep their themed
	// (animated) art, and desktop base keeps the animated baseBgVideo.
	const isPortraitBase = $derived(isPortrait && context.stateGame.bonusMode === null);
	const isLandscapeBase = $derived(
		isLandscape && (context.stateGame.bonusMode === null || context.stateGame.bonusMode === 'feature'),
	);

	// Themed bonus backgrounds: green forest for the normal bonus (Deal It / freegame),
	// golden forest for the super bonus (All In / superspin); everything else keeps the default.
	// The swap is instant here and masked by the alpha Transition overlay (TransitionAnimation).
	const backgroundKey = $derived.by(() => {
		switch (context.stateGame.bonusMode) {
			case 'freegame':
				return 'bonusNormalBgVideo';
			case 'superspin':
				return 'bonusSuperBgVideo';
			default:
				// Mobile portrait/landscape use static art; desktop keeps the animated video.
				return isPortrait ? 'visualPortrait' : isLandscape ? 'baseBgLandscape' : 'baseBgVideo';
		}
	});
	// Chrome blocks muted autoplay until the first user gesture. The base video is active from
	// mount (before any interaction) and a base-game spin doesn't change bonusMode, so without
	// this the initial play() stays rejected and the base background freezes on frame 0. Flip a
	// flag on the first gesture so the video-control effect below re-runs and retries play().
	let interacted = $state(false);
	$effect(() => {
		if (interacted) return;
		const onGesture = () => {
			interacted = true;
		};
		window.addEventListener('pointerdown', onGesture, { once: true });
		window.addEventListener('keydown', onGesture, { once: true });
		window.addEventListener('touchstart', onGesture, { once: true });
		return () => {
			window.removeEventListener('pointerdown', onGesture);
			window.removeEventListener('keydown', onGesture);
			window.removeEventListener('touchstart', onGesture);
		};
	});

	// Drive the animated bonus background videos: each loops + is muted, and plays only while its
	// bonus mode is active (paused otherwise so they don't decode in the background).
	$effect(() => {
		const mode = context.stateGame.bonusMode;
		interacted; // re-run after the first user gesture so a blocked play() gets retried
		const videoOf = (k: string) =>
			(context.stateApp.loadedAssets?.[k] as { source?: { resource?: HTMLVideoElement } } | undefined)
				?.source?.resource;
		for (const [key, active] of [
			['bonusSuperBgVideo', mode === 'superspin'],
			['bonusNormalBgVideo', mode === 'freegame'],
			// A single-spin FEATURE round keeps the base background (backgroundKey's default case), but
			// bonusMode is 'feature' throughout it and lingers until the next spin — so without 'feature'
			// here the base forest video would sit PAUSED (frozen) during the feature and the idle after.
			// Desktop only — mobile portrait/landscape now render static art, so the base video needn't decode.
			['baseBgVideo', (mode === null || mode === 'feature') && !isPortrait && !isLandscape],
		] as const) {
			const video = videoOf(key);
			if (!video || typeof video.play !== 'function') continue;
			video.loop = true;
			video.muted = true;
			video.playsInline = true;
			if (active) void video.play().catch(() => {});
			else video.pause();
		}
	});

	const aspect = $derived(
		isPortraitBase ? PORTRAIT_ASPECT : isLandscapeBase ? LANDSCAPE_ASPECT : BACKGROUND_ASPECT,
	);
	// The REAL painted area: on mobile the canvas is sized to the wrap div (100dvh) while
	// innerWidth/innerHeight track the visible viewport; when the browser toolbar is showing these
	// differ and a bg sized to innerHeight leaves an unpainted BLACK BAND at the canvas bottom.
	// Take the max of both (canvasSizes keeps this reactive; the renderer read is then fresh).
	const stage = $derived.by(() => {
		const renderer = (context.stateApp as { pixiApplication?: { renderer?: { screen?: { width: number; height: number } } } })
			?.pixiApplication?.renderer;
		return {
			width: Math.max(canvas.width, renderer?.screen?.width ?? 0),
			height: Math.max(canvas.height, renderer?.screen?.height ?? 0),
		};
	});
	const cover = $derived.by(() => {
		// +4% overscan for resize races (centred, so 2% bleed per edge).
		const width = stage.width * 1.04;
		const height = stage.height * 1.04;
		const canvasAspect = width / height;

		if (canvasAspect > aspect) {
			return { width, height: width / aspect };
		}

		return { width: height * aspect, height };
	});
</script>

<Sprite
	key={backgroundKey}
	x={stage.width * 0.5}
	y={stage.height * 0.5}
	anchor={0.5}
	width={cover.width}
	height={cover.height}
	alpha={0.96}
/>
<!-- Portrait top/bottom vignette REMOVED: it dimmed the bg's bright golden sunbeam behind the logo,
	 which read as a dark top (especially returning from the brighter bonus background). The sunbeam
	 itself frames the logo, and the logo art has its own outline, so no vignette is needed. -->

<Rectangle {...stage} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...stage} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

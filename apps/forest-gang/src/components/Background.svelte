<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const BACKGROUND_ASPECT = 1920 / 1080;
	const PORTRAIT_ASPECT = 360 / 800; // bg_mobile_portrait.jpg
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	// Portrait base game uses the dedicated portrait forest; bonus rounds keep their themed art.
	const isPortraitBase = $derived(isPortrait && context.stateGame.bonusMode === null);

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
				return isPortrait ? 'visualPortrait' : 'baseBgVideo';
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
			['baseBgVideo', (mode === null || mode === 'feature') && !isPortrait],
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

	const aspect = $derived(isPortraitBase ? PORTRAIT_ASPECT : BACKGROUND_ASPECT);
	const cover = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		const canvasAspect = width / height;

		if (canvasAspect > aspect) {
			return { width, height: width / aspect };
		}

		return { width: height * aspect, height };
	});
</script>

<Sprite
	key={backgroundKey}
	x={canvas.width * 0.5}
	y={canvas.height * 0.5}
	anchor={0.5}
	width={cover.width}
	height={cover.height}
	alpha={0.96}
/>
<!-- Portrait top/bottom vignette REMOVED: it dimmed the bg's bright golden sunbeam behind the logo,
	 which read as a dark top (especially returning from the brighter bonus background). The sunbeam
	 itself frames the logo, and the logo art has its own outline, so no vignette is needed. -->

<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

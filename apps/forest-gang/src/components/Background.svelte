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
	// Portrait/landscape base game uses dedicated static forest art; desktop and the bonus rounds
	// use the new-design static backgrounds.
	const isPortraitBase = $derived(isPortrait && context.stateGame.bonusMode === null);
	const isLandscapeBase = $derived(
		isLandscape && (context.stateGame.bonusMode === null || context.stateGame.bonusMode === 'feature'),
	);

	// Themed bonus backgrounds (new-design static art): golden forest for Deal It (freegame),
	// sunset forest for All In (superspin); everything else keeps the base forest.
	// The swap is instant here and masked by the alpha Transition overlay (TransitionAnimation).
	const backgroundKey = $derived.by(() => {
		switch (context.stateGame.bonusMode) {
			case 'freegame':
				return 'bonusNormalBackground';
			case 'superspin':
				return 'bonusSuperBackground';
			default:
				return isPortrait ? 'visualPortrait' : isLandscape ? 'baseBgLandscape' : 'baseBackground';
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

<!-- Single light veil: the redesign backgrounds are bright by design; the old 0.2+0.18
     double overlay muddied them and read as a dark band over the lower vignette. -->
<Rectangle {...stage} backgroundColor={0x050407} alpha={0.08} zIndex={-2} />

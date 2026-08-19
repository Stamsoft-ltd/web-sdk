<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	// Desktop and mobile-landscape share one 16:9 set (base forest + both bonus scenes); PORTRAIT
	// has its own tall paintings of the same three scenes. The 16:9 art `cover`-crops to ~26% of its
	// width on a phone, which throws most of the scene away — hence dedicated portrait art. (The old
	// bg_mobile_portrait is NOT it: that one still had the FOREST CASINO house painted in.)
	const BACKGROUND_ASPECT = 1920 / 1080;
	// Native aspect per key, so `cover` below crops each painting on its own terms.
	const BG_ASPECT: Record<string, number> = {
		baseBackground: BACKGROUND_ASPECT,
		bonusNormalBackground: BACKGROUND_ASPECT,
		bonusSuperBackground: BACKGROUND_ASPECT,
		portraitBase: 710 / 1428,
		portraitDealIt: 712 / 1550,
		portraitAllIn: 710 / 1546,
	};
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	// Driven by bonusBackgroundMode, NOT bonusMode. bonusMode is also assigned by
	// `bonusSymbolSelected`, which runs while the deer presenter is on screen with nothing covering
	// it — so the forest art swapped under the deer, in full view. bonusBackgroundMode is only
	// assigned where the transition veil covers the screen.
	const bonusBg = $derived(context.stateGame.bonusBackgroundMode);

	// Themed bonus backgrounds (new-design static art): golden forest for Deal It (freegame),
	// sunset forest for All In (superspin); everything else keeps the base forest.
	// The swap is instant here and masked by the alpha Transition overlay (TransitionAnimation).
	const backgroundKey = $derived.by(() => {
		// `feature` (Feature Spin) has no scene of its own and falls through to the base forest in
		// both sets, as it did before.
		if (isPortrait) {
			switch (bonusBg) {
				case 'freegame':
					return 'portraitDealIt';
				case 'superspin':
					return 'portraitAllIn';
				default:
					return 'portraitBase';
			}
		}
		switch (bonusBg) {
			case 'freegame':
				return 'bonusNormalBackground';
			case 'superspin':
				return 'bonusSuperBackground';
			default:
				return 'baseBackground';
		}
	});
	const aspect = $derived(BG_ASPECT[backgroundKey] ?? BACKGROUND_ASPECT);
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

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
				return 'bonusNormalBackground';
			case 'superspin':
				return 'bonusSuperBackground';
			default:
				return isPortrait ? 'visualPortrait' : 'visualV2';
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
<!-- Portrait: Figma top+bottom shadow drawn on top of the bg here (before the board/logo in
	 Game.svelte), so it darkens the scene but never the board, symbols, or HUD icons. -->
{#if isPortraitBase}
	<Sprite
		key="portraitShadow"
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={canvas.width}
		height={canvas.height}
	/>
{/if}
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

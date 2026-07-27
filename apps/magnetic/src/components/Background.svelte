<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const DESKTOP_ASPECT = 1920 / 1080;
	const MOBILE_ASPECT = 1440 / 3200; // tall portrait corridor art
	// Portrait uses the mobile (tall) backgrounds; the two special bonuses still swap:
	// SUPER (superspin), BONUS (freegame), else base.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const bgKey = $derived(
		context.stateGame.bonusMode === 'superspin'
			? isPortrait
				? 'bgMobileSuper'
				: 'bgSuper'
			: context.stateGame.bonusMode === 'freegame'
				? isPortrait
					? 'bgMobileBonus'
					: 'bgBonus'
				: isPortrait
					? 'bgMobileBase'
					: 'bgBase',
	);
	const aspect = $derived(isPortrait ? MOBILE_ASPECT : DESKTOP_ASPECT);
	// This component mounts before the gating asset pass finishes (it sits outside the loading-screen
	// branch in Game.svelte), and the portrait/landscape backgrounds are additionally deferred on the
	// layout the session did not start in. Drawing a key that isn't in loadedAssets yet logs an error
	// and paints an empty texture, so wait for it — the loading screen covers the stage meanwhile,
	// and after a rotate the previous background simply holds until the deferred one lands.
	const hasBg = $derived(!!context.stateApp.loadedAssets?.[bgKey]);
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
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

{#if hasBg}
	<Sprite
		key={bgKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={cover.width}
		height={cover.height}
		alpha={0.96}
	/>
{/if}
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

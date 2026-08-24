<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const aspect = 1678 / 937;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const showMascot = $derived(layoutType === 'desktop' || layoutType === 'landscape');
	const mascotHeight = $derived(canvas.height * 0.6);
	const mascotWidth = $derived(mascotHeight * (1019 / 1336));
	const key = $derived(
		context.stateGame.gameType === 'freegame' ? 'backgroundBonus' : 'backgroundBase',
	);
	const cover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > aspect
			? { width: canvas.width, height: canvas.width / aspect }
			: { width: canvas.height * aspect, height: canvas.height };
	});
</script>

<Rectangle {...canvas} backgroundColor={0x170905} zIndex={-3} />
<Sprite
	{key}
	x={canvas.width * 0.5}
	y={canvas.height * 0.5}
	anchor={0.5}
	width={cover.width}
	height={cover.height}
	zIndex={-2}
/>
<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
{#if showMascot}
	<Sprite
		key="mascot"
		x={canvas.width * 0.86}
		y={canvas.height * 0.59}
		anchor={0.5}
		width={mascotWidth}
		height={mascotHeight}
		zIndex={0}
	/>
{/if}

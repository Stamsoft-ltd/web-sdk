<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const BACKGROUND_ASPECT = 1920 / 1080;
	// Only the two special bonuses swap the background: 4th bonus (SUPER = superspin) -> bgSuper,
	// 3rd bonus (BONUS = freegame) -> bgBonus. Everything else (base / chance / feature) -> default.
	const bgKey = $derived(
		context.stateGame.bonusMode === 'superspin'
			? 'bgSuper'
			: context.stateGame.bonusMode === 'freegame'
				? 'bgBonus'
				: 'bgBase',
	);
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		const canvasAspect = width / height;

		if (canvasAspect > BACKGROUND_ASPECT) {
			return { width, height: width / BACKGROUND_ASPECT };
		}

		return { width: height * BACKGROUND_ASPECT, height };
	});
</script>

<Sprite
	key={bgKey}
	x={canvas.width * 0.5}
	y={canvas.height * 0.5}
	anchor={0.5}
	width={cover.width}
	height={cover.height}
	alpha={0.96}
/>
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

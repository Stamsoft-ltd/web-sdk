<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const BACKGROUND_ASPECT = 4800 / 2656;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	let driftX = $state(0);
	let driftY = $state(0);

	onMount(() => {
		let frame = 0;
		const started = performance.now();
		const tick = (now: number) => {
			const time = (now - started) / 1000;
			driftX = Math.sin(time * 0.12) * 7;
			driftY = Math.cos(time * 0.09) * 4;
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	});

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
	key="background"
	x={canvas.width * 0.5 + driftX}
	y={canvas.height * 0.5 + driftY}
	anchor={0.5}
	width={cover.width * 1.025}
	height={cover.height * 1.025}
	alpha={0.98}
/>
<Rectangle {...canvas} backgroundColor={0x050407} alpha={0.2} zIndex={-2} />
<Rectangle {...canvas} backgroundColor={0x000000} alpha={0.18} zIndex={-1} />

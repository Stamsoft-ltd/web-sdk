<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	type Direction = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
	type Props = {
		x: number; y: number; width: number; height: number; alpha?: number; zIndex?: number;
		direction: Direction | null; pulse: number; phase?: number;
	};
	const props: Props = $props();
	const arrowKeys: Record<Direction, string> = {
		LEFT: 'polarityArrowLeft', RIGHT: 'polarityArrowRight', UP: 'polarityArrowUp', DOWN: 'polarityArrowDown',
	};
	let scale = $state(0.78);
	let opacity = $state(0.35);
	$effect(() => {
		const started = performance.now();
		const pulse = props.pulse;
		let raf = 0;
		const tick = () => {
			const elapsed = (performance.now() - started) / 1000;
			const t = Math.min(1, elapsed / 0.6);
			const eased = 1 - Math.pow(1 - t, 3);
			scale = 0.78 + Math.sin(eased * Math.PI) * 0.22;
			opacity = 0.35 + Math.sin(eased * Math.PI) * 0.65;
			if (t < 1 && pulse === props.pulse) raf = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(raf);
	});
	const direction = $derived(props.direction);
	const key = $derived(direction ? arrowKeys[direction] : null);
</script>

{#if key}
<Sprite
	{key}
	x={props.x}
	y={props.y}
	anchor={{ x: 0.5, y: 0.5 }}
	width={props.width * scale}
	height={props.height * scale}
	alpha={(props.alpha ?? 1) * opacity}
	zIndex={props.zIndex}
/>
{/if}

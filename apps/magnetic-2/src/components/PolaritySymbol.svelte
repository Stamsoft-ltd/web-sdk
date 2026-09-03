<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	type Direction = 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
	type Props = {
		x: number;
		y: number;
		width: number;
		height: number;
		alpha?: number;
		zIndex?: number;
		direction: Direction | null;
		pulse: number;
		phase?: number;
	};
	const props: Props = $props();
	const directionKeys: Record<Direction, string> = {
		LEFT: 'polarityLeft',
		RIGHT: 'polarityRight',
		UP: 'polarityUp',
		DOWN: 'polarityDown',
	};
	let scale = $state(0.92);
	let offsetX = $state(0);
	let offsetY = $state(0);
	$effect(() => {
		if (props.pulse === 0) return;
		const started = performance.now();
		const pulse = props.pulse;
		let raf = 0;
		const tick = () => {
			const elapsed = (performance.now() - started) / 1000;
			const t = Math.min(1, elapsed / 0.52);
			const eased = 1 - Math.pow(1 - t, 3);
			const charge = Math.sin(eased * Math.PI);
			const shake = Math.sin(t * Math.PI * 12) * (1 - t) * 3;
			scale = 0.92 + charge * 0.18;
			offsetX = props.direction === 'LEFT' || props.direction === 'RIGHT' ? shake : 0;
			offsetY = props.direction === 'UP' || props.direction === 'DOWN' ? shake : 0;
			if (t < 1 && pulse === props.pulse) raf = requestAnimationFrame(tick);
		};
		tick();
		return () => {
			cancelAnimationFrame(raf);
			scale = 0.92;
			offsetX = 0;
			offsetY = 0;
		};
	});
	const direction = $derived(props.direction);
	const key = $derived(direction ? directionKeys[direction] : 'polarityNeutral');
</script>

<Sprite
	{key}
	x={props.x + offsetX}
	y={props.y + offsetY}
	anchor={{ x: 0.5, y: 0.5 }}
	width={props.width * scale}
	height={props.height * scale}
	alpha={props.alpha ?? 1}
	zIndex={props.zIndex}
/>

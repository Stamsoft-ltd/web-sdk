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
	let shownDirection = $state<Direction | null>(null);
	$effect(() => {
		if (props.pulse === 0 || !props.direction) {
			shownDirection = null;
			return;
		}
		const started = performance.now();
		const pulse = props.pulse;
		const selected = props.direction;
		const roulette: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
		const rouletteMs = 320;
		const stepMs = rouletteMs / roulette.length;
		let raf = 0;
		const tick = () => {
			const elapsedMs = performance.now() - started;
			const t = Math.min(1, elapsedMs / 520);
			const eased = 1 - Math.pow(1 - t, 3);
			shownDirection =
				elapsedMs < rouletteMs
					? roulette[Math.min(roulette.length - 1, Math.floor(elapsedMs / stepMs))]
					: selected;
			const stepT = (elapsedMs % stepMs) / stepMs;
			const flash = elapsedMs < rouletteMs ? Math.sin(stepT * Math.PI) : 0;
			const charge = Math.sin(eased * Math.PI) + flash * 0.45;
			const shake = Math.sin(t * Math.PI * 12) * (1 - t) * 3;
			scale = 0.92 + charge * 0.14;
			offsetX = shownDirection === 'LEFT' || shownDirection === 'RIGHT' ? shake : 0;
			offsetY = shownDirection === 'UP' || shownDirection === 'DOWN' ? shake : 0;
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
	const key = $derived(shownDirection ? directionKeys[shownDirection] : 'polarityNeutral');
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

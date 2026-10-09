<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		/** win level (6 SWEET … 10 LEGENDARY): more food, flung harder, the bigger the win */
		level: number;
	};
	const props: Props = $props();
	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Big-win food chaos (Win.svelte, behind the win plaque): the menu is flung up from below the
	// screen — burgers, sausages, cheese, onion rings, sauce bottles — tumbling over and falling away,
	// relaunched on a loop for as long as the win screen is up. Deterministic off the clock.
	const FOODS = ['mcH1', 'mcH3', 'mcH4', 'mcH5', 'mcL1', 'mcL3', 'mcL5', 'mcH1', 'mcH3', 'mcL2', 'mcL4'];
	// a few pieces for SWEET, building to a storm for LEGENDARY
	const COUNT_BY_LEVEL: Record<number, number> = { 6: 4, 7: 8, 8: 14, 9: 22, 10: 32 };
	const CYCLE_MS = 2300;
	const count = $derived(COUNT_BY_LEVEL[props.level] ?? 4);

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			clock = ts - start;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const hash = (n: number) => {
		const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
		return x - Math.floor(x);
	};
	const items = $derived.by(() => {
		const W = canvas.width;
		const H = canvas.height;
		const g = H * 1.9; // px/s²
		// Piece size follows the screen height, but no more than 1.25 × its width: on a tall phone
		// the height alone made each burger as big as the win plaque (the arcs still use the height).
		const S = Math.min(H, W * 1.25);
		return Array.from({ length: count }, (_, i) => {
			// each item relaunches every cycle, staggered; the first wave fills in over ~0.6s
			const offset = (i / count) * CYCLE_MS;
			const tt = clock - offset * 0.35;
			if (tt < 0) return null;
			const k = Math.floor(tt / CYCLE_MS);
			const t = (tt % CYCLE_MS) / 1000;
			const seed = i * 7.1 + k * 31.7;
			const x0 = W * (0.08 + 0.84 * hash(seed));
			const vx = (W * 0.5 - x0) * (0.25 + 0.35 * hash(seed + 1)) + W * 0.12 * (hash(seed + 2) - 0.5);
			const vy = -H * (1.35 + 0.35 * hash(seed + 3)) * (props.level >= 9 ? 1.08 : 1);
			const size = S * (0.07 + 0.045 * hash(seed + 4));
			const y = H + size + vy * t + 0.5 * g * t * t;
			if (y > H + size * 1.2 && t > 0.5) return null;
			return {
				key: FOODS[Math.floor(hash(seed + 5) * FOODS.length)],
				x: x0 + vx * t,
				y,
				size,
				rot: (hash(seed + 6) - 0.5) * 7 * t,
			};
		});
	});
</script>

<Container>
	{#each items as it, i (i)}
		{#if it}
			<Sprite key={it.key} x={it.x} y={it.y} anchor={0.5} width={it.size} height={it.size} rotation={it.rot} />
		{/if}
	{/each}
</Container>

<script lang="ts" module>
	// Burger (H1) reassembled from its layers. Each layer is a separate sprite so it can move
	// independently, giving the symbol a subtle "alive" idle when it's winning (a win line runs
	// over it, or it's locked with the light background during free games).
	//
	// Layout is baked from the source parts (see scratchpad/assemble.py): the assembled burger's
	// tight bounding box is `ASPECT` wide-to-tall, and every layer is placed by its normalized
	// centre (nx, ny) and size (nw, nh) inside that box, drawn back-to-front.
	const ASPECT = 1.989;
	type Layer = {
		key: string;
		nx: number;
		ny: number;
		nw: number;
		nh: number;
		// idle-motion tuning (fractions of the burger height / radians)
		dy: number;
		dx: number;
		rot: number;
		freq: number;
		phase: number;
	};
	const LAYERS: Layer[] = [
		// back -> front
		{ key: 'burgerBunBottom', nx: 0.5006, ny: 0.7523, nw: 0.8879, nh: 0.4906, dy: 0.006, dx: 0, rot: 0, freq: 1.0, phase: 0.0 },
		{ key: 'burgerPatty', nx: 0.4997, ny: 0.685, nw: 0.8886, nh: 0.6057, dy: 0.012, dx: 0, rot: 0.006, freq: 1.15, phase: 0.6 },
		{ key: 'burgerCheese', nx: 0.5, ny: 0.7274, nw: 1.0, nh: 0.5451, dy: 0.018, dx: 0.006, rot: 0.01, freq: 1.35, phase: 1.1 },
		{ key: 'burgerOnion', nx: 0.4985, ny: 0.6935, nw: 0.8752, nh: 0.4094, dy: 0.022, dx: 0.01, rot: 0.014, freq: 1.5, phase: 1.9 },
		{ key: 'burgerTomato', nx: 0.5003, ny: 0.7159, nw: 0.9068, nh: 0.4712, dy: 0.026, dx: 0.008, rot: 0.012, freq: 1.7, phase: 2.6 },
		{ key: 'burgerLettuce', nx: 0.5, ny: 0.6075, nw: 0.9659, nh: 0.4361, dy: 0.03, dx: 0.02, rot: 0.02, freq: 2.1, phase: 3.4 },
		{ key: 'burgerBunTop', nx: 0.5, ny: 0.3713, nw: 0.8118, nh: 0.7426, dy: 0.05, dx: 0.004, rot: 0.01, freq: 1.25, phase: 4.2 },
	];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import type { SymbolState } from '../game/types';

	type Props = {
		x?: number;
		y?: number;
		scale?: number; // symbol size ratio (matches the other symbols' sizeRatios)
		state?: SymbolState;
		winning?: boolean;
		oncomplete?: () => void;
	};
	const props: Props = $props();

	// Preserve SymbolSprite's contract: resolve the win-presentation await immediately so the round
	// never blocks on the burger (its idle animation is decorative, driven separately below).
	onMount(() => props.oncomplete?.());
	$effect(() => {
		props.state;
		props.oncomplete?.();
	});

	// Fit the burger to the cell by width (it's a wide, flat shape); a hair over 1 so it reads as
	// prominently as the other symbols.
	const FIT = 1.14;
	const bw = $derived(SYMBOL_WIDTH * (props.scale ?? 0.96) * FIT);
	const bh = $derived(bw / ASPECT);
	// Keep vertical footprint within the cell.
	const clampScale = $derived(Math.min(1, (SYMBOL_SIZE * (props.scale ?? 0.96)) / bh));
	const w = $derived(bw * clampScale);
	const h = $derived(bh * clampScale);

	// Idle clock + eased amplitude. Kept as plain locals (not $state) so the rAF loop can update them
	// without retriggering effects; `frame` is the single reactive tick the layer math reads.
	let t = 0;
	let amp = 0;
	let holdUntil = 0;
	let frame = $state(0);

	// A win line only holds the 'win' state briefly (oncomplete resolves at once), so latch a minimum
	// animation window whenever `winning` rises. Locked cells keep `winning` true the whole time.
	// The loop only runs while there's motion to show, so idle burgers cost nothing.
	let running = $state(false);
	$effect(() => {
		if (props.winning) {
			holdUntil = performance.now() + 1100;
			running = true;
		}
	});

	$effect(() => {
		if (!running) return;
		let raf = 0;
		let last = 0;
		const loop = (ts: number) => {
			if (!last) last = ts;
			const dt = Math.min(0.05, (ts - last) / 1000);
			last = ts;
			t += dt;
			const active = props.winning || ts < holdUntil;
			const target = active ? 1 : 0;
			const rate = target > amp ? dt * 9 : dt * 3; // quick to wake, slow to settle
			amp += (target - amp) * Math.min(1, rate);
			frame = t; // one reactive write per frame drives the layer math
			if (!active && amp < 0.002) {
				amp = 0;
				frame = t;
				running = false; // settle to rest and stop the loop
				return;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const layers = $derived.by(() => {
		const time = frame; // reactive tick — recomputes the layout each animated frame
		return LAYERS.map((l) => {
			const wob = amp * Math.sin(time * l.freq + l.phase);
			const wob2 = amp * Math.sin(time * l.freq * 0.73 + l.phase * 1.3);
			return {
				key: l.key,
				x: (props.x ?? 0) + (l.nx - 0.5) * w + l.dx * h * wob2,
				y: (props.y ?? 0) + (l.ny - 0.5) * h - l.dy * h * wob,
				width: l.nw * w,
				height: l.nh * h,
				rotation: l.rot * wob,
			};
		});
	});
</script>

<Container>
	{#each layers as l (l.key)}
		<Sprite
			key={l.key}
			x={l.x}
			y={l.y}
			anchor={0.5}
			width={l.width}
			height={l.height}
			rotation={l.rotation}
		/>
	{/each}
</Container>

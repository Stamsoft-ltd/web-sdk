<script lang="ts" module>
	// Burger (H1) reassembled from its layers. Each layer is a separate sprite so it can move
	// independently, giving the symbol a subtle "alive" idle when it's winning (a win line runs
	// over it, or it's locked with the light background during free games).
	//
	// Layout is baked from the source parts (see scratchpad/assemble.py): the assembled burger's
	// tight bounding box is `ASPECT` wide-to-tall, and every layer is placed by its normalized
	// centre (nx, ny) and size (nw, nh) inside that box, drawn back-to-front.
	const ASPECT = 1.077;
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
		// back -> front. Layout fans the parts into the original burger's visible bands so every
		// layer shows (bun / lettuce / tomato / onion / cheese / patty / bottom bun).
		{ key: 'burgerBunBottom', nx: 0.5, ny: 0.8587, nw: 0.9453, nh: 0.2826, dy: 0.004, dx: 0, rot: 0, freq: 1.0, phase: 0.0 },
		{ key: 'burgerPatty', nx: 0.5, ny: 0.7389, nw: 1.0, nh: 0.3694, dy: 0.008, dx: 0, rot: 0.004, freq: 1.15, phase: 0.6 },
		{ key: 'burgerCheese', nx: 0.5, ny: 0.662, nw: 0.9435, nh: 0.2786, dy: 0.012, dx: 0.005, rot: 0.008, freq: 1.35, phase: 1.1 },
		{ key: 'burgerOnion', nx: 0.5, ny: 0.6191, nw: 0.7322, nh: 0.1847, dy: 0.016, dx: 0.008, rot: 0.01, freq: 1.5, phase: 1.9 },
		{ key: 'burgerTomato', nx: 0.5, ny: 0.5921, nw: 0.8276, nh: 0.2327, dy: 0.018, dx: 0.006, rot: 0.01, freq: 1.7, phase: 2.6 },
		{ key: 'burgerLettuce', nx: 0.5, ny: 0.5092, nw: 0.8981, nh: 0.2197, dy: 0.024, dx: 0.016, rot: 0.016, freq: 2.1, phase: 3.4 },
		{ key: 'burgerBunTop', nx: 0.5, ny: 0.2396, nw: 0.9685, nh: 0.4793, dy: 0.03, dx: 0.003, rot: 0.008, freq: 1.2, phase: 4.2 },
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

	// Fit the burger into the flat H1 sprite's box, then trim a little so it reads a touch smaller
	// than the cell (the reassembled art has no built-in padding, unlike the other symbol PNGs).
	const FIT = 0.82;
	const boxW = $derived(SYMBOL_WIDTH * (props.scale ?? 0.96) * FIT);
	const boxH = $derived(SYMBOL_SIZE * (props.scale ?? 0.96) * FIT);
	const h = $derived(Math.min(boxH, boxW / ASPECT));
	const w = $derived(h * ASPECT);

	// One-shot "come alive" animation: a damped wobble that plays ONCE each time the symbol becomes
	// active (a win line lands, or it first locks), then settles to rest — it does not loop.
	const DURATION = 900; // ms
	let animStart = -1; // performance.now() of the current play, -1 when idle
	let frame = $state(0); // reactive tick driving the layer math
	let disp = 0; // 0..1 current displacement envelope

	// Fire on the rising edge of `winning`.
	let prevWinning = false;
	$effect(() => {
		const now = props.winning ?? false;
		if (now && !prevWinning) play();
		prevWinning = now;
	});

	let running = $state(false);
	function play() {
		animStart = performance.now();
		if (!running) running = true;
	}
	$effect(() => {
		if (!running) return;
		let raf = 0;
		const loop = (ts: number) => {
			const p = animStart < 0 ? 1 : (ts - animStart) / DURATION;
			if (p >= 1) {
				disp = 0;
				frame = ts;
				animStart = -1;
				running = false; // rest until the next activation
				return;
			}
			// decaying oscillation: a couple of springy bounces that fade out
			disp = Math.exp(-3.2 * p) * (1 - p);
			frame = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const layers = $derived.by(() => {
		const p = animStart < 0 ? 1 : (frame - animStart) / DURATION;
		return LAYERS.map((l) => {
			// each layer oscillates a couple of times over the one-shot, offset by its phase
			const osc = Math.sin(p * Math.PI * 2 * l.freq + l.phase);
			const wob = disp * osc;
			return {
				key: l.key,
				x: (props.x ?? 0) + (l.nx - 0.5) * w + l.dx * h * wob,
				y: (props.y ?? 0) + (l.ny - 0.5) * h - l.dy * h * wob * 3,
				width: l.nw * w,
				height: l.nh * h,
				rotation: l.rot * wob * 2,
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

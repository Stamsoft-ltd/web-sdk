<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import type { SymbolPartsConfig } from '../game/symbolParts';
	import type { SymbolState } from '../game/types';

	// A symbol reassembled from layered part sprites (see symbolParts.ts). It plays a one-shot
	// "come alive" animation each time it becomes active (a win line lands, or it locks), then rests.

	type Props = {
		config: SymbolPartsConfig;
		x?: number;
		y?: number;
		scale?: number; // symbol size ratio (matches the other symbols' sizeRatios)
		state?: SymbolState;
		winning?: boolean;
		oncomplete?: () => void;
	};
	const props: Props = $props();

	// Preserve SymbolSprite's contract: resolve the win-presentation await immediately so the round
	// never blocks on this symbol (its animation is decorative, driven separately below).
	onMount(() => props.oncomplete?.());
	$effect(() => {
		props.state;
		props.oncomplete?.();
	});

	// Fit into the flat sprite's box, trimmed by the config's `fit` (the reassembled art has no
	// built-in padding, unlike the other symbol PNGs), preserving aspect so it reads at cell size.
	const boxW = $derived(SYMBOL_WIDTH * (props.scale ?? 0.96) * props.config.fit);
	const boxH = $derived(SYMBOL_SIZE * (props.scale ?? 0.96) * props.config.fit);
	const h = $derived(Math.min(boxH, boxW / props.config.aspect));
	const w = $derived(h * props.config.aspect);

	// One-shot damped wobble: plays ONCE per activation, then settles. Does not loop.
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
		// Whole-symbol squash-stretch (gives one-piece symbols life): stretch tall / squeeze wide.
		const sq = (props.config.squash ?? 0) * disp * Math.sin(p * Math.PI * 2 * 1.5);
		const sx = 1 - sq;
		const sy = 1 + sq;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		return props.config.layers.map((l) => {
			const osc = Math.sin(p * Math.PI * 2 * l.freq + l.phase);
			const wob = disp * osc;
			const ox = (l.nx - 0.5) * w + l.dx * h * wob;
			const oy = (l.ny - 0.5) * h - l.dy * h * wob * 3;
			return {
				key: l.key,
				x: cx + ox * sx,
				y: cy + oy * sy,
				width: l.nw * w * sx,
				height: l.nh * h * sy,
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

<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import type { SymbolPartsConfig } from '../game/symbolParts';
	import type { SymbolState } from '../game/types';

	// A symbol reassembled from layered part sprites (see symbolParts.ts). When it becomes active
	// (locks / wins), it plays a single "come alive" pass — each layer travels out along its own
	// (dx, dy) offset and rotates by `rot`, then returns (a smooth out-and-back), so e.g. the burger
	// separates and reassembles, the spoon stirs, a cap/straw rotates. It plays ONCE, then rests.

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

	// Preserve SymbolSprite's contract: resolve the win-presentation await immediately.
	onMount(() => props.oncomplete?.());
	$effect(() => {
		props.state;
		props.oncomplete?.();
	});

	const boxW = $derived(SYMBOL_WIDTH * (props.scale ?? 0.96) * props.config.fit);
	const boxH = $derived(SYMBOL_SIZE * (props.scale ?? 0.96) * props.config.fit);
	const h = $derived(Math.min(boxH, boxW / props.config.aspect));
	const w = $derived(h * props.config.aspect);

	const DURATION = 1150; // ms
	// Everything the layer math reads is $state so the render tracks the animation reliably.
	let clock = $state(0); // rAF timestamp
	let animStart = $state(-1); // start of the current play (-1 = at rest)
	let running = $state(false);
	let prevWinning = false;

	function play() {
		animStart = performance.now();
		clock = animStart;
		running = true;
	}
	// Fire once on the rising edge of `winning`.
	$effect(() => {
		const now = props.winning ?? false;
		if (now && !prevWinning) play();
		prevWinning = now;
	});
	$effect(() => {
		if (!running) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			if (animStart >= 0 && ts - animStart >= DURATION) {
				animStart = -1; // settle to rest
				running = false; // stop the loop until the next activation
				return;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const layers = $derived.by(() => {
		const p = animStart < 0 ? 1 : Math.min(1, Math.max(0, (clock - animStart) / DURATION));
		// Out-and-back: 0 → 1 → 0, with a touch of overshoot near the end so it "clicks" back.
		const env = animStart < 0 ? 0 : Math.sin(Math.PI * p) * (1 + 0.12 * Math.sin(Math.PI * 2 * p));
		const sq = (props.config.squash ?? 0) * env;
		const sx = 1 - sq;
		const sy = 1 + sq;
		const cx = props.x ?? 0;
		const cy = props.y ?? 0;
		return props.config.layers.map((l) => {
			const ox = (l.nx - 0.5) * w + (l.dx ?? 0) * w * env;
			const oy = (l.ny - 0.5) * h + (l.dy ?? 0) * h * env;
			return {
				key: l.key,
				x: cx + ox * sx,
				y: cy + oy * sy,
				width: l.nw * w * sx,
				height: l.nh * h * sy,
				rotation: (l.rot ?? 0) * env,
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

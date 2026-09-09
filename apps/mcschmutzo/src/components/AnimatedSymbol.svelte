<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import type { SymbolPartsConfig } from '../game/symbolParts';
	import type { SymbolState } from '../game/types';

	// A symbol reassembled from layered part sprites (see symbolParts.ts). While it is active
	// (locked / winning — "yellow"), it keeps animating on a loop: each layer travels out along its
	// own (dx, dy) offset and rotates by `rot`, then back, over and over (burger separates and
	// reassembles, spoon stirs, cap/straw rotates, rings tumble). It runs until the symbol is no
	// longer active (the next turn clears the lock), then settles to rest.

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

	const PERIOD = 1400; // ms per loop cycle (out and back)
	// Everything the layer math reads is $state so the render tracks the animation reliably.
	let clock = $state(0); // rAF timestamp
	let startTime = $state(-1); // when the active loop began (-1 = at rest)
	let running = $state(false);

	// Run the loop for as long as the symbol is active; stop (settle) when it isn't.
	$effect(() => {
		if (props.winning) {
			if (!running) {
				startTime = performance.now();
				clock = startTime;
				running = true;
			}
		} else if (running) {
			running = false;
			startTime = -1;
		}
	});
	$effect(() => {
		if (!running) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	const layers = $derived.by(() => {
		const active = running && startTime >= 0;
		const frac = active ? (((clock - startTime) / PERIOD) % 1) : 0;
		// Smooth loop 0 → 1 → 0 with zero velocity at the seam (no jerk between cycles).
		const env = active ? (1 - Math.cos(Math.PI * 2 * frac)) / 2 : 0;
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

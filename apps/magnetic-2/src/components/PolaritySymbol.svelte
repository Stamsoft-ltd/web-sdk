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
	const glowKeys: Record<Direction, string> = {
		LEFT: 'polarityGlowLeft',
		RIGHT: 'polarityGlowRight',
		UP: 'polarityGlowUp',
		DOWN: 'polarityGlowDown',
	};
	let scale = $state(0.94);
	let glowAlpha = $state(0);
	let shownDirection = $state<Direction | null>(null);
	$effect(() => {
		if (props.pulse === 0 || !props.direction) {
			shownDirection = null;
			glowAlpha = 0;
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
			const flash = Math.sin(stepT * Math.PI);
			const selectedT = Math.max(0, Math.min(1, (elapsedMs - rouletteMs) / 200));
			glowAlpha =
				elapsedMs < rouletteMs ? 0.48 + flash * 0.52 : 0.72 + selectedT * 0.28;
			scale = 0.94 + Math.sin(eased * Math.PI) * 0.05;
			if (t < 1 && pulse === props.pulse) raf = requestAnimationFrame(tick);
		};
		tick();
		return () => {
			cancelAnimationFrame(raf);
			scale = 0.94;
		};
	});
	const glowKey = $derived(shownDirection ? glowKeys[shownDirection] : null);
	/**
	 * The polarity art is 336x341 -- all but square, where every other symbol is drawn on the shared
	 * 328x264 canvas. Filling the cell box with it stretched the lockup 23% wide, which is the
	 * squashed pad it read as on the board. So the box is FITTED, not filled: the art keeps its own
	 * aspect and takes whichever of the two dimensions runs out first.
	 */
	const ART_ASPECT = 336 / 341;
	const artW = $derived(Math.min(props.width, props.height * ART_ASPECT) * scale);
	const artH = $derived(artW / ART_ASPECT);
</script>

<Sprite
	key="polarityNeutral"
	x={props.x}
	y={props.y}
	anchor={{ x: 0.5, y: 0.5 }}
	width={artW}
	height={artH}
	alpha={props.alpha ?? 1}
	zIndex={props.zIndex}
/>
{#if glowKey}
	<Sprite
		key={glowKey}
		x={props.x}
		y={props.y}
		anchor={{ x: 0.5, y: 0.5 }}
		width={artW}
		height={artH}
		alpha={(props.alpha ?? 1) * glowAlpha}
		blendMode="add"
		zIndex={(props.zIndex ?? 0) + 1}
	/>
{/if}

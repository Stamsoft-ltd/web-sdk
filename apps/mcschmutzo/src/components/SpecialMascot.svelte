<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Composition sits on the right, tucked under the board's bottom-right (behind it).
	const cx = $derived(canvas.width * 0.8);
	const guyHeight = $derived(canvas.height * 0.52);
	const guyWidth = $derived(guyHeight * (1113 / 1186));
	const guyY = $derived(canvas.height * 0.52);
	const potWidth = $derived(guyWidth * 1.06);
	const potHeight = $derived(potWidth * (848 / 1180));
	const potY = $derived(canvas.height * 0.82);

	// Salt shaker spout (upper-left of the guy) → the pot's mouth (a gentle diagonal drift).
	const saltTopX = $derived(cx - guyWidth * 0.21);
	const saltTopY = $derived(guyY - guyHeight * 0.04);
	const saltBotX = $derived(cx - guyWidth * 0.12);
	const saltBotY = $derived(potY - potHeight * 0.18);
	const grain = $derived(Math.max(2.5, canvas.height * 0.006));

	// Looping fall — each grain is offset in phase so the stream is continuous.
	const COUNT = 12;
	let phase = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			phase = (((ts - start) / 1100) % 1 + 1) % 1;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const grains = $derived(
		Array.from({ length: COUNT }, (_, i) => {
			const p = (phase + i / COUNT) % 1;
			// even (linear) stream drifting toward the pot, with a little scatter.
			const x = saltTopX + (saltBotX - saltTopX) * p + Math.sin(i * 12.9) * grain * 1.3;
			const y = saltTopY + (saltBotY - saltTopY) * p;
			const alpha = p < 0.08 ? p / 0.08 : p > 0.92 ? (1 - p) / 0.08 : 1;
			return { x, y, alpha };
		}),
	);
</script>

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. -->
<Sprite
	key="specialGuy"
	x={cx}
	y={guyY}
	anchor={0.5}
	width={guyWidth}
	height={guyHeight}
	zIndex={0}
/>
{#each grains as g}
	<Rectangle
		x={g.x}
		y={g.y}
		width={grain}
		height={grain}
		radius={grain * 0.5}
		backgroundColor={0xfffdf5}
		alpha={g.alpha * 0.95}
		zIndex={1}
	/>
{/each}
<Sprite
	key="specialPot"
	x={cx + guyWidth * 0.02}
	y={potY}
	anchor={0.5}
	width={potWidth}
	height={potHeight}
	zIndex={2}
/>

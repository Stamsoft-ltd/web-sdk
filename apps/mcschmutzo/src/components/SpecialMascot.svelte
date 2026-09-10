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
	const COUNT = 40;
	let phase = $state(0);
	let idle = $state(0); // seconds — slow idle for the chef's breath/sway
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			phase = ((((ts - start) / 1200) % 1) + 1) % 1;
			idle = (ts - start) / 1000;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Subtle "alive" idle: a slow breath, gentle bob and sway.
	const breatheW = $derived(1 + 0.008 * Math.sin(idle * 1.7));
	const breatheH = $derived(1 + 0.016 * Math.sin(idle * 1.7));
	const guyBob = $derived(Math.sin(idle * 1.25) * guyHeight * 0.01);
	const guySway = $derived(Math.sin(idle * 0.85) * 0.013);
	const grains = $derived(
		Array.from({ length: COUNT }, (_, i) => {
			const p = (phase + i / COUNT) % 1;
			// Fine sprinkle: fans out into a cone as it falls + gentle gravity acceleration.
			const dir = Math.sin(i * 2.3999); // deterministic spread direction (-1..1)
			const spread = grain * (1 + p * 4.5);
			const ease = p * (0.5 + 0.5 * p);
			const x = saltTopX + (saltBotX - saltTopX) * p + dir * spread;
			const y = saltTopY + (saltBotY - saltTopY) * ease;
			const size = grain * (0.5 + ((i * 7) % 5) * 0.2); // varied grain sizes
			const fade = Math.min(1, p / 0.1) * (p > 0.8 ? Math.max(0, (1 - p) / 0.2) : 1);
			const alpha = fade * (0.6 + (i % 3) * 0.15);
			return { x, y, size, alpha };
		}),
	);
</script>

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. -->
<Sprite
	key="specialGuy"
	x={cx}
	y={guyY + guyBob}
	anchor={0.5}
	width={guyWidth * breatheW}
	height={guyHeight * breatheH}
	rotation={guySway}
	zIndex={0}
/>
{#each grains as g}
	<Rectangle
		x={g.x}
		y={g.y}
		width={g.size}
		height={g.size}
		radius={g.size * 0.5}
		backgroundColor={0xfffdf5}
		alpha={g.alpha}
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

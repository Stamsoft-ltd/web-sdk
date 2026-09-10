<script lang="ts">
	import { Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import AnimatedGuy from './AnimatedGuy.svelte';

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
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			phase = ((((ts - start) / 1200) % 1) + 1) % 1;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Chef stands still; only his eyes move (AnimatedGuy).
	const specialPupils = [
		{ key: 'specialPupilL', nx: 0.4259, ny: 0.3212, nw: 0.0593, nh: 0.0624 },
		{ key: 'specialPupilR', nx: 0.5247, ny: 0.3196, nw: 0.0755, nh: 0.0641 },
	];
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
<AnimatedGuy
	baseKey="specialBase"
	x={cx}
	y={guyY}
	width={guyWidth}
	height={guyHeight}
	zIndex={0}
	pupils={specialPupils}
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

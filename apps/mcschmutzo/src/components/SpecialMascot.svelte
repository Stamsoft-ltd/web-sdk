<script lang="ts">
	import { Container, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import AnimatedGuy from './AnimatedGuy.svelte';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());

	// Pupils + eye-cover boxes (measured from the cut special art) so the salting chef also glances +
	// blinks. Skin tone sampled by his eyes.
	const specialPupils = [
		{ key: 'specialPupilL', nx: 0.4313, ny: 0.3208, nw: 0.0539, nh: 0.0666 },
		{ key: 'specialPupilR', nx: 0.5301, ny: 0.3175, nw: 0.0701, nh: 0.0582 },
	];
	const specialLids = [
		{ cx: 0.43, cy: 0.321, w: 0.072, h: 0.082 },
		{ cx: 0.533, cy: 0.314, w: 0.088, h: 0.086 },
	];

	// Composition sits on the right, BEHIND the board — shifted right so the raised salt shaker
	// clears the board's right edge instead of being hidden behind it.
	const cx = $derived(canvas.width * 0.85);
	const guyHeight = $derived(canvas.height * 0.52);
	const guyWidth = $derived(guyHeight * (1113 / 1186));
	const guyY = $derived(canvas.height * 0.52);
	const potWidth = $derived(guyWidth * 1.06);
	const potHeight = $derived(potWidth * (848 / 1180));
	const potY = $derived(canvas.height * 0.82);

	// Clock: drives both the salt fall (phase) and the chef's idle breathe (elapsed).
	const COUNT = 40; // salt grains
	let phase = $state(0);
	let elapsed = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			elapsed = ts - start;
			phase = (((elapsed / 1200) % 1) + 1) % 1;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Subtle idle breathe/bob for the chef (he's mid-salt, so no big lean — just a living breath). The
	// pot stays planted on the ground; only the guy + his salt origin drift.
	const guyPose = $derived(
		mascotIdle(elapsed, cx, guyY, guyWidth, guyHeight, { sway: 0, breathe: 0.005, bob: 0.004 }),
	);
	const guyDy = $derived(guyPose.y - guyY); // vertical drift, applied to the salt spout too

	// Salt shaker spout (upper-left of the guy) → the pot's mouth (a gentle diagonal drift). The spout
	// rides with the chef's breathe so the stream stays glued to the shaker.
	const saltTopX = $derived(cx - guyWidth * 0.21);
	const saltTopY = $derived(guyY - guyHeight * 0.04 + guyDy);
	const saltBotX = $derived(cx - guyWidth * 0.12);
	const saltBotY = $derived(potY - potHeight * 0.18);
	const grain = $derived(Math.max(2.5, canvas.height * 0.006));
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

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. The whole group
     sits BEHIND the board (negative zIndex) but in front of the background. -->
<Container zIndex={-0.5}>
	<AnimatedGuy
		baseKey="specialBase"
		x={guyPose.x}
		y={guyPose.y}
		width={guyPose.width}
		height={guyPose.height}
		zIndex={0}
		pupils={specialPupils}
		lids={specialLids}
		skin={0xef9650}
		phase={2000}
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
</Container>

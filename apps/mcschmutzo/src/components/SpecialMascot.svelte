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

	// The whole hand+shaker+forearm (a CLEAN designer layer, only-hand.svg — the base has exactly this
	// region removed) FLICKS about the elbow in a sprinkling rhythm; the salt releases on the down-flick
	// so the arm and the falling salt read as one action. It's a full-frame sprite (same footprint as
	// the base) rotated about the elbow, so there's no cut edge in the middle of the arm to seam.
	const SHAKE_PERIOD = 560; // ms per flick
	const SHAKE_AMP = 0.045; // rad (~2.6°) about the elbow — a gentle sprinkling flick
	const shakeP = $derived((elapsed % SHAKE_PERIOD) / SHAKE_PERIOD);
	const armAngle = $derived(SHAKE_AMP * Math.sin(2 * Math.PI * shakeP)); // + = flick down (cap dips)

	const chefL = $derived(guyPose.x - guyPose.width / 2);
	const chefT = $derived(guyPose.y - guyPose.height / 2);
	// Elbow pivot (chef fractions) — where the forearm meets the upper arm.
	const PIVX = 0.389;
	const PIVY = 0.696;
	const pivotX = $derived(chefL + PIVX * guyPose.width);
	const pivotY = $derived(chefT + PIVY * guyPose.height);

	// Salt spout = the shaker cap, carried around the elbow by the flick so the stream stays glued to
	// the (moving) cap.
	const CAP_DX = 0.29 - PIVX; // cap - elbow (chef-frac x)
	const CAP_DY = 0.46 - PIVY; // cap - elbow (chef-frac y)
	const saltTopX = $derived(
		pivotX + (CAP_DX * guyPose.width) * Math.cos(armAngle) - (CAP_DY * guyPose.height) * Math.sin(armAngle),
	);
	const saltTopY = $derived(
		pivotY + (CAP_DX * guyPose.width) * Math.sin(armAngle) + (CAP_DY * guyPose.height) * Math.cos(armAngle),
	);
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
			// The stream hangs off the (moving) cap at the top and lands at the fixed pot, so it wiggles
			// with the shake near the shaker and is anchored below.
			const x = saltTopX + (saltBotX - saltTopX) * p + dir * spread;
			const y = saltTopY + (saltBotY - saltTopY) * ease;
			const size = grain * (0.5 + ((i * 7) % 5) * 0.2); // varied grain sizes
			const fade = Math.min(1, p / 0.1) * (p > 0.8 ? Math.max(0, (1 - p) / 0.2) : 1);
			// Density pulses with the flick AT THE MOMENT THIS GRAIN LEFT the shaker → salt bursts out on
			// each down-flick instead of an even stream.
			const releaseE = elapsed - p * 1200;
			const rf = 0.5 + 0.5 * Math.sin((2 * Math.PI * (((releaseE % SHAKE_PERIOD) + SHAKE_PERIOD) % SHAKE_PERIOD)) / SHAKE_PERIOD);
			const alpha = fade * (0.22 + 0.78 * rf) * (0.6 + (i % 3) * 0.15);
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
	<!-- Hand+shaker+forearm (clean full-frame layer), flicking about the elbow. Above the base, below
	     the falling salt so the grains read as leaving the cap. -->
	<Sprite
		key="specialArm"
		x={pivotX}
		y={pivotY}
		anchor={{ x: PIVX, y: PIVY }}
		width={guyPose.width}
		height={guyPose.height}
		rotation={armAngle}
		zIndex={0.5}
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

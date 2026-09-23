<script lang="ts">
	import { Circle, Container, Rectangle, Sprite } from 'pixi-svelte';

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

	// The arm (a clean full-frame copy of the hand+shaker+arm) is OVERLAID on the FULL base (the base
	// still contains the arm at rest — no hole is cut) and flicks a hair about the shoulder socket. Like
	// the splash chef's patched base, nothing behind the arm is transparent, so the flick can never
	// detach the arm or reveal the black oven behind it; the tiny angle keeps the overlaid arm from
	// showing any double edge against the resting one. Salt releases on the down-flick.
	const SHAKE_PERIOD = 560; // ms per flick
	const SHAKE_AMP = 0.028; // rad (~1.6°) — small flick
	const shakeP = $derived((elapsed % SHAKE_PERIOD) / SHAKE_PERIOD);
	const armAngle = $derived(SHAKE_AMP * Math.sin(2 * Math.PI * shakeP)); // + = flick down (cap dips)

	const chefL = $derived(guyPose.x - guyPose.width / 2);
	const chefT = $derived(guyPose.y - guyPose.height / 2);
	// Shoulder-socket pivot (chef fractions) — where the arm meets the body.
	const PIVX = 0.455;
	const PIVY = 0.61;
	const pivotX = $derived(chefL + PIVX * guyPose.width);
	const pivotY = $derived(chefT + PIVY * guyPose.height);

	// Salt spout = the shaker cap, carried around the shoulder by the flick so the stream stays glued
	// to the (moving) cap.
	const CAP_DX = 0.33 - PIVX; // cap - shoulder (chef-frac x)
	const CAP_DY = 0.5 - PIVY; // cap - shoulder (chef-frac y)
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

	// The soup simmers: a few bubbles swell on the surface and pop, on a loop. Positions are fixed per
	// bubble (spread across the surface ellipse) so they read as spots that keep bubbling, not drifting.
	const BUBBLE_N = 8;
	const BUBBLE_PERIOD = 2400; // ms per swell→pop
	const SOUP_CX = 0.45;
	const SOUP_CY = 0.34;
	const SOUP_RX = 0.29;
	const SOUP_RY = 0.075; // surface ellipse (pot fractions)
	const potLeft = $derived(cx + guyWidth * 0.02 - potWidth / 2);
	const potTop = $derived(potY - potHeight / 2);
	const bubbles = $derived.by(() =>
		Array.from({ length: BUBBLE_N }, (_, i) => {
			const p = (((elapsed / BUBBLE_PERIOD + i / BUBBLE_N) % 1) + 1) % 1;
			// Fixed spot per bubble: golden-angle spread inside the surface ellipse.
			const ang = i * 2.3999;
			const rad = 0.25 + 0.7 * (((i * 0.618) % 1 + 1) % 1);
			const bx = SOUP_CX + Math.cos(ang) * SOUP_RX * rad;
			const by = SOUP_CY + Math.sin(ang) * SOUP_RY * rad;
			const x = potLeft + bx * potWidth;
			const y = potTop + by * potHeight;
			// Swell to full by 55%, then pop (expand + fade) and rest until it swells again.
			const grow = Math.min(1, p / 0.5);
			const pop = p > 0.58 ? Math.min(1, (p - 0.58) / 0.22) : 0;
			const base = Math.max(3, potHeight * 0.03) * (0.55 + 0.45 * ((i * 7) % 3));
			const d = base * (0.35 + 0.65 * grow) * (1 + pop * 0.9);
			const fadeIn = Math.min(1, p / 0.06);
			const alpha = fadeIn * (pop > 0 ? Math.max(0, 1 - pop) : 1);
			return { id: i, x, y, d, alpha };
		}),
	);

	// The wooden spoon (cut out of the pot) is overlaid and gently STIRRED — a slow sway about the point
	// where it meets the soup, so it reads as being turned through the simmering soup.
	const SPOON_PIVX = 0.72;
	const SPOON_PIVY = 0.41;
	const spoonPivotX = $derived(potLeft + SPOON_PIVX * potWidth);
	const spoonPivotY = $derived(potTop + SPOON_PIVY * potHeight);
	const STIR_PERIOD = 2800; // ms per slow back-and-forth
	const spoonStir = $derived(0.033 * Math.sin((2 * Math.PI * (elapsed % STIR_PERIOD)) / STIR_PERIOD)); // ~±1.9°
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
	<!-- Simmering bubbles on the soup surface: a lighter-green dome + a soft highlight, swelling and
	     popping. Above the pot so they read as sitting on the liquid. -->
	{#each bubbles as bub (bub.id)}
		<Circle
			x={bub.x}
			y={bub.y}
			diameter={bub.d}
			anchor={0.5}
			backgroundColor={0x8fc22a}
			backgroundAlpha={bub.alpha * 0.85}
			zIndex={2.5}
		/>
		<Circle
			x={bub.x - bub.d * 0.16}
			y={bub.y - bub.d * 0.2}
			diameter={bub.d * 0.34}
			anchor={0.5}
			backgroundColor={0xe7f5b8}
			backgroundAlpha={bub.alpha * 0.8}
			zIndex={2.6}
		/>
	{/each}
	<!-- The wooden spoon, overlaid on the (spoon-less) pot and slowly stirred about the soup line. -->
	<Sprite
		key="specialSpoon"
		x={spoonPivotX}
		y={spoonPivotY}
		anchor={{ x: SPOON_PIVX, y: SPOON_PIVY }}
		width={potWidth}
		height={potHeight}
		rotation={spoonStir}
		zIndex={2.7}
	/>
</Container>

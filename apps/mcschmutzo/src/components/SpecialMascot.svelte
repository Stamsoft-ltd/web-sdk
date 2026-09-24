<script lang="ts">
	import { Circle, Container, Rectangle, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import AnimatedGuy from './AnimatedGuy.svelte';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());


	// Composition sits on the right, BEHIND the board. The real art is laid out on a shared 358x425
	// frame (guy on the right, the salt-arm overlay on the left) so both sprites line up; sized +
	// placed so the head and raised shaker read at the right spot.
	const cx = $derived(canvas.width * 0.88);
	const guyHeight = $derived(canvas.height * 0.72);
	const guyWidth = $derived(guyHeight * (358 / 425));
	const guyY = $derived(canvas.height * 0.6);
	const potWidth = $derived(guyWidth * 0.82);
	const potHeight = $derived(potWidth * (848 / 1180));
	const potY = $derived(canvas.height * 0.82);

	// The base has the baked pupils erased (color-aware: sclera/pupil only, skin untouched) and the
	// animated pupils are discs at the ART'S OWN pupil size, centred where they were — at rest the
	// face reads as the original art, and the tiny glance only ever exposes white-on-white sclera.
	// Both pupils sit at the SAME normalized offset inside their socket (slightly down-left, toward
	// the pot) so the eyes read as one consistent gaze, and disc + glance excursions are sized to
	// stay inside the white (sockets measured: L c(0.4351,0.2785) hw.029/.0264, R c(0.5425,0.2667)
	// hw.0366/.0335; disc radii L .0207w R .0266w; max glance ±.0045x/.003y — all fit).
	const specialPupils = [
		{ nx: 0.4314, ny: 0.2821, nw: 0.059, nh: 0.0497 },
		{ nx: 0.538, ny: 0.2711, nw: 0.076, nh: 0.064 },
	];
	const specialLids = [
		{ cx: 0.4544, cy: 0.2775, w: 0.095, h: 0.088 },
		{ cx: 0.5369, cy: 0.264, w: 0.108, h: 0.1 },
	];

	// Clock: drives both the salt fall (phase) and the chef's idle breathe (elapsed).
	const COUNT = 90; // salt grains — a dense, fine pour
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

	// The salt-shaker forearm is overlaid on the base and flicks gently so it reads as shaking; salt
	// pours from the (moving) cap. The pivot sits ON the joint strip that's baked into the base, so
	// the connection region never diverges from the painted joint (seamless), while the shaker end —
	// far from the pivot — does the visible swinging. Frame fractions off the shared frame.
	const SHAKE_PERIOD = 560; // ms per flick
	const SHAKE_AMP = 0.022; // rad (~1.3°) — gentle, smooth
	const shakeP = $derived((elapsed % SHAKE_PERIOD) / SHAKE_PERIOD);
	const armAngle = $derived(SHAKE_AMP * Math.sin(2 * Math.PI * shakeP));
	const chefL = $derived(guyPose.x - guyPose.width / 2);
	const chefT = $derived(guyPose.y - guyPose.height / 2);
	const PIVX = 0.452; // middle of the baked joint strip (frame fractions)
	const PIVY = 0.5;
	const pivotX = $derived(chefL + PIVX * guyPose.width);
	const pivotY = $derived(chefT + PIVY * guyPose.height);
	// The cap's holes face sits at frame (0.352, 0.466) — salt exits right there.
	const CAP_DX = 0.352 - PIVX;
	const CAP_DY = 0.466 - PIVY;
	const saltTopX = $derived(pivotX + CAP_DX * guyPose.width * Math.cos(armAngle) - CAP_DY * guyPose.height * Math.sin(armAngle));
	const saltTopY = $derived(pivotY + CAP_DX * guyPose.width * Math.sin(armAngle) + CAP_DY * guyPose.height * Math.cos(armAngle));
	const saltBotX = $derived(cx - guyWidth * 0.12);
	const saltBotY = $derived(potY - potHeight * 0.18);
	const grain = $derived(Math.max(2, canvas.height * 0.0045));
	const grains = $derived(
		Array.from({ length: COUNT }, (_, i) => {
			const p = (phase + i / COUNT) % 1;
			// Free fall: grains leave the holes slowly and accelerate down (p² gravity), so they bunch
			// tight near the cap (a dense pour) and string out as they speed up toward the pot.
			const ease = p * p * 0.82 + p * 0.18;
			// Tight at the holes, fanning into a narrow cone on the way down.
			const dir = Math.sin(i * 2.3999); // deterministic spread direction (-1..1)
			const wob = Math.sin(i * 12.9898 + p * 9); // slight per-grain flutter as it falls
			const spread = grain * (0.35 + ease * 5.5);
			const x = saltTopX + (saltBotX - saltTopX) * ease + dir * spread + wob * grain * 0.35 * ease;
			const y = saltTopY + (saltBotY - saltTopY) * ease;
			const size = grain * (0.45 + ((i * 7) % 5) * 0.16); // fine, varied grains
			const fade = Math.min(1, p / 0.06) * (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1);
			// Density pulses with the flick AT THE MOMENT THIS GRAIN LEFT the shaker → salt bursts out on
			// each down-flick instead of an even stream.
			const releaseE = elapsed - p * 1200;
			const rf = 0.5 + 0.5 * Math.sin((2 * Math.PI * (((releaseE % SHAKE_PERIOD) + SHAKE_PERIOD) % SHAKE_PERIOD)) / SHAKE_PERIOD);
			const alpha = fade * (0.3 + 0.7 * rf) * (0.65 + (i % 3) * 0.15);
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
</script>

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. The whole group
     sits BEHIND the board (negative zIndex) but in front of the background. -->
<Container zIndex={-0.5}>
	<!-- Real chef base (no salting arm). Baked pupils are kept, so no fresh discs (pupils empty) — he
	     just BLINKS via skin lids. The nametag jiggles as an overlay (a touch larger than the baked
	     one so it stays covered), and a tooth *ding* sparkles. -->
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
		sparkle={{ nx: 0.5, ny: 0.4, size: 0.06, period: 3800, phase: 1200 }}
		extras={[
			{ key: 'specialLabel', nx: 0.5643, ny: 0.5737, nw: 0.1984, nh: 0.1119, px: 0.5, py: 0.13, amp: 0.045, period: 320, phase: 900 },
		]}
	/>
	<!-- Salt-shaker forearm overlay: flicks about the shoulder (above the base, below the salt). -->
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
</Container>

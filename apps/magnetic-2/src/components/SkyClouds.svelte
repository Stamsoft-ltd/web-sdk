<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// Drifting clouds over the base-game sky.
	//
	// The outdoor background (Figma 9164:12153) is a terrace under a wide open sky with nothing in
	// it — the painting has no clouds at all — so the clouds are sprites moved across it. They are
	// the SPLASH's two shapes (art-src/splash/cloud_big|small.png, cut by build-splash-art.py): the
	// designer's own art, already drifting over the splash sky, so the game opens and plays under
	// the same weather instead of under two different painters' clouds.
	//
	// Nine on screen at a time, every one randomised: shape, size, height, speed and opacity are
	// rolled at start-up AND again each time a cloud leaves the frame, so the sky never repeats a
	// formation and no two sessions look alike.
	//
	// The motion is a plain constant drift, which is what a distant cloud actually does. The read of
	// DEPTH comes from correlating everything else with it: a near cloud is bigger, brighter, lower
	// and faster; a far one is small, pale, high and slow. That parallax is the whole effect —
	// varying the speeds independently of the sizes just looks like a screensaver.
	const props: {
		/** The background sprite's drawn size — clouds are placed in its coordinates, not the canvas's. */
		coverW: number;
		coverH: number;
		canvasW: number;
		canvasH: number;
		/** Rides the room cross-fade, so the clouds leave with the sky rather than blinking off. */
		alpha: number;
	} = $props();

	// Trimmed art size (a sprite drawn off its own aspect is a stretched sprite) and the width band
	// each shape is drawn at, as fractions of the background. The bands are the SPLASH's own — it
	// gives the big shape 9–13% of the frame and the small one 4.5–7.5%, and gives the big one less
	// spread because at the top of its range it stops reading as a cloud and starts reading as
	// scenery. Size comes from the SHAPE, not from depth alone: rolling one width for both would
	// draw the big shape at the small one's size half the time.
	const SHAPES = [
		{ key: 'skyCloudA', aspect: 183 / 64, w: [0.085, 0.13] },
		{ key: 'skyCloudB', aspect: 80 / 30, w: [0.045, 0.075] },
	];
	const COUNT = 9;
	/** Vertical band, as fractions of the background: below the frame's top edge, above the hills. */
	const BAND = [0.04, 0.4];

	type Cloud = {
		key: string;
		aspect: number;
		/** Position and size as fractions of the background, so a resize does not teleport anything. */
		x: number;
		y: number;
		w: number;
		depth: number;
		speed: number;
		alpha: number;
		/** Phase for the drift's slow vertical wander. */
		phase: number;
	};

	const roll = (x: number): Cloud => {
		const depth = Math.random();
		const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
		return {
			key: shape.key,
			aspect: shape.aspect,
			x,
			y: BAND[0] + (BAND[1] - BAND[0]) * (1 - depth) ** 0.7 * Math.random() + BAND[0] * depth,
			w: shape.w[0] + (shape.w[1] - shape.w[0]) * depth,
			depth,
			// Fractions of the background per second: a near cloud crosses in ~60s, a far one in ~3.5min.
			speed: 0.004 + 0.013 * depth,
			// The splash fades its clouds 0.5–0.9; this sky is deeper and blurred, so the near end is
			// held a little back to keep them behind the board rather than beside it.
			alpha: 0.4 + 0.4 * depth,
			phase: Math.random() * Math.PI * 2,
		};
	};

	// Spread the opening formation across the sky (and a little past both edges) rather than
	// starting them all at the left, which would read as a curtain coming in.
	let clouds = $state<Cloud[]>(
		Array.from({ length: COUNT }, (_, i) => roll(-0.25 + (i / COUNT) * 1.5)),
	);

	$effect(() => {
		let raf = 0;
		let last = performance.now();
		let acc = 0;
		const tick = (now: number) => {
			raf = requestAnimationFrame(tick);
			const dt = Math.min(0.25, (now - last) / 1000);
			last = now;
			// ~30fps. These move a fraction of a pixel per frame at 60, so a full-rate scene-graph
			// diff for six sprites buys nothing the eye can see.
			acc += dt;
			if (acc < 0.033) return;
			const step = acc;
			acc = 0;
			clouds = clouds.map((c) => {
				const x = c.x + c.speed * step;
				// Off the right edge, with its own width to spare: roll a new cloud and bring it back
				// in from the left. This is where the sky keeps changing.
				return x - c.w / 2 > 1.3 ? roll(-0.3) : { ...c, x, phase: c.phase + step * 0.35 };
			});
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#each clouds as cloud, i (i)}
	{@const w = cloud.w * props.coverW}
	<Sprite
		key={cloud.key}
		anchor={0.5}
		x={props.canvasW * 0.5 + (cloud.x - 0.5) * props.coverW}
		y={props.canvasH * 0.5 +
			(cloud.y - 0.5) * props.coverH +
			// A shallow wander so the drift is not a perfectly straight line.
			Math.sin(cloud.phase) * props.coverH * 0.012 * cloud.depth}
		width={w}
		height={w / cloud.aspect}
		alpha={cloud.alpha * props.alpha}
	/>
{/each}

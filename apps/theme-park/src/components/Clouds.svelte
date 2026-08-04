<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';
	import { CLOUDS_Z, backgroundCover } from '../game/sceneBackground';

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const cover = $derived(backgroundCover(canvas));

	// Native export sizes, kept here so each cloud draws at its own aspect instead of a shared box.
	const CLOUD_ART = [
		{ key: 'cloud1', aspect: 117 / 58 },
		{ key: 'cloud2', aspect: 226 / 108 },
		{ key: 'cloud3', aspect: 192 / 50 },
		{ key: 'cloud4', aspect: 147 / 72 },
		{ key: 'cloud5', aspect: 175 / 87 },
	];

	// Width comes off the five clouds placed in Figma 6612-4311: 107..214 of that 1200-wide frame,
	// taken against the backdrop art (whose 1188x664 is the same 1.79 frame). The range is stretched
	// a little at both ends so one sky can hold a clearly near and a clearly far cloud.
	const WIDTH_FRACTION = { min: 0.07, max: 0.2 };

	// Height is measured against the CANVAS, not the art: on a wide screen the backdrop is
	// cover-scaled taller than the viewport and its top is cropped, so an art fraction near 0 would
	// put a cloud off the top of the screen. The band runs from just under the top edge down to the
	// board's top (0.128 of the height — see DESIGN_GRID in stateGame), i.e. the strip of sky that is
	// actually visible.
	const CENTRE_FRACTION = { min: 0.025, max: 0.15 };

	// Seconds to cross the screen. Wide clouds read as nearer, so they travel faster.
	const CROSSING_SECONDS = { near: 70, far: 150 };
	// Dead time after a cloud leaves before it comes back. Without it the sky is a conveyor belt:
	// something is always entering, and the same few shapes cycle at a visible rhythm.
	const REST_SECONDS = { min: 4, max: 28 };
	const COUNT = { min: 3, max: 4 };

	const random = (min: number, max: number) => min + Math.random() * (max - min);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

	const shuffled = <T,>(items: T[]) => {
		const deck = [...items];
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		return deck;
	};

	type Cloud = {
		key: string;
		aspect: number;
		/** Which slice of the height band this one owns, for its whole life. */
		slot: number;
		slots: number;
		direction: 1 | -1;
		widthFraction: number;
		centreFraction: number;
		alpha: number;
		/** Fraction of one crossing covered per second. */
		speed: number;
		/** 0 = just off the entry edge, 1 = just off the exit edge. Null while resting off-screen. */
		progress: number | null;
		waiting: number;
	};

	/**
	 * Everything about a crossing is re-rolled when the cloud begins one: which side it enters from,
	 * how big and how fast it is, how long it rested first, and where inside its own slice of sky it
	 * sits. That is what stops the sky repeating — fixing all of it up front and looping the position
	 * put the same clouds back in the same places every couple of minutes and let them bunch up.
	 *
	 * The slice is the one thing that stays put: each cloud owns a horizontal band for its whole
	 * life, so two of them can pass each other but never stack on the same line.
	 */
	const launch = (cloud: Cloud, { atBoot = false } = {}) => {
		const depth = Math.random(); // 0 = far, small, slow, faint; 1 = near, big, fast, solid.
		cloud.direction = Math.random() < 0.5 ? 1 : -1;
		cloud.widthFraction = lerp(WIDTH_FRACTION.min, WIDTH_FRACTION.max, depth);
		cloud.centreFraction = lerp(
			CENTRE_FRACTION.min,
			CENTRE_FRACTION.max,
			(cloud.slot + Math.random()) / cloud.slots,
		);
		cloud.alpha = lerp(0.78, 1, depth);
		cloud.speed = 1 / lerp(CROSSING_SECONDS.far, CROSSING_SECONDS.near, depth);
		// At boot most of them are already part-way across, so the game does not open on an empty sky
		// and then have every cloud sail in at once. After that each re-entry rests off-screen first.
		cloud.progress = atBoot && Math.random() < 0.7 ? Math.random() : null;
		cloud.waiting = atBoot
			? random(0, REST_SECONDS.min)
			: random(REST_SECONDS.min, REST_SECONDS.max);
		return cloud;
	};

	const clouds: Cloud[] = (() => {
		const count = COUNT.min + Math.floor(Math.random() * (COUNT.max - COUNT.min + 1));
		const slots = shuffled(Array.from({ length: count }, (_, i) => i));
		return shuffled(CLOUD_ART)
			.slice(0, count)
			.map((art, index) =>
				launch(
					{
						...art,
						slot: slots[index],
						slots: count,
						direction: 1,
						widthFraction: 0,
						centreFraction: 0,
						alpha: 1,
						speed: 0,
						progress: null,
						waiting: 0,
					},
					{ atBoot: true },
				),
			);
	})();

	// The clouds themselves are plain objects mutated in the frame loop; this counter is the only
	// reactive part, so one bump per frame redraws all of them.
	let frame = $state(0);

	onMount(() => {
		let handle = 0;
		let previous = performance.now();
		const tick = (now: number) => {
			// Clamped so a backgrounded tab does not resume with the clouds teleported.
			const delta = Math.min((now - previous) / 1000, 0.1);
			previous = now;

			for (const cloud of clouds) {
				if (cloud.progress === null) {
					cloud.waiting -= delta;
					if (cloud.waiting > 0) continue;
					cloud.progress = 0;
				}
				cloud.progress += cloud.speed * delta;
				if (cloud.progress >= 1) launch(cloud);
			}

			frame += 1;
			handle = requestAnimationFrame(tick);
		};
		handle = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(handle);
	});

	const ready = $derived(clouds.every((cloud) => !!context.stateApp.loadedAssets?.[cloud.key]));

	// The duck-pond booth backdrop has no open sky; clouds drifting over its awning read as a glitch.
	// Kept mounted at alpha 0 (see the note on `placed`) rather than unmounted.
	const pondActive = $derived(!!context.stateGame.duckPicks);

	const placed = $derived.by(() => {
		void frame;
		return clouds.map((cloud) => {
			// Size against the backdrop art rather than the viewport, so a cloud keeps its size
			// relative to the ferris wheel behind it whatever shape the window is.
			const width = cover.width * cloud.widthFraction;
			const height = width / cloud.aspect;
			const span = canvas.width + width;
			const travelled = (cloud.progress ?? 0) * span;
			return {
				key: cloud.key,
				width,
				height,
				// Resting clouds stay mounted at alpha 0 rather than being removed from the tree. Every
				// node in the scene sorts at zIndex 0, so a sprite that unmounts and comes back is
				// re-appended AFTER the board's containers and would draw on top of the reels.
				alpha: cloud.progress === null ? 0 : cloud.alpha,
				x: cloud.direction === 1 ? -width + travelled : canvas.width - travelled,
				// Sprites anchor top-left, so back off half the height to sit the centre on the band.
				y: canvas.height * cloud.centreFraction - height * 0.5,
			};
		});
	});
</script>

<!-- One container, added to the stage once, at a zIndex above the backdrop and below the game. Even
     if a sprite inside it were to remount, the group keeps its place — which is what holds the sky
     behind the board. -->
<Container zIndex={CLOUDS_Z}>
	{#if ready}
		{#each placed as cloud (cloud.key)}
			<Sprite
				key={cloud.key}
				x={cloud.x}
				y={cloud.y}
				width={cloud.width}
				height={cloud.height}
				alpha={pondActive ? 0 : cloud.alpha}
			/>
		{/each}
	{/if}
</Container>

<script lang="ts" module>
	/**
	 * Popcorn popping out of the bucket, for as long as the popcorn symbol is winning.
	 *
	 * The design draws half a dozen loose kernels hanging in the air around the bucket (Figma
	 * 7052:7937) and ships them as their own drawings, so the win presentation throws them instead of
	 * leaving them parked: each one is launched out of the crown of the heap, arcs over under gravity
	 * and falls past the bottom of the symbol. Where the crown is and how wide it is are measured off
	 * the art by `scripts/popcorn/build_popcorn.py` into `POPCORN_MOUTH`, so re-drawing the bucket
	 * moves the throw point with it.
	 *
	 * Everything here is a pure function of `clock`. There is no per-frame state and no random number
	 * generator: each kernel's launch angle, speed, spin and size come out of `wobble` keyed on its
	 * index, which is what lets the whole burst be re-derived from scratch every frame and still look
	 * like the same kernels flying the same arcs. The board mounts one of these per winning popcorn
	 * cell, and the caller's `phase` is what stops two cells popping in lockstep.
	 *
	 * AT REST IT DROPS ONE KERNEL EVERY FEW SECONDS. That is a different motion from the win burst,
	 * not a slower one: nothing is thrown, a single kernel tips off the SHOULDER of the heap and
	 * falls past the bottom of the symbol, which is what an overfull bucket does when it settles.
	 * Between drops the bucket is completely still — four seconds of nothing for every second of
	 * falling — because the point is a bucket that looks too full, not a bucket that is leaking.
	 */
	import { POPCORN_KERNELS, POPCORN_MOUTH } from '../game/popcornParts';

	/** How many kernels are in the air at once. */
	const KERNELS = 9;
	/** Seconds from launch to gone. Long enough to clear the bottom of the symbol — see `FALL`. */
	const LIFETIME = 1.5;

	/**
	 * Launch speed and gravity, in symbol-heights per second and per second squared.
	 *
	 * Tuned as a pair, because between them they decide the whole flight: the kernel peaks at
	 * `RISE / GRAVITY` seconds, a fifth of a symbol above the crown, which puts it a few pixels
	 * inside the top of the frame — high enough to clear the heap and read as a pop, not so high
	 * that it leaves the cell and lands on the symbol above. By the end of its life it is a symbol
	 * and a half below where it started, well clear of the bottom edge.
	 */
	const RISE = 0.95;
	const GRAVITY = 2.2;
	/**
	 * How far a kernel drifts sideways over its whole life, as a fraction of the symbol's width.
	 * Enough to carry it clear of the tub on the way down — a kernel that falls straight back into
	 * the heap it came out of reads as a glitch rather than as popcorn.
	 */
	const DRIFT = 0.3;
	/** Turns per lifetime, either way. Popcorn tumbles; it does not glide. */
	const SPIN = 1.4;

	/** Kernels are drawn between this share of their measured size and its reciprocal. */
	const SIZE_VARY = 0.22;
	/** The last stretch of a kernel's life, over which it fades out rather than vanishing. */
	const FADE = 0.3;
	/** And the first flicker of it, so a kernel does not appear at full size inside the heap. */
	const EMERGE = 0.12;

	// === AT REST: ONE KERNEL AT A TIME ===
	/**
	 * Seconds between drops. Nearly all of that gap is a bucket sitting perfectly still.
	 *
	 * There can be several popcorn symbols on the board at once and `PHASE_SPREAD` scatters them
	 * across this window, so the interval a PLAYER sees a kernel at is this divided by however many
	 * buckets have landed — which is what makes a gap that sounds long on paper still read as often
	 * enough on screen.
	 */
	const DROP_EVERY = 13;
	/**
	 * How long one drop lasts. The rest of `DROP_EVERY` has nothing on screen at all.
	 *
	 * Set against `TIP` and `GRAVITY`: from the crown at `POPCORN_MOUTH.y` a kernel needs almost
	 * exactly a second to reach the bottom edge of the frame, and this leaves it a fraction more to
	 * be gone in. A thrown kernel can be faded out early because it is already past the tub; one
	 * that rolls off has the whole bucket still to fall down, and fading it on the burst's schedule
	 * dissolved it halfway down the stripes.
	 */
	const DROP_FALL = 1.15;
	/** The share of that spent fading — the stretch below the bottom edge, and no more. */
	const DROP_FADE = 0.17;
	/**
	 * The nudge that starts it, in symbol-heights per second, against the same `GRAVITY` the burst
	 * uses. Small on purpose: enough that the kernel lifts clear of the heap before it goes over,
	 * which is what makes it read as toppling rather than as falling through the bucket.
	 */
	const TIP = 0.32;
	/** How far it slides away from the heap over the fall, as a fraction of the symbol's width. */
	const SLIDE = 0.2;
	/** Turns per drop. Half of `SPIN`: a kernel that rolls off has far less on it than one thrown. */
	const DROP_SPIN = 0.7;
	/**
	 * How far out on the heap a drop starts, as a share of the crown's spread. Never near the middle
	 * — kernels come off the SHOULDER of a heap, and one appearing out of the top of the pile and
	 * sinking down the front of it looks like it is passing through the popcorn rather than over it.
	 */
	const SHOULDER = 0.55;
	/**
	 * What the caller's `phase` is worth in seconds at rest.
	 *
	 * Multiplied up because `phase` is scaled to the burst's 1.5-second lifetime, and left as-is it
	 * would drop every bucket on the board inside the same second or two of the cycle — which is the
	 * one thing this must not do. The board hands out phases up to about 2.6, so this spreads them
	 * across very nearly the whole of `DROP_EVERY`.
	 */
	const PHASE_SPREAD = 5;
	/**
	 * Where in the cycle a bucket starts when it lands, given its `phase`.
	 *
	 * Wrapped into the QUIET part of the window rather than the whole of it, which is the point: a
	 * bucket that landed at some arbitrary moment of a shared, never-resetting clock could open on
	 * any frame of a drop, and a kernel that fades up halfway down the outside of the tub has visibly
	 * not come out of it. Starting past `DROP_FALL` guarantees the first thing a new bucket does is
	 * wait, so every kernel a player ever sees begins at the crown of the heap.
	 */
	const stagger = (phase: number) =>
		DROP_FALL + ((phase * PHASE_SPREAD) % (DROP_EVERY - DROP_FALL));
	/**
	 * The kernels big enough to be worth dropping on their own, as a share of the symbol's width.
	 *
	 * The burst can use all three because nine of them are in the air at once and the smallest reads
	 * as debris between the others. On its own it does not read at all — the third kernel ships as a
	 * 17-pixel crumb, and every third drop being one looked like the bucket had simply done nothing.
	 * It cannot be scaled up to compensate; at that size there is nothing there to enlarge.
	 */
	const DROPPABLE = POPCORN_KERNELS.filter((kernel) => kernel.width > 0.07);

	/**
	 * A repeatable number in -1..1 for kernel `index`, varied by `salt`.
	 *
	 * The usual hash-a-sine trick. It stands in for a random number generator precisely because it is
	 * not one: the component is re-derived from `clock` every frame, so anything genuinely random
	 * would re-roll each kernel's flight sixty times a second.
	 */
	const wobble = (index: number, salt: number) => {
		const hashed = Math.sin((index + 1) * 12.9898 + salt) * 43758.5453;
		return (hashed - Math.floor(hashed)) * 2 - 1;
	};
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	type Props = {
		/** The centre of the SYMBOL — kernels are placed relative to it. */
		x: number;
		y: number;
		/** The size the bucket is being drawn at, so the kernels scale with it. */
		width: number;
		height: number;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the resting bucket drops on. */
		idleClock: number;
		/** Offset into the burst, so two buckets neither pop nor drop in step. */
		phase?: number;
		/** Radians about the symbol's centre: whatever rock the bucket under it is riding. */
		rotation?: number;
	};

	const props: Props = $props();

	/**
	 * The board's clock at the moment this bucket landed, read once and never again.
	 *
	 * `idleClock` is the whole board's and does not reset, so measuring the drop cycle against it
	 * directly meant a bucket's first kernel was wherever the clock happened to be — see `stagger`.
	 * A plain `const` off `props` captures the value at init rather than tracking it, which is
	 * exactly the non-reactive read wanted here.
	 */
	const landed = props.idleClock;

	/** One kernel over the side, every `DROP_EVERY` seconds. */
	const dropped = $derived.by(() => {
		const clock = props.idleClock - landed + stagger(props.phase ?? 0);
		const age = clock - Math.floor(clock / DROP_EVERY) * DROP_EVERY;
		if (age > DROP_FALL) return [];

		// Everything about the drop is keyed on WHICH drop it is, so no two in a row are the same
		// kernel coming off the same shoulder — which, at one every five seconds, is exactly the
		// kind of repeat the eye picks up.
		const drop = Math.floor(clock / DROP_EVERY);
		const life = age / DROP_FALL;
		// Strictly alternating shoulders. `wobble` was used for this first and is not even enough
		// about zero to stand in for a coin: at this salt it sent fourteen of the first twenty drops
		// right, the first five of them in a row, so the whole first half-minute of a settled board
		// spilled down one side of the bucket. Nobody counts a five-second alternation, and this way
		// both shoulders are certain to get used.
		const side = drop % 2 === 0 ? 1 : -1;
		const from = SHOULDER + (1 - SHOULDER) * Math.abs(wobble(drop, 3.3));

		const kernel = DROPPABLE[Math.abs(drop) % DROPPABLE.length];
		const size = 1 + wobble(drop, 9.1) * SIZE_VARY;
		return [
			{
				id: drop,
				key: kernel.key,
				x:
					(POPCORN_MOUTH.x - 0.5 + side * (from * POPCORN_MOUTH.spread + SLIDE * life)) *
					props.width,
				y:
					(POPCORN_MOUTH.y - 0.5) * props.height +
					(-TIP * age + 0.5 * GRAVITY * age * age) * props.height,
				width: kernel.width * props.width * size,
				height: kernel.height * props.height * size,
				// Rolling the way it went over, rather than either way at random.
				rotation: side * DROP_SPIN * Math.PI * 2 * life,
				alpha:
					Math.min(1, life / EMERGE) * (life > 1 - DROP_FADE ? (1 - life) / DROP_FADE : 1),
			},
		];
	});

	const burst = $derived.by(() => {
		const clock = props.clock + (props.phase ?? 0);
		const flying = [];
		for (let index = 0; index < KERNELS; index += 1) {
			// Staggered by a whole fraction of the lifetime and then looped, so the burst starts empty
			// and fills rather than arriving all at once, and never runs dry while the win holds.
			const started = clock / LIFETIME - index / KERNELS;
			if (started < 0) continue;
			const life = started - Math.floor(started);
			const age = life * LIFETIME;

			// Ballistics, in fractions of the symbol. Up is negative, as everywhere else in pixi.
			const drop = (-RISE * age + 0.5 * GRAVITY * age * age) * props.height;
			const launchX = wobble(index, 1.7) * POPCORN_MOUTH.spread * props.width;
			const drift = wobble(index, 4.3) * DRIFT * life * props.width;

			const kernel = POPCORN_KERNELS[index % POPCORN_KERNELS.length];
			const size = 1 + wobble(index, 9.1) * SIZE_VARY;
			flying.push({
				id: index,
				key: kernel.key,
				x: (POPCORN_MOUTH.x - 0.5) * props.width + launchX + drift,
				y: (POPCORN_MOUTH.y - 0.5) * props.height + drop,
				width: kernel.width * props.width * size,
				height: kernel.height * props.height * size,
				rotation: wobble(index, 6.5) * SPIN * Math.PI * 2 * life,
				alpha:
					Math.min(1, life / EMERGE) * (life > 1 - FADE ? (1 - life) / FADE : 1),
			});
		}
		return flying;
	});
</script>

<!-- One container so the popcorn turns with the symbol, exactly like the bucket under it. -->
<Container x={props.x} y={props.y} rotation={props.rotation ?? 0}>
	{#each props.win ? burst : dropped as kernel (kernel.id)}
		<Sprite
			key={kernel.key}
			anchor={0.5}
			x={kernel.x}
			y={kernel.y}
			width={kernel.width}
			height={kernel.height}
			rotation={kernel.rotation}
			alpha={kernel.alpha}
		/>
	{/each}
</Container>

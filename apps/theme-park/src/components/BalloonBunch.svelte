<script lang="ts" module>
	/**
	 * The balloon symbol, assembled from the six balloons it is made of.
	 *
	 * The design ships the bunch (Figma 7080:21576) AND the four balloons it is built from, which is
	 * what lets this be a bunch of balloons rather than a picture of one: at rest they bob on their
	 * strings, and when the symbol wins they let go and fly. Where each one hangs is measured off the
	 * design by `scripts/balloons/build_balloons.py` into `balloonParts.ts`.
	 *
	 * EVERY BALLOON TURNS ABOUT THE END OF ITS OWN STRING, which is the point the table stores and the
	 * reason it stores that instead of the middle. A balloon pivoted on its middle does not bob, it
	 * slides sideways; pivoted on the end of its string it swings the way a balloon on a string does.
	 *
	 * This one DOES move at rest, unlike the marquee signs around it. It can afford to: those hold
	 * still because a drifting sprite is resampled every frame and their painted bulbs flickered when
	 * it happened, and there is not a bulb anywhere on this symbol. The idle sway is kept small and
	 * slow all the same — six balloons nodding gently is alive, six balloons waving is a distraction
	 * on a board the player is trying to read.
	 *
	 * ONLY ONE BALLOON FLIES AT A TIME. Sending all six up in a staggered stream was built first and
	 * rendered, and for most of the cycle the cell held two balloons drifting off the corner — a
	 * winning symbol that empties reads as a bug, not a flourish. So the bunch LIFTS AND STRAINS, all
	 * six of it, and they take turns breaking free: the one whose turn it is climbs out of the top
	 * and fades, and comes back to the bunch while the next one goes. Five balloons are always home.
	 */
	import { BALLOONS } from '../game/balloonParts';

	const TAU = Math.PI * 2;

	// === AT REST ===
	/** How far a balloon nods, in radians — about two degrees — and how long a nod takes. */
	const SWAY = 0.035;
	const SWAY_SECONDS = 4.3;
	/** And how far it rides up and down with the nod, as a fraction of the symbol's height. */
	const BOB = 0.008;

	// === WINNING: THE BUNCH STRAINS ===
	/** How far the whole bunch rides up, as a fraction of the symbol's height. */
	const LIFT = 0.075;
	/** How hard each balloon tugs on its string then, in radians — about eleven degrees — and how fast. */
	const TUG = 0.19;
	const TUG_HZ = 1.55;
	/** How far each spreads out of the bunch as it tugs, as a fraction of the symbol's width. */
	const SPREAD = 0.045;
	/** How long the bunch takes to let go, so a win does not start with the balloons mid-air. */
	const RELEASE = 0.35;

	// === WINNING: AND ONE AT A TIME GETS AWAY ===
	/** Seconds each balloon gets as the one that breaks free. Six balloons, so this is the rota. */
	const BREAK_SECONDS = 1.5;
	/** How far it climbs in that time, in symbol heights. Out of the top of the cell, on purpose. */
	const CLIMB = 1.0;
	/** How far it wanders sideways on the way up, and how many times it weaves doing it. */
	const WANDER = 0.14;
	const WEAVE = 1.1;
	/** How far it leans into the weave. A balloon leans the way it is going. */
	const LEAN = 0.5;
	/** The fraction of its turn spent fading out as it goes. */
	const VANISH = 0.45;
	/**
	 * And the fraction the NEXT balloon's turn spends fading it back in. Much shorter than VANISH,
	 * because a balloon fading out is climbing away from the bunch and a balloon fading in is sitting
	 * right on top of it — held for as long as the fade out, it reads as a see-through balloon rather
	 * than as one coming back.
	 */
	const RETURN = 0.18;

	/**
	 * Deterministic per-balloon variation in -1..1. A hashed sine rather than a random number: every
	 * frame is re-derived from the clock, so the same balloon has to be given the same answer twice.
	 */
	const wobble = (index: number, salt: number) => {
		const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
		return (value - Math.floor(value)) * 2 - 1;
	};
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	type Props = {
		/** The centre of the SYMBOL — every balloon is placed relative to it. */
		x: number;
		y: number;
		/** The size the symbol is being drawn at, board win pulse and spin squeeze included. */
		width: number;
		height: number;
		/** The assembled still, which is what the board's spin trail ghosts. */
		baseKey: string;
		/** Seconds since this win started. Ignored unless `win`. */
		clock: number;
		win: boolean;
		/** The board's own clock, which never stops: what the idle sway runs on. */
		idleClock: number;
		/**
		 * How much of a spin trail this symbol is under. Mid-spin it falls back to the baked still —
		 * six sprites resampled independently at every ghost offset is a bunch coming apart.
		 */
		blur?: number;
		alpha?: number;
		/** The board's idle breath, which the settled symbol rides the same as any other sprite. */
		tint?: number;
		/** Radians about the symbol's centre: the board's idle rock. */
		rotation?: number;
	};

	const props: Props = $props();

	const assembled = $derived((props.blur ?? 0) <= 0.02);
	/** Eased in rather than switched on, so they let go together instead of snapping into the air. */
	const released = $derived(props.win ? Math.min(1, props.clock / RELEASE) : 0);

	const balloons = $derived(
		BALLOONS.map((balloon, index) => {
			// At rest: a nod about the string's end, each balloon on its own phase so the bunch does
			// not move as one board.
			const phase = wobble(index, 1) * Math.PI;
			const nod = Math.sin((TAU * props.idleClock) / SWAY_SECONDS + phase);

			let lift = BOB * nod;
			let drift = 0;
			let turn = SWAY * nod;
			let fade = 1;

			if (props.win) {
				// The bunch: up, tugging, and spreading out of its own middle. `out` is where the
				// balloon's HEAD is across the symbol, not where its string ends — the strings all
				// gather at the middle, so signing the spread off them would send half the bunch the
				// wrong way. It is a proportion rather than a side, so the two balloons that really
				// are in the middle stay there.
				const tug = Math.sin(TAU * TUG_HZ * props.clock + phase);
				const head = balloon.x + (balloon.height * props.height * Math.sin(balloon.rest)) / props.width;
				const out = (head - 0.5) * 2;
				lift = (-LIFT + BOB * tug) * released;
				drift = SPREAD * out * (0.5 + 0.5 * tug) * released;
				turn = TUG * tug * released;

				// And they take turns letting go entirely.
				const cycle = props.clock / BREAK_SECONDS;
				const step = Math.floor(cycle);
				const away = cycle - step;
				if (step % BALLOONS.length === index) {
					const weave = TAU * WEAVE * away + phase;
					lift = (-LIFT - CLIMB * away) * released;
					drift = drift + WANDER * Math.sin(weave) * released;
					// Leaning off the weave's RATE, not its position: it leans hardest where it is
					// moving sideways fastest, which is what a balloon being pushed along does.
					turn = LEAN * WANDER * Math.cos(weave) * released;
					fade = Math.min(1, (1 - away) / VANISH);
				} else if (step > 0 && (step + BALLOONS.length - 1) % BALLOONS.length === index) {
					// The one that just got away, back on its string. Faded in rather than replaced,
					// which is the difference between a balloon returning and a balloon blinking.
					// `step > 0` because on the FIRST turn nobody has flown yet, and without it the
					// balloon at the end of the rota — the big pink one at the front — starts every
					// single win invisible and fades up out of nothing.
					fade = Math.min(1, away / RETURN);
				}
			}

			return {
				id: index,
				key: balloon.key,
				x: (balloon.x - 0.5 + drift) * props.width,
				y: (balloon.y - 0.5 + lift) * props.height,
				width: balloon.width * props.width,
				height: balloon.height * props.height,
				rotation: balloon.rest + turn,
				alpha: fade,
			};
		}),
	);
</script>

<Container
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
>
	{#if assembled}
		<!-- Back to front, the design's own stacking. -->
		{#each balloons as balloon (balloon.id)}
			<Sprite
				key={balloon.key}
				anchor={{ x: 0.5, y: 1 }}
				x={balloon.x}
				y={balloon.y}
				width={balloon.width}
				height={balloon.height}
				rotation={balloon.rotation}
				alpha={balloon.alpha}
				tint={props.tint}
			/>
		{/each}
	{:else}
		<!-- Mid-spin: the same picture, in one piece. -->
		<Sprite
			key={props.baseKey}
			anchor={0.5}
			x={0}
			y={0}
			width={props.width}
			height={props.height}
			tint={props.tint}
		/>
	{/if}
</Container>

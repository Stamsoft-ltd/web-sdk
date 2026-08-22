<script lang="ts" module>
	/**
	 * Sparks thrown off the back of the coaster car while it is winning.
	 *
	 * The car (Figma 7033:27241) is the one high symbol with no marquee on it — it wins by its two
	 * headlights coming up (<SymbolBulbs>, `H1` in `symbolBulbs.ts`) and by throwing sparks off the
	 * rail behind it, which is what says the thing is MOVING rather than parked with its lights on.
	 *
	 * Drawn rather than loaded. A spark is a hot dot with a tail, and a run of them is the same dot at
	 * a hundred different points on the same ballistic arc — there is nothing in that for an artist to
	 * draw, and a sprite sheet of it would be a file to keep in step with art that has already been
	 * re-drawn twice. It costs one Graphics rebuild a frame per winning car.
	 *
	 * Nothing is random at runtime: a spark's angle, speed and lifetime come from its index, so the
	 * shower is the same every time and two winning cars are not in lockstep (they are seeded apart by
	 * the caller's `phase`).
	 */
	/** Sparks in flight at once. Each is a `LIFETIME / SPARKS` step behind the one in front. */
	const SPARKS = 16;
	/** How long one spark lives, in seconds. Short — these are struck off a rail, not fireworks. */
	const LIFETIME = 0.62;
	/**
	 * Where they are struck, as a fraction of the 448x360 symbol frame: the rear truck, where the car's
	 * back wheels meet the rail. Measured off the art.
	 */
	const SOURCE = { x: 0.72, y: 0.76 };
	/**
	 * The spray, in radians, measured anticlockwise from straight up. The car runs down and to the
	 * left, so its sparks are flung up and BACK — to the right — in a fan around this centre.
	 */
	const AIM = 0.62;
	const SPREAD = 0.5;
	/** Launch speed, as a fraction of the symbol's width per second, and how much of it varies. */
	const SPEED = 0.95;
	const SPEED_VARY = 0.45;
	/** Fractions of the symbol's width per second squared. What turns the spray into arcs. */
	const GRAVITY = 2.4;
	/** Head radius at birth, as a fraction of the symbol's width, and how far it varies per spark. */
	const HEAD = 0.016;
	const HEAD_VARY = 0.4;
	/** How far behind its head a spark's tail reaches, in seconds of its own travel. */
	const TAIL_SECONDS = 0.055;
	/** Segments the tail is drawn in — enough to bend with the arc rather than cut across it. */
	const TAIL_STEPS = 4;

	/** White at the strike, cooling to orange as it falls. */
	const HOT = 0xfff6de;
	const COOL = 0xff7a12;

	/** A stable 0..1 per spark, so the shower is a spray of different sparks and not a repeated one. */
	const hash = (index: number, salt: number) => {
		const hashed = Math.sin((index + 1) * 12.9898 + salt) * 43758.5453;
		return hashed - Math.floor(hashed);
	};

	/** Blend two packed RGB colours. */
	const mix = (from: number, to: number, amount: number) => {
		const lerp = (shift: number) => {
			const a = (from >> shift) & 0xff;
			const b = (to >> shift) & 0xff;
			return Math.round(a + (b - a) * amount) << shift;
		};
		return lerp(16) | lerp(8) | lerp(0);
	};
</script>

<script lang="ts">
	import { Graphics, PIXI } from 'pixi-svelte';

	type Props = {
		x: number;
		y: number;
		/** The size the symbol sprite is being drawn at, so the shower rides the win pulse with it. */
		width: number;
		height: number;
		/** Seconds since this win started. */
		clock: number;
		/** Spreads the shower across the grid so two winning cars are not one animation drawn twice. */
		phase?: number;
		alpha?: number;
		/** Radians about the symbol's centre, so the shower rocks with the car it comes off. */
		rotation?: number;
	};

	const props: Props = $props();

	/** Where one spark is `age` seconds after it was struck, in symbol-widths from the source. */
	const flight = (index: number, age: number) => {
		const angle = AIM + SPREAD * (hash(index, 0) - 0.5) * 2;
		const speed = SPEED * (1 + SPEED_VARY * (hash(index, 7.3) - 0.5) * 2);
		return {
			x: Math.sin(angle) * speed * age,
			y: -Math.cos(angle) * speed * age + 0.5 * GRAVITY * age * age,
		};
	};

	const draw = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		const { width, height } = props;
		const originX = (SOURCE.x - 0.5) * width;
		const originY = (SOURCE.y - 0.5) * height;
		const seed = props.phase ?? 0;

		for (let index = 0; index < SPARKS; index += 1) {
			// Counted from when this spark is first struck rather than wrapped from zero, so the shower
			// builds over its first half-second instead of arriving whole on the win frame.
			const struck = props.clock / LIFETIME - index / SPARKS + seed;
			if (struck < 0) continue;
			const life = struck % 1;
			const age = life * LIFETIME;
			const at = flight(index, age);
			const headX = originX + at.x * width;
			const headY = originY + at.y * width;
			// Squared, so a spark holds its heat most of the way and then goes out quickly.
			const fade = (1 - life) ** 2;
			const size = HEAD * width * (1 + HEAD_VARY * (hash(index, 2.1) - 0.5) * 2) * (0.5 + 0.5 * fade);
			const colour = mix(HOT, COOL, life);

			// The tail: the same arc walked backwards, thinning as it goes, so it curves with the flight
			// instead of pointing straight back at the source.
			for (let step = 1; step <= TAIL_STEPS; step += 1) {
				const back = flight(index, Math.max(0, age - (TAIL_SECONDS * step) / TAIL_STEPS));
				const taper = 1 - step / (TAIL_STEPS + 1);
				graphics
					.circle(originX + back.x * width, originY + back.y * width, size * taper)
					.fill({ color: colour, alpha: 0.5 * fade * taper });
			}
			graphics.circle(headX, headY, size).fill({ color: colour, alpha: 0.95 * fade });
			// A soft bloom under the head, so a spark reads as a light and not as a bead.
			graphics.circle(headX, headY, size * 3.4).fill({ color: colour, alpha: 0.13 * fade });
		}
	};
</script>

<Graphics
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
	blendMode="add"
	{draw}
/>

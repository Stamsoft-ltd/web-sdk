<script lang="ts" module>
	/**
	 * How far the halo reaches, in bulb diameters. Exported so a caller that knows the size of the
	 * glow it wants — rather than the size of the bulb under it — can work back to `bulb`.
	 */
	export const LIGHT_SPREAD = 3.4;
</script>

<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// The marquee bulbs, lit.
	//
	// The bulbs are DRAWN INTO the art — on the pad (game/padMarquee.ts) they are flat cream discs,
	// on the tall congratulations marquee they are painted lit — so there is no bulb layer to switch
	// on. Their centres are found offline and this puts the light on them: a hard core inside the
	// disc and a soft halo spilling out of it, both additive.
	//
	// Two sprites rather than one because the pad is flat art. On the old rendered sign a single wide
	// glow was enough — the disc underneath was already blown out, so the glow only had to bloom what
	// was there. A flat cream disc has no light in it at all, and one wide sprite spread over it
	// either leaves the disc looking like a sticker or, turned up far enough to read as lit, washes a
	// pale ring across the rail around it. The core does the "this bulb is on" and stays inside the
	// disc; the halo does the spill and is the only part allowed outside it.
	//
	// Every glow shares one texture, so pixi batches the lot into a single draw call and only `alpha`
	// changes per frame — positions and sizes are set once at mount.

	type Props = {
		/** Bulb centres in art-width units from the art's CENTRE, both axes. */
		bulbs: readonly (readonly [number, number])[];
		/** The art's rendered width in the parent's units; the fractions are multiplied by it. */
		size: number;
		colour: number;
		/**
		 * The core's own colour, if it should not be the halo's. Defaults to `colour`, which is right
		 * wherever the bulb sits on art that is darker than it is. It is for art whose sockets are
		 * already the same warm colour as the light: adding amber to amber keeps a bulb amber, and
		 * what says LIT is a white-hot centre with the amber spilling out around it.
		 */
		coreColour?: number;
		/**
		 * A point subtracted from every bulb, for tables measured about something other than the art
		 * they belong to. It doubles as the centre the chase runs around — bulbs light by their ANGLE
		 * about it — which is why a piece set off to one side needs its own: from the whole card's
		 * centre its bulbs are all at roughly one angle and would blink as a single lump.
		 */
		origin?: { x: number; y: number };
		/**
		 * The disc's own diameter, as a fraction of the art's width. The core and halo are sized off
		 * it, so re-exporting the art at another width cannot put the light out of scale with the
		 * bulb it is lighting.
		 */
		bulb?: number;
		/** How many light fronts are running at once. */
		cycles?: number;
		/** Laps per second. */
		speed?: number;
		/** Lit floor. A marquee whose dark bulbs go out completely reads as broken, not as a chase. */
		floor?: number;
		/**
		 * Scales the halo — the only part of the light that lands OUTSIDE the disc. Turn it up for art
		 * whose bulbs are painted already lit: the disc itself is at white and cannot go brighter, so
		 * the bloom spreading onto the surround is the whole of what says this bulb just came on.
		 */
		spill?: number;
		/**
		 * How deep each bulb's own blink dips, 0-1, on top of whatever the chase is doing. Off by
		 * default: on a sign the chase IS the animation and a blink fights it. It is for a strung run
		 * of bulbs that is mostly just on — a slow wave alone leaves those looking painted, and a
		 * short dip here and there is what says the run is made of separate bulbs.
		 */
		blink?: number;
		/** 0-1 master gate, so the lights can come up as the sign lands. */
		intensity?: number;
		/** Seconds since the sign appeared; the parent owns the clock. */
		elapsed: number;
	};

	const {
		bulbs,
		size,
		colour,
		coreColour = colour,
		origin = { x: 0, y: 0 },
		bulb = 0.0155,
		cycles = 4,
		speed = 0.42,
		floor = 0.16,
		spill = 1,
		blink = 0,
		intensity = 1,
		elapsed,
	}: Props = $props();

	const TAU = Math.PI * 2;

	/** Seconds between one bulb's blinks. Each gets its own, so no two dip together. */
	const BLINK_SECONDS = { min: 1.1, max: 3.6 };
	/**
	 * How much of that time the bulb is down. The dip is a cosine raised to this power: at 1 it is a
	 * breath, and by 8 the bulb sits at full for most of its cycle and drops briefly — which is what
	 * reads as a blink rather than as a pulse.
	 */
	const BLINK_SHARPNESS = 8;

	/** Deterministic 0-1 per bulb: the pattern never changes, and it does not look like a pattern. */
	const hash = (index: number, salt: number) => {
		const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
		return value - Math.floor(value);
	};

	/** Kept inside the disc: past 1 the core's own edge starts painting the rail. */
	const CORE = 0.92;
	/** The spill. Wide enough to touch its neighbours at full brightness, which is what makes a lit
	 *  run of bulbs read as one bar of light rather than as separate dots. */
	const HALO = LIGHT_SPREAD;

	// Position, and the phase offset that decides WHEN this bulb lights. Rebuilt only when the art
	// or its size changes — never per frame.
	const nodes = $derived(
		bulbs.map(([fx, fy], index) => {
			const x = (fx - origin.x) * size;
			const y = (fy - origin.y) * size;
			// Angle about the centre, 0-1. The rails are straight in places, so this compresses a
			// little at the corners; at four fronts running it is not readable as uneven.
			const angle = (Math.atan2(y, x) / TAU + 1) % 1;
			// A deterministic nudge per bulb. Without it the fronts are too clean and the sign reads
			// as a rotating gradient rather than as a few dozen separate bulbs.
			const jitter = (((index * 2654435761) % 1000) / 1000 - 0.5) * 0.06;
			return {
				id: index,
				x,
				y,
				phase: angle * cycles + jitter,
				// Its own blink: a rate somewhere in the range, and a start anywhere in that cycle.
				blinkRate:
					1 / (BLINK_SECONDS.min + (BLINK_SECONDS.max - BLINK_SECONDS.min) * hash(index, 1)),
				blinkPhase: hash(index, 2),
			};
		}),
	);

	const coreSize = $derived(bulb * CORE * size);
	const haloSize = $derived(bulb * HALO * size);

	/** How lit this bulb is, 0-1, before the master gate. */
	const lit = (node: (typeof nodes)[number]) => {
		const wave = 0.5 + 0.5 * Math.cos(TAU * (node.phase - elapsed * speed * cycles));
		const level = floor + (1 - floor) * wave ** 3;
		if (blink <= 0) return level;
		const dip =
			(0.5 + 0.5 * Math.cos(TAU * (elapsed * node.blinkRate + node.blinkPhase))) ** BLINK_SHARPNESS;
		return level * (1 - blink * dip);
	};

	/** How much light this bulb puts out. */
	const level = (node: (typeof nodes)[number]) => lit(node) * intensity;
</script>

<!-- Halos first, so no bulb's spill washes over the core of the one beside it. -->
{#each nodes as node (node.id)}
	<Sprite
		key="spark"
		anchor={0.5}
		blendMode="add"
		x={node.x}
		y={node.y}
		width={haloSize}
		height={haloSize}
		alpha={Math.min(1, level(node) * 0.55 * spill)}
		tint={colour}
	/>
{/each}

{#each nodes as node (node.id)}
	<Sprite
		key="spark"
		anchor={0.5}
		blendMode="add"
		x={node.x}
		y={node.y}
		width={coreSize}
		height={coreSize}
		alpha={level(node)}
		tint={coreColour}
	/>
{/each}

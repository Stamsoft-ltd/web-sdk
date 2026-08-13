<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	// The marquee bulbs on the win card, lit.
	//
	// The bulbs are PAINTED INTO the panel and ring art — there is no bulb layer to switch on — so
	// their centres were found offline (see winCardParts.ts) and this draws an additive glow on each
	// one. The art underneath is the unlit state; the glow is the lighting, which means a bulb can
	// be dimmed to nothing and still look like a bulb.
	//
	// Same additive-sprite technique as <BoardFrame> and <PanelBorderLights>, for the same reason:
	// every glow shares one texture so pixi batches the whole board into a single draw call, and
	// only `alpha` changes per frame — positions and sizes are set once at mount.

	type Props = {
		/** Bulb centres in card-space fractions, from WIN_CARD_TIERS. */
		bulbs: readonly (readonly [number, number])[];
		/** Card size in the parent's units; the fractions are multiplied by it. */
		size: number;
		colour: number;
		/**
		 * Card-space point this component is drawn about, subtracted from every bulb. Pass the
		 * part's own centre and mount this inside that part's container, so the lights inherit its
		 * entrance scale and rotation instead of having to repeat them.
		 *
		 * It doubles as the centre the chase runs around — bulbs light by their ANGLE about the
		 * origin — which is why the ring needs its own rather than the card's: from the card's
		 * centre the ring's bulbs are all at roughly one angle and would blink as a single lump.
		 */
		origin?: { x: number; y: number };
		/** Glow diameter, as a fraction of the card. */
		radius?: number;
		/** How many light fronts are running at once. */
		cycles?: number;
		/** Laps per second. */
		speed?: number;
		/** Lit floor — the bulbs are painted lit, so they never go fully dark. */
		floor?: number;
		/** 0-1 master gate, so the lights can come up as the card lands. */
		intensity?: number;
		/** Seconds since the card appeared; the parent owns the clock. */
		elapsed: number;
	};

	const {
		bulbs,
		size,
		colour,
		origin = { x: 0, y: 0 },
		radius = 0.052,
		cycles = 4,
		speed = 0.42,
		floor = 0.16,
		intensity = 1,
		elapsed,
	}: Props = $props();

	const TAU = Math.PI * 2;

	// Position, and the phase offset that decides WHEN this bulb lights. Rebuilt only when the tier
	// or the card size changes — never per frame.
	const nodes = $derived(
		bulbs.map(([fx, fy], index) => {
			const x = (fx - origin.x) * size;
			const y = (fy - origin.y) * size;
			// Angle about the origin, 0-1. The strips are straight, so this compresses a little at
			// the corners; at four fronts running it is not readable as uneven.
			const angle = (Math.atan2(y, x) / TAU + 1) % 1;
			// A deterministic nudge per bulb. Without it the fronts are too clean and the board
			// reads as a rotating gradient rather than as a few hundred separate bulbs.
			const jitter = (((index * 2654435761) % 1000) / 1000 - 0.5) * 0.06;
			return { id: index, x, y, phase: angle * cycles + jitter };
		}),
	);

	const level = (phase: number) => {
		const wave = 0.5 + 0.5 * Math.cos(TAU * (phase - elapsed * speed * cycles));
		return (floor + (1 - floor) * wave ** 3) * intensity;
	};
</script>

{#each nodes as node (node.id)}
	<Sprite
		key="spark"
		anchor={0.5}
		blendMode="add"
		x={node.x}
		y={node.y}
		width={radius * size}
		height={radius * size}
		alpha={level(node.phase)}
		tint={colour}
	/>
{/each}

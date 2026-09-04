/**
 * Slime thrown across the big-win card.
 *
 * The design puts lime splats around every win screen and BURIES the MAX screen in them
 * (7103:5231) — so the amount of slime is itself a win-level cue. The static `winBlob*` sprites
 * were one drawing at four fixed rotations; these are generated, so the card is never twice the
 * same and the tier decides how much of it there is.
 *
 * Shape is taken from the MAX render: a splat is a CLOVER of two to four fat round lobes floating
 * clear of the lockup, not a drape hanging off the plate's rim. Drapes were built first and thrown
 * away twice — pointed outward they read as tentacles, pointed down as green bars.
 *
 * Everything below is in the card's own design units, measured from its CENTRE, exactly like
 * game/winCardTiers.ts — WinCard scales the whole set by one factor.
 */

export type SlimeSplat = {
	/** Fat round lobes, fused by overlap into one silhouette. */
	lobes: { x: number; y: number; r: number }[];
	/** Where drops fall from, or null for a splat that does not drip. */
	drip: { x: number; y: number; r: number } | null;
	/** Seconds per drop, so no two splats drip in time with each other. */
	period: number;
	/** Which lobes carry a specular bead, and how big. */
	highlights: { lobe: number; size: number }[];
};

type Tier = {
	/** How many splats. More slime = bigger win; this IS the cue. */
	count: number;
	/** Base lobe radius, in design units. */
	size: number;
	/** Fraction of the splats that drip. */
	dripping: number;
};

export const WIN_SLIME_TIERS: Record<string, Tier> = {
	sweet: { count: 2, size: 20, dripping: 1 },
	wild: { count: 3, size: 22, dripping: 0.7 },
	epic: { count: 4, size: 24, dripping: 0.5 },
	mythic: { count: 5, size: 26, dripping: 0.5 },
	legendary: { count: 7, size: 28, dripping: 0.45 },
	// The MAX screen is covered — big splats all round the lockup, not just at its corners.
	max: { count: 11, size: 32, dripping: 0.35 },
};

/** mulberry32 — a seeded PRNG, so a card's slime is fixed for as long as it is on screen. */
export const makeRng = (seed: number) => {
	let a = Math.floor(seed * 0xffffffff) >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

type Rect = { cx: number; cy: number; w: number; h: number };

/**
 * One splat, centred on `anchor`.
 *
 * Two builds, both in the design: lobes BUDDING off a big centre one (the clovers), and lobes
 * CHAINED end to end (the one curled down the right-hand gutter). Neighbours overlap by ~40% of
 * their combined radii, which is what fuses them instead of leaving a lumpy string.
 */
const splat = (
	anchor: { x: number; y: number },
	size: number,
	rng: () => number,
	dripping: boolean,
): SlimeSplat => {
	const n = 2 + Math.floor(rng() * 3);
	const chained = rng() < 0.35;
	const lobes = [{ x: 0, y: 0, r: size * (0.8 + rng() * 0.35) }];
	let heading = rng() * Math.PI * 2;
	for (let i = 1; i < n; i += 1) {
		const from = chained ? lobes[i - 1] : lobes[0];
		const r = size * (0.45 + rng() * 0.4);
		const angle = chained ? (heading += (rng() - 0.5) * 1.6) : heading + (i * Math.PI * 2) / n;
		const d = (from.r + r) * (0.55 + rng() * 0.2);
		lobes.push({ x: from.x + Math.cos(angle) * d, y: from.y + Math.sin(angle) * d, r });
	}

	// Recentre on the anchor, so `count` splats spread evenly however their lobes happened to fall.
	const midX = (Math.min(...lobes.map((l) => l.x)) + Math.max(...lobes.map((l) => l.x))) / 2;
	const midY = (Math.min(...lobes.map((l) => l.y)) + Math.max(...lobes.map((l) => l.y))) / 2;
	const placed = lobes.map((l) => ({ x: anchor.x + l.x - midX, y: anchor.y + l.y - midY, r: l.r }));

	const lowest = placed.reduce((a, b) => (a.y + a.r > b.y + b.r ? a : b));
	const biggest = placed.reduce((a, b, i) => (placed[a].r >= b.r ? a : i), 0);
	return {
		lobes: placed,
		// Bead size comes off the SPLAT, not the lobe it hangs from: a drop sized off a small lobe
		// ends up thinner than its own outline and renders as a black dot.
		drip: dripping ? { x: lowest.x, y: lowest.y + lowest.r * 0.55, r: size * 0.32 } : null,
		period: 4.4 + rng() * 3.6,
		highlights:
			placed.length > 2
				? [
						{ lobe: biggest, size: 0.34 },
						{ lobe: (biggest + 1) % placed.length, size: 0.26 },
					]
				: [{ lobe: biggest, size: 0.34 }],
	};
};

export const buildWinSlime = (o: {
	tierKey: string;
	/** The slab the slime runs off. Splats STRADDLE its border — they never float free. */
	ring: Rect;
	/** What the border must stay clear of, each with its own clearance in multiples of the splat
	    size — the wordmark only needs elbow room, the amount plaque has to stay readable. */
	guards: { rect: Rect; pad: number }[];
	rng: () => number;
}): SlimeSplat[] => {
	const tier = WIN_SLIME_TIERS[o.tierKey] ?? WIN_SLIME_TIERS.sweet;
	const { rng } = o;

	// Where a splat can catch: the plate's own border, minus its chamfered corners and minus
	// anywhere the wordmark, plaque or saucer sits. Sampling the perimeter and throwing candidates
	// away is what makes the slime read as stuck ON the plate — the first cut ringed the lockup at a
	// distance, and free-floating lumps look like stickers, not slime running off an edge.
	const hw = o.ring.w * 0.5;
	const hh = o.ring.h * 0.5;
	const chamfer = 0.06; // the plate's corners are cut; nothing catches on the diagonal itself
	const clear = (x: number, y: number, size: number) =>
		!o.guards.some(
			(g) =>
				Math.abs(x - g.rect.cx) < g.rect.w * 0.5 + g.pad * size &&
				Math.abs(y - g.rect.cy) < g.rect.h * 0.5 + g.pad * size,
		);

	const SAMPLES = 240;
	const spots: { x: number; y: number; nx: number; ny: number }[] = [];
	for (let i = 0; i < SAMPLES; i += 1) {
		const u = i / SAMPLES;
		const side = Math.floor(u * 4);
		const f = u * 4 - side; // 0..1 along this side
		if (f < chamfer || f > 1 - chamfer) continue;
		const k = f * 2 - 1; // -1..1 across the side
		// The plate is a hexagon, not a rectangle: its ends are cut back at an angle. Anchors near a
		// corner walk inward with the cut, or the splat catches on a corner of the bounding box that
		// has no art under it and reads as floating beside the plate.
		const cut = Math.max(0, (Math.abs(k) - 0.5) / 0.5) ** 1.3;
		const inX = cut * hw * 0.1;
		const inY = cut * hh * 0.36;
		const spot =
			side === 0
				? { x: o.ring.cx + k * hw, y: o.ring.cy - hh + inY, nx: 0, ny: -1 }
				: side === 1
					? { x: o.ring.cx + hw - inX, y: o.ring.cy + k * hh, nx: 1, ny: 0 }
					: side === 2
						? { x: o.ring.cx - k * hw, y: o.ring.cy + hh - inY, nx: 0, ny: 1 }
						: { x: o.ring.cx - hw + inX, y: o.ring.cy - k * hh, nx: -1, ny: 0 };
		spots.push(spot);
	}

	const usable = spots.filter((spot) => clear(spot.x, spot.y, tier.size));
	const source = usable.length >= tier.count ? usable : spots;
	// Walk the free border at an even stride so the splats spread all round it rather than bunching.
	const step = source.length / tier.count;
	const start = rng() * source.length;
	return Array.from({ length: tier.count }, (_, i) => {
		const spot = source[Math.floor(start + i * step + (rng() - 0.5) * step * 0.5) % source.length];
		const size = tier.size * (0.7 + rng() * 0.55);
		// Sitting ON the edge: about a third of the splat outside it, the rest over the plate face.
		const at = { x: spot.x + spot.nx * size * 0.35, y: spot.y + spot.ny * size * 0.35 };
		return splat(at, size, rng, rng() < tier.dripping);
	});
};

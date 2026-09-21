/**
 * Slime thrown across the big-win card.
 *
 * The design puts lime splats around every win screen and BURIES the MAX screen in them
 * (7103:5231) — so the amount of slime is itself a win-level cue. The static `winBlob*` sprites
 * were one drawing at four fixed rotations; these are generated, so the card is never twice the
 * same and the tier decides how much of it there is.
 *
 * Shape is taken from the MAX render: a splat is a CLOVER of two to four fat round lobes, not a
 * drape hanging off the plate's rim. Drapes were built first and thrown away twice — pointed
 * outward they read as tentacles, pointed down as green bars.
 *
 * WHERE IT SITS (2026-09-21, "it stays from nowhere"): on the plate's FACE. The clovers used to be
 * centred a third of a splat outside the border and dealt their lobes in every direction, so a
 * whole splat could hang beside the plate with nothing under it — a green lump floating in the
 * dark next to the lockup. Slime thrown at a plate sticks to the plate: its first lobe catches on
 * the border, the rest of the mass runs DOWN the face under its own weight, and only at the
 * bottom edge does it hang over. So lobe 0 lands on the border, every other lobe is dealt into
 * the downward half and clamped onto the slab, and only the bottom edge lets them spill.
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
	/**
	 * The droplets flung out when the blob hits the plate — direction, speed and size, all in
	 * multiples of the splat size so WinCard can scale them with everything else. Rolled here so a
	 * card's spray is as fixed as its splats.
	 */
	spray: { angle: number; speed: number; r: number }[];
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
	// Most splats drip: a splat that only sits there is the part that read as static.
	sweet: { count: 2, size: 20, dripping: 1 },
	wild: { count: 3, size: 22, dripping: 0.9 },
	epic: { count: 4, size: 24, dripping: 0.8 },
	mythic: { count: 5, size: 26, dripping: 0.8 },
	legendary: { count: 7, size: 28, dripping: 0.7 },
	// The MAX screen is covered — big splats all round the lockup, not just at its corners.
	max: { count: 11, size: 32, dripping: 0.55 },
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
type Point = { x: number; y: number };

/** Even-odd point-in-polygon. */
const inside = (p: Point, poly: Point[]) => {
	let hit = false;
	for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
		const a = poly[i];
		const b = poly[j];
		if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
			hit = !hit;
	}
	return hit;
};

/**
 * One splat, centred on `anchor`.
 *
 * Two builds, both in the design: lobes BUDDING off a big centre one (the clovers), and lobes
 * CHAINED end to end (the one curled down the right-hand gutter). Neighbours overlap by ~40% of
 * their combined radii, which is what fuses them instead of leaving a lumpy string.
 */
const splat = (
	anchor: Point,
	size: number,
	rng: () => number,
	dripping: boolean,
	/** The plate's silhouette. Lobes are pulled back onto it, except under a downward-facing
	    border, where they may hang over — that overhang is where the drips come from. */
	face: { outline: Point[]; hangs: boolean },
): SlimeSplat => {
	const n = 2 + Math.floor(rng() * 3);
	const chained = rng() < 0.35;
	// Lobe 0 IS the anchor: the point of impact, on the border, that the rest grows out of.
	const lobes = [{ x: anchor.x, y: anchor.y, r: size * (0.8 + rng() * 0.35) }];
	// Everything else runs DOWN. Budded lobes are dealt across the lower half, alternating sides;
	// a chain starts downward and wanders as it goes.
	const DOWN = Math.PI / 2;
	let heading = DOWN + (rng() - 0.5) * 1.1;
	for (let i = 1; i < n; i += 1) {
		const from = chained ? lobes[i - 1] : lobes[0];
		const r = size * (0.45 + rng() * 0.4);
		const side = i % 2 === 1 ? -1 : 1;
		const angle = chained
			? (heading += (rng() - 0.5) * 1.3)
			: DOWN + side * (0.35 + rng() * 0.75) * (i > 2 ? 0.5 : 1);
		const d = (from.r + r) * (0.55 + rng() * 0.2);
		lobes.push({ x: from.x + Math.cos(angle) * d, y: from.y + Math.sin(angle) * d, r });
	}

	// Onto the face: a lobe that has strayed off the plate is pulled back along its line to the
	// anchor until it is over the plate, then a little further so most of it is (a bisection on
	// the outline — the plate is a boat, and a rectangle clamp put lobes under its diagonals with
	// nothing behind them). Under a border that faces down (the foot, the diagonals) lobes below
	// the anchor are left to hang. The anchor itself keeps its border seat — it is what reads as
	// "caught on the rim".
	const placed = lobes.map((l, i) => {
		if (i === 0) return l;
		// Over a downward border the mass may hang, but only so far: the lobes are the wet mass
		// caught on the rim, and it is the drip that falls. Uncapped, a chain dealt downward ran a
		// tongue three splats long over the amount plaque's corners.
		if (face.hangs && l.y > anchor.y) return { ...l, y: Math.min(l.y, anchor.y + size * 0.9) };
		const dx = l.x - anchor.x;
		const dy = l.y - anchor.y;
		const len = Math.hypot(dx, dy) || 1e-6;
		const probe = (s: number) => ({ x: anchor.x + dx * s, y: anchor.y + dy * s });
		if (inside(probe(1 + (l.r * 0.3) / len), face.outline)) return l;
		let lo = 0;
		let hi = 1;
		for (let step = 0; step < 10; step += 1) {
			const mid = (lo + hi) / 2;
			if (inside(probe(mid), face.outline)) lo = mid;
			else hi = mid;
		}
		const s = Math.max(0.15, lo - (l.r * 0.3) / len);
		return { ...probe(s), r: l.r };
	});

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
		// Four to five droplets, flung mostly upward and to the sides — what leaves a wet mass on
		// impact — and small, a tenth to a fifth of the splat.
		spray: Array.from({ length: 4 + Math.floor(rng() * 2) }, () => ({
			angle: -Math.PI * (0.12 + rng() * 0.76),
			speed: 0.9 + rng() * 1.1,
			r: 0.1 + rng() * 0.1,
		})),
	};
};

export const buildWinSlime = (o: {
	tierKey: string;
	/** The plate's silhouette, in design units. Splats STRADDLE its border — they never float free. */
	outline: Point[];
	/** What the border must stay clear of, each with its own clearance in multiples of the splat
	    size — the wordmark only needs elbow room, the amount plaque has to stay readable. */
	guards: { rect: Rect; pad: number }[];
	rng: () => number;
}): SlimeSplat[] => {
	const tier = WIN_SLIME_TIERS[o.tierKey] ?? WIN_SLIME_TIERS.sweet;
	const { rng } = o;

	// Where a splat can catch: the plate's own silhouette, minus anywhere the wordmark, plaque,
	// saucer or medallion sits. Sampling the perimeter and throwing candidates away is what makes
	// the slime read as stuck ON the plate — the first cut ringed the lockup at a distance, and
	// free-floating lumps look like stickers, not slime running off an edge. The perimeter is the
	// traced outline (WIN_CARD_PLATE_OUTLINE) walked at an even stride by arc length; a rectangle
	// with hand-tuned corner walks was tried first and put splats inside the face and under the
	// diagonals ("they should be by the border, not some random places", 2026-09-21).
	const clear = (x: number, y: number, size: number) =>
		!o.guards.some(
			(g) =>
				Math.abs(x - g.rect.cx) < g.rect.w * 0.5 + g.pad * size &&
				Math.abs(y - g.rect.cy) < g.rect.h * 0.5 + g.pad * size,
		);

	const poly = o.outline;
	const centroid = {
		x: poly.reduce((sum, p) => sum + p.x, 0) / poly.length,
		y: poly.reduce((sum, p) => sum + p.y, 0) / poly.length,
	};
	const edges = poly.map((a, i) => {
		const b = poly[(i + 1) % poly.length];
		const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
		// Outward: whichever edge normal points away from the centroid.
		let nx = (b.y - a.y) / len;
		let ny = -(b.x - a.x) / len;
		if (nx * ((a.x + b.x) / 2 - centroid.x) + ny * ((a.y + b.y) / 2 - centroid.y) < 0) {
			nx = -nx;
			ny = -ny;
		}
		return { a, b, len, nx, ny };
	});
	const perimeter = edges.reduce((sum, e) => sum + e.len, 0);
	const SAMPLES = 240;
	const spots: { x: number; y: number; nx: number; ny: number }[] = [];
	for (let i = 0; i < SAMPLES; i += 1) {
		let d = (i / SAMPLES) * perimeter;
		for (const e of edges) {
			if (d > e.len) {
				d -= e.len;
				continue;
			}
			// Nothing catches on a corner itself: the tabs' short edges and the medallion's rim are
			// under a splat long, and a splat centred on one hangs off both sides at once.
			if (e.len >= tier.size * 1.2) {
				const f = d / e.len;
				spots.push({
					x: e.a.x + (e.b.x - e.a.x) * f,
					y: e.a.y + (e.b.y - e.a.y) * f,
					nx: e.nx,
					ny: e.ny,
				});
			}
			break;
		}
	}

	const usable = spots.filter((spot) => clear(spot.x, spot.y, tier.size));
	const source = usable.length >= tier.count ? usable : spots;
	// Walk the free border at an even stride so the splats spread all round it rather than bunching.
	const step = source.length / tier.count;
	const start = rng() * source.length;
	/** The stride's jitter can run the index below zero, and a negative index is `undefined`. */
	const at = (index: number) =>
		source[((Math.floor(index) % source.length) + source.length) % source.length];

	// AND THEY MUST NOT PILE UP ON EACH OTHER. The stride alone does not guarantee that: it jitters,
	// the sizes vary by ±30%, and a clover reaches about twice its own `size`, so two neighbours
	// could land close enough to fuse into one shapeless mass (reported 2026-09-09 — two splats read
	// as a single green lump the height of the card). Each splat is now rolled at up to TRIES spots
	// along its own stretch of border and takes the first that clears everything already down; if
	// none of them does — the border is only so long, and MAX throws eleven at it — the splat is
	// dropped rather than piled on a neighbour (see the note at the bottom of the loop).
	const MIN_GAP = 0.86; // of the two reaches summed; a little overlap still fuses handsomely
	const TRIES = 14;
	const placed: { x: number; y: number; reach: number }[] = [];
	const out: SlimeSplat[] = [];
	for (let i = 0; i < tier.count; i += 1) {
		let best: { splat: SlimeSplat; x: number; y: number; reach: number } | null = null;
		let bestScore = -Infinity;
		for (let attempt = 0; attempt < TRIES; attempt += 1) {
			const spot = at(start + i * step + (rng() - 0.5) * step * 0.5);
			const size = tier.size * (0.7 + rng() * 0.55);
			// Caught ON the border: the anchor lobe's centre sits a tenth of a splat inside the
			// outline, so it straddles the rim — over the face on one side, bulging past the edge on
			// the other: the point of impact. The rest of the splat is pulled onto the face.
			const anchor = { x: spot.x - spot.nx * size * 0.1, y: spot.y - spot.ny * size * 0.1 };
			const candidate = splat(anchor, size, rng, rng() < tier.dripping, {
				outline: poly,
				hangs: spot.ny > 0.5,
			});
			// How far the clover actually reaches from its anchor — the lobes are dealt around it, so
			// this is not `size` and is what two splats have to keep between them.
			const reach = Math.max(
				...candidate.lobes.map((lobe) => Math.hypot(lobe.x - anchor.x, lobe.y - anchor.y) + lobe.r),
			);
			const score = Math.min(
				...placed.map(
					(other) =>
						Math.hypot(other.x - anchor.x, other.y - anchor.y) - (other.reach + reach) * MIN_GAP,
				),
				Infinity,
			);
			if (score > bestScore) {
				bestScore = score;
				best = { splat: candidate, x: anchor.x, y: anchor.y, reach };
			}
			if (score >= 0) break;
		}
		// Nothing fits here: DROP this splat rather than dumping it on top of its neighbour. `count`
		// is what the tier asks for, not a quota — the border only holds so much, and a tier that
		// asks for more than fits (MAX asks for eleven) simply lands what it can. A card missing one
		// splat reads as slime; two splats fused into one lump reads as a mistake.
		if (!best || bestScore < 0) continue;
		placed.push({ x: best.x, y: best.y, reach: best.reach });
		out.push(best.splat);
	}
	return out;
};

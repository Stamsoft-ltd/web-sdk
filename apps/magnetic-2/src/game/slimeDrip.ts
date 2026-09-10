/**
 * Slime running off a blob, drawn rather than animated as art.
 *
 * The MOTHERSHIP celebration screens stick lime blobs to the value box and to the badge ring, and
 * the user asked for them to drip "like real puke/alien thing". A falling drop CHANGES SHAPE as it
 * goes — it swells at the tip, necks, pinches, snaps and stretches with its speed — and a sprite can
 * only be moved, so this is geometry.
 *
 * The target is typed structurally rather than as PIXI.Graphics: pixi.js is not a direct dependency
 * of this app (adding it breaks svelte-check on the shared style preprocessor) and pixi-svelte does
 * not re-export the class, so the drawer asks only for the methods it actually calls.
 *
 * Colours are sampled off the art itself (#9EF916 body over a #012037 outline, with the artist's
 * pale highlight), so the drawn drips are the same slime as the sprite they fall from.
 */
export const SLIME = 0x9ef916;
export const SLIME_EDGE = 0x012037;
export const SLIME_LIGHT = 0xd6ff8a;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** backOut with a small overshoot: a lobe swells past its size as it pushes out, then settles. */
const emergeEase = (t: number) => {
	const u = clamp01(t) - 1;
	return u * u * (2.2 * u + 1.2) + 1;
};

/** Everything `drawSlimeDrips` needs from a pixi Graphics — which satisfies this structurally. */
export type SlimeDripTarget = {
	moveTo(x: number, y: number): unknown;
	lineTo(x: number, y: number): unknown;
	arc(x: number, y: number, r: number, start: number, end: number, ccw?: boolean): unknown;
	closePath(): unknown;
	ellipse(x: number, y: number, rx: number, ry: number): unknown;
	fill(style: { color: number; alpha?: number }): unknown;
	stroke(style: { color: number; width: number; alpha?: number }): unknown;
};

export type SlimeDripOptions = {
	/** Where the drips leave the blob, in the same units the Graphics draws in. */
	x: number;
	y: number;
	/** Bead size — roughly an eighth of the blob's own width reads right. */
	r: number;
	/** How far a snapped drop falls before it fades out. */
	fall: number;
	/** Outline width. */
	edge: number;
	/** Seconds. */
	clock: number;
	/** Seconds per drip. */
	period: number;
	/** Phase offsets, one per concurrent drip. Defaults to `DRIP_OFFSETS`. */
	offsets?: number[];
};

/**
 * Two drops, half a cycle apart — and the second one NEGATIVE, so it has not started yet at clock
 * zero. The callers reset the drip clock to zero the moment their splat has finished oozing out;
 * with `+0.5` the second drop was already a fully drawn-out teardrop on that first frame, which is
 * the same "it just appears" artifact the emerge animation was added to remove. A cycle whose phase
 * is still below zero is skipped entirely (see the `raw < 0` guards), so it simply starts half a
 * period later instead.
 */
export const DRIP_OFFSETS = [0, -0.5];

/** Appends the drips to `g` — the caller owns clear() and anything else in the same Graphics. */
export const drawSlimeDrips = (g: SlimeDripTarget, o: SlimeDripOptions) => {
	const { x, r: R } = o;
	// Never let the outline get thick relative to the drop it is outlining: the residual bead left
	// behind after a snap shrinks to nothing, and a fixed stroke turns it into a black ring.
	const EDGE = Math.min(o.edge, R * 0.4);
	// The outline closes with a straight line across its top, so the drop STARTS inside the blob
	// (which is drawn over this) and the seam never shows.
	const top = o.y - R * 0.8;

	// A pendant drop, built as a closed outline rather than a circle on a stick: the width runs from
	// the attachment down to the bead through a WAIST that pinches as the drop gets heavier. A
	// stick-and-ball reads as a needle — slime has no straight edges anywhere.
	const teardrop = (drop: number, r: number, waist: number) => {
		const N = 14;
		const halfAt = (u: number) => {
			const e = u * u * (3 - 2 * u); // smoothstep from the attachment to the bead
			return (R * 0.92 * (1 - e) + r * e) * (1 - waist * Math.sin(Math.PI * u) ** 1.4);
		};
		g.moveTo(x - R * 0.92, top);
		for (let i = 1; i <= N; i += 1) g.lineTo(x - halfAt(i / N), top + drop * (i / N));
		g.arc(x, top + drop, r, Math.PI, 0, true);
		for (let i = N; i >= 1; i -= 1) g.lineTo(x + halfAt(i / N), top + drop * (i / N));
		g.closePath();
	};

	for (const offset of o.offsets ?? DRIP_OFFSETS) {
		const raw = o.clock / o.period + offset;
		if (raw < 0) continue; // this drop's first cycle has not begun
		const t = raw % 1;
		if (t < 0.1) continue; // the tip is still gathering
		const fade = t > 0.9 ? (1 - t) / 0.1 : 1;
		let beadY: number;
		let beadR: number;
		if (t < 0.52) {
			// Attached: the bead swells and is drawn out until the waist gives way.
			const k = (t - 0.1) / 0.42;
			beadR = R * (0.62 + 0.38 * k);
			beadY = o.y + R * 0.9 + k * R * 2.6;
			teardrop(beadY - top, beadR, 0.55 * k);
		} else {
			// Snapped: it falls, stretching with its speed, and a residual bead stays behind.
			const k = (t - 0.52) / 0.48;
			beadR = R * (0.95 - 0.2 * k);
			beadY = o.y + R * 3.5 + o.fall * k * k;
			g.ellipse(x, beadY, beadR * (1 - 0.28 * k), beadR * (1 + 0.7 * k));
			g.ellipse(x, o.y - R * 0.15, R * 0.6 * (1 - k), R * 0.45 * (1 - k));
		}
		g.fill({ color: SLIME, alpha: fade });
		g.stroke({ color: SLIME_EDGE, width: EDGE, alpha: fade });
		// The art's own specular: one light bead high on the drop.
		g.ellipse(x - beadR * 0.3, beadY - beadR * 0.35, beadR * 0.26, beadR * 0.34);
		g.fill({ color: SLIME_LIGHT, alpha: 0.85 * fade });
	}
};

export type SlimeBlobTarget = {
	circle(x: number, y: number, r: number): unknown;
	ellipse(x: number, y: number, rx: number, ry: number): unknown;
	fill(style: { color: number; alpha?: number }): unknown;
};

export type SlimeBlobOptions = {
	/** Centre-line of the drape, first point to last, in the units the Graphics draws in. */
	spine: { x: number; y: number }[];
	/** Half-width at each spine point; same length as `spine`. */
	widths: number[];
	/** Outline thickness. */
	edge: number;
	clock: number;
	/** Highlights: position along the spine (0..1) and size as a fraction of the local width. */
	highlights?: { at: number; size: number }[];
	/** How far the lower half creeps downward, as a fraction of the blob's own length. */
	sag?: number;
};

/**
 * The blob itself, drawn rather than placed as a sprite, so the drape and the drops it sheds are
 * one continuous piece of material instead of a still with animation hanging off it.
 *
 * It is a UNION OF CIRCLES rendered in two passes — every circle grown by the edge width and filled
 * dark, then every circle filled lime on top. Overlapping subpaths union under nonzero winding, so
 * one `fill()` produces a clean silhouette and the outline comes free.
 *
 * The obvious alternative — an offset outline walked down one side of the spine and back up the
 * other — was written first and thrown away: it self-crosses wherever the spine curves tighter than
 * its own half-width, which is exactly where a drape bends, and the result read as a flat sausage.
 * Each node's radius carries its own slow wobble, so the silhouette never repeats.
 */
export const drawSlimeBlob = (g: SlimeBlobTarget, o: SlimeBlobOptions) => {
	const n = o.spine.length;
	const N = 26;
	// Catmull-Rom through the control points, so the chain follows a curve rather than a polyline.
	const nodes = Array.from({ length: N + 1 }, (_, step) => {
		const u = (step / N) * (n - 1);
		const i = Math.min(n - 2, Math.floor(u));
		const f = u - i;
		const at = (k: number) => o.spine[Math.min(n - 1, Math.max(0, k))];
		const cr = (a: number, b: number, c: number, d: number) =>
			0.5 *
			(2 * b +
				(c - a) * f +
				(2 * a - 5 * b + 4 * c - d) * f * f +
				(-a + 3 * b - 3 * c + d) * f ** 3);
		const w0 = o.widths[i];
		const w1 = o.widths[Math.min(n - 1, i + 1)];
		// Round both ends by easing the radius down over the last sixth of the chain.
		const capT = Math.min(1, Math.min(step, N - step) / (N * 0.17));
		const cap = Math.sin(capT * (Math.PI / 2)) ** 0.55;
		const wobble = 1 + 0.08 * Math.sin(o.clock * (0.6 + i * 0.27) + step * 0.55);
		// A slow wave travelling down the chain: the material creeps, gathers and thins as it goes,
		// instead of holding one silhouette with a drop falling out of it.
		const along = step / N;
		const creep = (o.sag ?? 0) * along * (0.5 + 0.5 * Math.sin(o.clock * 0.5 - along * 2.4));
		const swell = 1 + 0.09 * Math.sin(o.clock * 0.8 - along * 3.1);
		return {
			x: cr(at(i - 1).x, at(i).x, at(i + 1).x, at(i + 2).x) + creep * 0.25,
			y: cr(at(i - 1).y, at(i).y, at(i + 1).y, at(i + 2).y) + creep,
			r: (w0 + (w1 - w0) * f) * cap * wobble * swell,
		};
	});

	for (const node of nodes) g.circle(node.x, node.y, node.r + o.edge);
	g.fill({ color: SLIME_EDGE });
	for (const node of nodes) g.circle(node.x, node.y, node.r);
	g.fill({ color: SLIME });

	for (const hl of o.highlights ?? []) {
		const node = nodes[Math.round(hl.at * N)];
		g.ellipse(
			node.x - node.r * 0.22,
			node.y - node.r * 0.3,
			node.r * hl.size,
			node.r * hl.size * 1.5,
		);
		g.fill({ color: SLIME_LIGHT, alpha: 0.9 });
	}
};

export type SlimeClusterOptions = {
	/** The lobes, in the units the Graphics draws in. Overlapping is the point. */
	lobes: { x: number; y: number; r: number }[];
	/** Outline thickness. */
	edge: number;
	clock: number;
	/** Highlights: which lobe, and size as a fraction of that lobe's radius. */
	highlights?: { lobe: number; size: number }[];
	/** How far the lower lobes creep downward, as a fraction of their own radius. Slime runs. */
	sag?: number;
	/**
	 * The drops this splat sheds — the SAME period/offsets as its `drawSlimeDrips` call — so the
	 * lobe they leave from swells while each drop gathers and relaxes the moment it snaps. Without
	 * this the drops fall out of a mass that never reacts to losing them. `lobe` defaults to the
	 * lowest one.
	 */
	drip?: { period: number; offsets?: number[]; lobe?: number };
	/**
	 * How far the splat has oozed out, 0..1 — 1, fully formed, is the default.
	 *
	 * Slime ARRIVES. A bead pushes through first and the rest of the mass swells out of it lobe by
	 * lobe, each one overshooting a little as it comes. A splat that simply appears at full size —
	 * or that scales up as one rigid group, which is the same pop with extra steps — reads as a
	 * sticker being pasted onto the screen, which is what this replaces.
	 *
	 * LOBE 0 IS THE ANCHOR the others grow out of, so list the lobe nearest the surface first.
	 */
	grow?: number;
};

/**
 * A SPLAT — the shape the design actually draws (7103:5231): two to four fat round lobes fused into
 * a clover, thin dark outline, one or two small pale specular beads. Not a drape.
 *
 * Same two-pass union as `drawSlimeBlob`, but the lobes are given explicitly instead of being
 * resampled off a spine: a spine smooths the radius between control points, which rounds the clover
 * off into a sausage and loses exactly the lumpiness that makes it read as slime.
 */
export const drawSlimeCluster = (g: SlimeBlobTarget, o: SlimeClusterOptions) => {
	// Slime RUNS. Every lobe below the top one creeps down on its own slow cycle, and as it runs it
	// STRETCHES — narrower and taller, the way a heavy drop pulls out of a mass — while the top of
	// the splat keeps its shape as the anchor. The first cut only bobbed the lower lobes up and down
	// as circles, and a circle that bobs reads as a bubble, not as something wet and heavy.
	//
	// The second cut (clean ellipses, one 11-second creep cycle, ±6% pulse) was reported as "the
	// static part that does not move" next to its own drops. Three things fix that, all of them how
	// a wet mass actually behaves: it has a BELLY (its underside bulges under gravity — an ellipse is
	// symmetric, so each lobe carries an extra circle low in the union), its CONTOUR is lumpy and the
	// lumps roll (small bumps riding the lower rim), and it FEEDS its drops — the lobe a drop leaves
	// from swells as the drop gathers and snaps back when it goes, which ties the mass to the one
	// thing on screen the eye already follows.
	const top = Math.min(...o.lobes.map((lobe) => lobe.y));
	const span = Math.max(...o.lobes.map((lobe) => lobe.y + lobe.r)) - top + 1e-6;

	// Emergence: lobe i starts coming out at i * EMERGE_STEP of the ramp and takes EMERGE_SPAN of
	// it, so the splat unfolds FROM lobe 0 outward — every lobe inflating together is a balloon,
	// not a mass being pushed through a surface. Each lobe also slides out of the anchor's centre
	// rather than fading in where it will end up.
	const grow = clamp01(o.grow ?? 1);
	const EMERGE_SPAN = 0.62;
	const emergeStep = o.lobes.length > 1 ? (1 - EMERGE_SPAN) / (o.lobes.length - 1) : 0;
	const anchor = o.lobes[0];

	// How full the feeding lobe is: 0 at rest, 1 the instant before the drop's waist gives way
	// (t 0.1 → 0.52 in drawSlimeDrips), then it recoils over the next 0.18 of the cycle.
	let feed = 0;
	if (o.drip) {
		for (const offset of o.drip.offsets ?? DRIP_OFFSETS) {
			const raw = o.clock / o.drip.period + offset;
			if (raw < 0) continue; // matches the same guard in drawSlimeDrips
			const t = raw % 1;
			const k = t < 0.1 ? 0 : t < 0.52 ? (t - 0.1) / 0.42 : t < 0.7 ? 1 - (t - 0.52) / 0.18 : 0;
			feed = Math.max(feed, k * k);
		}
	}
	const feedLobe =
		o.drip?.lobe ??
		o.lobes.reduce(
			(best, lobe, i) => (lobe.y + lobe.r > o.lobes[best].y + o.lobes[best].r ? i : best),
			0,
		);

	const at = (lobe: { x: number; y: number; r: number }, i: number) => {
		const down = (lobe.y - top) / span;
		const run = (o.sag ?? 0) * down * (0.5 + 0.5 * Math.sin(o.clock * 0.55 + i * 1.3));
		// Two rates per lobe — the slow heave and a quicker jelly quiver on top of it — so the
		// surface is visibly alive inside a second or two, not only across the creep cycle.
		const pulse =
			1 +
			0.05 * Math.sin(o.clock * (0.7 + i * 0.31) + i * 1.7) +
			0.035 * Math.sin(o.clock * (1.9 + i * 0.23) + i * 0.9);
		const swell = i === feedLobe ? feed : 0;
		const out = grow >= 1 ? 1 : emergeEase((grow - i * emergeStep) / EMERGE_SPAN);
		const rx = lobe.r * pulse * (1 - 0.22 * run) * (1 + 0.08 * swell) * out;
		const ry = lobe.r * pulse * (1 + 0.5 * run) * (1 + 0.24 * swell) * out;
		const x = lobe.x + lobe.r * 0.14 * down * Math.sin(o.clock * 0.42 + i * 2.1);
		// A feeding lobe hangs lower as it fills: the mass is being pulled toward the drop.
		const y = lobe.y + lobe.r * run * 1.6 + lobe.r * 0.3 * swell;
		return {
			out,
			x: anchor.x + (x - anchor.x) * out,
			y: anchor.y + (y - anchor.y) * out,
			rx,
			ry,
			// The belly: a circle low in the lobe, heaving on its own beat, so the underside is
			// fuller than the top and visibly sags rather than sitting as a symmetric oval.
			belly: {
				x: 0,
				y: ry * (0.38 + 0.08 * Math.sin(o.clock * 0.9 + i * 1.4)) + lobe.r * 0.25 * swell,
				r: rx * (0.7 + 0.06 * Math.sin(o.clock * 1.1 + i * 0.7)),
			},
			// Three lumps on the lower rim, each drifting round its arc and breathing, so the outline
			// is never the clean union of two ellipses and never the same twice.
			bumps: [0, 1, 2].map((k) => {
				const a = Math.PI * (0.22 + 0.28 * k) + 0.32 * Math.sin(o.clock * 0.5 + i * 1.1 + k * 2.1);
				const d = 0.8 + 0.05 * Math.sin(o.clock * 1.4 + k * 1.9 + i);
				return {
					x: Math.cos(a) * d * rx,
					y: Math.sin(a) * d * ry,
					r: lobe.r * (0.26 + 0.05 * Math.sin(o.clock * 1.7 + k * 2.4 + i * 0.6)),
				};
			}),
		};
	};
	const shaped = o.lobes.map(at);

	const pass = (edge: number) => {
		for (const s of shaped) {
			if (s.out <= 0.002) continue;
			// A full-width outline on a lobe that is still a bead turns it into a dark dot.
			const e = edge * Math.min(1, 0.35 + 0.65 * s.out);
			g.ellipse(s.x, s.y, s.rx + e, s.ry + e);
			g.circle(s.x + s.belly.x, s.y + s.belly.y, s.belly.r + e);
			for (const b of s.bumps) g.circle(s.x + b.x, s.y + b.y, b.r + e);
		}
	};
	pass(o.edge);
	g.fill({ color: SLIME_EDGE });
	pass(0);
	g.fill({ color: SLIME });

	for (const hl of o.highlights ?? []) {
		const s = shaped[hl.lobe];
		if (!s || s.out <= 0.002) continue;
		g.ellipse(s.x - s.rx * 0.26, s.y - s.ry * 0.3, s.rx * hl.size, s.ry * hl.size * 1.45);
		g.fill({ color: SLIME_LIGHT, alpha: 0.9 });
	}
};

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
	/** Phase offsets, one per concurrent drip (e.g. [0, 0.5] for two, half a cycle apart). */
	offsets?: number[];
};

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

	for (const offset of o.offsets ?? [0, 0.5]) {
		const t = (((o.clock / o.period + offset) % 1) + 1) % 1;
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
	const rAt = (lobe: { x: number; y: number; r: number }, i: number) =>
		lobe.r * (1 + 0.045 * Math.sin(o.clock * (0.5 + i * 0.31) + i * 1.7));
	// Slime RUNS. Every lobe below the top one creeps down and back on its own slow cycle, so the
	// splat is never the same shape twice and never reads as a sticker pasted on the art.
	const top = Math.min(...o.lobes.map((lobe) => lobe.y));
	const yAt = (lobe: { x: number; y: number; r: number }, i: number) =>
		lobe.y +
		(o.sag ?? 0) *
			lobe.r *
			((lobe.y - top) / (lobe.r + 1e-6)) *
			(0.5 + 0.5 * Math.sin(o.clock * 0.55 + i * 1.3));

	o.lobes.forEach((lobe, i) => g.circle(lobe.x, yAt(lobe, i), rAt(lobe, i) + o.edge));
	g.fill({ color: SLIME_EDGE });
	o.lobes.forEach((lobe, i) => g.circle(lobe.x, yAt(lobe, i), rAt(lobe, i)));
	g.fill({ color: SLIME });

	for (const hl of o.highlights ?? []) {
		const lobe = o.lobes[hl.lobe];
		if (!lobe) continue;
		const r = rAt(lobe, hl.lobe);
		g.ellipse(lobe.x - r * 0.26, yAt(lobe, hl.lobe) - r * 0.3, r * hl.size, r * hl.size * 1.45);
		g.fill({ color: SLIME_LIGHT, alpha: 0.9 });
	}
};

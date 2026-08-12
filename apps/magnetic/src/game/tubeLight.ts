// Shared "lit gas tube" renderer for the celebration frame (WonPanel) and every big-win sign
// (WinSign). Both screens paint their tubes FLAT in the art and light them here, and they had
// drifted into two near-identical copies of the recipe — so one tube now has one implementation.
//
// What makes a tube read as lit rather than as a painted white stripe:
//
//   * the core FADES OUT toward the electrodes. The old version was a single rounded bar at a
//     constant alpha running the full length, which stopped dead at both ends — the single biggest
//     reason it looked printed on. It is now nested bars of decreasing length that sum to a taper.
//   * the spill is wide and DEEPENS as it widens (white core -> tube colour -> a darker, denser
//     version of it), so it lands on the surrounding metal instead of stopping at the glass.
//   * the electrodes glow. A real tube is brightest where the pins enter, and that small detail is
//     what places the light INSIDE a fitting rather than on top of it.
//   * brightness carries an irregular ballast flicker, and a soft hotspot drifts inside the glass.

/** Structural — satisfied by PIXI.Graphics and by the local Graphics types both callers use. */
export type TubeG = {
	roundRect: (x: number, y: number, w: number, h: number, r: number) => unknown;
	fill: (style: object) => void;
};

export type TubeLightOpts = {
	/** Centre of the tube, in the caller's local coordinates. */
	x: number;
	y: number;
	/** Tube box. The longer axis is the tube's length; the shorter one is its thickness. */
	w: number;
	h: number;
	/** Gas colour, e.g. 0x34f6ff. */
	color: number;
	/** Clock in seconds. */
	t: number;
	/** Per-tube offset so a row of tubes never flickers in lockstep. */
	phase: number;
	/** Master 0..1, e.g. a sign part ramping its tubes up as it lands. Default 1. */
	level?: number;
};

const SPILL_LAYERS = 8;
const CORE_STEPS = 4;

export const drawTubeLight = (g: TubeG, o: TubeLightOpts) => {
	const master = o.level ?? 1;
	if (master <= 0.002) return;

	const vertical = o.h >= o.w;
	const across = vertical ? o.w : o.h; // thickness
	const along = vertical ? o.h : o.w; // length
	const p = o.phase;

	const cr = (o.color >> 16) & 0xff;
	const cg = (o.color >> 8) & 0xff;
	const cb = o.color & 0xff;
	/** Toward white — a lit gas core desaturates. */
	const hot = (c: number, k: number) => Math.round(c + (255 - c) * k);
	/** Toward black — the far spill is dense colour, not more white. */
	const deep = (c: number, k: number) => Math.round(c * k);

	// Slow breathe with sparse, sharp dips: the high powers make the dips read as a ballast
	// stuttering rather than as a smooth in/out fade.
	const breath = 0.86 + 0.14 * Math.sin(o.t * 1.35 + p);
	const dip =
		0.16 * Math.max(0, Math.sin(o.t * 21.7 + p * 3)) ** 10 +
		0.1 * Math.max(0, Math.sin(o.t * 6.9 + p * 1.7)) ** 8;
	const level = Math.max(0.35, breath - dip) * master;

	const bar = (bx: number, by: number, bw: number, bh: number, color: number, alpha: number) => {
		if (alpha <= 0.002) return;
		g.roundRect(bx - bw / 2, by - bh / 2, bw, bh, Math.min(bw, bh) / 2);
		g.fill({ color, alpha });
	};

	// ── Spill ──
	// Widens fast across the tube and only a little past its ends, so the glow hugs the fitting's
	// shape. Only PARTLY toward white at the inner layers: full white over already-bright art clips
	// additively and turns a wide tube milky grey.
	for (let k = 0; k < SPILL_LAYERS; k++) {
		const f = k / (SPILL_LAYERS - 1); // 0 = tight -> 1 = outer spill
		const grow = f ** 1.6;
		const m = 1 - f;
		const gAcross = across * (0.55 + 4.4 * grow);
		const gAlong = along * (1 + 0.3 * grow);
		// Inner layers lift toward white; outer layers sink toward a denser version of the colour.
		const k1 = 0.55 * m ** 1.8;
		const k2 = 0.55 + 0.45 * m;
		const color =
			(deep(hot(cr, k1), k2) << 16) | (deep(hot(cg, k1), k2) << 8) | deep(hot(cb, k1), k2);
		bar(
			o.x,
			o.y,
			vertical ? gAcross : gAlong,
			vertical ? gAlong : gAcross,
			color,
			(0.012 + 0.115 * m ** 2.3) * level,
		);
	}

	// ── Core ──
	// Nested full-length capsules, each shorter and brighter than the last. Summing whole bars is
	// what keeps the filament's edge clean: slicing it into per-segment alphas (the obvious way to
	// get the taper) scallops the edge where the capsules meet, and at this size that reads as a
	// rendering fault rather than as light.
	const coreColor = (hot(cr, 0.85) << 16) | (hot(cg, 0.85) << 8) | hot(cb, 0.85);
	const coreThick = across * 0.24;
	for (let k = 0; k < CORE_STEPS; k++) {
		const f = k / (CORE_STEPS - 1); // 0 = full length, 1 = the hot middle
		const len = along * (0.97 - 0.68 * f ** 1.25);
		bar(
			o.x,
			o.y,
			vertical ? coreThick : len,
			vertical ? len : coreThick,
			coreColor,
			0.1 * level,
		);
	}

	// ── Electrodes ──
	// Small dense blobs where the pins enter. Cheap, and the thing that stops the tube reading as a
	// decal sitting on the metal.
	const endColor = (hot(cr, 0.55) << 16) | (hot(cg, 0.55) << 8) | hot(cb, 0.55);
	for (const end of [-1, 1]) {
		const off = end * along * 0.47;
		for (let k = 0; k < 2; k++) {
			const r = across * (0.9 - 0.3 * k);
			bar(
				vertical ? o.x : o.x + off,
				vertical ? o.y + off : o.y,
				r,
				r,
				endColor,
				(0.13 - 0.05 * k) * level,
			);
		}
	}

	// ── Drifting hotspot ──
	// A sine sweep inside the glass, so it eases at both ends and never wraps. Three nested blobs
	// give it a soft edge.
	const c = along * 0.3 * Math.sin(o.t * 0.72 + p * 0.9);
	for (let k = 0; k < 3; k++) {
		const f = k / 2;
		const len = along * (0.16 + 0.34 * f);
		const thin = across * (0.6 - 0.2 * f);
		bar(
			vertical ? o.x : o.x + c,
			vertical ? o.y + c : o.y,
			vertical ? thin : len,
			vertical ? len : thin,
			coreColor,
			(0.17 - 0.05 * k) * level,
		);
	}
};

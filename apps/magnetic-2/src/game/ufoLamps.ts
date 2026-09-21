/**
 * The mothership's running lights.
 *
 * The ship art (ufo_ship.webp, Figma 9148:31504) paints five magenta lamp slots round the saucer
 * and the emitter oval on its underside — but they are FLAT: the same pink whatever the ship is
 * doing. This draws the light they never had, additively over the art, so the ship reads as running
 * rather than parked.
 *
 * Boxes are measured by scripts/build-ufo-ship.py — the magenta ink's own bounding boxes, found by
 * flood-filling the sprite's pink pixels (R>170, B>190, G<170), as fractions of the sprite box and
 * centre-relative. Nothing here is eyeballed; re-run the script if the art changes.
 *
 * A lit lamp is three things, and the first pass here had only the last of them (2026-09-21, "make
 * those like real lights" — on the recording they still read as painted pink): a HOT CORE, the slot
 * itself burning near-white so the eye reads a source rather than a sticker; a tight BLOOM hugging
 * the slot's rounded shape, which is the glass; and a wide SPILL of the lamp's own colour over the
 * hull around it, which is what tells you it is a light and not a decal. The old pass drew the
 * spill alone, at 0.085 alpha, and the flat pink ink underneath won.
 */
export type UfoLamp = { x: number; y: number; w: number; h: number };

/** Five rim slots, in the order light travels round them. The emitter is separate — it never chases. */
export const UFO_LAMPS: UfoLamp[] = [
	{ x: -0.3664, y: 0.2552, w: 0.1531, h: 0.1125 },
	{ x: -0.0016, y: 0.2437, w: 0.2047, h: 0.0849 },
	{ x: 0.3676, y: 0.2552, w: 0.1523, h: 0.1125 },
	{ x: 0.3086, y: 0.3842, w: 0.1031, h: 0.0728 },
	{ x: -0.3078, y: 0.3842, w: 0.1031, h: 0.0728 },
];

/** The tractor emitter's own mouth, which pulses with the beam instead of chasing. */
export const UFO_EMITTER: UfoLamp = { x: 0.0008, y: 0.4074, w: 0.3875, h: 0.1191 };

export const UFO_LAMP_COLOUR = 0xff6be0;
/** The core: the lamp's pink pushed almost to white, the way a lit tube reads at its centre. */
export const UFO_LAMP_CORE_COLOUR = 0xffe4fb;

/** Seconds for one lap of the chase. Slow: the ship is hovering, not signalling. */
export const UFO_CHASE_PERIOD = 3.6;

type LampTarget = {
	ellipse(x: number, y: number, rx: number, ry: number): unknown;
	roundRect(x: number, y: number, w: number, h: number, radius?: number): unknown;
	fill(style: { color: number; alpha?: number }): unknown;
};

/**
 * The lamp's own shape at a scale: the art's slots are pill-shaped, so the core and the bloom are
 * pills too — an ellipse over a pill leaves the slot's corners unlit, which is exactly the sticker
 * look this is replacing.
 */
const pill = (g: LampTarget, cx: number, cy: number, w: number, h: number) =>
	g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);

/**
 * Appends the glow. MUST be drawn with blendMode="add" — a solid pink ellipse over the art reads as
 * a sticker, and it is the falloff that makes it a light.
 */
export const drawUfoLamps = (
	g: LampTarget,
	o: { hullX: number; hullY: number; hullW: number; hullH: number; clock: number; level: number },
) => {
	if (o.level <= 0.001) return;
	const at = (lamp: UfoLamp, k: number, core = 1) => {
		const cx = o.hullX + lamp.x * o.hullW;
		const cy = o.hullY + lamp.y * o.hullH;
		const w = lamp.w * o.hullW;
		const h = lamp.h * o.hullH;
		const level = k * o.level;

		// SPILL: the lamp's colour over the hull, nine rings of (1-u)^2.4 out to 2.6 slot widths —
		// the same falloff the pad's bulbs use, the only shape that stays a light rather than
		// saturating into a flat disc over dark art. Wide and faint; this is what paints the hull.
		for (let i = 0; i < 9; i += 1) {
			const u = i / 8;
			g.ellipse(cx, cy, w * (0.55 + u * 1.9), h * (0.7 + u * 2.2));
			g.fill({ color: UFO_LAMP_COLOUR, alpha: 0.075 * (1 - u) ** 2.4 * level });
		}
		// BLOOM: the glass. Pills from 1.45x down to the slot's own edge, stacking towards it so
		// the brightness climbs into the slot instead of hazing evenly around it.
		for (let i = 0; i < 5; i += 1) {
			const u = i / 4;
			const grow = 1.45 - u * 0.45;
			pill(g, cx, cy, w * grow, h * grow);
			g.fill({ color: UFO_LAMP_COLOUR, alpha: 0.11 * level * (0.5 + 0.5 * core) });
		}
		// CORE: the slot itself, burning. Two pills — the full slot in the lamp colour, then a
		// smaller near-white centre — so it reads as a tube hot in the middle and pink at the rim.
		pill(g, cx, cy, w * 0.96, h * 0.9);
		g.fill({ color: UFO_LAMP_COLOUR, alpha: 0.55 * level * core });
		pill(g, cx, cy, w * 0.8, h * 0.62);
		g.fill({ color: UFO_LAMP_CORE_COLOUR, alpha: 0.7 * level * core });
	};

	const lap = (o.clock / UFO_CHASE_PERIOD) % 1;
	UFO_LAMPS.forEach((lamp, i) => {
		// A soft bump running round the ring, plus a floor so no lamp ever goes fully dark — a
		// running light is never OFF, it just breathes. On top, a small fast shimmer with its own
		// phase per lamp: the flicker of a tube, not a strobe.
		const phase = (((lap - i / UFO_LAMPS.length) % 1) + 1) % 1;
		const bump = Math.max(0, 1 - Math.min(phase, 1 - phase) * 4) ** 1.6;
		const shimmer = 1 + 0.05 * Math.sin(o.clock * (7.3 + i * 0.9) + i * 1.7);
		at(lamp, (0.55 + 0.45 * bump) * shimmer);
	});
	// The emitter is a pool of light, not a tube: full spill, but a third of the core and two thirds
	// of the bloom, or its pulse peak blew out to a white slab across the belly.
	at(UFO_EMITTER, 0.6 + 0.4 * Math.sin(o.clock * 1.7), 0.35);
};

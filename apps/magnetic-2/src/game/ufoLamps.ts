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

/** Seconds for one lap of the chase. Slow: the ship is hovering, not signalling. */
export const UFO_CHASE_PERIOD = 3.6;

type LampTarget = {
	ellipse(x: number, y: number, rx: number, ry: number): unknown;
	fill(style: { color: number; alpha?: number }): unknown;
};

/**
 * Appends the glow. MUST be drawn with blendMode="add" — a solid pink ellipse over the art reads as
 * a sticker, and it is the falloff that makes it a light.
 */
export const drawUfoLamps = (
	g: LampTarget,
	o: { hullX: number; hullY: number; hullW: number; hullH: number; clock: number; level: number },
) => {
	if (o.level <= 0.001) return;
	const at = (lamp: UfoLamp, k: number) => {
		// Nine steps of (1-u)^2.4 — the same falloff the pad's bulbs use, which is the only shape
		// that stays a light rather than saturating into a flat disc over dark art.
		for (let i = 0; i < 9; i += 1) {
			const u = i / 8;
			g.ellipse(
				o.hullX + lamp.x * o.hullW,
				o.hullY + lamp.y * o.hullH,
				lamp.w * o.hullW * (0.5 + u * 1.6),
				lamp.h * o.hullH * (0.5 + u * 1.6),
			);
			g.fill({ color: UFO_LAMP_COLOUR, alpha: 0.085 * (1 - u) ** 2.4 * k * o.level });
		}
	};

	const lap = (o.clock / UFO_CHASE_PERIOD) % 1;
	UFO_LAMPS.forEach((lamp, i) => {
		// A soft bump running round the ring, plus a floor so no lamp ever goes fully dark.
		const phase = (((lap - i / UFO_LAMPS.length) % 1) + 1) % 1;
		const bump = Math.max(0, 1 - Math.min(phase, 1 - phase) * 4) ** 1.6;
		at(lamp, 0.35 + 0.65 * bump);
	});
	at(UFO_EMITTER, 0.6 + 0.4 * Math.sin(o.clock * 1.7));
};

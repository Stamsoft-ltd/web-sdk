/**
 * The four lime bulbs painted into `my_pad`, and the light they never had.
 *
 * The pad art is flat: its bulbs are drawn highlights, so on a still frame the panel looks
 * printed. Centres and diameter below were found by colour-keying the lime pixels of my_pad.webp,
 * expressed in the design's own 1200x670 frame, so they track the art at any size.
 *
 * A first pass stacked three wide circles of additive lime. Over the pad's light violet that
 * washed out to flat GREY discs with visible edges — additive light on an already-bright surface
 * saturates. This draws a proper falloff instead (many thin steps, alpha ~ (1-u)^2.4) plus a hot
 * core, and runs a marquee CHASE around the four so they blink in turn rather than breathing in
 * unison.
 */
export const PAD_BULBS = [
	{ x: 172, y: 271 },
	{ x: 1026, y: 271 },
	{ x: 186, y: 408 },
	{ x: 1012, y: 408 },
];
export const PAD_BULB_D = 56;
const LIME = 0x9ff816;
/** The chase order is a ring, not the array order: top-left, top-right, bottom-right, bottom-left. */
const CHASE_ORDER = [0, 1, 3, 2];
const CHASE_PERIOD = 1.9;

export type BulbGlowTarget = {
	circle(x: number, y: number, r: number): unknown;
	fill(style: { color: number; alpha?: number }): unknown;
};

type Options = {
	/** Design x/y -> screen, and a design length -> screen. */
	px: (x: number) => number;
	py: (y: number) => number;
	s: (v: number) => number;
	clock: number;
	/** Scales the whole effect — 0 while the panel is still fading in. */
	intensity?: number;
};

/** Appends the glow to `g`, which must be drawn with `blendMode="add"`. */
export const drawPadBulbGlow = (g: BulbGlowTarget, o: Options) => {
	const on = o.intensity ?? 1;
	if (on <= 0) return;
	const STEPS = 9;
	for (let i = 0; i < PAD_BULBS.length; i += 1) {
		const b = PAD_BULBS[i];
		// Slow breath every bulb shares...
		const breath = 0.42 + 0.18 * Math.sin(o.clock * 1.5 + i * 1.9);
		// ...and the chase, a short bright pass that visits one bulb at a time.
		const slot = CHASE_ORDER.indexOf(i) / CHASE_ORDER.length;
		const phase = (((o.clock / CHASE_PERIOD - slot) % 1) + 1) % 1;
		const blink = phase < 0.22 ? Math.sin((phase / 0.22) * Math.PI) ** 1.6 : 0;
		const level = (breath + 0.75 * blink) * on;

		const x = o.px(b.x);
		const y = o.py(b.y);
		const r0 = o.s(PAD_BULB_D / 2);
		for (let step = 0; step < STEPS; step += 1) {
			const u = step / (STEPS - 1); // 0 = tight core, 1 = outer edge of the halo
			g.circle(x, y, r0 * (0.5 + u * 1.35));
			g.fill({ color: LIME, alpha: 0.09 * (1 - u) ** 2.4 * level });
		}
		// The filament itself: small, and the only part that goes properly hot on the blink.
		g.circle(x, y, r0 * 0.42);
		g.fill({ color: LIME, alpha: 0.18 * level + 0.3 * blink * on });
	}
};

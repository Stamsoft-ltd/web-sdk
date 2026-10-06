// The soup pot's painted drips, alive: each finger (cut by scripts/build-pot-drips.py into
// pot-drips/drip-N.webp, sitting exactly on its painted self at rest) slowly oozes longer while a bead
// swells at its tip, lets the drop go, and springs back with a little wobble; the drop falls with
// gravity, stretching as it speeds up, and fades. Every finger on its own beat. All geometry is in
// pot-IMAGE px (special-pot-v2/v3, 1080×777), so the pixi pot (SpecialMascot) and the HTML phone pot
// (PotDripsHtml) map it onto their own box.

export const POT_IMG = { w: 1080, h: 777 };

type Drip = { key: string; src: string; x: number; y: number; w: number; h: number; tipX: number; period: number; phase: number; amp: number };

// boxes from build-pot-drips.py; period / phase / stretch picked so no two fingers drop together
const D = '/assets/mcschmutzo/pot-drips';
export const POT_DRIPS: Drip[] = [
	{ key: 'potDrip0', src: `${D}/drip-0.webp`, x: 185, y: 362, w: 75, h: 96, tipX: 227.5, period: 3900, phase: 600, amp: 0.3 },
	{ key: 'potDrip1', src: `${D}/drip-1.webp`, x: 260, y: 362, w: 53, h: 156, tipX: 282.7, period: 4700, phase: 2900, amp: 0.2 },
	{ key: 'potDrip2', src: `${D}/drip-2.webp`, x: 313, y: 362, w: 87, h: 104, tipX: 336.1, period: 4300, phase: 1500, amp: 0.26 },
	{ key: 'potDrip3', src: `${D}/drip-3.webp`, x: 730, y: 362, w: 102, h: 111, tipX: 807.0, period: 4100, phase: 3600, amp: 0.26 },
	{ key: 'potDrip4', src: `${D}/drip-4.webp`, x: 832, y: 362, w: 68, h: 149, tipX: 851.9, period: 5000, phase: 400, amp: 0.2 },
];

// the art's own soup colours (sampled off the drips)
export const DRIP_COLORS = { body: 0xaabb17, edge: 0x4b5e05, light: 0xe6ef8c };

const RELEASE = 0.66; // share of the cycle spent oozing; the rest is the drop's fall + the recoil
const TIP_IN = 13; // the round tip's centre sits this far above the layer's bottom edge
const DROP_R = 15; // ≈ a finger tip's width, so the drop reads as one of them
const GRAVITY = 1500; // pot px / s²
const FADE_FALL = 230; // pot px of fall over which the drop fades out

export type DripPose = {
	/** scaleY of the finger layer, from its top edge */
	stretch: number;
	/** the bead swelling at the tip (pot px; 0 = none) */
	bead: { x: number; y: number; r: number } | null;
	/** the falling drop (pot px), stretched along its fall */
	drop: { x: number; y: number; rx: number; ry: number; alpha: number } | null;
};

export function dripPose(d: Drip, now: number): DripPose {
	const t = ((now + d.phase) % d.period) / d.period;
	const tipAt = (stretch: number) => d.y + d.h * stretch - TIP_IN;
	if (t < RELEASE) {
		const u = t / RELEASE;
		const e = u * u * (3 - 2 * u);
		const stretch = 1 + d.amp * e;
		// the bead grows out of the tip in the second half of the ooze
		const g = Math.max(0, (u - 0.35) / 0.65);
		return { stretch, bead: g > 0 ? { x: d.tipX, y: tipAt(stretch) + 4 * g, r: DROP_R * (0.55 + 0.45 * g) } : null, drop: null };
	}
	const v = (t - RELEASE) / (1 - RELEASE);
	// recoil: snaps back up and wobbles out
	const stretch = 1 + d.amp * Math.exp(-6 * v) * Math.cos(v * Math.PI * 3.2);
	const s = v * (1 - RELEASE) * (d.period / 1000);
	const fall = 0.5 * GRAVITY * s * s;
	const speed = GRAVITY * s;
	const alpha = Math.max(0, 1 - fall / FADE_FALL);
	const drop =
		alpha > 0
			? {
					x: d.tipX,
					y: tipAt(1 + d.amp) + 4 + fall,
					rx: DROP_R * (1 - Math.min(0.25, speed / 4000)),
					ry: DROP_R * (1 + Math.min(0.6, speed / 1400)),
					alpha,
				}
			: null;
	return { stretch, bead: null, drop };
}

/** Draw a bead / drop in the art's style (outline, body, gloss) on any 2D-ish path API. */
export type DripPainter = {
	ellipse: (x: number, y: number, rx: number, ry: number, color: number, alpha: number) => void;
};
export function paintDrop(p: DripPainter, x: number, y: number, rx: number, ry: number, alpha: number, k: number) {
	const o = 3.2 * k; // outline width, scaled to the pot
	p.ellipse(x, y, rx + o, ry + o, DRIP_COLORS.edge, alpha);
	p.ellipse(x, y, rx, ry, DRIP_COLORS.body, alpha);
	p.ellipse(x - rx * 0.32, y - ry * 0.3, rx * 0.28, ry * 0.36, DRIP_COLORS.light, alpha * 0.9);
}

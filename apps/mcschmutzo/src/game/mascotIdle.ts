// Subtle, realistic idle for the chef mascots. The character art is a single baked sprite (an
// earlier attempt to animate it from separate parts looked wrong), so this moves the WHOLE figure a
// hair: a slow breathe (feet-planted scale + tiny lift) and an optional slow weight-shift sway that
// pivots about the feet, so the head drifts a touch more than the boots — like someone standing
// idle. Amplitudes are deliberately tiny; the two sine periods are coprime-ish so it never visibly
// repeats. Given the base centre (cx, cy) and the sprite's (w, h), returns the tweaked placement.
export type MascotPlacement = { x: number; y: number; width: number; height: number; rotation: number };

export function mascotIdle(
	elapsed: number,
	cx: number,
	cy: number,
	w: number,
	h: number,
	opts?: { sway?: number; breathe?: number; bob?: number },
): MascotPlacement {
	const swayAmp = opts?.sway ?? 0.009; // radians (~0.5°) of lean
	const breatheAmp = opts?.breathe ?? 0.004; // ±0.4% scale
	const bobAmp = opts?.bob ?? 0.003; // ±0.3% of height

	const breathe = Math.sin(elapsed / 580); // ~3.6s breathing cycle
	const sway = Math.sin(elapsed / 950 + 1.3); // ~6s weight shift, offset phase

	const s = 1 + breathe * breatheAmp;
	const hh = h * 0.5;
	// Keep the boots planted while the chest breathes: growing by `s` about the centre would lift the
	// feet, so drop the centre by the extra half-height the scale adds.
	const feetPlant = -(s - 1) * hh;
	const bob = breathe * h * bobAmp;

	const rot = sway * swayAmp;
	// Pivot the lean about the feet (a point hh below centre): rotate the centre around that pivot so
	// the boots stay put and the sway grows toward the head.
	const d = hh * s;
	const pivotDx = d * Math.sin(rot);
	const pivotDy = d * (1 - Math.cos(rot));

	return {
		x: cx + pivotDx,
		y: cy + feetPlant - bob + pivotDy,
		width: w * s,
		height: h * s,
		rotation: rot,
	};
}

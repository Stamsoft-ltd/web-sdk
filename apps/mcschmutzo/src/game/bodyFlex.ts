// The chef's torso as soft tissue, not a cut-out: one smooth displacement field that bends his body
// art (AnimatedGuy draws the body as a mesh through it) and carries every layer pinned to it — head,
// arms, bow, nametag, collar, the held bottle — by the field's value at that layer's pivot, so
// nothing separates at a seam. It replaces the rigid whole-figure breathe (mascotIdle breathe/bob):
//
// - breath lift: the torso stretches up from its fixed bottom edge, the neck rising most;
// - chest swell: a soft radial bulge round the chest, so the shirt fills and empties;
// - lean: the shoulders follow the head's tilt a little (the head turns on a body that gives).
//
// Coordinates are figure fractions (0..1 of the AnimatedGuy frame); the result is in px.
export type BodyFlex = {
	/** neck (figure fractions) — the top of the torso, where the lift and lean are full */
	neckY: number;
	/** the torso's fixed bottom edge (figure fraction; the board cuts him off below the waist) */
	baseY: number;
	/** chest centre (figure fractions) and the swell's radius (fraction of the figure height) */
	chest: { x: number; y: number; r: number };
	/** the neck's breath lift (fraction of the height), the swell (fractional local growth), the
	 *  lean (fraction of the head's tilt taken by the shoulders) */
	lift: number;
	swell: number;
	lean: number;
};

export type FlexState = { breath: number; tilt: number };

/** A slow breath, -1..1 (the same ~3.6 s cycle mascotIdle used). */
export const breathAt = (ms: number) => Math.sin(ms / 580);

/** The field's displacement (px) at figure point (nx, ny) for a w × h figure. */
export function flexAt(f: BodyFlex, s: FlexState, nx: number, ny: number, w: number, h: number) {
	// how far up the torso this point is: 0 at the fixed bottom, 1 at the neck (and above: the head)
	const up = Math.max(0, Math.min(1, (f.baseY - ny) / (f.baseY - f.neckY)));
	const ease = up * up * (3 - 2 * up);
	let dy = -f.lift * s.breath * ease * h;
	// lean: the torso turns about its bottom edge by a share of the head's tilt (small-angle shear)
	let dx = f.lean * s.tilt * (f.baseY - Math.min(ny, f.baseY)) * h * ease;
	// chest swell: points push out from the chest centre, most at about r from it, none far away
	const px = (nx - f.chest.x) * w;
	const py = (ny - f.chest.y) * h;
	const r = f.chest.r * h;
	const g = Math.exp(-(px * px + py * py) / (2 * r * r));
	const k = f.swell * Math.max(0, s.breath * 0.5 + 0.5) * g;
	dx += px * k;
	dy += py * k;
	return { dx, dy };
}

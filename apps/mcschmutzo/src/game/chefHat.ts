// The LEGENDARY hat toss, shared by both chefs (Background's bottle chef and SpecialMascot's salting
// chef), in three clear beats (user, 2026-10-09: "jump up, rotate and go back"): it jumps up off his
// head, hangs at the top while it SPINS round like a top (about the vertical — user: "not vertically
// but horizontally"), then drops back with a squash. The 3D look — shading, edge thickness, shear and
// the shadow on his hair — is drawn by AnimatedGuy from `turn` and `dy`.
// Nothing fast: the user rejects quick shakes.

/** `turn` is the spin about the vertical, radians (0 = facing us, π = seen from behind). */
export type HatPose = { dy: number; rot: number; sy: number; turn: number };
export const HAT_REST: HatPose = { dy: 0, rot: 0, sy: 1, turn: 0 };
const SPINS = 2; // full turns at the top

const RISE_MS = 420;
const SPIN_MS = 560;
const FALL_MS = 360;
const LAND_MS = 320;
/** Whole toss, from lift-off to the end of the landing squash. */
export const HAT_TOSS_MS = RISE_MS + SPIN_MS + FALL_MS + LAND_MS;

const smooth = (x: number) => x * x * (3 - 2 * x);

/**
 * `t` ms since lift-off (the wind-up runs over the 140 ms before it); `peak` the highest lift, as a
 * fraction of the figure's height (− = up). Callers hold `peak` to the room above the figure.
 */
export const hatTossPose = (t: number, peak: number): HatPose => {
	if (t < 0) return { ...HAT_REST, sy: t > -140 ? 1 - 0.15 * Math.sin((-t / 140) * Math.PI) : 1 };
	// up: fast off the head, slowing into the top
	if (t < RISE_MS) {
		const u = t / RISE_MS;
		return { ...HAT_REST, dy: peak * (1 - (1 - u) ** 2) };
	}
	// the top: it hangs (a little float) and spins round
	const s = t - RISE_MS;
	if (s < SPIN_MS) {
		const v = s / SPIN_MS;
		return { ...HAT_REST, dy: peak * (1 + 0.06 * Math.sin(Math.PI * v)), turn: 2 * Math.PI * SPINS * smooth(v) };
	}
	// down: falling faster and faster back onto his head
	const f = s - SPIN_MS;
	if (f < FALL_MS) {
		const w = f / FALL_MS;
		return { ...HAT_REST, dy: peak * (1 - w * w) };
	}
	const land = f - FALL_MS;
	if (land < LAND_MS) return { ...HAT_REST, sy: 1 - 0.2 * Math.sin((land / LAND_MS) * Math.PI) * (1 - land / LAND_MS) };
	return HAT_REST;
};

/**
 * The toss's peak for a hat whose far corner swings `reach` (figure fractions) above its pivot at
 * `pivotY`, on a figure whose top edge is `top` px down the screen: as high as `max`, never off-screen,
 * never lower than `min`.
 */
export const hatTossPeak = (top: number, height: number, pivotY: number, reach: number, max = -0.16, min = -0.075) =>
	Math.min(min, Math.max(max, (4 - top) / height + (reach - pivotY)));

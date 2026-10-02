// The chef's pointing hand. It used to rock on one constant sine, which read as a stiff cut-out. Now
// it rests with a tiny breathing drift and, every 3–6 s (random each time), does a "point-point": a
// small anticipation lift, a quick jab toward the viewer (rotate fingertip-down, slide along the
// finger, squash on impact), a rebound, a second smaller jab, then a damped settle with a little
// overshoot. The bases under the hand were repainted so ±5° about the wrist never shows a hole.
//
// Angles are in DEGREES with + = fingertip DOWN, independent of which way the hand faces; callers
// map that to screen rotation with the fingertip side (`tip`). `along` is a fraction of the hand's
// length toward the fingertip; `squash` scales along the finger (1 = rest).

export type HandPose = { angle: number; along: number; squash: number };

const REST: HandPose = { angle: 0, along: 0, squash: 1 };

/** Tunables (exported so the report/tests can read the exact numbers). */
export const POINT_GESTURE = {
	driftDeg: 0.6,
	minGapMs: 3000,
	maxGapMs: 6000,
	// [time ms, angle deg, along, squash] — piecewise, eased between keys.
	keys: [
		[0, 0, 0, 1],
		[120, -2, 0, 1], // anticipation lift
		[200, 3, 0.015, 0.985], // tap 1: jab forward
		[245, 2.6, 0.012, 0.97], // impact squash lands just after the jab peaks
		[340, -0.8, 0, 1.005], // rebound
		[420, 1.8, 0.009, 0.982], // tap 2, smaller
	] as const,
	settleMs: 900, // damped settle after the last key
	settleTauMs: 190,
	settlePeriodMs: 380,
};

const smooth = (u: number) => u * u * (3 - 2 * u);

/** Pose `dt` ms into one point-point (0 outside it). */
export function pointPointPose(dt: number): HandPose {
	const K = POINT_GESTURE.keys;
	if (dt <= 0) return REST;
	for (let i = 0; i < K.length - 1; i++) {
		const [t0, a0, l0, s0] = K[i];
		const [t1, a1, l1, s1] = K[i + 1];
		if (dt <= t1) {
			const u = smooth((dt - t0) / (t1 - t0));
			return { angle: a0 + (a1 - a0) * u, along: l0 + (l1 - l0) * u, squash: s0 + (s1 - s0) * u };
		}
	}
	const [tEnd, aEnd, lEnd, sEnd] = K[K.length - 1];
	const s = dt - tEnd;
	if (s >= POINT_GESTURE.settleMs) return REST;
	// Damped oscillation back to rest (overshoots to ~-0.5° once), faded to exactly 0 at the end.
	const fade = 1 - smooth(s / POINT_GESTURE.settleMs);
	const k = Math.exp(-s / POINT_GESTURE.settleTauMs) * Math.cos((2 * Math.PI * s) / POINT_GESTURE.settlePeriodMs) * fade;
	return { angle: aEnd * k, along: lEnd * Math.max(0, k), squash: 1 - (1 - sEnd) * Math.max(0, k) };
}

const GESTURE_MS = POINT_GESTURE.keys[POINT_GESTURE.keys.length - 1][0] + POINT_GESTURE.settleMs;

/**
 * A per-hand scheduler: call `pose(t, breath)` every frame with a monotonic clock (ms) and the
 * figure's current breath (-1 exhaled … 1 inhaled). Each instance picks its own random gaps.
 */
export function createPointGesture(firstDelayMs = 1200 + Math.random() * 1800) {
	let next = -1;
	let last = -Infinity;
	const gap = () => POINT_GESTURE.minGapMs + Math.random() * (POINT_GESTURE.maxGapMs - POINT_GESTURE.minGapMs);
	return {
		pose(t: number, breath = 0): HandPose {
			if (next < 0) next = t + firstDelayMs;
			// A long stall (hidden tab) jumps the clock: don't replay a stale gesture, just reschedule.
			if (t > next + GESTURE_MS) {
				if (t - next > GESTURE_MS * 2) next = t + gap();
				else {
					last = next;
					next = last + gap(); // start-to-start 3–6 s
				}
			}
			if (t >= next) last = next;
			const g = pointPointPose(t - last);
			// Inhaling lifts the chest and the forearm with it: fingertip rises a touch.
			return { ...g, angle: g.angle - POINT_GESTURE.driftDeg * breath };
		},
	};
}

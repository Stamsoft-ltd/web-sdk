/**
 * Verifies that the reel stop is velocity-continuous, per docs/plans/08.
 *
 *   node apps/forest-gang/scripts/verify-reel-stop.mjs
 *
 * The eased leg's initial velocity is `f'(0) x distance / duration`, and `slideY` sets
 * `duration = distance / speed` — so handing it a speed constant makes the leg START at
 * `f'(0) x speed`, not `speed`. Four different options objects reach that leg (see the table
 * below), so no single constant can match them all. `reelStopEasingPower` (p) selects easing
 * `1 - (1 - t)^p` and speed `reelSpinSpeed / p`, which cancels to an initial velocity of exactly
 * `reelSpinSpeed` on every path.
 *
 * This replays svelte's Tween raf loop (svelte/src/motion/tweened.js) frame by frame against the
 * same constants the game ships, and asserts the junction is continuous. It is a math check, not a
 * browser capture: it will catch the constants and the easing/duration relation drifting apart, not
 * a rendering bug. Keep the SPIN_OPTIONS / SYMBOL_H values below in sync with src/game/constants.ts.
 */

const FRAME = 1000 / 60;
const SYMBOL_H = 103; // constants.ts SYMBOL_H
const REEL_LENGTH = 6; // INITIAL_BOARD reel length
const defaultY = -SYMBOL_H;

const linear = (t) => t;
const cubicOut = (t) => 1 - (1 - t) ** 3;
const powerEasing = (p) => (t) => 1 - (1 - t) ** p;

// src/game/constants.ts — SPIN_OPTIONS_*. `LEGACY_*` is what shipped before plan 08.
const P = 2; // reelStopEasingPower
const LEGACY_SPEED_BEFORE_BOUNCE = 2.8;
const LEGACY_EASING = cubicOut;

const SHARED = { reelPaddingMultiplierNormal: 1.2 };
const OPTS = {
	DEFAULT: { ...SHARED, reelSpinSpeed: 2.3, reelBounceSizeMulti: 0.3 },
	ANTICIPATED: { ...SHARED, reelSpinSpeed: 3.0, reelBounceSizeMulti: 0.2 },
	FAST: { ...SHARED, reelSpinSpeed: 4, reelBounceSizeMulti: 0.15 },
	TURBO: { ...SHARED, reelSpinSpeed: 7, reelBounceSizeMulti: 0.1 },
};

// The four paths that reach the eased leg. FAST and TURBO get there because
// createEnhanceBoardSpin maps `noStop` reels to spinType 'normal' while stateGame's predicate has
// already picked the turbo options object — the cross product the plan is about.
const PATHS = [
	{ label: 'default normalSpin      ', opts: OPTS.DEFAULT, paddingSize: REEL_LENGTH * 1.2 },
	{ label: 'anticipated reel        ', opts: OPTS.ANTICIPATED, paddingSize: REEL_LENGTH * 16 },
	{ label: 'autospin+turbo, anticip.', opts: OPTS.FAST, paddingSize: REEL_LENGTH * 1.2 },
	{ label: 'turbo, anticipation     ', opts: OPTS.TURBO, paddingSize: REEL_LENGTH * 1.2 },
];

// createReelForSpinning.addPadding(): symbols = target(6) + _.range(paddingSize)(ceil) + prev(6)
const topYFor = (paddingSize) =>
	defaultY - (REEL_LENGTH * 2 + Math.max(Math.ceil(paddingSize), 0)) * SYMBOL_H + REEL_LENGTH * SYMBOL_H;

/** One slideY leg as the raf loop actually plays it. `t0` is when .set() was called. */
function playLeg({ from, to, speed, easing, t0 }) {
	const duration = Math.abs(to - from) / speed;
	const frames = [];
	// The tick a leg resolves on is already sampled by that leg, so the next one starts a tick later.
	for (let n = Math.floor(t0 / FRAME + 1e-9) + 1; ; n++) {
		const now = n * FRAME;
		const elapsed = now - t0;
		if (elapsed > duration) {
			frames.push(to);
			break;
		}
		frames.push(from + (to - from) * easing(elapsed / duration));
	}
	return { duration, frames };
}

function run({ opts, paddingSize, mode }) {
	const splitY = defaultY * (REEL_LENGTH * opts.reelPaddingMultiplierNormal);
	const bounceY = defaultY + SYMBOL_H * opts.reelBounceSizeMulti;
	const vIn = opts.reelSpinSpeed;

	const leg1 = playLeg({ from: topYFor(paddingSize), to: splitY, speed: vIn, easing: linear, t0: 0 });
	const t1 = leg1.frames.length * FRAME; // generalSpinWith chains the next .set() on that tick

	const leg2 =
		mode === 'before'
			? playLeg({ from: splitY, to: bounceY, speed: LEGACY_SPEED_BEFORE_BOUNCE, easing: LEGACY_EASING, t0: t1 })
			: playLeg({ from: splitY, to: bounceY, speed: vIn / P, easing: powerEasing(P), t0: t1 });

	const all = [...leg1.frames, ...leg2.frames];
	const disp = all.slice(1).map((y, i) => Math.abs(y - all[i]));
	const j = leg1.frames.length - 1; // index of the first displacement inside the eased leg

	return {
		vIn,
		// analytic initial velocity of the eased leg: f'(0) x distance / duration
		vOut: (mode === 'before' ? 3 : P) * Math.abs(bounceY - splitY) / leg2.duration,
		legacyDuration: leg2.duration,
		total: t1 + leg2.duration,
		cruiseFrame: vIn * FRAME,
		easedFrames: disp.slice(j, j + 10),
		linearFrames: disp.slice(Math.max(0, j - 3), j),
	};
}

const f = (n, d = 2) => n.toFixed(d).padStart(8);
let failures = 0;
const check = (ok, msg) => {
	if (!ok) {
		failures++;
		console.log('FAIL: ' + msg);
	}
};

console.log('=== velocity at the linear->eased junction (px/ms) and leg timing ===\n');
console.log('path                      mode     v_in    v_out    ratio  eased_ms  total_ms');
for (const p of PATHS) {
	for (const mode of ['before', 'after']) {
		const r = run({ ...p, mode });
		console.log(
			`${p.label} ${mode.padEnd(6)} ${f(r.vIn)} ${f(r.vOut)} ${f(r.vOut / r.vIn)}x ` +
				`${f(r.legacyDuration, 0)} ${f(r.total, 0)}`,
		);
	}
}

console.log('\n=== per-frame displacement (px) at 60 fps: last 3 linear | first 3 eased ===\n');
for (const p of PATHS) {
	for (const mode of ['before', 'after']) {
		const r = run({ ...p, mode });
		const pre = r.linearFrames.map((x) => x.toFixed(1).padStart(6)).join(' ');
		const post = r.easedFrames.slice(0, 3).map((x) => x.toFixed(1).padStart(6)).join(' ');
		console.log(`${p.label} ${mode.padEnd(6)} ${pre} |${post}`);
	}
}

for (const p of PATHS) {
	const before = run({ ...p, mode: 'before' });
	const after = run({ ...p, mode: 'after' });

	check(
		Math.abs(after.vOut / after.vIn - 1) < 1e-9,
		`${p.label}: eased leg starts at ${after.vOut.toFixed(3)} against ${after.vIn} incoming`,
	);
	check(
		after.easedFrames.every((d) => d <= after.cruiseFrame + 1e-6),
		`${p.label}: an eased frame (${Math.max(...after.easedFrames).toFixed(1)} px) travels further ` +
			`than the incoming cruise frame (${after.cruiseFrame.toFixed(1)} px)`,
	);
	check(
		after.easedFrames.every((d, i, a) => i === 0 || d <= a[i - 1] + 1e-6),
		`${p.label}: eased leg is not monotonically decelerating`,
	);
	// Guards the regression itself: the old pairing overshot the cruise speed on every path.
	check(
		before.easedFrames.some((d) => d > before.cruiseFrame + 1e-6),
		`${p.label}: the legacy pairing no longer reproduces the spike this check exists to prevent`,
	);
}

// fastSpin (super-turbo, and turbo without anticipation) is a single linear leg with no eased
// segment. Plan 08 requires it stay that way.
{
	const opts = OPTS.TURBO;
	const leg = playLeg({
		from: topYFor(0),
		to: defaultY + SYMBOL_H * opts.reelBounceSizeMulti,
		speed: opts.reelSpinSpeed,
		easing: linear,
		t0: 0,
	});
	const disp = leg.frames.slice(1, -1).map((y, i) => Math.abs(y - leg.frames[i]));
	console.log(
		`\nfastSpin: one linear leg, ${leg.duration.toFixed(0)} ms, ` +
			`${Math.min(...disp).toFixed(1)}..${Math.max(...disp).toFixed(1)} px/frame — no eased segment`,
	);
	check(new Set(disp.map((d) => d.toFixed(6))).size === 1, 'fastSpin leg is not constant-velocity');
}

console.log('\n=== default-mode slideDown budget per reel (ms) ===\n');
console.log('reel   before    after    delta');
for (const reelIndex of [0, 1, 2, 3, 4]) {
	const paddingSize = (reelIndex + 1) * REEL_LENGTH * 1.2;
	const b = run({ opts: OPTS.DEFAULT, paddingSize, mode: 'before' });
	const a = run({ opts: OPTS.DEFAULT, paddingSize, mode: 'after' });
	console.log(`  ${reelIndex}  ${f(b.total, 0)} ${f(a.total, 0)} ${f(a.total - b.total, 0)}`);
}

console.log(failures === 0 ? '\nOK — all four eased-leg paths are velocity-continuous.' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);

// The splash → base "candy hyperspeed" (App enterGame; user, 2026-10-30: "something like funnel or
// going to superspeed with ship but in candy shop"). Sprinkles drift out of a point on the screen,
// speed up into long candy-coloured streaks inside a closing funnel, a pink-white flash at the
// peak (where the scenes swap under it), then they slow back into sprinkles and fade. Canvas 2D on
// a fixed overlay, so the Pixi and DOM scenes get the same warp.

const COLORS = ['#ff7ac3', '#ffd84a', '#5fe0d6', '#b98bff', '#ffffff', '#ff9a5c', '#8fe36b'];
const COUNT = 280;

/** Runs the warp from screen point (ox, oy) for `ms`; `peak` (0..1) is when it's fastest and
 * flashes. Resolves when it has faded. */
export function candyWarp(ox: number, oy: number, ms: number, peak = 0.42): Promise<void> {
	const canvas = document.createElement('canvas');
	canvas.className = 'candy-warp';
	canvas.setAttribute('aria-hidden', 'true');
	const dpr = Math.min(2, devicePixelRatio || 1);
	const W = innerWidth,
		H = innerHeight;
	canvas.width = Math.round(W * dpr);
	canvas.height = Math.round(H * dpr);
	document.body.append(canvas);
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		canvas.remove();
		return Promise.resolve();
	}
	ctx.scale(dpr, dpr);
	// Far enough to reach every corner from the origin.
	const R = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
	const bits = Array.from({ length: COUNT }, (_, i) => ({
		a: Math.random() * Math.PI * 2,
		d: Math.random() * 1.1,
		v: 0.55 + Math.random() * 0.9,
		w: 3.5 + Math.random() * 4.5,
		c: COLORS[i % COLORS.length],
	}));
	const t0 = performance.now();
	let last = t0;
	return new Promise((done) => {
		const frame = (now: number) => {
			// rAF's time is its frame's start, which can be before t0.
			const p = Math.max(0, Math.min(1, (now - t0) / ms));
			const dt = Math.max(0, Math.min(50, now - last)) / 1000;
			last = now;
			// Speed: eases up to the peak, then brakes hard and coasts out.
			const s = p < peak ? (p / peak) ** 2.2 : (1 - (p - peak) / (1 - peak)) ** 2.6;
			// Whole-effect opacity: in fast, out over the last 35%.
			const env = Math.min(1, p / 0.08) * Math.min(1, (1 - p) / 0.35);
			ctx.clearRect(0, 0, W, H);
			// The funnel: the edges close in toward the origin as it speeds up.
			// (It also hides the splash's edge as it rushes past the base world behind it.)
			const inner = R * (0.85 - 0.7 * s);
			const fun = ctx.createRadialGradient(ox, oy, inner, ox, oy, R);
			fun.addColorStop(0, 'rgba(255, 90, 190, 0)');
			fun.addColorStop(0.35, `rgba(214, 70, 200, ${0.45 * s * env})`);
			fun.addColorStop(1, `rgba(70, 12, 120, ${0.92 * s * env})`);
			ctx.fillStyle = fun;
			ctx.fillRect(0, 0, W, H);
			ctx.lineCap = 'round';
			for (const b of bits) {
				b.d += b.v * (0.05 + 2.6 * s) * dt;
				if (b.d > 1.15) {
					b.d = 0.02 + Math.random() * 0.1;
					b.a = Math.random() * Math.PI * 2;
				}
				// A sprinkle at rest, a streak at speed; thicker as it comes at you.
				const len = 0.015 + 0.7 * s * b.d;
				const r0 = b.d * R,
					r1 = (b.d + len) * R;
				const cos = Math.cos(b.a),
					sin = Math.sin(b.a);
				ctx.globalAlpha = env * Math.min(1, b.d * 5);
				ctx.strokeStyle = b.c;
				ctx.lineWidth = b.w * (0.5 + b.d);
				ctx.beginPath();
				ctx.moveTo(ox + cos * r0, oy + sin * r0);
				ctx.lineTo(ox + cos * r1, oy + sin * r1);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
			// The flash at the peak: the scenes swap under it.
			const f = Math.min(1, 1.4 * Math.max(0, 1 - Math.abs(p - peak) / 0.13));
			if (f > 0) {
				const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, R);
				g.addColorStop(0, `rgba(255, 255, 255, ${f})`);
				g.addColorStop(0.5, `rgba(255, 205, 236, ${0.95 * f})`);
				g.addColorStop(1, `rgba(255, 140, 205, ${0.85 * f})`);
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, W, H);
			}
			if (p < 1) requestAnimationFrame(frame);
			else {
				canvas.remove();
				done();
			}
		};
		requestAnimationFrame(frame);
	});
}

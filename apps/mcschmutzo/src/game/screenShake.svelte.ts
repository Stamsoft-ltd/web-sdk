// Screen shake for impacts, applied to the board group (Game.svelte) in canvas px — the background
// stays put (shaking it would open gaps at the screen edges). Each `shake(px, ms)` adds an impulse
// that jolts hard and dies off (quadratic); overlapping impulses add up. Scale by event:
//   WILD lands ≈ 2.5px / 110ms · pot impact ≈ 2px · big win 5px, mega 7px, top tiers 8px.
// Off under prefers-reduced-motion.

type Impulse = { at: number; px: number; ms: number; seed: number };

export const screenShake = $state({ x: 0, y: 0 });

let impulses: Impulse[] = [];
let raf = 0;
let seq = 0;

const tick = (ts: number) => {
	let x = 0;
	let y = 0;
	impulses = impulses.filter((i) => ts - i.at < i.ms);
	for (const i of impulses) {
		const u = Math.max(0, (ts - i.at) / i.ms);
		const amp = i.px * (1 - u) ** 2;
		// two detuned sines per axis: an irregular rattle, not a wobble
		x += amp * (0.7 * Math.sin(ts / 17 + i.seed) + 0.3 * Math.sin(ts / 29 + i.seed * 2.1));
		y += amp * 0.8 * (0.7 * Math.cos(ts / 19 + i.seed * 1.3) + 0.3 * Math.sin(ts / 31 + i.seed));
	}
	screenShake.x = x;
	screenShake.y = y;
	raf = impulses.length ? requestAnimationFrame(tick) : 0;
};

export const shake = (px: number, ms: number) => {
	if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	impulses.push({ at: performance.now(), px, ms, seed: (seq += 1.7) });
	if (!raf) raf = requestAnimationFrame(tick);
};

/** A shake that lands `delay` ms from now. */
export const shakeAfter = (delay: number, px: number, ms: number) => {
	if (delay <= 0) shake(px, ms);
	else setTimeout(() => shake(px, ms), delay);
};

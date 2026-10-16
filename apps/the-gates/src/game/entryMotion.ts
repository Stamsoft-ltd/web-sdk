/** Presentation-only timeline, independent of wagers and spin speed. */
export const LANDING_EXIT_MS = 1250;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const progress = (age: number, delay: number, duration: number) => clamp((age - delay) / duration);
const smooth = (p: number) => p * p * (3 - 2 * p);
function settle(p: number) {
	const t = p - 1;
	return 1 + 1.45 * t * t * t + 0.45 * t * t;
}
export function landingIntroFrame(age: number, reduced = false) {
	if (reduced) {
		const p = clamp(age / 140);
		return { cards: [0, 0, 0], logo: 0, alpha: p, caption: p, done: p === 1 };
	}
	return {
		cards: [0, 1, 2].map((i) => 1 - settle(progress(age, i * 140, 450))),
		logo: 1 - settle(progress(age, 760, 460)),
		alpha: 1,
		caption: smooth(progress(age, 1080, 170)),
		done: age >= 1250,
	};
}
export function landingExitFrame(age: number, reduced = false) {
	if (reduced) {
		const p = clamp(age / 140);
		return { cards: [p, p, p], logo: p, background: 1 - p, caption: 1 - p, done: p === 1 };
	}
	return {
		cards: [0, 1, 2].map((i) => progress(age, i * 65, 380) ** 2),
		logo: smooth(progress(age, 300, 850)),
		background: 1 - smooth(progress(age, 300, 450)),
		caption: 1 - progress(age, 0, 160),
		done: age >= LANDING_EXIT_MS,
	};
}
export function gameArrivalFrame(age: number, reduced = false) {
	if (reduced) {
		const p = clamp(age / 140);
		return { offset: 0, alpha: p, done: p === 1 };
	}
	const p = progress(age, 370, 650);
	return { offset: 1 - settle(p), alpha: progress(age, 330, 100), done: age >= LANDING_EXIT_MS };
}
export function interpolateBox(
	a: { x: number; y: number; width: number; height: number },
	b: typeof a,
	p: number,
) {
	return {
		x: a.x + (b.x - a.x) * p,
		y: a.y + (b.y - a.y) * p,
		width: a.width + (b.width - a.width) * p,
		height: a.height + (b.height - a.height) * p,
	};
}

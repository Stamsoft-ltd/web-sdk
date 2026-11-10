/** Decorative only. The authoritative cluster determines Wild color, never eligibility. */
import { CLUSTER_GESTURE_MS, GEM_GESTURE_MS } from './symbolClusterMotion.ts';
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
	x = clamp(x);
	return x * x * (3 - 2 * x);
};
const ramp = (p: number, a: number, b: number) => ease((p - a) / (b - a));
const bump = (p: number, a: number, b: number, c: number, d: number) =>
	ramp(p, a, b) * (1 - ramp(p, c, d));
export function premiumSymbolFrame(age: number, reduced = false) {
	const p = reduced ? 0 : clamp(age / CLUSTER_GESTURE_MS);
	return {
		blink: bump(p, 0.12, 0.18, 0.2, 0.28),
		brow: bump(p, 0.3, 0.46, 0.63, 0.88),
		flap: bump(p, 0.14, 0.4, 0.61, 0.88),
		seal: bump(p, 0.06, 0.22, 0.7, 0.94),
		// Exact supplied closed envelope at both endpoints; parts blend in before opening.
		parts: bump(p, 0.035, 0.12, 0.92, 0.99),
	};
}
export function wildSymbolFrame(age: number, reduced = false) {
	const p = reduced ? 0 : clamp(age / GEM_GESTURE_MS),
		active = ramp(p, 0.05, 0.25) * (1 - ramp(p, 0.78, 0.98));
	return {
		light: active * (0.9 + 0.1 * Math.sin(p * Math.PI * 6)),
		halo: active * 0.8,
		glints: Array.from({ length: 6 }, (_, i) => {
			const t = (p - (0.13 + i * 0.085)) / 0.19;
			return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI) * active;
		}),
	};
}
/** Shared hinge/fragment geometry in the normalized 300px symbol space. */
export const ENVELOPE_HINGE_Y = 78;
export const ENVELOPE_SEAL_Y = 178;
export function envelopeLidPose(flap: number, seal: number) {
	const cosine = Math.cos(clamp(flap) * Math.PI);
	return {
		flapScale: -cosine,
		upperScale: cosine,
		upperY: ENVELOPE_HINGE_Y + (ENVELOPE_SEAL_Y - ENVELOPE_HINGE_Y) * cosine,
		lowerY: ENVELOPE_SEAL_Y + 4 * clamp(seal),
		inFront: cosine >= 0,
	};
}
/** All pale crystal pixels, including outer facets; not six small center ellipses.
 * Chroma protects gold. The center diamond and dark ink remain untouched.
 */
export function wildCrystalWeight(
	x: number,
	y: number,
	r: number,
	g: number,
	b: number,
	a: number,
) {
	if (a <= 0 || Math.abs(x - 0.5) + Math.abs(y - 0.5) < 0.225) return 0;
	if (Math.hypot(x - 0.5, y - 0.5) > 0.51) return 0;
	const hi = Math.max(r, g, b),
		lo = Math.min(r, g, b);
	if (hi < 90 || lo / hi < 0.35 || b < r * 0.9 || g < r * 0.9) return 0;
	return ease((lo / hi - 0.35) / 0.2) * (a / 255);
}

/** Keep the six large connected crystal interiors, excluding tiny white glints on gold.
 * One-time preparation only; O(pixels), no animation-frame readback or filtering.
 */
export function wildCrystalMask(
	rgba: Uint8ClampedArray,
	width: number,
	height: number,
	pad: number,
	ink: number,
) {
	const weights = new Uint8ClampedArray(width * height),
		seen = new Uint8Array(weights.length),
		queue = new Int32Array(weights.length);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const n = y * width + x,
				i = n * 4;
			weights[n] = Math.round(
				255 *
					wildCrystalWeight(
						(x - pad) / ink,
						(y - pad) / ink,
						rgba[i],
						rgba[i + 1],
						rgba[i + 2],
						rgba[i + 3],
					),
			);
		}
	const components: number[][] = [];
	for (let n = 0; n < weights.length; n++) {
		if (seen[n] || weights[n] < 12) continue;
		let head = 0,
			tail = 1;
		queue[0] = n;
		seen[n] = 1;
		const component: number[] = [];
		while (head < tail) {
			const i = queue[head++];
			component.push(i);
			for (const j of [
				i % width ? i - 1 : -1,
				i % width < width - 1 ? i + 1 : -1,
				i - width,
				i + width,
			]) {
				if (j < 0 || j >= weights.length || seen[j] || weights[j] < 12) continue;
				seen[j] = 1;
				queue[tail++] = j;
			}
		}
		components.push(component);
	}
	const result = new Uint8ClampedArray(weights.length);
	for (const component of components.sort((a, b) => b.length - a.length).slice(0, 6)) {
		if (component.length < width * height * 0.002) continue;
		for (const i of component) result[i] = weights[i];
	}
	return result;
}

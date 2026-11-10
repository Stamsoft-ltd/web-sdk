import type { SymbolName } from './contract';
import type { Speed } from './uiPolicy';
/** Internal artwork only. Outcome eligibility and playback barriers remain authoritative. */
export const CLUSTER_SYMBOLS: readonly SymbolName[] = [
	'CRYSTAL_ORB',
	'SACRED_EYE',
	'SUN_MEDALLION',
	'GUARDIAN_MASK',
	'RUNE_CHALICE',
	'WILD',
	'RED_GEM',
	'BLUE_GEM',
	'GREEN_GEM',
	'PURPLE_GEM',
	'AMBER_GEM',
];
export const CLUSTER_GESTURE_MS = 900;
// Gem light sweeps need more breathing room; keep Eye / Sun / Orb unchanged.
export const GEM_GESTURE_MS = 1800;
export function clusterGestureMs(name: SymbolName) {
	return name.endsWith('_GEM') || name === 'WILD' ? GEM_GESTURE_MS : CLUSTER_GESTURE_MS;
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => {
	v = clamp(v);
	return v * v * (3 - 2 * v);
};
const ramp = (p: number, a: number, b: number) => ease((p - a) / (b - a));
export function clusterClock(age: number, deltaMs: number, speed: Speed, paused = false) {
	return Math.min(
		Math.max(CLUSTER_GESTURE_MS, GEM_GESTURE_MS),
		Math.max(0, age) +
			(paused ? 0 : Math.max(0, deltaMs) * (speed === 'turbo' ? 3 : speed === 'fast' ? 2 : 1)),
	);
}
export function clusterFrame(age: number, reduced = false, duration = CLUSTER_GESTURE_MS) {
	const p = reduced ? 0 : clamp(age / duration),
		active = ramp(p, 0.06, 0.2) * (1 - ramp(p, 0.76, 0.96));
	const keys = [
		[0, 0, 0],
		[0.1, 0, 0],
		[0.22, -44, -2],
		[0.36, -44, -2],
		[0.52, 44, 0],
		[0.64, 44, 0],
		[0.76, 7, -13],
		[0.84, 7, -13],
		[1, 0, 0],
	];
	let x = 0,
		y = 0;
	for (let i = 1; i < keys.length; i++)
		if (p <= keys[i][0]) {
			const a = keys[i - 1],
				b = keys[i],
				t = ease((p - a[0]) / (b[0] - a[0]));
			x = a[1] + (b[1] - a[1]) * t;
			y = a[2] + (b[2] - a[2]) * t;
			break;
		}
	return {
		p,
		active,
		eyeX: x,
		eyeY: y,
		irisWidth: 131 * (1 - 0.16 * (x / 44) ** 2),
		irisHeight: 131 * (1 - 0.06 * (y / 13) ** 2),
		orbAngle: -Math.PI * 6 * ramp(p, 0.08, 0.82),
		sunAngle: Math.PI * 2 * ramp(p, 0.1, 0.9),
		shineX: -110 + ramp(p, 0.1, 0.83) * 520,
		sparkle: active * Math.max(0, Math.sin((p - 0.48) * Math.PI * 5)),
	};
}
/** Keep the previous ink footprint despite transparent margins in the old atlas. */
export function clusterArtUnits(name: SymbolName) {
	return name === 'WILD'
		? (260 * 292) / 278 / 0.9
		: name === 'RUNE_CHALICE'
			? 152.88888888888889
			: name === 'SACRED_EYE'
				? 144
				: name.endsWith('_GEM')
					? 160
					: 120;
}
export const SYMBOL_PART_FILES = {
	sunBadge: './assets/the-gates/symbol-parts/sun/badge.png',
	sunRays: './assets/the-gates/symbol-parts/sun/rays.png',
	sunFace: './assets/the-gates/symbol-parts/sun/face.png',
	orbFrame: './assets/the-gates/symbol-parts/orb/frame.png',
	orbSpiral: './assets/the-gates/symbol-parts/orb/spiral.png',
	eyeBorder: './assets/the-gates/symbol-parts/eye/border.png',
	eyeBackground: './assets/the-gates/symbol-parts/eye/background.png',
	eyeIris: './assets/the-gates/symbol-parts/eye/iris.png',
	pharaohBody: './assets/the-gates/symbol-parts/pharaoh/body.png',
	pharaohEyeLeft: './assets/the-gates/symbol-parts/pharaoh/eye-left.png',
	pharaohEyeRight: './assets/the-gates/symbol-parts/pharaoh/eye-right.png',
	pharaohBrowLeft: './assets/the-gates/symbol-parts/pharaoh/brow-left.png',
	pharaohBrowRight: './assets/the-gates/symbol-parts/pharaoh/brow-right.png',
	pharaohGem: './assets/the-gates/symbol-parts/pharaoh/gem.png',
	envelopeClosed: './assets/the-gates/art/symbols/envelope.png',
	envelopeBody: './assets/the-gates/symbol-parts/envelope/body.png',
	envelopeFlap: './assets/the-gates/symbol-parts/envelope/flap.png',
	envelopeSealLower: './assets/the-gates/symbol-parts/envelope/seal-lower.png',
	wildFlower: './assets/the-gates/wild/flower.png',
} as const;

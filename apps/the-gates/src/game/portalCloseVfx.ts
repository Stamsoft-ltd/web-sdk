import { Graphics } from 'pixi.js';
import { Physics, type Skeleton } from '@esotericsoftware/spine-core';
import { portalCloseFrame } from './portalClose.ts';
export function applyPortalClose(skeleton: Skeleton, progress: number, reduced = false) {
	const f = portalCloseFrame(progress, reduced),
		root = skeleton.findBone('portal-root');
	if (root) root.scaleX = root.scaleY = f.scale;
	for (const [name, rotation] of [
		['portal-rim', -0.55],
		['portal-vortex', 1.8],
	] as const) {
		const bone = skeleton.findBone(name),
			slot = skeleton.findSlot(name);
		if (bone) bone.rotation += (f.rotation * rotation * 180) / Math.PI;
		if (slot) slot.color.a = f.alpha;
	}
	skeleton.updateWorldTransform(Physics.update);
	return f;
}
/** Bounded geometry: seven curls, one pin and six sparks; no textures/filters. */
export function drawPortalClose(
	g: Graphics,
	p: number,
	x: number,
	y: number,
	radius: number,
	color: number,
	reduced = false,
) {
	const f = portalCloseFrame(p, reduced);
	if (reduced || p <= 0 || p >= 1) return;
	for (let i = 0; i < 7; i++) {
		const lag = Math.max(0, p - i * 0.018),
			r = radius * (1 - lag),
			a = i * 2.4 + f.rotation * 3 + lag * 3;
		g.arc(x, y, r, a, a + 0.32).stroke({
			color,
			width: Math.max(1, radius * 0.018),
			alpha: Math.sin(Math.PI * p) * (1 - i / 9) * 0.7,
		});
	}
	if (f.pin > 0) {
		for (let i = 3; i >= 1; i--)
			g.circle(x, y, (((3 + 7 * f.pin) * radius) / 150) * i).fill({ color, alpha: f.pin * 0.07 });
		g.circle(x, y, ((3 + 7 * f.pin) * radius) / 150).fill({ color: 0xfff9db, alpha: f.pin });
	}
	if (p > 0.78)
		for (let i = 0; i < 6; i++) {
			const q = (p - 0.78) / 0.22,
				a = (i * Math.PI) / 3,
				d = ((8 + q * 24) * radius) / 150;
			g.circle(
				x + Math.cos(a) * d,
				y + Math.sin(a) * d,
				Math.max(0.1, (2 * (1 - q) * radius) / 150),
			).fill({ color, alpha: (1 - q) * 0.8 });
		}
}

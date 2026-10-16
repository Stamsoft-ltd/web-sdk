/** Native motion-workbench Canvas2D adapter only. Runtime gameplay is Pixi. */
import {
	BlendMode,
	MeshAttachment,
	RegionAttachment,
	type TextureAtlasRegion,
} from '@esotericsoftware/spine-core';
import { SpinePose as Actor } from '../src/game/spine.ts';
import { cachedRegion } from './region-cache.ts';
import { recordMotionFrame } from '../src/game/motionMetrics.ts';
type Tick = (delta: number, now: number) => void;
const subscribers = new Set<Tick>();
let frame = 0,
	previous = 0,
	nextFrameAt = 0;
function tick(now: number) {
	frame = requestAnimationFrame(tick);
	if (document.hidden) {
		previous = now;
		nextFrameAt = now;
		return;
	}
	if (now + 0.5 < nextFrameAt) return;
	// Advance the deadline, not "now + frame": avoids 30/40ms cadence from RAF rounding.
	const budget = 1000 / 60;
	nextFrameAt += budget;
	if (nextFrameAt <= now) nextFrameAt += (Math.floor((now - nextFrameAt) / budget) + 1) * budget;
	const interval = now - previous;
	const delta = Math.min(interval / 1000, 0.067);
	previous = now;
	if (document.hidden) return;
	const start = performance.now();
	for (const draw of subscribers) draw(delta, now);
	recordMotionFrame(interval, performance.now() - start);
}
export function spineClock(draw: Tick) {
	subscribers.add(draw);
	if (!frame) {
		previous = performance.now();
		nextFrameAt = previous + 1000 / 60;
		frame = requestAnimationFrame(tick);
	}
	return () => {
		subscribers.delete(draw);
		if (!subscribers.size) {
			cancelAnimationFrame(frame);
			frame = 0;
		}
	};
}

export class SpinePose extends Actor {
	private vertices = new Float32Array(8);
	private meshVertices = new Float32Array(128);
	/** Draw regions with bone-derived affine transforms; no CSS animation of flat art. */
	draw(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy = sx) {
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(sx, -sy);
		for (const slot of this.skeleton.drawOrder) {
			const a = slot.getAttachment();
			if (!slot.bone.active || slot.color.a <= 0) continue;
			if (a instanceof MeshAttachment) {
				if (this.meshVertices.length < a.worldVerticesLength)
					this.meshVertices = new Float32Array(a.worldVerticesLength);
				a.computeWorldVertices(slot, 0, a.worldVerticesLength, this.meshVertices, 0, 2);
				const region = a.region as TextureAtlasRegion;
				if (!region) continue;
				const image = region.texture.getImage() as HTMLImageElement;
				ctx.save();
				ctx.globalAlpha = slot.color.a * a.color.a * this.skeleton.color.a;
				ctx.globalCompositeOperation =
					slot.data.blendMode === BlendMode.Additive ? 'lighter' : 'source-over';
				for (let i = 0; i < a.triangles.length; i += 3) {
					const ids = a.triangles.slice(i, i + 3).map((index) => index * 2);
					const [p, q, r] = ids;
					const u0 = a.uvs[p] * image.width,
						v0 = a.uvs[p + 1] * image.height;
					const u1 = a.uvs[q] * image.width - u0,
						v1 = a.uvs[q + 1] * image.height - v0;
					const u2 = a.uvs[r] * image.width - u0,
						v2 = a.uvs[r + 1] * image.height - v0;
					const det = u1 * v2 - u2 * v1;
					if (Math.abs(det) < 1e-6) continue;
					const v = this.meshVertices,
						x1 = v[q] - v[p],
						y1 = v[q + 1] - v[p + 1],
						x2 = v[r] - v[p],
						y2 = v[r + 1] - v[p + 1];
					const aa = (x1 * v2 - x2 * v1) / det,
						bb = (y1 * v2 - y2 * v1) / det,
						cc = (x2 * u1 - x1 * u2) / det,
						dd = (y2 * u1 - y1 * u2) / det;
					ctx.save();
					ctx.beginPath();
					ctx.moveTo(v[p], v[p + 1]);
					ctx.lineTo(v[q], v[q + 1]);
					ctx.lineTo(v[r], v[r + 1]);
					ctx.closePath();
					ctx.clip();
					ctx.transform(aa, bb, cc, dd, v[p] - aa * u0 - cc * v0, v[p + 1] - bb * u0 - dd * v0);
					ctx.drawImage(image, 0, 0);
					ctx.restore();
				}
				ctx.restore();
				continue;
			}
			if (!(a instanceof RegionAttachment)) continue;
			const region = a.region as TextureAtlasRegion;
			if (!region || region.degrees) continue;
			a.computeWorldVertices(slot, this.vertices, 0, 2);
			const v = this.vertices;
			ctx.save();
			ctx.globalAlpha = slot.color.a * a.color.a * this.skeleton.color.a;
			ctx.globalCompositeOperation =
				slot.data.blendMode === BlendMode.Additive ? 'lighter' : 'source-over';
			// v2=top-left, v4=top-right, v0=bottom-left (Spine Y-up).
			ctx.transform(
				(v[4] - v[2]) / region.width,
				(v[5] - v[3]) / region.width,
				(v[0] - v[2]) / region.height,
				(v[1] - v[3]) / region.height,
				v[2],
				v[3],
			);
			const image = region.texture.getImage() as HTMLImageElement;
			const cached = cachedRegion(
				region,
				image,
				Math.hypot(v[4] - v[2], v[5] - v[3]) * Math.abs(sx),
				Math.hypot(v[0] - v[2], v[1] - v[3]) * Math.abs(sy),
			);
			if (cached) ctx.drawImage(cached, 0, 0, region.width, region.height);
			else
				ctx.drawImage(
					image,
					region.x,
					region.y,
					region.width,
					region.height,
					0,
					0,
					region.width,
					region.height,
				);
			ctx.restore();
		}
		ctx.restore();
	}
}

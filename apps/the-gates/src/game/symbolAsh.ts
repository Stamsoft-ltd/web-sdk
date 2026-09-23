import {
	AtlasAttachmentLoader,
	FakeTexture,
	SkeletonJson,
	TextureAtlas,
} from '@esotericsoftware/spine-core';
import { SpinePose } from './spine.ts';
import { visualRandom } from './visualRandom.ts';

export type AshTiming = { startedAt: number; delay: number; duration: number; seed: string };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const ashProgress = (now: number, timing: AshTiming) =>
	clamp((now - timing.startedAt - timing.delay) / Math.max(1, timing.duration));

/** Cosmetic only: stable per reveal/cell, never consumes outcome randomness. */
export function ashFragments(seed: string) {
	const random = visualRandom(seed);
	return Array.from({ length: 100 }, (_, i) => ({
		x: i % 10,
		y: Math.floor(i / 10),
		start: random() * 0.25,
		dx: (random() - 0.5) * 0.32,
		dy: 0.05 + random() * 0.2,
		turn: (random() - 0.5) * 2.4,
		ember: random() < 0.07,
	}));
}

/** One removal-only Spine rig: independent bones and original/charred texture layers.
 * Normalized one-second track is scrubbed by the live removal-wave deadline.
 */
export function ashRig(seed: string, width: number, height: number) {
	const flakes = ashFragments(seed);
	const tiles = flakes.map((f, i) => {
		const x = Math.floor((f.x * width) / 10),
			y = Math.floor((f.y * height) / 10);
		return {
			...f,
			i,
			px: x,
			py: y,
			w: Math.floor(((f.x + 1) * width) / 10) - x,
			h: Math.floor(((f.y + 1) * height) / 10) - y,
		};
	});
	const atlas = ['coal', 'source']
		.map(
			(page) =>
				`${page}\nsize: ${width},${height}\nfilter: Linear,Linear\npma: false\n` +
				tiles.map((t) => `${page}-${t.i}\n  bounds: ${t.px},${t.py},${t.w},${t.h}\n`).join(''),
		)
		.join('\n');
	const json = {
		skeleton: { spine: '4.2.74', x: -500, y: -500, width: 1000, height: 1000 },
		bones: [
			{ name: 'root' },
			...tiles.map((t) => ({
				name: `flake-${t.i}`,
				parent: 'root',
				x: ((t.px + t.w / 2) / width) * 1000 - 500,
				y: 500 - ((t.py + t.h / 2) / height) * 1000,
			})),
		],
		slots: tiles.flatMap((t) =>
			['coal', 'source'].map((page) => ({
				name: `${page}-${t.i}`,
				bone: `flake-${t.i}`,
				attachment: `${page}-${t.i}`,
			})),
		),
		skins: [
			{
				name: 'default',
				attachments: Object.fromEntries(
					tiles.flatMap((t) =>
						['coal', 'source'].map((page) => {
							const name = `${page}-${t.i}`;
							return [
								name,
								{
									[name]: {
										path: name,
										width: (t.w / width) * 1000,
										height: (t.h / height) * 1000,
									},
								},
							];
						}),
					),
				),
			},
		],
		animations: {
			ash: {
				bones: Object.fromEntries(
					tiles.map((t) => {
						const start = 0.12 + t.start,
							span = 1 - start;
						return [
							`flake-${t.i}`,
							{
								translate: [
									{ time: start, x: 0, y: 0 },
									{ time: start + span * 0.5, x: t.dx * 500, y: -t.dy * 250 },
									{ time: 1, x: t.dx * 1000, y: -t.dy * 1000 },
								],
								rotate: [
									{ time: start, value: 0 },
									{ time: 1, value: (t.turn * 180) / Math.PI },
								],
								scale: [
									{ time: start, x: 1, y: 1 },
									{ time: start + span * 0.8, x: 0.035, y: 0.035 },
									{ time: 1, x: 0.035, y: 0.035 },
								],
							},
						];
					}),
				),
				slots: Object.fromEntries(
					tiles.flatMap((t) => [
						[
							`source-${t.i}`,
							{
								alpha: [
									{ time: 0, value: 1 },
									{ time: 0.23, value: t.ember ? 0.15 : 0 },
									{ time: 0.6, value: 0 },
									{ time: 1, value: 0 },
								],
							},
						],
						[
							`coal-${t.i}`,
							{
								alpha: [
									{ time: 0, value: 0 },
									{ time: 0.23, value: 1 },
									{ time: 0.12 + t.start + (0.88 - t.start) * 0.45, value: 1 },
									{ time: 1, value: 0 },
								],
							},
						],
					]),
				),
			},
		},
	};
	return { atlas, json };
}

/** Captures actual posed artwork, not a generic puff overlay. No private ticker. */
export class SymbolAsh {
	private pose: SpinePose;
	constructor(surface: HTMLCanvasElement, seed: string) {
		const source = document.createElement('canvas'),
			coal = document.createElement('canvas');
		for (const texture of [source, coal]) {
			texture.width = surface.width;
			texture.height = surface.height;
			const ctx = texture.getContext('2d')!;
			if (texture === coal) ctx.filter = 'grayscale(1) brightness(0.45)';
			ctx.drawImage(surface, 0, 0);
		}
		const rig = ashRig(seed, surface.width, surface.height);
		const atlas = new TextureAtlas(rig.atlas);
		for (const page of atlas.pages)
			page.setTexture(new FakeTexture(page.name === 'coal' ? coal : source));
		const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(rig.json);
		this.pose = new SpinePose(data, 'ash');
		this.pose.state.getCurrent(0)!.loop = false;
	}
	draw(ctx: CanvasRenderingContext2D, progress: number) {
		const p = clamp(progress),
			w = ctx.canvas.width,
			h = ctx.canvas.height;
		ctx.clearRect(0, 0, w, h);
		if (p >= 1) return;
		this.pose.state.getCurrent(0)!.trackTime = p;
		this.pose.update(0);
		this.pose.draw(ctx, w / 2, h / 2, w / 1000, h / 1000);
	}
}

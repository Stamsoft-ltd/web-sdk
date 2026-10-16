/** Base and transparent presentation canvases share one demand clock and decoded assets.
 * HTML HUD remains between them; opaque background never covers HUD during presentations.
 * Canvas stays permanently in the game host; overlays select GPU layers, never reparent it.
 * No renderer, texture or skeleton is recreated on a HUD press.
 */
import { Application, Container, Texture, CanvasSource, Graphics, Text } from 'pixi.js';
import { dev } from '$app/environment';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import { Skeleton, type SkeletonData } from '@esotericsoftware/spine-core';
import { SpinePose } from './spine';
import type { RewardTarget } from './rewardDelivery';
import { recordMotionFrame } from './motionMetrics';
export { Container, Graphics, Text };
// Existing book-controlled rigs are authored Y-up. Flip their Pixi node, not global animation math.
Skeleton.yDown = false;
type Job = {
	root: Container;
	overlay?: HTMLElement | null;
	priority?: number;
	/** Retained board stays on the GPU behind gate/win overlays. */
	underlay?: boolean;
	layout: () => void;
	draw: (dt: number, now: number) => boolean;
};
export class GpuEngine {
	readonly app = new Application();
	readonly overlayApp = new Application();
	readonly rewardTargets = new Map<string, RewardTarget>();
	entry: { startedAt: number; reduced: boolean } | null = null;
	setEntryTransition(value: typeof this.entry) {
		this.entry = value;
		this.invalidate();
	}
	private jobs = new Set<Job>();
	private images = new Map<HTMLImageElement, Texture>();
	private frame = 0;
	private previous = 0;
	private renders = 0;
	private dead = false;
	private initialized = false;
	private overlay: HTMLElement | null = null;
	private readonly shade = new Graphics();
	private bounds?: DOMRect;
	constructor(
		private host: HTMLElement,
		private presenting: (value: boolean) => void,
	) {}
	async init() {
		await this.app.init({
			preference: 'webgl',
			autoStart: false,
			sharedTicker: false,
			// Match shared App default: smooth the GPU-drawn mobile frame/pad contours.
			antialias: true,
			autoDensity: true,
			resolution: Math.min(devicePixelRatio || 1, 2),
			backgroundAlpha: 0,
			powerPreference: 'high-performance',
		});
		if (this.dead) {
			this.app.destroy(true);
			return;
		}
		try {
			await this.overlayApp.init({
				preference: 'webgl',
				autoStart: false,
				sharedTicker: false,
				antialias: true,
				autoDensity: true,
				resolution: Math.min(devicePixelRatio || 1, 2),
				backgroundAlpha: 0,
				powerPreference: 'high-performance',
			});
		} catch (error) {
			this.app.destroy(true);
			throw error;
		}
		if (this.dead) {
			this.overlayApp.destroy(true);
			this.app.destroy(true);
			return;
		}
		this.initialized = true;
		this.overlayApp.stop();
		this.overlayApp.stage.sortableChildren = true;
		Object.assign(this.overlayApp.canvas.style, {
			position: 'fixed',
			inset: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zIndex: '40',
		});
		this.overlayApp.canvas.dataset.renderer = 'pixi-webgl-overlay';
		this.overlayApp.canvas.setAttribute('aria-hidden', 'true');
		this.host.parentElement!.appendChild(this.overlayApp.canvas);
		this.app.stop();
		this.app.stage.sortableChildren = true;
		this.shade.eventMode = 'none';
		this.shade.visible = false;
		this.overlayApp.stage.addChild(this.shade);
		Object.assign(this.app.canvas.style, {
			position: 'absolute',
			inset: '0',
			width: '100%',
			height: '100%',
			pointerEvents: 'none',
			zIndex: '0',
		});
		this.app.canvas.dataset.renderer = 'pixi-webgl';
		this.app.canvas.dataset.testid = 'game-canvas';
		this.app.canvas.classList.add('game-canvas');
		this.app.canvas.setAttribute('aria-hidden', 'true');
		this.host.appendChild(this.app.canvas);
		window.addEventListener('resize', this.resize);
		document.addEventListener('visibilitychange', this.visibility);
		this.resize();
	}
	texture(image: HTMLImageElement) {
		let texture = this.images.get(image);
		if (!texture) {
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d');
			if (!context) throw new Error('Texture preparation unavailable');
			context.drawImage(image, 0, 0);
			texture = new Texture({
				source: new CanvasSource({
					resource: canvas,
					autoGenerateMipmaps: true,
					scaleMode: 'linear',
				}),
			});
			this.images.set(image, texture);
		}
		return texture;
	}
	pose(data: SkeletonData, animation = 'idle', seed = 0) {
		// Keep FakeTexture.getImage() intact for deterministic prewarm/native acquisition validation.
		// Spine's official Pixi pipe consumes its .texture, shared once per native atlas page.
		for (const skin of data.skins)
			for (const entry of skin.getAttachments()) {
				const region = (
					entry.attachment as unknown as {
						region?: { texture?: { getImage: () => HTMLImageElement; texture?: Texture } };
					}
				).region;
				if (region?.texture) region.texture.texture = this.texture(region.texture.getImage());
			}
		const actor = new SpinePose(data, animation, seed);
		const view = new Spine({ skeletonData: actor.data, autoUpdate: false });
		view.skeleton = actor.skeleton;
		view.state = actor.state;
		view.eventMode = 'none';
		return { actor, view, begin: () => view.update(0) };
	}
	register(job: Job) {
		job.root.zIndex = job.priority ?? 0;
		this.jobs.add(job);
		(job.overlay ? this.overlayApp.stage : this.app.stage).addChild(job.root);
		this.surface();
		job.layout();
		this.invalidate();
		return () => {
			this.jobs.delete(job);
			if (!job.root.destroyed) job.root.destroy({ children: true, context: true });
			this.surface();
			this.invalidate();
		};
	}
	private surface() {
		if (this.dead) return;
		const overlays = [...this.jobs].filter((job) => job.overlay?.isConnected);
		const active =
			overlays.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0]?.overlay ?? null;
		if (active !== this.overlay) {
			this.overlay = active;
			this.presenting(!!active);
			for (const job of this.jobs) job.layout();
		}
		const activeJobs = overlays.filter((job) => job.overlay === active);
		this.shade.visible = active?.dataset.pixiShade === 'true';
		this.shade.zIndex = activeJobs.length
			? Math.min(...activeJobs.map((job) => job.priority ?? 0)) - 0.5
			: 0;
		this.shade
			.clear()
			.rect(0, 0, this.app.screen.width, this.app.screen.height)
			.fill({ color: 0x06142c, alpha: 0.62 });
		for (const job of this.jobs) {
			job.root.visible = !job.overlay || job.overlay === active;
			job.root.alpha = 1;
		}
	}

	get origin() {
		return this.bounds ?? this.app.canvas.getBoundingClientRect();
	}
	statistics() {
		return {
			frames: this.renders,
			jobs: this.jobs.size,
			active: !!this.frame,
			textures: this.images.size,
		};
	}
	private resize = () => {
		if (this.dead) return;
		const resolution = Math.min(devicePixelRatio || 1, 2);
		if (
			this.app.screen.width !== innerWidth ||
			this.app.screen.height !== innerHeight ||
			this.app.renderer.resolution !== resolution
		)
			this.app.renderer.resize(Math.max(1, innerWidth), Math.max(1, innerHeight), resolution);
		this.overlayApp.renderer.resize(Math.max(1, innerWidth), Math.max(1, innerHeight), resolution);
		this.bounds = this.app.canvas.getBoundingClientRect();
		for (const job of this.jobs) job.layout();
		this.surface();
		this.invalidate();
	};
	private visibility = () => {
		if (document.hidden) {
			cancelAnimationFrame(this.frame);
			this.frame = 0;
			this.previous = 0;
		} else this.invalidate();
	};
	layout() {
		if (this.dead) return;
		for (const job of this.jobs) job.layout();
		this.invalidate();
	}
	invalidate() {
		if (!this.dead && !this.frame && !document.hidden)
			this.frame = requestAnimationFrame(this.tick);
	}
	private tick = (now: number) => {
		this.frame = 0;
		if (this.dead || document.hidden) return;
		const interval = this.previous ? now - this.previous : 16.67;
		const dt = Math.min(interval / 1000, 0.067);
		this.previous = now;
		const started = dev ? performance.now() : 0;
		let moving = false;
		for (const job of this.jobs) if (job.root.visible) moving = job.draw(dt, now) || moving;
		this.app.render();
		if (this.overlay) this.overlayApp.render();
		this.overlayApp.canvas.style.visibility = this.overlay ? 'visible' : 'hidden';
		this.renders++;
		if (dev) {
			this.app.canvas.dataset.gpuFrames = String(this.renders);
			this.app.canvas.dataset.tickerActive = String(moving);
			recordMotionFrame(interval, performance.now() - started);
			this.app.canvas.dataset.pixiNodes = String(this.jobs.size);
		}
		if (moving) this.invalidate();
		else this.previous = 0;
	};
	destroy() {
		this.dead = true;
		cancelAnimationFrame(this.frame);
		this.frame = 0;
		window.removeEventListener('resize', this.resize);
		document.removeEventListener('visibilitychange', this.visibility);
		if (!this.initialized) return;
		this.jobs.clear();
		this.rewardTargets.clear();
		this.overlayApp.destroy(true, { children: true, context: true });
		this.app.destroy(true, { children: true, context: true });
		for (const texture of this.images.values()) texture.destroy(true);
		this.images.clear();
	}
}
export type GpuPose = ReturnType<GpuEngine['pose']>;

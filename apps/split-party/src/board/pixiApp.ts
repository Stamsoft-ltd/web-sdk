// What the three WebGL views (board, scene, logo) share about starting, running and dying.
import { Application, Graphics, Texture, UPDATE_PRIORITY, type ApplicationOptions } from 'pixi.js';

// Every texture a view uses is uploaded up front and owned by it, so pixi's texture GC (which
// unloads anything unbound for 3600 frames) would only ever undo that upload: a bonus world's
// backdrop, idle for a minute of base play, re-uploading on the frame the bonus fades in.
export const APP_OPTIONS: Partial<ApplicationOptions> = {
	backgroundAlpha: 0,
	autoDensity: true,
	preference: 'webgl',
	textureGCActive: false,
};

// `{ children: true }` alone leaves every Graphics' own context (and the GPU batch data pixi
// keeps per context) alive for the renderer's lifetime; popped blobs would pile those up.
// How long a lost WebGL context may take to come back (iOS backgrounding, a GPU reset).
const LOST_GRACE_MS = 3000;

export const DISPOSE = { children: true, context: true } as const;

/**
 * A view's Application with a lifecycle that survives being torn down at any point:
 * - destroy() during app.init() can't run pixi's destroy (its ResizePlugin throws before init),
 *   so it waits for init and destroys then — otherwise a detached renderer keeps a WebGL
 *   context and renders an empty stage every frame;
 * - one throw in a frame stops pixi's ticker for good (it re-requests the next frame only
 *   after update returns), so frames are guarded and a throw hands the view to `fail`;
 * - a context the browser drops and doesn't give back within LOST_GRACE_MS leaves a blank
 *   canvas: also `fail` (pixi restores one that comes back by itself).
 */
export class PixiApp {
	readonly app = new Application();
	destroyed = false;
	private ready = false;
	private failed = false;
	private unwatch: (() => void) | null = null;
	/** Called once when the view can't go on (the wrapper falls back to the DOM version). */
	onfail: ((e: unknown) => void) | null = null;

	/** Resolves false when the view was destroyed meanwhile (the caller just returns). */
	async init(options: Partial<ApplicationOptions>) {
		await this.app.init({ ...APP_OPTIONS, ...options });
		this.ready = true;
		if (this.destroyed) {
			this.app.destroy(true, DISPOSE);
			return false;
		}
		const canvas = this.app.canvas;
		let grace: ReturnType<typeof setTimeout> | undefined;
		const lost = () => {
			clearTimeout(grace);
			grace = setTimeout(() => this.fail(new Error('WebGL context lost and not restored')), LOST_GRACE_MS);
		};
		const restored = () => clearTimeout(grace);
		canvas.addEventListener('webglcontextlost', lost);
		canvas.addEventListener('webglcontextrestored', restored);
		this.unwatch = () => {
			clearTimeout(grace);
			canvas.removeEventListener('webglcontextlost', lost);
			canvas.removeEventListener('webglcontextrestored', restored);
		};
		return true;
	}

	/** Runs `frame` then renders, every tick; a throw in either stops the view and fails it. */
	run(frame: () => void) {
		const { app } = this;
		app.ticker.remove(app.render, app);
		app.ticker.add(
			() => {
				if (this.failed) return;
				try {
					frame();
					app.render();
				} catch (e) {
					this.fail(e);
				}
			},
			null,
			UPDATE_PRIORITY.LOW,
		);
	}

	fail(e: unknown) {
		if (this.failed || this.destroyed) return;
		this.failed = true;
		this.app.ticker?.stop();
		// Not from inside the ticker's own update: the wrapper destroys the app.
		queueMicrotask(() => this.onfail?.(e));
	}

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.unwatch?.();
		if (this.ready) this.app.destroy(true, DISPOSE);
	}
}

/** prefers-reduced-motion, live: `on` now and on every change; returns the unsubscribe. */
export function watchReducedMotion(on: (reduced: boolean) => void) {
	const mq = matchMedia('(prefers-reduced-motion: reduce)');
	const change = () => on(mq.matches);
	change();
	mq.addEventListener('change', change);
	return () => mq.removeEventListener('change', change);
}

/** A texture lookup that says (once per src) when art it was asked for was never loaded. */
export function textureLookup(name: string, ...maps: Map<string, Texture>[]) {
	const warned = new Set<string>();
	return (src: string) => {
		for (const m of maps) {
			const t = m.get(src);
			if (t) return t;
		}
		if (!warned.has(src)) {
			warned.add(src);
			console.warn(`[${name}] texture not loaded, drawn empty: ${src}`);
		}
		return Texture.EMPTY;
	};
}

/** Waits for the Coiny face the canvas labels are drawn in; says so when it isn't there. */
export async function loadLabelFont(name: string) {
	try {
		const faces = await document.fonts?.load("400 22px 'Coiny'");
		if (faces && !faces.length) console.warn(`[${name}] Coiny not found; labels use the fallback face`);
	} catch (e) {
		console.warn(`[${name}] Coiny failed to load; labels use the fallback face`, e);
	}
}

/**
 * A Graphics that wears shared, cached contexts (BlobView's pupils). Destroying it puts its own
 * context back first, so a DISPOSE can never take a shared one down with it.
 */
export class SharedGraphics extends Graphics {
	/** Its own context, for drawing that isn't shared. */
	readonly own = this.context;
	override destroy(options?: Parameters<Graphics['destroy']>[0]) {
		this.context = this.own;
		super.destroy(options);
	}
}

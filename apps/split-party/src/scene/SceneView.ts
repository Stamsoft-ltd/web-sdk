// The game's backdrops drawn in Pixi: the base world (BaseScene.svelte) and the three bonus
// worlds (BonusNormal.svelte, BonusSuper.svelte, BonusHidden.svelte), with their jelly domes
// (JellyDome.svelte), drifting clouds (SkyClouds.svelte), water light and the blobs that peek
// out of the scenery. Same layouts, timings and keyframes as those components;
// one canvas for all of them, the bonus world cross-fading over the base like App's fade.
import { Assets, BlurFilter, ColorMatrixFilter, Container, DisplacementFilter, Filter, GlProgram, Graphics, Matrix, Sprite, Texture, UniformGroup, type FilterSystem, type RenderSurface } from 'pixi.js';
import { bezier, keyframes, progress, EASE_IN_OUT, type Frame, type Ease } from '../board/anim';
import { BlobView, BLOB_BOX, blushTexture, loadBlobTextures } from '../board/BoardView';
import { DISPOSE, PixiApp, textureLookup, watchReducedMotion } from '../board/pixiApp';

export type Tier = 'normal' | 'super' | 'hidden' | null;
const SKY = { w: 1200, h: 670 };
const TEX_RES = 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const DEG = Math.PI / 180;
// Phase 0..1 of an infinite animation with a (negative) delay, both in ms.
const cycle = (now: number, period: number, delay: number) => {
	const t = (now - delay) / period;
	return t - Math.floor(t);
};
// An `alternate` infinite animation's eased value 0..1.
const alternate = (now: number, period: number, delay: number, ease: Ease) => {
	const t = (now - delay) / period;
	const n = Math.floor(t);
	return ease(n % 2 ? 1 - (t - n) : t - n);
};

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = Math.ceil(w * TEX_RES);
	c.height = Math.ceil(h * TEX_RES);
	const ctx = c.getContext('2d')!;
	ctx.scale(TEX_RES, TEX_RES);
	draw(ctx);
	return Texture.from(c);
}
// radial-gradient(closest-side, #fff, #fff8 55%, #fff0): glints and ripples, stretched to size.
const softTexture = () =>
	canvasTexture(32, 32, (ctx) => {
		const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
		g.addColorStop(0, '#fff');
		g.addColorStop(0.55, 'rgba(255,255,255,.533)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 32, 32);
	});
// The domes are painted soft (blur baked into the art), so their spray is soft too: a droplet
// is its colour fading out past 25% of the radius with a blurred glint, and the pop ring a
// white band (tinted per dome) fading both ways. Gradients, not ctx.filter, which Safari lacks.
// DROP_CORE: the droplet's apparent size as a share of the texture (its sprite is sized up).
const DROP_CORE = 0.6;
const rgba = (hex: string, a: number) => {
	const n = parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const dropTexture = (color: string) =>
	canvasTexture(32, 32, (ctx) => {
		const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
		g.addColorStop(0, color);
		g.addColorStop(0.25, color);
		g.addColorStop(0.6, rgba(color, 0.55));
		g.addColorStop(1, rgba(color, 0));
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 32, 32);
		const h = ctx.createRadialGradient(12.5, 11.5, 0, 12.5, 11.5, 7);
		h.addColorStop(0, 'rgba(255,255,255,.55)');
		h.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = h;
		ctx.fillRect(0, 0, 32, 32);
	});
// The ring's peak sits at RING_AT of the texture's radius.
const RING_AT = 0.78;
const ringTexture = () =>
	canvasTexture(64, 64, (ctx) => {
		const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
		g.addColorStop(0, 'rgba(255,255,255,0)');
		g.addColorStop(RING_AT - 0.2, 'rgba(255,255,255,0)');
		g.addColorStop(RING_AT, 'rgba(255,255,255,.95)');
		g.addColorStop(Math.min(1, RING_AT + 0.2), 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 64, 64);
	});
// color-mix(in srgb, c, white 45%).
const mixWhite = (hex: string, k = 0.45) => {
	const n = parseInt(hex.slice(1), 16);
	const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k) + 255 * k);
	return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

type Ctx = { tex: (src: string) => Texture; soft: Texture; ring: Texture; birds: Texture[]; drop: (c: string) => Texture; blob: { tex: (src: string) => Texture; blush: Texture }; reduced: boolean; covered: (parent: Container, x: number, y: number, w: number, h: number) => boolean };
type Ticker = { tick(now: number): void };

// ---- Clouds (SkyClouds.svelte) -----------------------------------------------------------------

type Lane = { far: boolean; y: [number, number] };
type Look = { src: string; w: [number, number]; alpha: [number, number] };
const NEAR_LOOK: Look = { src: './splash/cloud-puff.webp', w: [130, 170], alpha: [0.92, 0.92] };
const FAR_LOOK: Look = { src: './splash/cloud-puff-far.webp', w: [70, 95], alpha: [0.7, 0.8] };
class Clouds implements Ticker {
	private items: { box: Container; img: Sprite; lane: number; w: number; h: number; sx: number; sy: number; dur: number; start: number; breathe: number }[] = [];
	constructor(
		private ctx: Ctx,
		private parent: Container,
		private lanes: Lane[],
		private width = 1200,
		private near = NEAR_LOOK,
		private far = FAR_LOOK,
	) {
		const now = performance.now();
		lanes.forEach((_, i) => this.items.push(this.make(i, true, now)));
	}
	private make(lane: number, midway: boolean, now: number) {
		const { far: isFar, y } = this.lanes[lane];
		const look = isFar ? this.far : this.near;
		const w = rand(...look.w);
		const dur = ((this.width + w + 80) / (isFar ? rand(7, 11) : rand(18, 26))) * 1000;
		const delay = midway ? -((lane / this.lanes.length + rand(0.1, 0.25)) % 1) * dur : rand(2000, 12000);
		const box = new Container();
		box.y = rand(y[0], y[1]);
		const t = this.ctx.tex(look.src);
		const img = new Sprite(t);
		img.width = w;
		img.height = (w * t.height) / t.width;
		img.alpha = rand(...look.alpha);
		// transform-origin 50% 80%.
		img.anchor.set(0.5, 0.8);
		img.position.set(w / 2, img.height * 0.8);
		box.addChild(img);
		this.parent.addChild(box);
		return { box, img, lane, w, h: img.height, sx: img.scale.x, sy: img.scale.y, dur, start: now + delay, breathe: -dur * 0.37 };
	}
	tick(now: number) {
		this.items = this.items.map((c) => {
			let p = (now - c.start) / c.dur;
			if (this.ctx.reduced) p = Math.max(0, Math.min(1, p));
			if (p >= 1 && !this.ctx.reduced) {
				c.box.destroy(DISPOSE);
				return this.make(c.lane, false, now);
			}
			c.box.x = -(c.w + 40) + Math.max(0, p) * (this.width + c.w + 80);
			const b = this.ctx.reduced ? 0 : EASE_IN_OUT(1 - Math.abs(1 - 2 * cycle(now, 11000, c.breathe)));
			// cloud-breathe: swell a touch and rise 4px at the half.
			c.img.scale.set(c.sx * (1 + 0.05 * b), c.sy * (1 + 0.03 * b));
			c.img.y = c.h * 0.8 - 4 * b;
			return c;
		});
	}
}

// ---- Birds ------------------------------------------------------------------------------------

// A far-off bird in the painting's plum, drawn in BIRD_FRAMES wing positions (a full flap):
// a gull's "M", wingtips swinging from high to low, on a small body. 40×24, body at 20,13.
const BIRD_FRAMES = 8;
const BIRD = { w: 40, h: 24 };
const birdTextures = () =>
	Array.from({ length: BIRD_FRAMES }, (_, f) =>
		canvasTexture(BIRD.w, BIRD.h, (ctx) => {
			const lift = Math.cos((f / BIRD_FRAMES) * Math.PI * 2);
			const tip = 12 - lift * 9;
			const elbow = 10 - lift * 4;
			ctx.strokeStyle = '#3a2a6e';
			ctx.fillStyle = '#3a2a6e';
			ctx.lineWidth = 2.8;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo(3, tip);
			ctx.quadraticCurveTo(11, elbow - 3, 20, 13);
			ctx.quadraticCurveTo(29, elbow - 3, 37, tip);
			ctx.stroke();
			ctx.beginPath();
			ctx.ellipse(20, 13.6, 2.8, 1.9, 0, 0, Math.PI * 2);
			ctx.fill();
		}),
	);
type Bird = { s: Sprite; lag: number; dy: number; speed: number; phase: number; rate: number; glideAt: number; bob: number; bobAmp: number };
type Flock = { birds: Bird[]; x0: number; y: number; dir: 1 | -1; start: number; span: number };
/** Now and then a few birds cross the sky the same way, loosely: each starts its own way back
 *  and up or down, flies at its own speed and flaps at its own pace, so they drift apart as
 *  they go. Slow and far off. Nothing flies under reduced motion. */
class Birds implements Ticker {
	private flocks: Flock[] = [];
	private next: number;
	constructor(
		private ctx: Ctx,
		private parent: Container,
		private y: Range,
		private width = 1200,
		private size: Range = [15, 24],
	) {
		this.next = performance.now() + rand(1500, 6000);
	}
	private launch(now: number) {
		const n = pick([1, 1, 2, 2, 3, 4]);
		const dir = Math.random() < 0.5 ? 1 : -1;
		const birds: Bird[] = [];
		for (let i = 0; i < n; i++) {
			const w = rand(...this.size);
			const s = new Sprite(this.ctx.birds[0]);
			s.anchor.set(0.5, 13 / BIRD.h);
			s.scale.set(w / BIRD.w);
			s.alpha = rand(0.6, 0.8);
			this.parent.addChild(s);
			birds.push({
				s,
				// The first leads; the rest trail 3–14 wingspans behind, well above or below.
				lag: i ? rand(3, 14) * w : 0,
				dy: i ? rand(-1, 1) * (this.y[1] - this.y[0]) * 0.5 : 0,
				speed: rand(26, 42),
				phase: rand(0, 1),
				rate: rand(2.4, 3.3),
				glideAt: rand(0, 1),
				bob: rand(0, Math.PI * 2),
				bobAmp: rand(2, 5),
			});
		}
		const margin = 4 * this.size[1];
		const lag = Math.max(...birds.map((b) => b.lag));
		this.flocks.push({
			birds,
			x0: dir > 0 ? -margin : this.width + margin,
			y: rand(...this.y),
			dir,
			start: now,
			span: this.width + 2 * margin + lag,
		});
	}
	tick(now: number) {
		if (!this.ctx.reduced && now >= this.next) {
			this.launch(now);
			this.next = now + rand(9000, 22000);
		}
		this.flocks = this.flocks.filter((f) => {
			const t = (now - f.start) / 1000;
			if (f.birds.every((b) => t * b.speed > f.span)) {
				for (const b of f.birds) b.s.destroy();
				return false;
			}
			for (const b of f.birds) {
				// Every ~6s a bird glides for a second or so, wings held a little up.
				const g = (t / 6 + b.glideAt) % 1;
				const frame = g < 0.2 ? 1 : Math.floor((t * b.rate + b.phase) * BIRD_FRAMES) % BIRD_FRAMES;
				b.s.texture = this.ctx.birds[frame];
				b.s.x = f.x0 + f.dir * (t * b.speed - b.lag);
				b.s.y = f.y + b.dy + Math.sin(t * 1.2 + b.bob) * b.bobAmp + (g < 0.2 ? g * 6 : 0);
			}
			return true;
		});
	}
}

// ---- Jelly dome (JellyDome.svelte) ------------------------------------------------------------

type Range = [number, number];
type DomeOpts = { src: string; x: number; y: number; w: number; h: number; ox: number; oy: number; color: string; shown?: boolean; first: Range; rest: Range; wait: Range };
const C_BLOW = bezier(0.25, 0.6, 0.4, 1);
const C_BLOW54 = bezier(0.5, 0, 0.6, 1);
const EASE_IN = bezier(0.42, 0, 1, 1);
const EASE_OUT_ = bezier(0, 0, 0.58, 1);
const C_DROP = bezier(0.2, 0.6, 0.4, 1);
const BLOW_S: Frame<{ sx: number; sy: number }>[] = [
	[0, { sx: 0.06, sy: 0.03 }, C_BLOW],
	[0.54, { sx: 1.14, sy: 1.2 }, C_BLOW54],
	[0.66, { sx: 1.2, sy: 0.84 }],
	[0.78, { sx: 0.94, sy: 1.07 }],
	[0.89, { sx: 1.03, sy: 0.97 }],
	[1, { sx: 1, sy: 1 }],
];
const BLOW_A: Frame<{ v: number }>[] = [
	[0, { v: 0 }, C_BLOW],
	[0.1, { v: 1 }],
	[1, { v: 1 }],
];
const POP_S: Frame<{ sx: number; sy: number; a: number }>[] = [
	[0, { sx: 1, sy: 1, a: 1 }],
	[0.5, { sx: 1.1, sy: 1.14, a: 1 }],
	[1, { sx: 1.35, sy: 1.2, a: 0 }],
];
const SPRAY_A: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.12, { v: 1 }],
	[0.7, { v: 1 }],
	[1, { v: 0 }],
];
class Dome implements Ticker {
	private img: Sprite;
	private phase: 'wait' | 'blow' | 'rest' | 'burst';
	private since = 0;
	private next = 0;
	private fx: { root: Container; ring: Sprite; ringBase: number; drops: { s: Sprite; dx: number; dy: number; base: number }[]; start: number } | null = null;
	constructor(
		private ctx: Ctx,
		private parent: Container,
		private o: DomeOpts,
	) {
		this.img = new Sprite(ctx.tex(o.src));
		// The bubble inflates from its foot (ox, oy in the box).
		this.img.anchor.set(o.ox / o.w, o.oy / o.h);
		this.img.position.set(o.x + o.ox, o.y + o.oy);
		parent.addChild(this.img);
		const now = performance.now();
		if (ctx.reduced) this.phase = 'rest';
		else {
			this.phase = o.shown ? 'rest' : 'wait';
			this.next = now + rand(...o.first);
		}
		this.since = now;
	}
	private base() {
		return [this.o.w / this.img.texture.width, this.o.h / this.img.texture.height];
	}
	private spray(now: number, burst: boolean) {
		this.fx?.root.destroy(DISPOSE);
		const { o } = this;
		const root = new Container();
		root.position.set(o.x + o.ox, o.y + o.oy * 0.55);
		const ring = new Sprite(this.ctx.ring);
		ring.anchor.set(0.5);
		ring.tint = mixWhite(o.color);
		ring.width = ring.height = ((0.4 * o.w) / 2 - 1.5) * (2 / RING_AT);
		const ringBase = ring.scale.x;
		root.addChild(ring);
		const drops = Array.from({ length: 7 }, (_, i) => {
			const a = -Math.PI * (0.1 + (0.8 * (i + Math.random() * 0.6)) / 7);
			const r = o.w * rand(0.35, 0.6);
			const s = new Sprite(this.ctx.drop(o.color));
			s.anchor.set(0.5);
			const size = rand(5, 11) / DROP_CORE;
			s.width = s.height = size;
			root.addChild(s);
			return { s, dx: Math.cos(a) * r, dy: Math.sin(a) * r, base: s.scale.x };
		});
		this.parent.addChild(root);
		// Droplets fly at the blow-up's pop (54% of it) or right away on a burst.
		this.fx = { root, ring, ringBase, drops, start: now + (burst ? 0 : 500) };
	}
	private step(now: number) {
		const next = { wait: 'blow', blow: 'rest', rest: 'burst', burst: 'wait' }[this.phase] as Dome['phase'];
		this.phase = next;
		this.since = now;
		if (next === 'blow' && this.ctx.covered(this.parent, this.o.x, this.o.y, this.o.w, this.o.h)) {
			// Mama stands here: no bubble may pop under her, try again later.
			this.phase = 'wait';
			this.next = now + rand(...this.o.wait);
		} else if (next === 'blow') (this.spray(now, false), (this.next = now + 950));
		else if (next === 'rest') this.next = now + rand(...this.o.rest);
		else if (next === 'burst') (this.spray(now, true), (this.next = now + 420));
		else this.next = now + rand(...this.o.wait);
	}
	tick(now: number) {
		if (!this.ctx.reduced && now >= this.next) this.step(now);
		const [bx, by] = this.base();
		const t = now - this.since;
		let sx = 1,
			sy = 1,
			a = 1;
		if (this.phase === 'wait') a = 0;
		else if (this.phase === 'blow') {
			const p = Math.min(1, t / 950);
			({ sx, sy } = keyframes(BLOW_S, p));
			a = keyframes(BLOW_A, p).v;
		} else if (this.phase === 'burst') {
			const p = Math.min(1, t / 320);
			({ sx, sy, a } = keyframes(POP_S, p, EASE_IN));
		}
		this.img.scale.set(bx * sx, by * sy);
		this.img.alpha = a;
		const fx = this.fx;
		if (fx) {
			const rp = (now - fx.start) / 500;
			fx.ring.visible = rp >= 0 && rp < 1;
			if (fx.ring.visible) {
				const e = EASE_OUT_(rp);
				fx.ring.scale.set(fx.ringBase * (0.3 + 2.1 * e));
				fx.ring.alpha = 0.9 * (1 - e);
			}
			const dp = (now - fx.start) / 750;
			for (const d of fx.drops) {
				d.s.visible = dp >= 0 && dp < 1;
				if (!d.s.visible) continue;
				const k = keyframes(
					[
						[0, { x: 0, y: 0, s: 1 }],
						[0.7, { x: d.dx, y: d.dy, s: 1 }],
						[1, { x: d.dx * 1.1, y: d.dy + 18, s: 0.4 }],
					],
					dp,
					C_DROP,
				);
				d.s.position.set(k.x, k.y);
				d.s.scale.set(d.base * k.s);
				d.s.alpha = keyframes(SPRAY_A, dp, C_DROP).v;
			}
			if (dp >= 1 && rp >= 1) {
				fx.root.destroy(DISPOSE);
				this.fx = null;
			}
		}
	}
}

// ---- Peeking blobs ----------------------------------------------------------------------------

const PEEKERS = ['WATERMELON', 'CHERRIES', 'GRAPES', 'STRAWBERRY', 'BLUEBERRY', 'KIWI', 'LEMON'] as const;
// A blob in a box `size` px square, transform origin 50% 90% of the box.
class PeekBlob {
	root = new Container();
	blob: BlobView;
	constructor(ctx: Ctx, symbol: string, uid: string, readonly size: number) {
		this.blob = new BlobView(ctx.blob.tex, ctx.blob.blush, symbol, 1, uid);
		const box = new Container();
		box.scale.set(size / BLOB_BOX.size);
		box.position.set(-size * 0.5, -size * 0.9);
		this.blob.root.position.set(-BLOB_BOX.x, -BLOB_BOX.y);
		box.addChild(this.blob.root);
		this.root.addChild(box);
	}
	tick(now: number, reduced: boolean) {
		this.blob.tick({ now, scared: null, relief: null, lit: null, reduced });
	}
}
type PT = { tx: number; ty: number; sx: number; sy: number; r: number };
// BaseScene's peek, in % of the blob's box (dx, px, py) and degrees (lean).
const islandPeek = (dx: number, px: number, py: number, lean: number): Frame<PT>[] => [
	[0, { tx: dx, ty: 0, sx: 1, sy: 1, r: 0 }],
	[0.14, { tx: px * 1.08, ty: py * 1.08, sx: 0.96, sy: 1.06, r: lean * 0.5 }],
	[0.22, { tx: px, ty: py, sx: 1, sy: 1, r: lean }],
	[0.38, { tx: px, ty: py, sx: 1, sy: 1, r: lean }],
	[0.52, { tx: px, ty: py, sx: 1, sy: 1, r: lean * 0.3 }],
	[0.66, { tx: px, ty: py, sx: 1, sy: 1, r: lean * 0.3 }],
	[0.8, { tx: px * 1.02, ty: py * 1.02, sx: 1, sy: 1, r: lean }],
	[0.92, { tx: dx * 0.5 + px * 0.1, ty: 4, sx: 1, sy: 1, r: 0 }],
	[1, { tx: dx, ty: 0, sx: 1, sy: 1, r: 0 }],
];
// BonusNormal's cliff-peek.
const cliffPeek = (lean: number): Frame<PT>[] => [
	[0, { tx: 0, ty: 0, sx: 1, sy: 1, r: 0 }],
	[0.14, { tx: 0, ty: -66, sx: 0.95, sy: 1.08, r: 0 }],
	[0.22, { tx: 0, ty: -58, sx: 1, sy: 1, r: lean }],
	[0.4, { tx: 0, ty: -58, sx: 1, sy: 1, r: lean }],
	[0.52, { tx: 0, ty: -58, sx: 1, sy: 1, r: lean * -0.4 }],
	[0.68, { tx: 0, ty: -58, sx: 1, sy: 1, r: lean * -0.4 }],
	[0.8, { tx: 0, ty: -60, sx: 1, sy: 1, r: lean }],
	[0.92, { tx: 0, ty: -8, sx: 1.04, sy: 0.94, r: 0 }],
	[1, { tx: 0, ty: 0, sx: 1, sy: 1, r: 0 }],
];
type LivePeek = { pb: PeekBlob; x: number; y: number; frames: Frame<PT>[]; start: number; ms: number; end: number };
function tickPeek(p: LivePeek, now: number, reduced: boolean) {
	const prog = progress(now, p.start, 0, p.ms);
	const v = keyframes(p.frames, Math.max(0, prog), EASE_IN_OUT);
	const s = p.pb.size;
	p.pb.root.position.set(p.x + (v.tx / 100) * s, p.y + (v.ty / 100) * s);
	p.pb.root.scale.set(v.sx, v.sy);
	p.pb.root.rotation = v.r * DEG;
	p.pb.tick(now, reduced);
}

// ---- Worlds -----------------------------------------------------------------------------------

abstract class World {
	root = new Container();
	protected parts: Ticker[] = [];
	protected timers = new Set<ReturnType<typeof setTimeout>>();
	protected later(ms: number, fn: () => void) {
		const t = setTimeout(() => (this.timers.delete(t), fn()), ms);
		this.timers.add(t);
	}
	constructor(protected ctx: Ctx) {}
	tick(now: number) {
		for (const p of this.parts) p.tick(now);
	}
	/** The scene rect the screen shows (x, y, w, h in 1200×670 units), on every layout. */
	view(_portrait: boolean, _slice: { x: number; y: number; w: number; h: number }) {}
	destroy() {
		this.timers.forEach(clearTimeout);
		this.root.destroy(DISPOSE);
	}
	protected sprite(src: string, x: number, y: number, w: number, h: number, flip = false, parent = this.root) {
		const s = new Sprite(this.ctx.tex(src));
		s.position.set(flip ? x + w : x, y);
		s.width = w;
		s.height = h;
		if (flip) s.scale.x *= -1;
		parent.addChild(s);
		return s;
	}
}

// Glints on the water band (11358:69611's open water, y ~380–480 in the frame).
const GLINTS = Array.from({ length: 22 }, (_, i) => {
	const h = Math.imul(i + 1, 2654435761) >>> 0;
	const x = 2 + ((h % 1000) / 1000) * 92;
	const y = 384 + (((h >>> 10) % 100) / 100) * 88;
	// Wider and slower towards the shore, like the old band's near rows.
	const near = (y - 384) / 88;
	return { x, y, w: (3 + ((h >>> 17) % 5)) * (0.7 + 0.6 * near), dur: 3.2 + ((h >>> 5) % 9) * 0.25, delay: -(((h >>> 13) % 40) / 10) };
});
const GLINT: Frame<{ a: number; tx: number; sx: number }>[] = [
	[0, { a: 0, tx: -10, sx: 0.4 }],
	[0.45, { a: 0.8, tx: 3, sx: 1 }],
	[0.7, { a: 0.45, tx: 10, sx: 0.8 }],
	[1, { a: 0, tx: -10, sx: 0.4 }],
];
const BASE_CLOUD_LANES: Lane[] = [
	{ far: false, y: [36, 60] },
	{ far: true, y: [92, 110] },
	{ far: false, y: [160, 185] },
];
const PHONE_LANES: Lane[] = [
	{ far: false, y: [0, 14] },
	{ far: true, y: [44, 58] },
	{ far: false, y: [82, 100] },
	{ far: true, y: [124, 140] },
];
const PHONE_NEAR: Look = { src: './splash/cloud-puff.webp', w: [60, 80], alpha: [0.9, 0.9] };
const PHONE_FAR: Look = { src: './splash/cloud-puff-far.webp', w: [34, 46], alpha: [0.7, 0.8] };
const BASE_DOMES = [
	['magenta', 30, 588, 82],
	['magenta', 292, 617, 90],
	['magenta', 1118, 560, 82],
	['green', 36, 551, 201],
	['purple', -72, 568, 168],
	['purple', 905, 568, 168],
	['purple', 60, 491, 66],
	['magenta', 150, 479, 54],
	['green', 205, 494, 62],
	['green', 955, 485, 70],
	['magenta', 1058, 480, 56],
	['purple', 1118, 492, 64],
] as const;
// Portrait: four domes on the open grass between the board and the HUD strip (its top at ~80%
// of a phone's height), feet just above the strip, clear of the spin disc that rises out of it
// in the middle. At the screen's foot they sat under the HUD's dark fade, one cut in half by
// it, and the band itself stood empty.
const PHONE_DOMES = [
	['purple', 0.12, 0.78, 62],
	['magenta', 0.3, 0.775, 46],
	['green', 0.7, 0.78, 52],
	['magenta', 0.89, 0.775, 54],
] as const;
const DOME_COLOR = { magenta: '#ea32df', green: '#5bed7c', purple: '#b241fb' };
const GRASS_Y = 505;
const BASE_PEEK_MS = 4200;
// The base sea's horizon (the far hills', volcano's and dome hill's feet, y ~373-375): what
// stands on it is mirrored into the water about it, squashed a little.
const SEA_HORIZON = 374;
const REFLECT_SQUASH = 0.9;
const BASE_REFLECTED = [
	['./base/hd/far-hills.webp', 0, 68, 1011, 400],
	['./base/hd/volcano.webp', 912, 92, 329, 329],
	['./base/hd/dome-hill.webp', 814, 268, 267, 117],
] as const;
// Laid over the reflection: the water's colours (water-clear.webp's), see-through under the
// horizon and opaque two thirds of the way down, so the reflection fades out with depth.
const reflectFade = () =>
	canvasTexture(4, 110, (ctx) => {
		const g = ctx.createLinearGradient(0, 0, 0, 110);
		g.addColorStop(0, 'rgba(1,204,255,0)');
		g.addColorStop(0.3, 'rgba(0,192,255,.45)');
		g.addColorStop(0.68, 'rgba(0,201,254,1)');
		g.addColorStop(0.84, 'rgba(5,228,253,1)');
		g.addColorStop(1, 'rgba(25,243,255,1)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 4, 110);
	});
/** Swells rolling in on the base sea: soft light dashes on bands that come from the horizon to
 *  the shore (y 377–482), thin and slow far off, longer and softer up close (LiveSea's). */
const SWELL_BANDS = 9;
const SWELL_MS = 9000;
const SWELL_DASHES = Array.from({ length: SWELL_BANDS }, (_, b) =>
	Array.from({ length: 9 }, (_, i) => {
		const h = Math.imul(b * 31 + i + 1, 2654435761) >>> 0;
		return { x: (h % 1000) / 1000, len: 0.04 + ((h >>> 10) % 100) / 1000, k: ((h >>> 20) % 100) / 100 };
	}),
);
class Swells implements Ticker {
	private dashes: { s: Sprite; b: number; d: (typeof SWELL_DASHES)[number][number] }[] = [];
	constructor(private ctx: Ctx, parent: Container) {
		SWELL_DASHES.forEach((band, b) =>
			band.forEach((d) => {
				const s = new Sprite(ctx.soft);
				s.anchor.set(0.5);
				s.alpha = 0;
				parent.addChild(s);
				this.dashes.push({ s, b, d });
			}),
		);
	}
	tick(now: number) {
		const R = this.ctx.reduced;
		const t = now / 1000;
		for (const { s, b, d } of this.dashes) {
			const p = R ? (b + 0.5) / SWELL_BANDS : (now / SWELL_MS + b / SWELL_BANDS) % 1;
			const x = (((d.x + (R ? 0 : t * (0.004 + 0.006 * d.k))) % 1) + 1) % 1;
			s.x = x * SKY.w;
			s.y = 377 + (482 - 377) * p ** 1.5;
			s.width = SKY.w * d.len * (0.5 + p);
			s.height = 0.8 + 3.2 * p;
			s.alpha = 0.3 * Math.sin(p * Math.PI) * (0.6 + 0.4 * d.k);
		}
	}
}
// 11362:70732, the island on the right.
const ISLAND = { x: 900, y: 268, w: 362, h: 181 };
// Peek spots on its ridge, % of the island (x is the blob's centre, top its hidden box's top;
// px/py the peek's offset, % of the blob): over the green hump, and sneaking out diagonally
// from behind the left bush's right shoulder (user, 2026-10-29: not over the tree).
const ISLAND_SPOTS = [
	{ x: 47, top: 36, px: 0, py: -61, lean: -6 },
	{ x: 30, top: 44, px: 85, py: -95, lean: 16 },
];
const ISLAND_PEEK = 26;

const CRATER = { x: 1086, y: 180 };
// The filter's vertex stage, pixi's own (its DisplacementFilter's): vFilterUv is the map
// sprite's UV, so the flow map lies on the lava wherever it is drawn.
const LAVA_VERT = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vFilterUv;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uFilterMatrix;
void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
    vFilterUv = (uFilterMatrix * vec3(vTextureCoord, 1.0)).xy;
}`;
// Lava's look and reach (premultiplied in, premultiplied out). The flow map: R down its own
// stream (0 in the crater's pool, 1 at that stream's tip), G depth into a stream (0 at its
// crust), B the stream's phase. The rock under it is bare (volcano.webp), so each drip only ever
// runs downhill (user: "not to go back .. it's antiphysics"): it oozes from the upper stream
// down to its tip, slowing as it goes, rests, then its lower part cools, darkens and fades into
// the rock while the next drip sets off; ~11s round, the three out of step. Its edges stop
// short of its middle, so the tip stays round, and the fresh tip runs a little hotter. Swells
// of warmth ooze down inside; the lava cools a little as it goes, and is warmest in the crater.
const LAVA_FRAG = `in vec2 vTextureCoord;
in vec2 vFilterUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uMapTexture;
uniform float uTime;
void main()
{
    vec4 c = texture(uTexture, vTextureCoord);
    vec3 m = texture(uMapTexture, vFilterUv).rgb;
    float d = m.r;
    float core = m.g;
    float ph = m.b;
    float t = fract(uTime / 11.0 + ph);
    float grow = 1.0 - pow(1.0 - smoothstep(0.0, 0.62, t), 2.0);
    float reach = mix(0.4, 1.03, grow);
    float edge = reach - d - pow(1.0 - core, 1.5) * 0.14;
    float set = smoothstep(0.8, 1.0, t) * smoothstep(0.36, 0.52, d);
    float vis = smoothstep(0.0, 0.05, edge) * (1.0 - set);
    float f = d * 2.0 - uTime * 0.16 + ph * smoothstep(0.0, 0.3, d);
    float swell = pow(0.5 + 0.5 * sin(f * 6.2832), 2.0);
    float cool = smoothstep(0.35, 1.0, d) * (1.0 - 0.5 * core) + (1.0 - core) * 0.3;
    vec3 rgb = mix(c.rgb, c.rgb * vec3(0.9, 0.5, 0.58), clamp(cool, 0.0, 1.0) * 0.45);
    float heat = core * (1.0 - 0.4 * d) * 0.3 * swell;
    heat += (1.0 - smoothstep(0.0, 0.14, d)) * core * 0.12;
    heat += (1.0 - smoothstep(0.0, 0.14, edge)) * step(0.001, d) * core * 0.3;
    rgb += vec3(1.0, 0.82, 0.42) * c.a * heat;
    rgb *= 1.0 - 0.35 * set;
    finalColor = vec4(min(rgb, vec3(c.a)), c.a) * vis;
}`;
class LavaFilter extends Filter {
	constructor(private map: Sprite) {
		super({
			glProgram: GlProgram.from({ vertex: LAVA_VERT, fragment: LAVA_FRAG, name: 'lava-filter' }),
			resources: {
				lavaUniforms: new UniformGroup({
					uFilterMatrix: { value: new Matrix(), type: 'mat3x3<f32>' },
					uTime: { value: 0, type: 'f32' },
				}),
				uMapTexture: map.texture.source,
			},
		});
		map.renderable = false;
	}
	set time(t: number) {
		this.resources.lavaUniforms.uniforms.uTime = t;
	}
	apply(fm: FilterSystem, input: Texture, output: RenderSurface, clear: boolean) {
		fm.calculateSpriteMatrix(this.resources.lavaUniforms.uniforms.uFilterMatrix, this.map);
		fm.applyFilter(this, input, output, clear);
	}
}

/** The volcano's lava (volcano-lava.webp, its hot pixels cut out of the painting, with a
 *  jelly gloss baked on) over the bare rock (volcano.webp, the lava painted out): glossy jelly
 *  like the blobs (user, 2026-10-29: "in the whole style of the slot"), then made to move
 *  ("now there is NO animation at all"): LavaFilter lets each drip ooze down and draw back
 *  while soft warmth flows inside. The crater breathes a warm glow and now and then spits a few
 *  embers that arc up and fall back. (The jelly bubbles that popped in the crater were cut:
 *  "not very realistic".) */
const EMBER_N = 6;
class Lava implements Ticker {
	private filter: LavaFilter;
	private crater: Sprite;
	private embers: { s: Sprite; start: number; ms: number; vx: number; vy: number }[] = [];
	private nextBurst = 0;
	constructor(private ctx: Ctx, parent: Container) {
		const flow = new Container();
		const lava = new Sprite(ctx.tex('./base/hd/volcano-lava.webp'));
		lava.position.set(912, 92);
		lava.width = lava.height = 329;
		const map = new Sprite(ctx.tex('./base/hd/volcano-flow.webp'));
		map.position.set(912, 92);
		map.width = map.height = 329;
		flow.addChild(lava, map);
		this.filter = new LavaFilter(map);
		flow.filters = [this.filter];
		parent.addChild(flow);
		// A warm haze over the crater's mouth, normal blend: added light on the blue sky went
		// white-cyan, not lava-orange.
		this.crater = new Sprite(ctx.soft);
		this.crater.anchor.set(0.5);
		this.crater.tint = '#ff8a3d';
		this.crater.position.set(CRATER.x, CRATER.y + 1);
		parent.addChild(this.crater);
		for (let i = 0; i < EMBER_N; i++) {
			const s = new Sprite(ctx.soft);
			s.anchor.set(0.5);
			s.tint = '#ffc45c';
			s.alpha = 0;
			parent.addChild(s);
			this.embers.push({ s, start: -1e9, ms: 1, vx: 0, vy: 0 });
		}
	}
	tick(now: number) {
		const R = this.ctx.reduced;
		this.filter.time = R ? 0 : now / 1000;
		// Two uneven breaths, so the glow never pulses like a metronome.
		const b = R ? 0.5 : 0.5 + 0.3 * Math.sin(now / 1300) + 0.2 * Math.sin(now / 530 + 1.1);
		this.crater.alpha = 0.22 + 0.2 * b;
		this.crater.width = 50 + 10 * b;
		this.crater.height = 14 + 4 * b;
		if (!R && now > this.nextBurst) {
			// A small spit of 2-4 embers every 4-9s.
			this.nextBurst = now + rand(4000, 9000);
			let k = 2 + Math.floor(Math.random() * 3);
			for (const e of this.embers) {
				if (k === 0) break;
				if (now - e.start < e.ms) continue;
				e.start = now + rand(0, 260);
				e.ms = rand(1100, 1700);
				e.vx = rand(-14, 14);
				e.vy = rand(16, 30);
				k--;
			}
		}
		for (const e of this.embers) {
			const t = (now - e.start) / e.ms;
			if (R || t < 0 || t > 1) {
				e.s.alpha = 0;
				continue;
			}
			// Up and over under gravity, cooling as it goes.
			e.s.x = CRATER.x + e.vx * t;
			e.s.y = CRATER.y - 2 - e.vy * 4 * t * (1 - t) * 1.2 + 10 * t * t;
			const w = 3.2 * (1 - 0.5 * t);
			e.s.width = e.s.height = w;
			e.s.alpha = Math.min(1, t / 0.08) * (1 - t) ** 1.5;
		}
	}
}

/** Smoke from the volcano's crater (11362:70935's, at ~(1086, 179)): soft round puffs that
 *  rise off the crater, swell, lean a little with the wind and thin out, overlapping into one
 *  faint wisp. Very gentle: slow, pale, never a plume. The puffs share one cycle, evenly
 *  staggered, so the column never gaps or bunches. Under reduced motion it holds still. The
 *  hidden bonus's candy house wears a smaller copy on its chimney (`k` scales size and rise). */
const SMOKE_MS = 10000;
const SMOKE_N = 10;
type SmokeAt = { x: number; y: number; k: number; tint: string; alpha: number };
const CRATER_SMOKE: SmokeAt = { ...CRATER, k: 1, tint: '#fbf7ff', alpha: 0.5 };
class Smoke implements Ticker {
	private puffs: Sprite[] = [];
	constructor(
		private ctx: Ctx,
		parent: Container,
		private at: SmokeAt = CRATER_SMOKE,
	) {
		for (let i = 0; i < SMOKE_N; i++) {
			const p = new Sprite(ctx.soft);
			p.anchor.set(0.5);
			p.tint = at.tint;
			p.alpha = 0;
			parent.addChild(p);
			this.puffs.push(p);
		}
	}
	tick(now: number) {
		const t0 = this.ctx.reduced ? 0 : now;
		const { x, y, k, alpha } = this.at;
		this.puffs.forEach((p, i) => {
			const t = cycle(t0, SMOKE_MS, (-i / SMOKE_N) * SMOKE_MS);
			const e = 1 - (1 - t) ** 1.6; // quick off the crater, slowing as it thins
			const w = k * (18 + 40 * t);
			p.width = w;
			p.height = w * 0.85;
			p.x = x + k * (26 * e * e + 3 * Math.sin(t * 6 + i * 1.7));
			p.y = y - 2 - k * 100 * e;
			// In over the first tenth, out over the rest.
			p.alpha = alpha * Math.min(1, t / 0.1) * (1 - t) ** 1.2;
		});
	}
}

/** 11362:70765, the sailboat: crosses the water from a random side (bow first, so flipped when
 *  sailing left), slowly, riding a gentle swell (a small bob and roll) with a faint wake fanning
 *  out behind it; behind the island, mama and the board; then rests a while off-screen. It
 *  stays moored off-screen under reduced motion. */
const WAKE_N = 7;
const WAKE_MS = 3600;
class Boat implements Ticker {
	private s: Sprite;
	private wake: Sprite[] = [];
	private from = 0;
	private to = 0;
	private start = 0;
	private ms = 0;
	private next: number;
	private sailing = false;
	private dir = 1;
	constructor(private ctx: Ctx, parent: Container) {
		for (let i = 0; i < WAKE_N; i++) {
			const w = new Sprite(ctx.soft);
			w.anchor.set(0.5);
			w.alpha = 0;
			parent.addChild(w);
			this.wake.push(w);
		}
		this.s = new Sprite(ctx.tex('./base/hd/boat.webp'));
		// Origin on the keel's waterline, so the rock pivots in the water.
		this.s.anchor.set(0.5, 0.86);
		this.s.width = 77;
		this.s.height = 67;
		this.s.visible = false;
		parent.addChild(this.s);
		this.next = performance.now() + rand(600, 2000);
	}
	tick(now: number) {
		if (!this.sailing) {
			for (const w of this.wake) w.alpha = 0;
			if (this.ctx.reduced || now < this.next) return;
			this.dir = Math.random() < 0.5 ? 1 : -1;
			this.from = this.dir > 0 ? -60 : SKY.w + 60;
			this.to = this.dir > 0 ? SKY.w + 60 : -60;
			this.start = now;
			// Slow, like a small sailboat far off (user: ~30s crossings were "very fast").
			this.ms = rand(55000, 70000);
			this.s.scale.x = Math.abs(this.s.scale.x) * this.dir;
			this.s.visible = this.sailing = true;
		}
		const t = (now - this.start) / this.ms;
		if (t >= 1 || this.ctx.reduced) {
			this.s.visible = this.sailing = false;
			this.next = now + rand(4000, 10000);
			return;
		}
		const x = this.from + (this.to - this.from) * t;
		// A slow, gentle swell (~3s): a small bob, and a roll that lags it a little.
		const swell = Math.sin(now / 480) + 0.3 * Math.sin(now / 1130 + 0.9);
		this.s.x = x;
		this.s.y = 341 + 67 * 0.86 + 1.1 * swell;
		this.s.rotation = this.dir * (1.5 * Math.sin(now / 480 - 1.1) + 0.4 * Math.sin(now / 1700)) * DEG;
		// The wake: rings left at the stern every WAKE_MS / WAKE_N, widening and fading.
		const speed = (this.to - this.from) / this.ms;
		this.wake.forEach((w, i) => {
			const age = cycle(now, WAKE_MS, (-i / WAKE_N) * WAKE_MS);
			const born = now - age * WAKE_MS;
			if (born < this.start) return void (w.alpha = 0);
			w.x = this.from + speed * (born - this.start) - this.dir * 22;
			w.y = 341 + 67 * 0.86 + 1 + age * 2;
			w.width = 16 + 54 * age;
			w.height = 3 + 3 * age;
			w.alpha = 0.3 * Math.min(1, age * 6) * (1 - age);
		});
	}
}

class BaseWorld extends World {
	private glints: { s: Sprite; x: number; sx: number; dur: number; delay: number }[] = [];
	private peekLayer = new Container();
	private seaMap: Sprite | null = null;
	private peeks: LivePeek[] = [];
	private peekId = 0;
	constructor(ctx: Ctx, portrait: boolean, slice: { w: number; h: number }) {
		super(ctx);
		this.sprite('./base/hd/hills.webp', -2, -3, 1204, 674);
		const dome = ([c, x, y, s]: readonly [keyof typeof DOME_COLOR, number, number, number], fast: boolean) =>
			new Dome(ctx, this.root, {
				src: `./base/hd/dome-${c}${s < 120 ? '-small' : ''}.webp`,
				color: DOME_COLOR[c],
				x: x + 0.06 * s,
				y: y + 0.3 * s,
				w: 0.88 * s,
				h: 0.4 * s,
				ox: 0.44 * s,
				oy: 0.4 * s * 0.955,
				first: fast ? [1500, 9000] : [4000, 25000],
				rest: fast ? [5000, 11000] : [2500, 6000],
				wait: fast ? [1500, 4000] : [20000, 50000],
				// Portrait's are the band's only life: up from the start, rarely gone for long.
				shown: fast,
			});
		if (portrait) {
			for (const [c, fx, fy, s] of PHONE_DOMES)
				this.parts.push(
					dome(
						[
							c,
							(SKY.w - slice.w) / 2 + fx * slice.w - s / 2,
							Math.max(GRASS_Y, (SKY.h - slice.h) / 2 + fy * slice.h) - 0.3 * s - 0.4 * s * 0.955,
							s,
						],
						true,
					),
				);
			const sky = new Container();
			sky.position.set((SKY.w - slice.w) / 2, (SKY.h - slice.h) / 2);
			this.root.addChild(sky);
			this.parts.push(new Clouds(ctx, sky, PHONE_LANES, slice.w, PHONE_NEAR, PHONE_FAR));
			this.parts.push(new Birds(ctx, sky, [20, 120], slice.w, [11, 16]));
		} else {
			for (const d of BASE_DOMES) this.parts.push(dome(d, false));
			this.parts.push(new Clouds(ctx, this.root, BASE_CLOUD_LANES, SKY.w));
			this.parts.push(new Birds(ctx, this.root, [80, 215]));
		}
		// The split backdrop (11362:70545), back to front: the water, the far hills on its
		// horizon (cut off at x 1011 for the volcano), the smoking volcano and the dome hill at
		// its foot, then the boat, and the right island with its peekers between its back and
		// front. The design draws the boat under the volcano; it sails on the water in front of
		// the horizon here, or its sail would vanish into the mountain's foot. Mama and the board
		// are DOM over this canvas, so the boat passes behind them.
		// A live sea (user: the painted one was "very still.. clear the image and animate the
		// sea"): the water cleared of its painted streaks, the horizon's hills, volcano and dome
		// hill mirrored into it and fading with depth, all rippled by a scrolling water map
		// (SuperWorld's sea); Swells roll in over it.
		const sea = new Container();
		this.sprite('./base/hd/water-clear.webp', -9, 215, 1209, 403, false, sea);
		const mirror = new Container();
		for (const [src, x, y, w, h] of BASE_REFLECTED) {
			const r = new Sprite(ctx.tex(src));
			r.position.set(x, SEA_HORIZON + (SEA_HORIZON - y) * REFLECT_SQUASH);
			r.width = w;
			r.height = h * REFLECT_SQUASH;
			r.scale.y *= -1;
			mirror.addChild(r);
		}
		// Clipped to the water, half seen through it, and faded out with depth by the water's
		// own colour laid over it (a sprite alpha mask here drew nothing).
		mirror.alpha = 0.5;
		const clip = new Graphics().rect(-20, SEA_HORIZON, 1240, 484 - SEA_HORIZON).fill('#fff');
		sea.addChild(clip, mirror);
		mirror.mask = clip;
		const fade = new Sprite(reflectFade());
		fade.position.set(-20, SEA_HORIZON);
		fade.width = 1240;
		fade.height = 484 - SEA_HORIZON;
		sea.addChild(fade);
		const seaMap = (this.seaMap = new Sprite(waterMap()));
		seaMap.scale.set(2.4, 0.8);
		sea.addChild(seaMap);
		sea.filters = [new DisplacementFilter({ sprite: seaMap, scale: { x: 9, y: 3 } })];
		this.root.addChild(sea);
		this.sprite('./base/hd/far-hills.webp', 0, 68, 1011, 400);
		this.sprite('./base/hd/volcano.webp', 912, 92, 329, 329);
		this.parts.push(new Lava(ctx, this.root));
		this.parts.push(new Smoke(ctx, this.root));
		this.sprite('./base/hd/dome-hill.webp', 814, 268, 267, 117);
		this.parts.push(new Swells(ctx, this.root));
		for (const g of GLINTS) {
			const sp = new Sprite(ctx.soft);
			sp.anchor.set(0.5);
			sp.width = g.w / 100 * SKY.w;
			sp.height = 5;
			const x = (g.x / 100) * SKY.w + sp.width / 2;
			sp.position.set(x, g.y);
			sp.alpha = 0;
			this.root.addChild(sp);
			this.glints.push({ s: sp, x, sx: sp.scale.x, dur: g.dur * 1000, delay: g.delay * 1000 });
		}
		this.parts.push(new Boat(ctx, this.root));
		// The island is painted soft and hazy with distance; the blobs are crisp art. Unsoftened,
		// a peeker read as a sticker on the painting (user, 2026-10-30: "the blob is not blurred
		// enough"): edges as soft as the trees' around it, its contrast eased a touch toward the haze.
		const haze = new ColorMatrixFilter();
		haze.contrast(-0.08, false);
		haze.brightness(1.06, true);
		this.peekLayer.filters = [new BlurFilter({ strength: 0.6, quality: 3 }), haze];
		this.root.addChild(this.peekLayer);
		this.sprite('./base/hd/island.webp', ISLAND.x, ISLAND.y, ISLAND.w, ISLAND.h);
		this.later(rand(4000, 12000), () => this.peek());
	}
	// Now and then a blob peeks out of the island (BaseScene.svelte's spots).
	private peek() {
		// Reduced motion, or hidden under a bonus world: nobody peeks, but the schedule runs on
		// (so turning reduced motion off mid-game brings the peekers back).
		if (this.ctx.reduced || !this.root.visible) return this.later(rand(3000, 8000), () => this.peek());
		const spots = Math.random() < 0.35 ? ISLAND_SPOTS : [pick(ISLAND_SPOTS)];
		const now = performance.now();
		spots.forEach((s, i) => {
			const size = ISLAND_PEEK;
			const pb = new PeekBlob(this.ctx, pick(PEEKERS), `peek-${this.peekId++}`, size);
			this.peekLayer.addChild(pb.root);
			const p: LivePeek = {
				pb,
				// left/top place the box; the origin is 50% 90% of it.
				x: ISLAND.x + (s.x / 100) * ISLAND.w,
				y: ISLAND.y + (s.top / 100) * ISLAND.h + size * 0.9,
				frames: islandPeek(0, s.px, s.py, s.lean),
				start: now + i * rand(250, 700),
				ms: BASE_PEEK_MS,
				end: now + BASE_PEEK_MS + 800,
			};
			this.peeks.push(p);
		});
		this.later(rand(6000, 16000), () => this.peek());
	}
	tick(now: number) {
		super.tick(now);
		// The map drifts sideways and toward the viewer: the water's streaks waver and roll in.
		if (this.seaMap && !this.ctx.reduced) {
			this.seaMap.x = -cycle(now, 16000, 0) * 256 * 2.4;
			this.seaMap.y = cycle(now, 7000, 0) * 128 * 0.8;
		}
		for (const g of this.glints) {
			if (this.ctx.reduced) {
				g.s.alpha = 0.4;
				continue;
			}
			const v = keyframes(GLINT, cycle(now, g.dur, g.delay), EASE_IN_OUT);
			g.s.alpha = v.a;
			g.s.x = g.x + v.tx;
			g.s.scale.x = g.sx * v.sx;
		}
		this.peeks = this.peeks.filter((p) => {
			if (now >= p.end) {
				p.pb.root.destroy(DISPOSE);
				return false;
			}
			tickPeek(p, now, this.ctx.reduced);
			return true;
		});
	}
}

// Normal bonus (BonusNormal.svelte): Figma 11362:72643 (2026-10-29), the sunset blob-house
// meadow. Layers from build-bonus-scene.py's normal-v2; the sky is the frame's gradient.
const NA = './bonus/normal/hd';
const N_SKY = [
	[0, '#985efb'],
	[0.305, '#ce5cf3'],
	[0.582, '#fc68cb'],
	[0.74, '#fd80b3'],
	[1, '#fd979b'],
] as const;
// The two pink clouds (297×99 at 60%): [x, y, sway px, sway period ms].
const N_CLOUDS = [
	[73, 6, 18, 23000],
	[887, 118, 14, 31000],
] as const;
// Peek spots right of the board, under the round panels: the blob's centre x and the crest's
// edge there (measured from the art's alpha), behind the hill or behind the dunes.
const N_SPOTS = [
	{ x: 1062, edge: 411, lean: -8, back: true },
	{ x: 1155, edge: 449, lean: -6, back: false },
	{ x: 985, edge: 440, lean: -10, back: false },
];
class NormalWorld extends World {
	private back = new Container();
	private front = new Container();
	private clouds: { s: Sprite; x: number; sway: number; ms: number }[] = [];
	private peeks: (LivePeek & { spot: number })[] = [];
	private peekId = 0;
	constructor(ctx: Ctx) {
		super(ctx);
		const sky = new Sprite(
			canvasTexture(4, 496, (g) => {
				const lg = g.createLinearGradient(0, 0, 0, 496);
				for (const [o, c] of N_SKY) lg.addColorStop(o, c);
				g.fillStyle = lg;
				g.fillRect(0, 0, 4, 496);
			}),
		);
		// Past the frame on every side, for the cover crop; the top colour carries up.
		sky.position.set(-80, 0);
		sky.width = 1360;
		sky.height = 496;
		this.root.addChild(new Graphics().rect(-80, -120, 1360, 121).fill(N_SKY[0][1]), sky);
		for (const [x, y, sway, ms] of N_CLOUDS) {
			const c = this.sprite(`${NA}/cloud.webp`, x, y, 297, 99);
			c.alpha = 0.6;
			this.clouds.push({ s: c, x, sway, ms });
		}
		this.parts.push(new Birds(ctx, this.root, [60, 170]));
		this.root.addChild(this.back);
		this.sprite(`${NA}/hills.webp`, 194, 248, 1023, 342);
		this.sprite(`${NA}/house.webp`, -56, 102, 369, 379);
		this.root.addChild(this.front);
		this.sprite(`${NA}/dunes.webp`, -209, 315, 1497, 500);
		this.later(rand(2000, 6000), () => this.peek());
	}
	private peek() {
		// Reduced motion, or hidden under a bonus world: nobody peeks, but the schedule runs on
		// (so turning reduced motion off mid-game brings the peekers back).
		if (this.ctx.reduced || !this.root.visible) return this.later(rand(3000, 8000), () => this.peek());
		const busy = new Set(this.peeks.map((p) => p.spot));
		const free = N_SPOTS.map((_, i) => i).filter((i) => !busy.has(i));
		if (free.length) {
			const i = pick(free);
			const s = N_SPOTS[i];
			const now = performance.now();
			const pb = new PeekBlob(this.ctx, pick(PEEKERS), `bonus-peek-${this.peekId++}`, 50);
			(s.back ? this.back : this.front).addChild(pb.root);
			this.peeks.push({ pb, spot: i, x: s.x, y: s.edge + 4 + 45, frames: cliffPeek(s.lean), start: now, ms: 4000, end: now + 4300 });
		}
		this.later(rand(5000, 14000), () => this.peek());
	}
	tick(now: number) {
		super.tick(now);
		for (const c of this.clouds) c.s.x = c.x + (this.ctx.reduced ? 0 : c.sway * Math.sin((now / c.ms) * Math.PI * 2));
		this.peeks = this.peeks.filter((p) => {
			if (now >= p.end) {
				p.pb.root.destroy(DISPOSE);
				return false;
			}
			tickPeek(p, now, this.ctx.reduced);
			return true;
		});
	}
}

// Super bonus (BonusSuper.svelte): Figma 11300:27276 (2026-10-29), the pink sunset dunes. One
// painting (build-bonus-scene.py), the normal bonus's pink cloud three times and a blue jelly
// dome at the board's foot that now and then pops and blows back up.
const SA = './bonus/super/hd';
// [x, y, w, h, sway px, sway period ms]
const S_CLOUDS = [
	[38, 31, 297, 99, 16, 27000],
	[600, 103, 297, 99, 12, 34000],
	[934, 26, 231, 77, 14, 23000],
] as const;
// 11300:27289 at (291, 441) 133 square, its art cropped like every dome (CROP, x 6-94%, y 30-70%).
const S_DOME = { x: 291, y: 441, s: 133, foot: 0.914 };
const S_TREE = [978, 129, 331, 362] as const;
// The tree's candies as fairy lights (user 2026-11-02: "make something with this tree, maybe to
// light"): [x, y, size] in candy-tree.webp px (1199x1312), found by colour in the art, and the
// candy's colour. A light wave runs round the crown from TREE_HUB; sparkles pop on them.
const TREE_ART = [1199, 1312] as const;
const TREE_HUB = [560, 470] as const;
const TREE_ROOT = [620, 1290] as const;
const TREE_LIGHTS = [
	[513, 106, 160, 0xffd84a],
	[640, 216, 104, 0xffd84a],
	[200, 474, 62, 0xffd84a],
	[501, 550, 164, 0xffd84a],
	[847, 518, 62, 0xffd84a],
	[887, 694, 100, 0xffd84a],
	[263, 303, 194, 0x3ec8ff],
	[832, 327, 108, 0x3ec8ff],
	[988, 489, 160, 0x3ec8ff],
	[344, 652, 104, 0x3ec8ff],
	[469, 270, 66, 0xc46bff],
	[131, 577, 108, 0xc46bff],
	[720, 602, 108, 0xc46bff],
] as const;
// Gentle (user 2026-11-02: the first pass was "too aggressive"): a slow, shallow glow wave and
// rare small sparkles.
const TREE_WAVE_MS = 5600;
const SPARKLE_MS = 1100;
/** A seamless water map: R pushes sideways, G up/down; long horizontal swells with a finer
 *  chop on top. Integer frequencies so it tiles. */
function waterMap() {
	const W = 256;
	const H = 128;
	const c = document.createElement('canvas');
	c.width = W;
	c.height = H;
	const g = c.getContext('2d')!;
	const img = g.createImageData(W, H);
	const T = Math.PI * 2;
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++) {
			const u = x / W;
			const v = y / H;
			const r = 0.55 * Math.sin(T * (2 * u + 5 * v)) + 0.3 * Math.sin(T * (5 * u - 9 * v) + 1.3) + 0.15 * Math.sin(T * (11 * u + 17 * v));
			const gr = 0.6 * Math.sin(T * (3 * u + 7 * v) + 0.7) + 0.4 * Math.sin(T * (7 * u - 13 * v) + 2.1);
			const k = (y * W + x) * 4;
			img.data[k] = 128 + 127 * r;
			img.data[k + 1] = 128 + 127 * gr;
			img.data[k + 2] = 128;
			img.data[k + 3] = 255;
		}
	g.putImageData(img, 0, 0);
	const t = Texture.from(c);
	t.source.addressMode = 'repeat';
	return t;
}
class SuperWorld extends World {
	private clouds: { s: Sprite; x: number; sway: number; ms: number }[] = [];
	private tree = new Container();
	private lights: { g: Graphics; phase: number }[] = [];
	private sparkles: { g: Graphics; at: number; i: number }[] = [];
	private sparkleNext = 0;
	constructor(ctx: Ctx) {
		super(ctx);
		// The painting's box (12, -16, 1185×686) falls short of the frame's sides: scaled about
		// its centre to the frame's width.
		this.sprite(`${SA}/dunes.webp`, 0, 327 - 347, 1200, 694);
		for (const [x, y, w, h, sway, ms] of S_CLOUDS) {
			const c = this.sprite(`${NA}/cloud.webp`, x, y, w, h);
			c.alpha = 0.6;
			this.clouds.push({ s: c, x, sway, ms });
		}
		this.parts.push(new Birds(ctx, this.root, [50, 180]));
		// 11376:74001, the candy tree right of the board, its far side past the frame's edge. It
		// sways a touch from its trunk, its candies lit like fairy lights.
		const [tx, ty, tw, th] = S_TREE;
		const k = tw / TREE_ART[0];
		this.tree.pivot.set(TREE_ROOT[0] * k, TREE_ROOT[1] * k);
		this.tree.position.set(tx + TREE_ROOT[0] * k, ty + TREE_ROOT[1] * k);
		this.root.addChild(this.tree);
		this.sprite(`${SA}/candy-tree.webp`, 0, 0, tw, th, false, this.tree);
		for (const [x, y, size, color] of TREE_LIGHTS) {
			const r = (size / 2) * k;
			// A halo in the candy's colour, brightest just past its rim, and a hot white core.
			const g = new Graphics()
				.circle(0, 0, r * 1.45).fill({ color, alpha: 0.07 })
				.circle(0, 0, r * 1.2).fill({ color, alpha: 0.12 })
				.circle(0, 0, r * 0.4).fill({ color: 0xffffff, alpha: 0.16 });
			g.blendMode = 'add';
			g.position.set(x * k, y * k);
			this.tree.addChild(g);
			const phase = Math.atan2(y - TREE_HUB[1], x - TREE_HUB[0]) / (Math.PI * 2);
			this.lights.push({ g, phase });
		}
		for (let i = 0; i < 3; i++) {
			// A four-point star: two thin crossed diamonds.
			const g = new Graphics()
				.poly([0, -9, 1.6, -1.6, 9, 0, 1.6, 1.6, 0, 9, -1.6, 1.6, -9, 0, -1.6, -1.6]).fill(0xffffff)
				.circle(0, 0, 2.6).fill(0xffffff);
			g.blendMode = 'add';
			g.visible = false;
			this.tree.addChild(g);
			this.sparkles.push({ g, at: -Infinity, i: 0 });
		}
		const { x, y, s, foot } = S_DOME;
		const w = 0.88 * s;
		const h = 0.4 * s;
		this.parts.push(
			new Dome(ctx, this.root, {
				src: `${SA}/dome-blue.webp`,
				color: '#3f7bff',
				x: x + 0.06 * s,
				y: y + 0.3 * s,
				w,
				h,
				ox: w / 2,
				oy: h * foot,
				shown: true,
				first: [2000, 12000],
				rest: [3000, 7000],
				wait: [1500, 5000],
			}),
		);
	}
	tick(now: number) {
		super.tick(now);
		const R = this.ctx.reduced;
		for (const c of this.clouds) c.s.x = c.x + (R ? 0 : c.sway * Math.sin((now / c.ms) * Math.PI * 2));
		this.tree.rotation = R ? 0 : 0.004 * Math.sin(now / 2600);
		// The wave: each light glows softly, and brightens as the wave passes its angle round the hub.
		const w = now / TREE_WAVE_MS;
		for (const { g, phase } of this.lights) {
			const p = R ? 0 : Math.max(0, Math.cos((w - phase) * Math.PI * 2));
			const on = p ** 2;
			g.alpha = 0.3 + 0.45 * on;
			g.scale.set(0.97 + 0.06 * on);
		}
		if (R) {
			for (const s of this.sparkles) s.g.visible = false;
			return;
		}
		// Sparkles: one pops on a random candy every so often, grows, turns and fades.
		const k = S_TREE[2] / TREE_ART[0];
		if (now >= this.sparkleNext) {
			const s = this.sparkles.find((x) => now - x.at > SPARKLE_MS);
			if (s) {
				s.at = now;
				s.i = Math.floor(Math.random() * TREE_LIGHTS.length);
				const [x, y, size] = TREE_LIGHTS[s.i];
				s.g.position.set((x + size * 0.18) * k, (y - size * 0.2) * k);
			}
			this.sparkleNext = now + 1800 + Math.random() * 2400;
		}
		for (const s of this.sparkles) {
			const t = (now - s.at) / SPARKLE_MS;
			s.g.visible = t >= 0 && t < 1;
			if (!s.g.visible) continue;
			const b = Math.sin(t * Math.PI);
			s.g.scale.set(0.25 + 0.4 * b);
			s.g.alpha = 0.7 * b;
			s.g.rotation = t * 0.5;
		}
	}
}

// Hidden bonus: Figma 11174:6525, the neon blue cavern (user, 2026-10-27; it had been the Super
// world at night). Layers in the frame's order, boxes as the frame places them.
const HA = './bonus/hidden/hd';
const H_BACK = [
	['mound-a', -90, 178, 432, 432],
] as const;
const H_GLOWS = [
	[721, 258],
	[1094, 346],
	[780, 92],
	[320, 106],
	[134, 92],
	[150, 229],
	[965, 61],
] as const;
const H_GEM = [70, 258, 229, 305] as const;
// [x, y, size]: the dome art is the frame's square; its foot sits at 68% of it.
const H_DOME_FOOT = 0.682;
const H_FRONT = [
	['mound-a', -78, 274, 296, 296],
	['dome', 92, 335, 314, 314],
	['mound-b', -155, 324, 551, 551],
] as const;
const H_DOME_COLOR = '#ea32df';
// 11381:76399 (2026-10-29), the blue candy house right of the board, its far side past the
// frame's edge; it took the place of the right-hand domes and mound-c (the frame dropped them).
// Its chimney (the purple cap, art x 262-608, y 100-230 of 1349x1166) smokes a little: the
// puffs start behind the cap's crown (art ~435, 140) and rise out over it.
const H_HOUSE = [965, 130, 457, 395] as const;
const H_SMOKE: SmokeAt = { x: 1112, y: 178, k: 0.6, tint: '#e6deff', alpha: 0.5 };
class HiddenWorld extends World {
	private glows: { g: Graphics; dur: number; delay: number }[] = [];
	private gem: Sprite;
	constructor(ctx: Ctx) {
		super(ctx);
		// A touch past the frame's own box (-35, -10, 1235x690), so no layout shows its edge.
		this.sprite(`${HA}/cavern.webp`, -40, -14, 1250, 700);
		for (const [src, x, y, w, h] of H_BACK) this.sprite(`${HA}/${src}.webp`, x, y, w, h);
		H_GLOWS.forEach(([x, y], i) => {
			// The frame's 16px glow: a #04DAFD dot blurred 2, drawn as a core in two soft rings.
			const g = new Graphics()
				.circle(0, 0, 13).fill({ color: 0x04dafd, alpha: 0.14 })
				.circle(0, 0, 9).fill({ color: 0x04dafd, alpha: 0.45 })
				.circle(0, 0, 5.5).fill({ color: 0x9ff3ff, alpha: 0.95 });
			g.position.set(x + 8, y + 8);
			this.root.addChild(g);
			this.glows.push({ g, dur: 2400 + ((i * 7) % 5) * 380, delay: i * 530 });
		});
		this.gem = this.sprite(`${HA}/gem.webp`, ...H_GEM);
		this.gem.anchor.set(0.5);
		this.gem.position.set(H_GEM[0] + H_GEM[2] / 2, H_GEM[1] + H_GEM[3] / 2);
		for (const [src, x, y, w, h] of H_FRONT) {
			if (src !== 'dome') {
				this.sprite(`${HA}/${src}.webp`, x, y, w, h);
				continue;
			}
			this.parts.push(
				new Dome(ctx, this.root, {
					src: `${HA}/dome.webp`,
					color: H_DOME_COLOR,
					x,
					y,
					w,
					h,
					ox: w / 2,
					oy: h * H_DOME_FOOT,
					shown: true,
					first: [2500, 14000],
					rest: [3000, 7000],
					wait: [9000, 24000],
				}),
			);
		}
		this.parts.push(new Smoke(ctx, this.root, H_SMOKE));
		this.sprite(`${HA}/candy-house.webp`, ...H_HOUSE);
	}
	tick(now: number) {
		super.tick(now);
		const R = this.ctx.reduced;
		for (const { g, dur, delay } of this.glows) {
			const k = R ? 1 : alternate(now, dur, delay, EASE_IN_OUT);
			g.alpha = 0.45 + 0.55 * k;
			g.scale.set(0.8 + 0.3 * k);
		}
		// The jelly gem floats a little.
		const b = R ? 0 : Math.sin(now / 1100);
		this.gem.y = H_GEM[1] + H_GEM[3] / 2 - 5 * b;
		this.gem.rotation = R ? 0 : 0.025 * Math.sin(now / 1700);
	}
}

// ---- Scene ------------------------------------------------------------------------------------

const BASE_SRCS = [
	'./base/hd/hills.webp',
	'./base/hd/volcano.webp',
	'./base/hd/volcano-lava.webp',
	'./base/hd/volcano-flow.webp',
	'./base/hd/dome-hill.webp',
	'./base/hd/water-clear.webp',
	'./base/hd/far-hills.webp',
	'./base/hd/island.webp',
	'./base/hd/boat.webp', NEAR_LOOK.src, FAR_LOOK.src].concat(
	...(['green', 'magenta', 'purple'] as const).map((c) => [`./base/hd/dome-${c}.webp`, `./base/hd/dome-${c}-small.webp`]),
);
const BONUS_SRCS = [
	`${NA}/hills.webp`,
	`${NA}/house.webp`,
	`${NA}/cloud.webp`,
	`${NA}/dunes.webp`,
	`${SA}/dunes.webp`,
	`${SA}/dome-blue.webp`,
	`${SA}/candy-tree.webp`,
	`${HA}/cavern.webp`,
	`${HA}/candy-house.webp`,
	`${HA}/mound-a.webp`,
	`${HA}/mound-b.webp`,
	`${HA}/gem.webp`,
	`${HA}/dome.webp`,
];
const FADE_MS = 700;

export class SceneView {
	private pixi = new PixiApp();
	private app = this.pixi.app;
	private readonly textures = new Map<string, Texture>();
	private reduced = false;
	private unwatchMotion: (() => void) | null = null;
	// The portrait base world is built for the narrowest slice seen (see layout()).
	private built: { portrait: boolean; w: number } | null = null;
	private ctx!: Ctx;
	private scene = new Container();
	private base: BaseWorld | null = null;
	private bonus: { world: World; tier: Tier; from: number; to: number; start: number }[] = [];
	private tier: Tier = null;
	private host: HTMLElement | null = null;
	private destroyed = false;
	private extra: Texture[] = [];
	private dropTex = new Map<string, Texture>();
	private shown = { portrait: false, slice: { x: 0, y: 0, w: SKY.w, h: SKY.h } };
	frozen: number | null = null;

	async init(host: HTMLElement) {
		this.host = host;
		if (import.meta.env.DEV) (globalThis as { __scene?: SceneView }).__scene = this;
		this.unwatchMotion = watchReducedMotion((r) => {
			this.reduced = r;
			if (this.ctx) this.ctx.reduced = r;
		});
		const ok = await this.pixi.init({
			resizeTo: host,
			antialias: false,
			// The backdrops are soft (blur baked in), but the domes, puff clouds, birds and blobs
			// are crisp: 1.5 drew them at 75% on a retina screen. 2 costs ~1.8× the fill.
			resolution: Math.min(2, devicePixelRatio || 1),
		});
		if (!ok) return;
		await Promise.all(
			[...BASE_SRCS, ...BONUS_SRCS].map(async (src) => {
				this.textures.set(src, await Assets.load<Texture>({ src, data: { autoGenerateMipmaps: true, scaleMode: 'linear' } }));
			}),
		);
		const blobTex = await loadBlobTextures();
		if (this.destroyed) return;
		const blush = blushTexture();
		const soft = softTexture();
		const birds = birdTextures();
		const ring = ringTexture();
		this.extra = [blush, soft, ring, ...birds];
		this.ctx = {
			tex: textureLookup('SceneView', this.textures, blobTex),
			soft,
			ring,
			birds,
			drop: (c) => {
				let t = this.dropTex.get(c);
				if (!t) this.dropTex.set(c, (t = dropTexture(c)));
				return t;
			},
			blob: { tex: textureLookup('SceneView', blobTex), blush },
			reduced: this.reduced,
			// Whether a box (in `parent`) sits under App's mama (her canvas reaches past her box,
			// and a dome's spray flies about half its width round it).
			covered: (parent, x, y, w, h) => {
				const a = document.querySelector('.base-mama')?.getBoundingClientRect();
				if (!a?.width) return false;
				const c = this.app.canvas.getBoundingClientRect();
				const k = c.width / (this.app.screen.width || 1);
				const p0 = parent.toGlobal({ x, y });
				const p1 = parent.toGlobal({ x: x + w, y: y + h });
				const [l, t, r, b] = [c.left + p0.x * k, c.top + p0.y * k, c.left + p1.x * k, c.top + p1.y * k];
				const m = (r - l) * 0.6 + a.width * 0.15;
				return r + m > a.left && l - m < a.right && b + m > a.top && t - m < a.bottom;
			},
		};
		// Upload up front (pixi 8.8.1 has no working PrepareSystem): a bonus world's first frame
		// must not stall on 10MB of texture uploads.
		const gl = this.app.renderer.texture as unknown as { initSource?: (s: unknown) => void };
		for (const t of [...this.textures.values(), ...this.extra]) gl.initSource?.(t.source);
		this.app.stage.addChild(this.scene);
		host.appendChild(this.app.canvas);
		this.app.canvas.style.display = 'block';
		this.layout();
		this.setTier(this.tier, true);
		this.pixi.run(() => this.frame());
		// resizeTo resizes the renderer a frame after the window's resize event: lay out then,
		// from the new screen size, not from the event.
		this.app.renderer.on('resize', () => this.layout());
	}

	/** Called once if the view stops working after init (a throw in a frame, a lost context). */
	set onfail(fn: ((e: unknown) => void) | null) {
		this.pixi.onfail = fn;
	}

	// Cover-scale the 1200×670 scene (4% overscan); portrait rebuilds the base world, whose
	// domes and clouds live in the slice a phone actually sees.
	private layout() {
		const vw = this.app.screen.width;
		const vh = this.app.screen.height;
		if (!vw || !vh) return;
		const scale = Math.max(vw / SKY.w, vh / SKY.h) * 1.04;
		this.scene.scale.set(scale);
		this.scene.position.set(vw / 2 - (SKY.w / 2) * scale, vh / 2 - (SKY.h / 2) * scale);
		const portrait = vh > vw;
		const slice = { w: vw / scale, h: vh / scale };
		this.shown = { portrait, slice: { x: (SKY.w - slice.w) / 2, y: (SKY.h - slice.h) / 2, ...slice } };
		for (const b of this.bonus) b.world.view(portrait, this.shown.slice);
		// A phone's URL bar showing and hiding changes the slice's width by ~8% each way: build
		// for the narrowest slice (wider ones just show a little more sky past it), and only
		// rebuild when the slice gets narrower than that, much wider, or the orientation flips.
		const b = this.built;
		const stale = !b || b.portrait !== portrait || (portrait && (slice.w < b.w * 0.99 || slice.w > b.w * 1.25));
		if (stale) {
			this.built = { portrait, w: slice.w };
			this.base?.destroy();
			this.base = new BaseWorld(this.ctx, portrait, slice);
			this.scene.addChildAt(this.base.root, 0);
		}
	}

	setTier(tier: Tier, instant = false) {
		const changed = tier !== this.tier;
		this.tier = tier;
		if (!this.ctx || (!changed && !instant)) return;
		const now = performance.now();
		// Fade out whatever is up, fade the new world in over it (App's 700ms fade).
		for (const b of this.bonus) if (b.to !== 0) Object.assign(b, { from: this.fadeOf(b, now), to: 0, start: now });
		if (tier && !this.bonus.some((b) => b.tier === tier && b.to === 1)) {
			const world =
				tier === 'normal'
					? new NormalWorld(this.ctx)
					: tier === 'hidden'
						? new HiddenWorld(this.ctx)
						: new SuperWorld(this.ctx);
			world.view(this.shown.portrait, this.shown.slice);
			world.root.alpha = instant ? 1 : 0;
			this.scene.addChild(world.root);
			this.bonus.push({ world, tier, from: instant ? 1 : 0, to: 1, start: now });
		}
	}
	private fadeOf(b: { from: number; to: number; start: number }, now: number) {
		return b.from + (b.to - b.from) * Math.min(1, (now - b.start) / FADE_MS);
	}

	private frame() {
		const now = this.frozen ?? performance.now();
		// The base world is hidden under an opaque bonus world: skip drawing and animating it.
		if (this.base) {
			this.base.root.visible = !this.bonus.some((b) => b.to === 1 && this.fadeOf(b, now) >= 1);
			if (this.base.root.visible) this.base.tick(now);
		}
		this.bonus = this.bonus.filter((b) => {
			const a = this.fadeOf(b, now);
			b.world.root.alpha = a;
			if (b.to === 0 && a <= 0) {
				b.world.destroy();
				return false;
			}
			b.world.tick(now);
			return true;
		});
	}

	destroy() {
		this.destroyed = true;
		this.unwatchMotion?.();
		this.base?.destroy();
		for (const b of this.bonus) b.world.destroy();
		this.pixi.destroy();
		for (const t of [...this.extra, ...this.dropTex.values()]) t.destroy(true);
	}
}


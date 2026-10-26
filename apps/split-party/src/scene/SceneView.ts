// The game's backdrops drawn in Pixi: the base world (BaseScene.svelte) and the three bonus
// worlds (BonusNormal.svelte, BonusSuper.svelte, its night variant), with their jelly domes
// (JellyDome.svelte), drifting clouds (SkyClouds.svelte), water light, flying islands and the
// blobs that peek out of the scenery. Same layouts, timings and keyframes as those components;
// one canvas for all of them, the bonus world cross-fading over the base like App's fade.
import { Assets, Container, Sprite, Texture } from 'pixi.js';
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

type Ctx = { tex: (src: string) => Texture; soft: Texture; ring: Texture; birds: Texture[]; drop: (c: string) => Texture; blob: { tex: (src: string) => Texture; blush: Texture }; reduced: boolean };
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
		if (next === 'blow') (this.spray(now, false), (this.next = now + 950));
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

// Glints on the seascape's water band.
const GLINTS = Array.from({ length: 16 }, (_, i) => {
	const h = Math.imul(i + 1, 2654435761) >>> 0;
	const x = 8 + ((h % 1000) / 1000) * 80;
	const y = (x > 56 ? 85 : 80) + (((h >>> 10) % 100) / 100) * (x > 56 ? 6 : 11);
	return { x, y, w: 3 + ((h >>> 17) % 5), dur: 3.2 + ((h >>> 5) % 9) * 0.25, delay: -(((h >>> 13) % 40) / 10) };
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
// Portrait: three domes standing whole in the strip of grass under the bottom row. A row
// higher only peeked out between the HUD's boxes, and the screen's edge cut a lower one.
const PHONE_DOMES = [
	['magenta', 0.11, 0.985, 66],
	['purple', 0.5, 0.99, 60],
	['green', 0.89, 0.985, 66],
] as const;
const DOME_COLOR = { magenta: '#ea32df', green: '#5bed7c', purple: '#b241fb' };
const GRASS_Y = 505;
const BASE_PEEK_MS = 4200;

class BaseWorld extends World {
	private glints: { s: Sprite; x: number; sx: number; dur: number; delay: number }[] = [];
	private peekLayers: { layer: Container; w: number; h: number }[] = [];
	private peeks: LivePeek[] = [];
	private peekId = 0;
	constructor(ctx: Ctx, portrait: boolean, slice: { w: number; h: number }) {
		super(ctx);
		this.sprite('./base/crisp/hills.webp', -2, -3, 1204, 674);
		const dome = ([c, x, y, s]: readonly [keyof typeof DOME_COLOR, number, number, number], fast: boolean) =>
			new Dome(ctx, this.root, {
				src: `./base/crisp/dome-${c}${s < 120 ? '-small' : ''}.webp`,
				color: DOME_COLOR[c],
				x: x + 0.06 * s,
				y: y + 0.3 * s,
				w: 0.88 * s,
				h: 0.4 * s,
				ox: 0.44 * s,
				oy: 0.4 * s * 0.955,
				first: fast ? [1500, 9000] : [4000, 25000],
				rest: [2500, 6000],
				wait: fast ? [6000, 18000] : [20000, 50000],
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
		for (const s of [
			{ x: 496, y: 183, w: 772, h: 309, flip: false },
			{ x: -187, y: 178, w: 795.2, h: 318, flip: true },
		]) {
			const box = new Container();
			box.position.set(s.flip ? s.x + s.w : s.x, s.y);
			if (s.flip) box.scale.x = -1;
			this.root.addChild(box);
			this.sprite('./base/crisp/seascape.webp', 0, 0, s.w, s.h, false, box);
			const peeks = new Container();
			box.addChild(peeks);
			this.peekLayers.push({ layer: peeks, w: s.w, h: s.h });
			this.sprite('./base/crisp/seascape-front.webp', s.w / 2, 0, s.w / 2, s.h, false, box);
			for (const g of GLINTS) {
				const sp = new Sprite(ctx.soft);
				sp.anchor.set(0.5);
				const w = (g.w / 100) * s.w;
				sp.width = w;
				sp.height = 5;
				const x = (g.x / 100) * s.w + w / 2;
				sp.position.set(x, (g.y / 100) * s.h + 2.5);
				sp.alpha = 0;
				box.addChild(sp);
				this.glints.push({ s: sp, x, sx: sp.scale.x, dur: g.dur * 1000, delay: g.delay * 1000 });
			}
		}
		this.later(rand(4000, 12000), () => this.peek());
	}
	// Now and then a blob peeks out of an island (BaseScene.svelte's spots).
	private peek() {
		// Reduced motion, or hidden under a bonus world: nobody peeks, but the schedule runs on
		// (so turning reduced motion off mid-game brings the peekers back).
		if (this.ctx.reduced || !this.root.visible) return this.later(rand(3000, 8000), () => this.peek());
		const island = Math.random() < 0.5 ? 'left' : 'right';
		// The right island's bush row: head and eyes up over its tall left bush or its middle.
		// (Sliding out sideways left the blob in the open at the screen's edge, or poking out
		// above the row's short end bush.)
		const bushLeft = { x: 76.6, top: 46.9, dx: 0, px: 0, py: -61, lean: -6 };
		const bushTop = { x: 80.5, top: 46.9, dx: 0, px: 0, py: -61, lean: 6 };
		// The left island (the mirrored seascape, so its % run right to left on screen): up over
		// the green hill's ridge, head and eyes only, the right island's size. (Its slope is a
		// soft diagonal: a blob there looked stuck in the hill, not behind it.)
		const crest = { x: 67.1, top: 57, dx: 0, px: 0, py: -63, lean: -8 };
		const spots =
			island === 'right'
				? Math.random() < 0.35
					? [bushLeft, bushTop]
					: [Math.random() < 0.5 ? bushLeft : bushTop]
				: [crest];
		const { layer, w, h } = this.peekLayers[island === 'left' ? 1 : 0];
		const now = performance.now();
		spots.forEach((s, i) => {
			const size = 0.032 * w;
			const pb = new PeekBlob(this.ctx, pick(PEEKERS), `peek-${this.peekId++}`, size);
			layer.addChild(pb.root);
			const p: LivePeek = {
				pb,
				// left/top place the box; the origin is 50% 90% of it.
				x: (s.x / 100) * w + size * 0.5,
				y: (s.top / 100) * h + size * 0.9,
				frames: islandPeek(s.dx, s.px, s.py, s.lean),
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

// Normal bonus (BonusNormal.svelte).
const NA = './bonus/normal/crisp';
const N_CLOUD: Look = { src: `${NA}/cloud-puff.webp`, w: [160, 190], alpha: [0.8, 0.8] };
const N_FAR: Look = { src: `${NA}/cloud-puff.webp`, w: [110, 135], alpha: [0.65, 0.8] };
const N_LANES: Lane[] = [
	{ far: false, y: [24, 40] },
	{ far: true, y: [96, 112] },
];
const CLIFFS = [
	[877, 181, 356, 364, false, false],
	[-50, 128, 408, 417, true, false],
	[-60, 390, 207, 212, true, true],
] as const;
const N_FOOT = { blue: 0.914, green: 0.952, magenta: 0.951 };
const N_COLOR = { blue: '#3f7bff', green: '#5bed7c', magenta: '#ea32df' };
const N_DOMES = [
	['blue', 994, 380, 290],
	['green', 1007, 484, 315],
	['green', 845, 433, 149],
	['blue', 904, 496, 146],
	['blue', 42, 363, 290],
	['blue', 291, 441, 133],
	['magenta', -152, 337, 510],
] as const;
const N_SPOTS = [
	{ x: 1073, edge: 206, lean: -8 },
	{ x: 1133, edge: 203, lean: -6 },
	{ x: 1027, edge: 217, lean: -10 },
	{ x: 134, edge: 156, lean: 8 },
	{ x: 66, edge: 153, lean: 6 },
];
// Half the frame's size, standing on the same spot (the foot's centre stays put).
function halfDome<C extends string>(c: C, fx: number, fy: number, fs: number, foot: number) {
	const s = fs * 0.5;
	const x = fx + fs / 2 - s / 2;
	const y = fy + fs * (0.3 + 0.4 * foot) - s * (0.3 + 0.4 * foot);
	return { x: x + 0.06 * s, y: y + 0.3 * s, w: 0.88 * s, h: 0.4 * s, oy: 0.4 * s * foot, ox: 0.44 * s };
}
class NormalWorld extends World {
	private peekLayer = new Container();
	private peeks: (LivePeek & { spot: number })[] = [];
	private peekId = 0;
	constructor(ctx: Ctx) {
		super(ctx);
		this.sprite(`${NA}/sunset.webp`, -60, -30, 1260, 730);
		this.parts.push(new Clouds(ctx, this.root, N_LANES, SKY.w, N_CLOUD, N_FAR));
		this.parts.push(new Birds(ctx, this.root, [60, 170]));
		this.root.addChild(this.peekLayer);
		for (const [x, y, w, h, flip, small] of CLIFFS) this.sprite(`${NA}/cliff${small ? '-small' : ''}.webp`, x, y, w, h, flip);
		for (const [c, fx, fy, fs] of N_DOMES) {
			const g = halfDome(c, fx, fy, fs, N_FOOT[c]);
			this.parts.push(
				new Dome(ctx, this.root, {
					src: `${NA}/dome-${c}${fs < 200 ? '-small' : ''}.webp`,
					color: N_COLOR[c],
					...g,
					shown: true,
					first: [2500, 16000],
					rest: [3000, 7000],
					wait: [9000, 26000],
				}),
			);
		}
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
			this.peekLayer.addChild(pb.root);
			this.peeks.push({ pb, spot: i, x: s.x, y: s.edge + 4 + 45, frames: cliffPeek(s.lean), start: now, ms: 4000, end: now + 4300 });
		}
		this.later(rand(5000, 14000), () => this.peek());
	}
	tick(now: number) {
		super.tick(now);
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

// Super bonus (BonusSuper.svelte), and its night variant for the Hidden tier.
const SA = './bonus/super/crisp';
const S_NEAR: Look = { src: `${NA}/cloud-puff.webp`, w: [150, 185], alpha: [0.85, 0.85] };
const S_FAR: Look = { src: `${NA}/cloud-puff.webp`, w: [100, 125], alpha: [0.65, 0.75] };
const S_LANES: Lane[] = [
	{ far: true, y: [14, 26] },
	{ far: false, y: [98, 112] },
	{ far: true, y: [188, 200] },
];
const ISLANDS = [
	[154, 43, 142, 0],
	[993, 103, 142, -5.5],
] as const;
const WATER = [
	[489, 469, 675, 289, false, 0],
	[124, 523, 343, 147, true, -4],
] as const;
const S_FOOT = { blue: 0.914, purple: 0.953, magenta: 0.951 };
const S_COLOR = { blue: '#3f7bff', purple: '#9b3dfb', magenta: '#ea32df' };
const S_DOMES = [
	['purple', -84, 252, 318],
	['magenta', 278, 366, 172],
	['blue', -178, 315, 563],
	['blue', 827, 195, 563],
] as const;
const STARS = Array.from({ length: 38 }, (_, i) => {
	const h = Math.imul(i + 7, 2246822519) >>> 0;
	return [(h % 1000) * 1.2, ((h >>> 10) % 1000) * 0.3, 1.5 + ((h >>> 20) % 4) * 0.8, 2 + ((h >>> 5) % 30) / 10, -(((h >>> 15) % 40) / 10)] as const;
});
const RIPPLES = Array.from({ length: 46 }, (_, i) => {
	const h = Math.imul(i + 1, 2654435761) >>> 0;
	const d = (((h >>> 10) % 1000) / 1000) ** 0.8;
	return {
		x: -20 + ((h % 1000) / 1000) * 1200,
		y: 452 + d * 214,
		w: 14 + d * 70 + ((h >>> 17) % 20),
		hgt: 1.5 + d * 3,
		drift: 8 + d * 34,
		alpha: 0.35 + d * 0.5,
		dur: 3 + d * 3 + ((h >>> 5) % 9) * 0.25,
		delay: -(((h >>> 13) % 60) / 10),
	};
});
// One soft band of the swell: [period, clear up to, peak at, peak alpha].
const BANDS = [
	[22, 8, 14, 0x30 / 255, 3400],
	[31, 12, 20, 0x22 / 255, 6100],
] as const;
class SuperWorld extends World {
	private islands: { box: Container; img: Sprite; x: number; t: number }[] = [];
	private water: { s: Sprite; x: number; t: number; sx: number; sy: number }[] = [];
	private ripples: { s: Sprite; x: number; r: (typeof RIPPLES)[number]; sx: number }[] = [];
	private bands: { s: Sprite; set: number; k: number }[] = [];
	private stars: { s: Sprite; dur: number; delay: number; base: number }[] = [];
	constructor(ctx: Ctx, night: boolean, bandTex: Texture[], night$: { overlay: Texture; moon: Texture; star: Texture }) {
		super(ctx);
		this.sprite(`${SA}/arches.webp`, 0, 0, 1202, 676);
		const dome = ([c, fx, fy, fs]: (typeof S_DOMES)[number]) =>
			new Dome(ctx, this.root, {
				src: `${SA}/dome-${c}.webp`,
				color: S_COLOR[c],
				...halfDome(c, fx, fy, fs, S_FOOT[c]),
				shown: true,
				first: [2000, 12000],
				rest: [3000, 7000],
				wait: [1500, 5000],
			});
		for (const d of S_DOMES.slice(0, 2)) this.parts.push(dome(d));
		for (const [x, y, s, t] of ISLANDS) {
			const box = new Container();
			box.position.set(x, y);
			const img = new Sprite(ctx.tex(`${SA}/island.webp`));
			img.anchor.set(0.5);
			img.width = img.height = s;
			img.position.set(s / 2, s / 2);
			box.addChild(img);
			this.root.addChild(box);
			this.islands.push({ box, img, x, t: t * 1000 });
		}
		for (const [x, y, w, h, small, t] of WATER) {
			const s = new Sprite(ctx.tex(`${SA}/water${small ? '-small' : ''}.webp`));
			s.anchor.set(0.5);
			s.width = w;
			s.height = h;
			s.position.set(x + w / 2, y + h / 2);
			this.root.addChild(s);
			this.water.push({ s, x: x + w / 2, t: t * 1000, sx: s.scale.x, sy: s.scale.y });
		}
		// The swell: soft bands rolling toward the viewer, faded in under the horizon.
		const swell = new Container();
		swell.position.set(0, 448);
		swell.alpha = 0.45;
		this.root.addChild(swell);
		BANDS.forEach(([period], set) => {
			for (let k = 0; k <= Math.ceil(228 / period) + 1; k++) {
				const s = new Sprite(bandTex[set]);
				s.width = 1200;
				s.height = period;
				swell.addChild(s);
				this.bands.push({ s, set, k });
			}
		});
		for (const r of RIPPLES) {
			const s = new Sprite(ctx.soft);
			s.anchor.set(0.5);
			s.width = r.w;
			s.height = r.hgt;
			s.position.set(r.x + r.w / 2, r.y + r.hgt / 2);
			s.alpha = 0;
			this.root.addChild(s);
			this.ripples.push({ s, x: r.x + r.w / 2, r, sx: s.scale.x });
		}
		for (const d of S_DOMES.slice(2)) this.parts.push(dome(d));
		if (night) {
			const o = new Sprite(night$.overlay);
			o.width = SKY.w;
			o.height = SKY.h;
			this.root.addChild(o);
			const moon = new Sprite(night$.moon);
			moon.anchor.set(0.5);
			moon.scale.set(1 / TEX_RES);
			moon.position.set(560 + 37, 52 + 37);
			this.root.addChild(moon);
			for (const [x, y, size, dur, phase] of STARS) {
				const s = new Sprite(night$.star);
				s.anchor.set(0.5);
				const base = size / 4 / TEX_RES;
				s.scale.set(base);
				s.position.set(x + size / 2, y + size / 2);
				this.root.addChild(s);
				this.stars.push({ s, dur: dur * 1000, delay: phase * 1000, base });
			}
		}
		this.parts.push(new Clouds(ctx, this.root, S_LANES, SKY.w, S_NEAR, S_FAR));
		// Birds by day only: the Hidden tier's night sky has its stars.
		if (!night) this.parts.push(new Birds(ctx, this.root, [50, 180]));
	}
	tick(now: number) {
		super.tick(now);
		const R = this.ctx.reduced;
		for (const i of this.islands) {
			const sway = R ? 0.5 : EASE_IN_OUT(1 - Math.abs(1 - 2 * cycle(now, 17000, i.t)));
			i.box.x = i.x - 16 + 32 * sway;
			const bob = R ? 0 : EASE_IN_OUT(1 - Math.abs(1 - 2 * cycle(now, 6500, i.t)));
			i.img.y = i.img.height / 2 - 11 * bob;
			i.img.rotation = (-2 + 4.5 * bob) * DEG;
		}
		for (const w of this.water) {
			const k = R ? 0.5 : EASE_IN_OUT(1 - Math.abs(1 - 2 * cycle(now, 7000, w.t)));
			w.s.alpha = 0.75 + 0.25 * k;
			w.s.x = w.x - 26 + 52 * k;
			w.s.scale.set(w.sx * (0.94 + 0.14 * k), w.sy * (1.03 - 0.11 * k));
		}
		for (const b of this.bands) {
			const [period, , peak, , ms] = BANDS[b.set];
			const off = R ? 0 : cycle(now, ms, 0) * period;
			const y = -period + b.k * period + off;
			b.s.y = y;
			// mask: linear-gradient(#0000, #000 35%) over the 228px swell.
			b.s.alpha = Math.max(0, Math.min(1, (y + peak) / (0.35 * 228)));
		}
		for (const r of this.ripples) {
			if (R) {
				r.s.alpha = 0.3;
				continue;
			}
			const v = keyframes(
				[
					[0, { a: 0, tx: -r.r.drift, sx: 0.35 }],
					[0.4, { a: r.r.alpha, tx: 0, sx: 1 }],
					[0.65, { a: r.r.alpha * 0.6, tx: r.r.drift * 0.6, sx: 0.85 }],
					[1, { a: 0, tx: -r.r.drift, sx: 0.35 }],
				],
				cycle(now, r.r.dur * 1000, r.r.delay * 1000),
				EASE_IN_OUT,
			);
			r.s.alpha = v.a;
			r.s.x = r.x + v.tx;
			r.s.scale.x = r.sx * v.sx;
		}
		for (const s of this.stars) {
			const k = R ? 1 : alternate(now, s.dur, s.delay, EASE_IN_OUT);
			s.s.alpha = 0.25 + 0.75 * k;
			s.s.scale.set(s.base * (0.6 + 0.5 * k));
		}
	}
}

// ---- Scene ------------------------------------------------------------------------------------

const BASE_SRCS = ['./base/crisp/hills.webp', './base/crisp/seascape.webp', './base/crisp/seascape-front.webp', NEAR_LOOK.src, FAR_LOOK.src].concat(
	...(['green', 'magenta', 'purple'] as const).map((c) => [`./base/crisp/dome-${c}.webp`, `./base/crisp/dome-${c}-small.webp`]),
);
const BONUS_SRCS = [
	`${NA}/sunset.webp`,
	`${NA}/cloud-puff.webp`,
	`${NA}/cliff.webp`,
	`${NA}/cliff-small.webp`,
	`${NA}/dome-blue.webp`,
	`${NA}/dome-blue-small.webp`,
	`${NA}/dome-green.webp`,
	`${NA}/dome-green-small.webp`,
	`${NA}/dome-magenta.webp`,
	`${SA}/arches.webp`,
	`${SA}/island.webp`,
	`${SA}/water.webp`,
	`${SA}/water-small.webp`,
	`${SA}/dome-blue.webp`,
	`${SA}/dome-magenta.webp`,
	`${SA}/dome-purple.webp`,
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
	private bandTex: Texture[] = [];
	private nightTex!: { overlay: Texture; moon: Texture; star: Texture };
	private dropTex = new Map<string, Texture>();
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
			// The art is soft (blur baked into every layer), so past 1.5× more pixels only cost.
			resolution: Math.min(1.5, devicePixelRatio || 1),
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
		this.bandTex = BANDS.map(([period, clear, peak, alpha]) =>
			canvasTexture(4, period, (ctx) => {
				const g = ctx.createLinearGradient(0, 0, 0, period);
				g.addColorStop(0, 'rgba(255,255,255,0)');
				g.addColorStop(clear / period, 'rgba(255,255,255,0)');
				g.addColorStop(peak / period, `rgba(255,255,255,${alpha})`);
				g.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, 4, period);
			}),
		);
		this.nightTex = {
			overlay: canvasTexture(4, 128, (ctx) => {
				const g = ctx.createLinearGradient(0, 0, 0, 128);
				g.addColorStop(0, 'rgba(11,6,48,.9)');
				g.addColorStop(0.55, 'rgba(27,15,85,.7)');
				g.addColorStop(1, 'rgba(18,10,60,.8)');
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, 4, 128);
			}),
			moon: canvasTexture(74 + 120, 74 + 120, (ctx) => {
				ctx.translate(60, 60);
				ctx.save();
				ctx.shadowColor = 'rgba(255,244,196,.33)';
				ctx.shadowBlur = 40 * TEX_RES;
				// The halo shape sits off-canvas and only its glow lands here. The path takes the
				// transform when it is built, so translate before arc().
				ctx.shadowOffsetX = 4000 * TEX_RES;
				ctx.translate(-4000, 0);
				ctx.beginPath();
				ctx.arc(37, 37, 37 + 14, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
				const g = ctx.createRadialGradient(74 * 0.38, 74 * 0.36, 0, 74 * 0.38, 74 * 0.36, Math.hypot(0.62, 0.64) * 74);
				g.addColorStop(0, '#fffbe8');
				g.addColorStop(0.6, '#f3e7b8');
				g.addColorStop(1, '#d9c98f');
				ctx.beginPath();
				ctx.arc(37, 37, 37, 0, Math.PI * 2);
				ctx.fillStyle = g;
				ctx.fill();
			}),
			// A 4px star with its 6px glow (box-shadow 0 0 6px 1px #ffffffaa).
			star: canvasTexture(20, 20, (ctx) => {
				ctx.shadowColor = 'rgba(255,255,255,.67)';
				ctx.shadowBlur = 6 * TEX_RES;
				ctx.beginPath();
				ctx.arc(10, 10, 2, 0, Math.PI * 2);
				ctx.fillStyle = '#fff';
				ctx.fill();
				ctx.shadowBlur = 0;
				ctx.fill();
			}),
		};
		this.extra = [blush, soft, ring, ...birds, ...this.bandTex, ...Object.values(this.nightTex)];
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
				tier === 'normal' ? new NormalWorld(this.ctx) : new SuperWorld(this.ctx, tier === 'hidden', this.bandTex, this.nightTex);
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


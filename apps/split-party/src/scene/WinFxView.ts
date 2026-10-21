// The big-win screen's live slime and jelly bubbles (WinScreen.svelte), drawn in code, no art:
// - drips hang from the plaque's slime: each creeps down from the slime's bottom edge, swells a
//   drop at its tip, necks, lets the drop go (it falls away under gravity) and springs back up;
// - jelly bubbles burst out of the slime like a coin shower: a fountain as the plaque lands,
//   then a steady stream, each tumbling along its arc, wobbling, and popping in mid-air into a
//   soft flash and droplets (or falling off the bottom).
// Everything is in the screen's 1200×670 design space (the canvas fills WinScreen's .frame).
// One Application (one WebGL context) serves every big win: a screen borrows it, moves its
// canvas into its own host and hands it back clean, since creating a context per win cost a
// ~70ms long task right as the win landed.
import { Container, FillGradient, Graphics, Sprite, Texture } from 'pixi.js';
import { PixiApp, DISPOSE, watchReducedMotion } from '../board/pixiApp';

export type WinFxOptions = {
	/** Where drips hang from: points on the slime's bottom edge (design px), where its dark
	    outline starts, and the edge's slope there (radians, + = falling to the right). */
	anchors: { x: number; y: number; angle: number }[];
	/** The slime's dark outline: its thickness where the drips leave it (design px). */
	outline: number;
	/** Plaque box [cx, cy, w, h]: bubbles spout from its upper slime, sizes scale with it. */
	plaque: [number, number, number, number];
	/** Bubbles in the opening fountain, and per second after it. */
	burst: number;
	rate: number;
	/** WinScreen's `speed` (turbo): the landing beats come sooner. */
	speed: number;
};

const W = 1200;
const H = 670;
const G = 1500; // px/s², bubbles and drops
const INK = '#1a0368'; // the plaque's outline
const MAX_BUBBLES = 140;
const TEX_RES = 3;
// A bubble's radius in design px, whatever the plaque: MAX's big plaque made 115px balls that
// covered the logo and the board.
const MAX_R = 26;
const MAX_RESOLUTION = 2;

// The shared app, the screen drawing on it and that screen's frame.
let shared: { pixi: PixiApp; ready: Promise<boolean> } | null = null;
let owner: WinFxView | null = null;
let tick: (() => void) | null = null;

function sharedPixi(resolution: number) {
	if (shared) return shared;
	const pixi = new PixiApp();
	const s = {
		pixi,
		ready: pixi
			.init({ width: W, height: H, antialias: true, resolution })
			.then((ok) => {
				if (!ok) return false;
				// Idle until a screen takes it; one ticker callback runs whichever screen owns it.
				pixi.app.ticker.stop();
				pixi.run(() => tick?.());
				return true;
			})
			.catch((e) => {
				if (shared === s) shared = null;
				throw e;
			}),
	};
	// The app can't go on (a throw in a frame, a lost context): drop it, the next win makes a
	// new one, and the screen on it plays without its fx.
	pixi.onfail = (e) => {
		const o = owner;
		dropShared();
		o?.onfail?.(e);
	};
	shared = s;
	return s;
}

function dropShared() {
	owner?.release();
	shared?.pixi.destroy();
	shared = null;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = Math.ceil(w * TEX_RES);
	c.height = Math.ceil(h * TEX_RES);
	const ctx = c.getContext('2d')!;
	ctx.scale(TEX_RES, TEX_RES);
	draw(ctx);
	return Texture.from(c);
}
// A glossy jelly ball in the plaque's cartoon style: dark outline, a body lit from the top left,
// a rim light along the bottom, a big soft highlight and a sharp glint. 64px across.
function bubbleTexture(light: string, mid: string, deep: string) {
	const r = 30;
	return canvasTexture(2 * r + 4, 2 * r + 4, (ctx) => {
		ctx.translate(r + 2, r + 2);
		const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
		body.addColorStop(0, light);
		body.addColorStop(0.55, mid);
		body.addColorStop(1, deep);
		ctx.beginPath();
		ctx.arc(0, 0, r - 1.5, 0, Math.PI * 2);
		ctx.fillStyle = body;
		ctx.fill();
		ctx.lineWidth = 3;
		ctx.strokeStyle = INK;
		ctx.stroke();
		// Rim light along the bottom.
		ctx.beginPath();
		ctx.arc(0, 0, r - 6, Math.PI * 0.15, Math.PI * 0.85);
		ctx.lineWidth = 2.6;
		ctx.lineCap = 'round';
		ctx.strokeStyle = 'rgba(255,255,255,.35)';
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(-r * 0.3, -r * 0.42, r * 0.36, r * 0.2, -0.5, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,.75)';
		ctx.fill();
		ctx.beginPath();
		ctx.arc(r * 0.38, r * 0.3, r * 0.08, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,.85)';
		ctx.fill();
	});
}

type Bubble = {
	s: Sprite;
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	spin: number;
	born: number;
	popAt: number;
	wob: number;
	tint: number;
};
type Bit = { g: Graphics; x: number; y: number; vx: number; vy: number; born: number; life: number; ring: boolean; r: number; color: string };
type Drip = {
	x: number;
	y: number;
	angle: number;
	/** Scale: the plaque's width over 600. */
	k: number;
	period: number;
	offset: number;
	reach: number;
	sway: number;
	dropped: number;
};
type Drop = { x: number; y: number; vy: number; r: number };

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class WinFxView {
	private app: PixiApp['app'] | null = null;
	private dead = false;
	/** Canvas reaching past the stage's top and bottom (design px), for tall screens. */
	private pad = 0;
	private root = new Container();
	private slime = new Graphics();
	private bubbleLayer = new Container();
	private bitLayer = new Container();
	private textures: Texture[] = [];
	private bubbles: Bubble[] = [];
	private bits: Bit[] = [];
	private drips: Drip[] = [];
	private drops: Drop[] = [];
	private t0 = performance.now();
	private last = 0;
	private emitted = 0;
	private reduced = false;
	private unwatch: (() => void) | null = null;
	private opts: WinFxOptions;
	private bodyFill: FillGradient;
	onfail: ((e: unknown) => void) | null = null;

	constructor(opts: WinFxOptions) {
		this.opts = opts;
		const k = opts.plaque[2] / 600;
		this.drips = opts.anchors.map((a, i) => ({
			x: a.x,
			y: a.y,
			angle: a.angle,
			k,
			period: 2200 + Math.random() * 1200,
			// Staggered, so they don't all let go together.
			offset: i * 450 + Math.random() * 400,
			reach: (95 + Math.random() * 45) * k,
			sway: Math.random() * Math.PI * 2,
			dropped: -1,
		}));
		// Slime from the plaque: the rim colour at the root, deepening, lit again at the tip.
		this.bodyFill = new FillGradient({
			type: 'linear',
			start: { x: 0, y: 0 },
			end: { x: 0, y: 1 },
			colorStops: [
				{ offset: 0, color: '#b233fd' },
				{ offset: 0.55, color: '#8a37ef' },
				{ offset: 1, color: '#b04cfc' },
			],
			textureSpace: 'local',
		});
	}

	/** `pad`: how far past the stage's top and bottom the screen shows (a tall screen), so the
	    bubbles and drops aren't cut off at the stage's edges there. */
	async init(host: HTMLElement, resolution: number, pad = 0) {
		this.unwatch = watchReducedMotion((r) => (this.reduced = r));
		resolution = Math.min(MAX_RESOLUTION, resolution);
		const s = sharedPixi(resolution);
		if (!(await s.ready) || this.dead || shared !== s) return;
		// A screen still on it (a win replacing a win) hands it over.
		owner?.release();
		owner = this;
		const app = (this.app = s.pixi.app);
		this.pad = pad = Math.round(pad);
		if (app.renderer.resolution !== resolution || app.screen.height !== H + 2 * pad) app.renderer.resize(W, H + 2 * pad, resolution);
		this.root.y = pad;
		this.textures = [
			// The design's purple bubbles on every tier, in two shades.
			bubbleTexture('#e4b8ff', '#9b4dff', '#5a1fc2'),
			bubbleTexture('#f0dcff', '#b47dff', '#6b2fd1'),
		];
		const gl = app.renderer.texture as unknown as { initSource?: (s: unknown) => void };
		for (const t of this.textures) gl.initSource?.(t.source);
		// Drips under the bubbles, and the pop bits over everything.
		this.root.addChild(this.slime, this.bubbleLayer, this.bitLayer);
		app.stage.addChild(this.root);
		app.canvas.style.display = 'block';
		app.canvas.style.marginTop = `${-pad}px`;
		host.appendChild(app.canvas);
		this.t0 = this.last = performance.now();
		tick = () => this.frame();
		app.ticker.start();
	}

	private frame() {
		const now = performance.now();
		const dt = Math.min(0.05, (now - this.last) / 1000);
		this.last = now;
		const t = now - this.t0;
		this.tickSlime(t, dt);
		if (!this.reduced) this.tickBubbles(t, dt);
		this.tickBits(t, dt);
	}

	// ---- Slime drips --------------------------------------------------------------------------

	private tickSlime(t: number, dt: number) {
		const g = this.slime.clear();
		// The drips ooze out once the plaque has landed (WinScreen's ws-plaque, 100-800ms).
		const start = 750 * this.opts.speed;
		const grow = Math.min(1, Math.max(0, (t - start) / 450));
		if (grow <= 0) return;
		for (const d of this.drips) {
			const k = d.k;
			const rest = 28 * k;
			let len: number;
			let bulb: number;
			let neck: number;
			if (this.reduced) {
				len = rest * 1.6;
				bulb = 12 * k;
				neck = 8 * k;
			} else {
				const local = Math.max(0, t - start - d.offset);
				const cycle = Math.floor(local / d.period);
				const p = (local % d.period) / d.period;
				if (p < 0.62) {
					// Creeping down, slowly then quicker as the weight gathers.
					const u = ease(p / 0.62) ** 1.25;
					len = lerp(rest, d.reach, u);
					bulb = lerp(10, 17, u) * k;
					neck = lerp(9, 5.5, u) * k;
				} else if (p < 0.7) {
					// The neck pinches thin while the drop pulls a little further.
					const u = (p - 0.62) / 0.08;
					len = d.reach * (1 + 0.1 * u);
					bulb = 17 * k;
					neck = lerp(5.5, 1, u) * k;
				} else {
					// Let go: the drop falls, the strand springs back up and wobbles still.
					if (d.dropped !== cycle) {
						d.dropped = cycle;
						this.drops.push({ x: d.x + this.swayAt(d, t), y: d.y + d.reach * 1.1, vy: 160, r: 16 * k });
					}
					const u = (p - 0.7) / 0.3;
					const spring = Math.exp(-5 * u) * Math.cos(11 * u);
					len = rest + (d.reach * 0.5 - rest) * spring;
					bulb = lerp(7, 10, Math.min(1, u * 2)) * k;
					neck = lerp(4, 9, Math.min(1, u * 2)) * k;
				}
			}
			len *= grow;
			bulb *= 0.4 + 0.6 * grow;
			this.drawDrip(g, d, len, bulb, neck, this.reduced ? 0 : this.swayAt(d, t));
		}
		// Falling drops: stretched by their speed, gone off the bottom.
		for (const drop of this.drops) {
			drop.vy += G * dt;
			drop.y += drop.vy * dt;
			const stretch = 1 + Math.min(0.7, drop.vy / 1400);
			const rx = drop.r / Math.sqrt(stretch);
			const ry = drop.r * stretch;
			g.ellipse(drop.x, drop.y, rx, ry).fill(this.bodyFill).stroke({ width: 2.4 * (drop.r / 12), color: INK });
			g.ellipse(drop.x - rx * 0.35, drop.y - ry * 0.35, rx * 0.3, ry * 0.22).fill({ color: '#f1dcff', alpha: 0.85 });
		}
		this.drops = this.drops.filter((d) => d.y - d.r < H + this.pad + 40);
	}

	private swayAt(d: Drip, t: number) {
		return 2.2 * d.k * Math.sin(t / 620 + d.sway);
	}

	/**
	 * One drip, poured out of the slime. Two filled shapes, no strokes (a stroke's ends showed
	 * as ticks against the slime's thick outline):
	 * - the ink: peels off the slime's outline band at the band's own thickness (its top runs
	 *   just inside the band, its shoulders hug the band's underside, then bend down), and thins
	 *   to the strand's line weight on the way down and round the bulb;
	 * - the slime body on top: breaks up through the band into the slime in a low arch (the
	 *   art's rim colour there), so the outline opens where the slime pours out.
	 * The mouth and shoulders lie along the slime's edge at its slope; the strand hangs plumb.
	 */
	private drawDrip(g: Graphics, d: Drip, len: number, bulb: number, neck: number, sway: number) {
		const { x, y, k } = d;
		const T = this.opts.outline;
		const t = 2.6 * k;
		const root = 15 * k;
		const cos = Math.cos(d.angle);
		const sin = Math.sin(d.angle);
		// A point off the anchor along the edge (dx) and across it (dy, + = down).
		const at = (dx: number, dy: number): [number, number] => [x + dx * cos - dy * sin, y + dx * sin + dy * cos];
		// The body flares out of a wide mouth into a thinner strand; the ink's shoulders reach
		// only a little past it (a long straight run would show against the art's curve).
		const mouth = root * 0.8;
		const fillet = T * 0.9;
		const top = root * 0.42; // the strand's half-width just under the slime
		const yS = y + T + root * 0.35; // where the strand starts
		const by = Math.max(y + len, yS + bulb * 0.8); // bulb centre
		const bx = x + sway;
		const nx = x + sway * 0.6;
		const sy = yS + Math.max(2 * k, (by - bulb - yS) * 0.35);
		const ny = Math.max(sy + 1, by - bulb * 1.05);
		const path = (ink: boolean) => {
			const e = ink ? 1 : 0;
			// Ink thins from the band's weight under the slime to the strand's line weight.
			const tr = ink ? T * 0.85 : 0;
			const tn = e * t;
			const side = (s: -1 | 1, first: boolean) => {
				const m = mouth + e * fillet;
				// The ink's top runs mid-band (always over the art's own ink); the body's just
				// above the band, into the slime.
				const lip = ink ? T * 0.5 : -0.6;
				const A = at(s * m, lip);
				const c1 = at(s * (m - e * fillet * 0.6), ink ? T * 1.05 : T * 0.9);
				const B: [number, number] = [x + s * (top + tr), yS];
				const pts: [number, number][] = [
					A,
					c1,
					[x + s * (top + tr), yS - root * 0.15],
					B,
					[x + s * (top + tr), yS + (sy - yS) * 0.5],
					[nx + s * (neck + tn), sy - (sy - yS) * 0.3],
					[nx + s * (neck + tn), sy],
					[nx + s * (neck + tn), ny],
					[bx + s * (bulb + tn) * 1.05, ny + bulb * 0.2],
					[bx + s * (bulb + tn), by],
				];
				return first ? pts : pts.reverse();
			};
			const L = side(-1, true);
			g.moveTo(...L[0]);
			g.bezierCurveTo(...L[1], ...L[2], ...L[3]);
			g.bezierCurveTo(...L[4], ...L[5], ...L[6]);
			g.bezierCurveTo(...L[7], ...L[8], ...L[9]);
			g.arc(bx, by, bulb + tn, Math.PI, 0, true);
			const R = side(1, false);
			g.bezierCurveTo(...R[1], ...R[2], ...R[3]);
			g.bezierCurveTo(...R[4], ...R[5], ...R[6]);
			g.bezierCurveTo(...R[7], ...R[8], ...R[9]);
			if (ink) g.lineTo(...L[0]);
			else {
				// Back over the band in a low arch, into the slime's rim colour.
				const lift = T * 0.45;
				g.bezierCurveTo(...at(mouth * 0.45, -0.6 - lift), ...at(-mouth * 0.45, -0.6 - lift), ...L[0]);
			}
			g.closePath();
		};
		path(true);
		g.fill(INK);
		path(false);
		g.fill(this.bodyFill);
		// A highlight running down the strand's left side and a glint on the bulb.
		if (ny - yS > 10 * k) {
			g.moveTo(x - top * 0.5, yS);
			g.quadraticCurveTo(nx - neck * 0.4, (yS + ny) / 2, nx - neck * 0.35, ny);
			g.stroke({ width: 1.8 * k, color: '#e7c6ff', alpha: 0.7, cap: 'round' });
		}
		g.ellipse(bx - bulb * 0.38, by - bulb * 0.32, bulb * 0.3, bulb * 0.2).fill({ color: '#f6e8ff', alpha: 0.9 });
	}

	// ---- Bubbles -----------------------------------------------------------------------------

	private tickBubbles(t: number, dt: number) {
		const { burst, rate, speed } = this.opts;
		// A fountain as the plaque pops into place, then a steady stream.
		const fountainAt = 420 * speed;
		if (t >= fountainAt) {
			const want = burst + Math.max(0, (t - fountainAt - 500) / 1000) * rate;
			const fountain = this.emitted < burst;
			while (this.emitted < want && this.bubbles.length < MAX_BUBBLES) {
				this.spawn(t, fountain);
				this.emitted++;
			}
		}
		const k = this.opts.plaque[2] / 600;
		for (const b of this.bubbles) {
			b.vy += G * dt;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
			const age = t - b.born;
			// Pops out of the slime, then tumbles: a jelly wobble and a slow spin.
			const grow = Math.min(1, age / 160);
			const pop = 1 + 0.25 * Math.max(0, 1 - age / 220) * Math.sin(age / 22);
			const wob = Math.sin(age / 90 + b.wob) * 0.1;
			const d = (b.r * 2 * grow * pop) / 64;
			b.s.position.set(b.x, b.y);
			b.s.scale.set(d * (1 + wob), d * (1 - wob));
			b.s.rotation += b.spin * dt;
			if (age > b.popAt) this.burstBubble(b, t, k);
		}
		this.bubbles = this.bubbles.filter((b) => {
			const gone = b.s.destroyed || b.y - b.r > H + this.pad + 20 || b.x < -80 || b.x > W + 80;
			if (gone && !b.s.destroyed) b.s.destroy();
			return !gone;
		});
	}

	private spawn(t: number, fountain: boolean) {
		const [cx, cy, w, h] = this.opts.plaque;
		const k = w / 600;
		// Out of the slime's upper half, flung up and outward, wider the further out they start.
		const fx = Math.random() * 2 - 1;
		const x = cx + fx * w * 0.36;
		const y = cy - h * 0.12 + Math.random() * h * 0.1;
		const up = fountain ? 700 + Math.random() * 520 : 560 + Math.random() * 480;
		const tint = Math.random() < 0.6 ? 0 : 1;
		const s = new Sprite(this.textures[tint]);
		s.anchor.set(0.5);
		s.scale.set(0);
		this.bubbleLayer.addChild(s);
		const r = Math.min(MAX_R, (9 + Math.random() * Math.random() * 20) * Math.max(0.75, Math.min(1.1, k)));
		this.bubbles.push({
			s,
			x,
			y,
			vx: fx * (160 + Math.random() * 260) + (Math.random() - 0.5) * 120,
			vy: -up,
			r,
			spin: (Math.random() - 0.5) * 6,
			born: t,
			// Most pop around or after the top of their arc; some fall all the way out.
			popAt: Math.random() < 0.7 ? (up / G) * 1000 * (0.7 + Math.random() * 0.9) : 9e9,
			wob: Math.random() * 6,
			tint,
		});
	}

	private burstBubble(b: Bubble, t: number, k: number) {
		const color = ['#c58bff', '#dcb8ff'][b.tint];
		this.addBit({ x: b.x, y: b.y, vx: b.vx * 0.3, vy: b.vy * 0.3, born: t, life: 260, ring: true, r: b.r, color: '#ffffff' });
		const n = 5 + Math.floor(Math.random() * 3);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
			const v = 140 + Math.random() * 160;
			this.addBit({
				x: b.x + Math.cos(a) * b.r * 0.6,
				y: b.y + Math.sin(a) * b.r * 0.6,
				vx: b.vx * 0.3 + Math.cos(a) * v,
				vy: b.vy * 0.3 + Math.sin(a) * v - 60,
				born: t,
				life: 420 + Math.random() * 200,
				ring: false,
				r: (2.2 + Math.random() * 2.2) * Math.max(0.8, k),
				color,
			});
		}
		b.s.destroy();
	}

	private addBit(b: Omit<Bit, 'g'>) {
		const g = new Graphics();
		// The pop's flash: a soft white disc, brighter at the middle (a hairline ring read as a
		// stray artefact).
		if (b.ring) for (const [r, a] of [[1, 0.16], [0.78, 0.2], [0.52, 0.28]]) g.circle(0, 0, r).fill({ color: b.color, alpha: a });
		else g.circle(0, 0, b.r).fill(b.color).stroke({ width: Math.max(1, b.r * 0.35), color: INK });
		this.bitLayer.addChild(g);
		this.bits.push({ ...b, g });
	}

	private tickBits(t: number, dt: number) {
		for (const b of this.bits) {
			const p = (t - b.born) / b.life;
			if (p >= 1) {
				b.g.destroy(DISPOSE);
				continue;
			}
			if (b.ring) {
				// A flash that swells to 1.4x the bubble and fades.
				b.g.position.set(b.x, b.y);
				b.g.scale.set(b.r * (0.9 + 0.5 * p));
				b.g.alpha = (1 - p) ** 2;
			} else {
				b.vy += G * 0.6 * dt;
				b.x += b.vx * dt;
				b.y += b.vy * dt;
				b.g.position.set(b.x, b.y);
				b.g.scale.set(1 - 0.5 * p);
				b.g.alpha = 1 - p * p;
			}
		}
		this.bits = this.bits.filter((b) => !b.g.destroyed);
	}

	/** Hands the shared app back: stopped, its stage empty and its canvas out of the page. */
	release() {
		if (owner !== this || !this.app) return;
		owner = null;
		tick = null;
		const app = this.app;
		app.ticker.stop();
		this.root.removeFromParent();
		app.render();
		app.canvas.remove();
	}

	destroy() {
		this.dead = true;
		this.unwatch?.();
		this.release();
		if (!this.root.destroyed) this.root.destroy(DISPOSE);
		for (const t of this.textures) t.destroy(true);
		this.textures = [];
		this.bodyFill.destroy();
	}
}

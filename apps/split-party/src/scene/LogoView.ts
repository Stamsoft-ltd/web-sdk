// The base-game logo in Pixi (Logo.svelte + LiveEyes.svelte): the Figma art, its six side
// splashes flung out and sucked back every 4s, and live eyes in the "O" that glance about,
// blink, and stare at the board while a round plays (`gaze`). The O also smiles and blushes
// (lib/logoFace.ts); on a win (`cheer`) the logo jelly-bounces, flings its splashes at once
// and the O squints ^^ with an open grin.
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import EYES from '../lib/eyes.json';
import LAYERS from '../lib/logo-layers.json';
import { FACE } from '../lib/logoFace';
import { bezier, keyframes, EASE_IN_OUT, type Frame } from '../board/anim';
import { clipConvex, circlePts, convex, flat, parsePts } from '../board/BoardView';
import type { Pt } from '../board/crackGeom';
import { PixiApp, watchReducedMotion } from '../board/pixiApp';

type Eye = { hull: string; top: number; bottom: number; left: number; right: number; white: string; lid: string; px: number; py: number; pr: number; pupil: string };
type Drop = (typeof LAYERS.drops)[number];
const W = LAYERS.width;
const H = LAYERS.height;
// The canvas reaches this far (in logo units) past the art, for splashes flung outside it.
const PAD = 12;
const RIM = 1.4;
const PUPIL = 1.3;
const LOOK_DELAY = -1200;
const BLINK_DELAY = -2800;
const C_SPLAT = bezier(0.3, 0.7, 0.4, 1);
const C_SACCADE = bezier(0.3, 0.8, 0.4, 1);
type S = { tx: number; ty: number; sx: number; sy: number };
const SPLAT: Frame<S>[] = [
	[0, { tx: 0, ty: 0, sx: 0.12, sy: 0.3 }],
	[0.06, { tx: 0, ty: 0, sx: 1.24, sy: 1.08 }],
	[0.11, { tx: 0, ty: 0, sx: 0.9, sy: 1.08 }],
	[0.17, { tx: 0, ty: 0, sx: 1.06, sy: 0.95 }],
	[0.24, { tx: 0, ty: 0, sx: 1, sy: 1 }],
	[0.86, { tx: 0, ty: 0, sx: 1, sy: 1 }],
	[0.93, { tx: 0, ty: 0, sx: 1.08, sy: 0.86 }],
	[1, { tx: 0, ty: 0, sx: 0.12, sy: 0.3 }],
];
const dotSplat = (fx: number, fy: number): Frame<S>[] => [
	[0, { tx: fx, ty: fy, sx: 0, sy: 0 }],
	[0.07, { tx: -0.12 * fx, ty: -0.12 * fy, sx: 1.3, sy: 0.75 }],
	[0.13, { tx: 0, ty: 0, sx: 0.85, sy: 1.2 }],
	[0.2, { tx: 0, ty: 0, sx: 1.05, sy: 0.96 }],
	[0.26, { tx: 0, ty: 0, sx: 1, sy: 1 }],
	[0.86, { tx: 0, ty: 0, sx: 1, sy: 1 }],
	[1, { tx: fx, ty: fy, sx: 0, sy: 0 }],
];
const LOOK: Frame<{ x: number; y: number }>[] = [
	[0, { x: 0, y: 0 }],
	[0.24, { x: 0, y: 0 }],
	[0.3, { x: -1, y: 1 }],
	[0.46, { x: -1, y: 1 }],
	[0.54, { x: 1, y: -0.5 }],
	[0.72, { x: 1, y: -0.5 }],
	[0.8, { x: 0, y: 0 }],
	[1, { x: 0, y: 0 }],
];
const BLINK: Frame<{ v: number }>[] = [
	[0, { v: 0 }],
	[0.91, { v: 0 }],
	[0.94, { v: 1 }],
	[0.955, { v: 1 }],
	[1, { v: 0 }],
];
// The win bounce, about the logo's bottom centre.
const CHEER_MS = 900;
const BOUNCE: Frame<{ sx: number; sy: number; ty: number }>[] = [
	[0, { sx: 1, sy: 1, ty: 0 }],
	[0.14, { sx: 1.07, sy: 0.9, ty: 0 }],
	[0.34, { sx: 0.95, sy: 1.08, ty: -2.6 }],
	[0.54, { sx: 1.04, sy: 0.96, ty: 0 }],
	[0.74, { sx: 0.99, sy: 1.02, ty: -0.4 }],
	[1, { sx: 1, sy: 1, ty: 0 }],
];
// After the bounce, while the win stays on show (tumbles keep winning): a smaller hop every
// HOP_MS, squinting ^^ in the air and wide-eyed, looking up, on the ground (the board's cheer).
const HOP_MS = 900;
// At rest the logo breathes like the board's blobs (BoardView's BREATH), only gentler: it is
// one wide jelly, so the same stretch would read as a wobble (Logo.svelte's logo-breathe).
const BREATH_MS = 3600;
const BREATH: Frame<{ sx: number; sy: number; ty: number }>[] = [
	[0, { sx: 1, sy: 1, ty: 0 }],
	[0.4, { sx: 0.992, sy: 1.022, ty: -0.004 * H }],
	[0.5, { sx: 0.992, sy: 1.022, ty: -0.004 * H }],
	[0.78, { sx: 1.006, sy: 0.993, ty: 0 }],
	[1, { sx: 1, sy: 1, ty: 0 }],
];
const HOP: Frame<{ sx: number; sy: number; ty: number }>[] = [
	[0, { sx: 1, sy: 1, ty: 0 }],
	[0.18, { sx: 1.045, sy: 0.94, ty: 0 }],
	[0.45, { sx: 0.97, sy: 1.05, ty: -1.6 }],
	[0.72, { sx: 1.025, sy: 0.975, ty: 0 }],
	[1, { sx: 1, sy: 1, ty: 0 }],
];
const cycle = (now: number, period: number, delay: number) => {
	const t = (now - delay) / period;
	return t - Math.floor(t);
};

export class LogoView {
	private pixi = new PixiApp();
	private app = this.pixi.app;
	private unwatchMotion: (() => void) | null = null;
	private art = new Container();
	// Everything in the art, squashed about the logo's bottom centre by the win bounce.
	private jelly = new Container();
	private smile = new Graphics();
	private grin = new Container();
	private joys: Container[] = [];
	private cheerSince: number | null = null;
	private beat = 0;
	private drops: { c: Container; frames: Frame<S>[]; delay: number; ax: number; ay: number }[] = [];
	private eyes: { e: Eye; clip: Pt[]; pupil: Graphics; lid: Container; lx: number; ly: number; last: string }[] = [];
	private gaze: { x: number; y: number } | null = null;
	// The stare's saccade: from where the pupils were to where they're going, over 160ms.
	private stare = { from: [0, 0], to: [0, 0], start: 0 };
	private t0 = performance.now();
	private host: HTMLElement | null = null;
	private reduced = false;
	private destroyed = false;
	private res = 0;
	private frames = 0;

	async init(host: HTMLElement) {
		this.host = host;
		this.unwatchMotion = watchReducedMotion((r) => (this.reduced = r));
		if (!(await this.pixi.init({ resizeTo: host, antialias: true, resolution: this.measureRes() }))) return;
		const srcs = ['./splash/hd/logo-base.webp', ...LAYERS.drops.map((d) => d.src)];
		const tex = new Map<string, Texture>();
		await Promise.all(srcs.map(async (src) => tex.set(src, await Assets.load<Texture>({ src, data: { autoGenerateMipmaps: true } }))));
		if (this.destroyed) return;
		const gl = this.app.renderer.texture as unknown as { initSource?: (s: unknown) => void };
		for (const t of tex.values()) gl.initSource?.(t.source);
		const base = new Sprite(tex.get('./splash/hd/logo-base.webp'));
		base.width = W;
		base.height = H;
		this.art.addChild(base);
		const anchored = LAYERS.drops.filter((d) => d.anchored);
		LAYERS.drops.forEach((d: Drop, i) => {
			const c = new Container();
			c.pivot.set(d.ax, d.ay);
			c.position.set(d.ax, d.ay);
			const s = new Sprite(tex.get(d.src));
			s.position.set(d.x, d.y);
			s.width = d.w;
			s.height = d.h;
			c.addChild(s);
			this.art.addChild(c);
			// A free dot flies out of the nearest anchored splash, so it starts at that anchor.
			let frames = SPLAT;
			if (!d.anchored) {
				const cx = d.x + d.w / 2;
				const cy = d.y + d.h / 2;
				const from = anchored.reduce((a, o) => (Math.hypot(o.ax - cx, o.ay - cy) < Math.hypot(a.ax - cx, a.ay - cy) ? o : a));
				frames = dotSplat(from.ax - cx, from.ay - cy);
			}
			// Left splashes burst first, the right side answers; each drop trails the one before.
			const delay = ((d.ax > W / 2 ? 0.5 : 0) + (i % 3) * 0.07 + (d.anchored ? 0 : 0.08)) * 1000;
			this.drops.push({ c, frames, delay, ax: d.ax, ay: d.ay });
		});
		for (const e of ((EYES as Record<string, Eye[]>).LOGO ?? []) as Eye[]) {
			const hull = parsePts(e.hull);
			const unit = (e.right - e.left) / 16;
			// rim: the white widened past the hull over painted pupil edges the hull missed.
			this.art.addChild(new Graphics().poly(flat(hull), true).fill(e.white).stroke({ width: RIM * unit, color: e.white, join: 'round' }));
			const pupil = new Graphics();
			this.art.addChild(pupil);
			const lid = new Container();
			const hx = (e.left + e.right) / 2;
			lid.pivot.set(hx, e.top);
			lid.position.set(hx, e.top);
			lid.addChild(
				new Graphics()
					.poly(flat(hull), true)
					.fill(e.lid)
					.stroke({ width: 3.2 * unit, color: e.lid, join: 'round' })
					.moveTo(e.left + 0.5 * unit, (e.top + e.bottom) / 2)
					.quadraticCurveTo(hx, e.bottom + 1.5 * unit, e.right - 0.5 * unit, (e.top + e.bottom) / 2)
					.stroke({ width: 1.5 * unit, color: e.pupil, cap: 'round' }),
			);
			this.art.addChild(lid);
			const clip = convex(hull);
			this.eyes.push({
				e,
				clip,
				pupil,
				lid,
				lx: ((e.right - e.left) / 2 - e.pr * PUPIL) * 0.5,
				ly: ((e.bottom - e.top) / 2 - e.pr * PUPIL) * 0.3,
				last: '',
			});
		}
		this.buildFace();
		// One by one, in order (removeChildren() hands them back reversed: the base art on top).
		for (const k of [...this.art.children]) this.jelly.addChild(k);
		this.jelly.pivot.set(W / 2, H);
		this.jelly.position.set(W / 2, H);
		this.art.addChild(this.jelly);
		this.app.stage.addChild(this.art);
		this.app.canvas.style.display = 'block';
		host.appendChild(this.app.canvas);
		this.layout();
		// resizeTo resizes the renderer a frame after the window event: lay out when it has.
		this.app.renderer.on('resize', () => this.layout());
		this.pixi.run(() => this.frame());
		addEventListener('resize', this.onResize);
	}

	/** Called once if the view stops working after init (a throw in a frame, a lost context). */
	set onfail(fn: ((e: unknown) => void) | null) {
		this.pixi.onfail = fn;
	}

	private measureRes() {
		const h = this.host;
		const dpr = devicePixelRatio || 1;
		if (!h?.offsetWidth) return this.res || dpr;
		const scale = h.getBoundingClientRect().width / h.offsetWidth;
		this.res = Math.min(3, Math.max(1, dpr * scale));
		return this.res;
	}
	// Only the resolution: the size follows the host through resizeTo (and layout() through the
	// renderer's resize event).
	private onResize = () => {
		const prev = this.res;
		const next = this.measureRes();
		if (prev && Math.abs(next - prev) / prev > 0.04) this.app.renderer.resize(this.app.screen.width, this.app.screen.height, next);
		else if (prev) this.res = prev;
	};
	// The canvas covers the host plus PAD logo units each side; the art is fitted like the SVG
	// (xMidYMid meet) into the host's box.
	private layout() {
		const w = this.app.screen.width;
		const h = this.app.screen.height;
		const k = Math.min(w / (W + 2 * PAD), h / (H + 2 * PAD));
		this.art.scale.set(k);
		this.art.position.set((w - W * k) / 2, (h - H * k) / 2);
	}

	// The O's smile, grin and blush (lib/logoFace.ts), and a ^^ squint over each eye for wins.
	private buildFace() {
		const face = new Container();
		face.position.set(FACE.x, FACE.y);
		face.rotation = (FACE.deg * Math.PI) / 180;
		const b = FACE.blush;
		for (const side of [-1, 1])
			face.addChild(new Graphics().ellipse(side * b.dx, b.dy, b.rx, b.ry).fill({ color: b.color, alpha: b.alpha }));
		const sm = FACE.smile;
		this.smile.moveTo(-sm.w, 0).quadraticCurveTo(0, sm.bow * 2, sm.w, 0).stroke({ width: sm.width, color: FACE.ink, cap: 'round' });
		face.addChild(this.smile);
		const g = FACE.grin;
		this.grin.addChild(
			new Graphics()
				.moveTo(-g.w, -0.2)
				.lineTo(g.w, -0.2)
				.quadraticCurveTo(g.w * 0.9, g.depth, 0, g.depth)
				.quadraticCurveTo(-g.w * 0.9, g.depth, -g.w, -0.2)
				.closePath()
				.fill(g.fill)
				.stroke({ width: 0.45, color: FACE.ink, join: 'round' }),
			new Graphics().ellipse(0, g.depth * 0.62, g.w * 0.47, g.depth * 0.18).fill(g.tongue),
		);
		// Opens from the top edge.
		this.grin.visible = false;
		face.addChild(this.grin);
		this.art.addChild(face);
		for (const { e } of this.eyes) {
			const unit = (e.right - e.left) / 16;
			const hx = (e.left + e.right) / 2;
			const my = (e.top + e.bottom) / 2;
			const joy = new Container();
			joy.addChild(
				new Graphics()
					.poly(flat(parsePts(e.hull)), true)
					.fill(e.lid)
					.stroke({ width: 3.2 * unit, color: e.lid, join: 'round' })
					.moveTo(e.left + 0.8 * unit, my + 1.4 * unit)
					.quadraticCurveTo(hx, e.top - 1.8 * unit, e.right - 0.8 * unit, my + 1.4 * unit)
					.stroke({ width: 1.6 * unit, color: e.pupil, cap: 'round' }),
			);
			joy.pivot.set(hx, my);
			joy.position.set(hx, my);
			joy.visible = false;
			this.art.addChild(joy);
			this.joys.push(joy);
		}
	}

	/** A win is being shown: a full bounce when it starts and on every new win (`beat`), the
	 *  hop loop in between. */
	setCheer(on: boolean, beat = 0) {
		const fresh = beat !== this.beat;
		this.beat = beat;
		if (on && (this.cheerSince == null || fresh)) {
			const now = performance.now();
			this.cheerSince = now;
			// The splashes fling out now (their 4s loop restarts).
			this.t0 = now;
		} else if (!on) this.cheerSince = null;
	}

	setGaze(g: { x: number; y: number } | null) {
		const now = performance.now();
		this.stare = { from: this.stareOffset(now), to: [0, 0], start: now };
		this.gaze = g;
	}
	private stareOffset(now: number) {
		const p = C_SACCADE(Math.min(1, (now - this.stare.start) / 160));
		const s = this.stare;
		return [s.from[0] + (s.to[0] - s.from[0]) * p, s.from[1] + (s.to[1] - s.from[1]) * p];
	}

	private frame() {
		const now = performance.now();
		if (++this.frames % 30 === 0) this.onResize();
		const t = now - this.t0;
		const cheering = this.cheerSince != null;
		const live = cheering && !this.reduced;
		const since = live ? now - this.cheerSince! : 0;
		const cp = live ? since / CHEER_MS : 1;
		const hp = live && cp >= 1 ? ((since - CHEER_MS) % HOP_MS) / HOP_MS : -1;
		const v =
			cp < 1 ? keyframes(BOUNCE, cp, EASE_IN_OUT) : hp >= 0
					? keyframes(HOP, hp, EASE_IN_OUT)
					: this.reduced
						? { sx: 1, sy: 1, ty: 0 }
						: keyframes(BREATH, (t % BREATH_MS) / BREATH_MS, EASE_IN_OUT);
		this.jelly.scale.set(v.sx, v.sy);
		this.jelly.position.set(W / 2, H + v.ty);
		this.smile.visible = !cheering;
		this.grin.visible = cheering;
		// The grin pops open with the bounce, then laughs with each hop.
		this.grin.scale.set(1, cp < 0.2 ? 0.4 + 3 * cp : hp >= 0 ? 1 + 0.18 * Math.sin(hp * Math.PI) : 1);
		// ^^ through the bounce and in the air; wide eyes looking up between the hops.
		const squint = cheering && (!live || cp < 1 || (hp > 0.25 && hp < 0.8));
		const wide = cheering && !squint;
		for (const j of this.joys) j.visible = squint;
		for (const d of this.drops) {
			if (this.reduced) break;
			const local = t - d.delay;
			const f = keyframes(d.frames, local < 0 ? 0 : (local % 4000) / 4000, C_SPLAT);
			d.c.position.set(d.ax + f.tx, d.ay + f.ty);
			d.c.scale.set(f.sx, f.sy);
		}
		for (const ev of this.eyes) {
			const { e } = ev;
			let ox = 0;
			let oy = 0;
			if (this.gaze) {
				// Stare: aim at a point toward the gaze from the eye's centre (LiveEyes' stare()).
				const r = e.pr * PUPIL * 0.45;
				const x = (e.left + e.right) / 2 + this.gaze.x * ((e.right - e.left) / 2 - r);
				const y = (e.top + e.bottom) / 2 + this.gaze.y * ((e.bottom - e.top) / 2 - r);
				this.stare.to = [x - e.px, y - e.py];
			} else this.stare.to = [0, 0];
			const [sx, sy] = this.stareOffset(now);
			ox = sx;
			oy = sy;
			if (wide) {
				ox = 0;
				oy = -2 * ev.ly;
			} else if (!this.gaze && !this.reduced) {
				const k = keyframes(LOOK, cycle(now, 5600, LOOK_DELAY), EASE_IN_OUT);
				ox += k.x * ev.lx;
				oy += k.y * ev.ly;
			}
			const ps = wide ? 1.15 : 1;
			const key = `${ox.toFixed(2)},${oy.toFixed(2)},${ps}`;
			if (key !== ev.last) {
				ev.last = key;
				const r = e.pr * PUPIL * ps;
				const g = ev.pupil.clear();
				const body = clipConvex(circlePts(e.px + ox, e.py + oy, r), ev.clip);
				if (body.length > 2) g.poly(flat(body), true).fill(e.pupil);
				const hi = clipConvex(circlePts(e.px + ox + e.pr * 0.42, e.py + oy - e.pr * 0.42, e.pr * 0.34, 14), ev.clip);
				if (hi.length > 2) g.poly(flat(hi), true).fill('#fff');
			}
			const lv = this.reduced || cheering ? 0 : keyframes(BLINK, cycle(now, 4400, BLINK_DELAY), EASE_IN_OUT).v;
			ev.lid.scale.y = lv;
			ev.lid.visible = lv > 0.001;
		}
	}

	destroy() {
		this.destroyed = true;
		this.unwatchMotion?.();
		removeEventListener('resize', this.onResize);
		this.pixi.destroy();
	}
}


// Mama blob beside the board (Mama-2, Figma 11386:76456; the first Mama was 11321:47840), rigged by
// scripts/build-mama.py: a jelly body mesh with her face in loose parts on top.
// - At rest she breathes, sways (her bun lagging behind), blinks and glances about.
// - A spin (`cheer`) is a happy hop: ^^ squint, a bigger laugh, brows up.
// - While tiles split (`fear`) she frets: brows knit up, eyes wide with small pupils, an "o"
//   mouth, a shiver and a sweat drop, staring at the board. Each `push` is her sending her
//   spirit to the splitting tile (App's .spirit): she leans in and squeezes, then clutches her
//   paws to her chest and squeezes her eyes shut, peeking now and then. Her paws never leave
//   her body (drawn arms read as tubes; the user rejected two versions).
// - While a win is on show (`win`) she laughs and bounces her paws; at rest she pats her belly, her
//   brows lift now and then, and every few seconds she fidgets: a little hop, a jelly wiggle, a
//   wave, a giggle or a curious look at the board.
// - All through a bonus (`dance`) she dances: bouncing off her feet on a beat with a squash at
//   every landing, rocking side to side, paws pumping, smiling, and fidgeting far more often
//   (user, 2026-10-30: "mama blob is very static, make her very dynamic in bonus mode").
import { Assets, Container, Graphics, Mesh, MeshGeometry, Sprite, Texture } from 'pixi.js';
import MAMA from '../lib/mama.json';
import { keyframes, EASE_IN_OUT, type Frame } from '../board/anim';
import { clipConvex, convex, flat, parsePts } from '../board/BoardView';
import type { Pt } from '../board/crackGeom';
import { PixiApp, watchReducedMotion } from '../board/pixiApp';
import { canvasRes } from '../lib/canvasRes';

type Part = { src: string; x: number; y: number; w: number; h: number };
type EyeData = (typeof MAMA.eyes)[number];
const PARTS = MAMA.parts as Record<string, Part>;
const W = MAMA.w;
const H = MAMA.h;
const CX = W / 2;
// The canvas reaches this far (in her units) past the Figma box: the hop and the lean.
const PAD_X = 34;
const PAD_TOP = 46;
const PAD_BOTTOM = 6;
const GRID = 12;
// Her buns' bottom: everything above it lags behind the body's sway like a loose top knot.
const BUN = 50;

// The spin hop, about her feet: crouch, jump, land squashed, settle.
const HOP_MS = 1100;
const HOP: Frame<{ sx: number; sy: number; ty: number }>[] = [
	[0, { sx: 1, sy: 1, ty: 0 }],
	[0.14, { sx: 1.08, sy: 0.9, ty: 0 }],
	[0.36, { sx: 0.95, sy: 1.08, ty: -20 }],
	[0.56, { sx: 1.1, sy: 0.88, ty: 0 }],
	[0.7, { sx: 0.97, sy: 1.04, ty: -5 }],
	[0.84, { sx: 1.03, sy: 0.97, ty: 0 }],
	[1, { sx: 1, sy: 1, ty: 0 }],
];
// The push that sends the spirit: a squeeze, then a lean toward the board.
const PUSH_MS = 700;
type Fidget = 'hop' | 'wiggle' | 'wave' | 'giggle' | 'look';
const FIDGETS: [Fidget, number][] = [
	['hop', 900],
	['wiggle', 1300],
	['wave', 1800],
	['giggle', 1200],
	['look', 1600],
];
// A fidget's rise and fall: up over its first fifth, down over its last.
const ramp = (t: number) => Math.max(0, Math.min(1, 5 * t, 5 * (1 - t)));
// Her entrance, as the warp from the splash lands (App enterGame): she is there whole from the
// first frame, landing squashed and settling with a jelly wobble. (The ball she used to grow out
// of read as a weak reveal: user, 2026-10-30, "mama to be shown fully".)
// The mouth opens from near its top edge, like a dropping jaw: grown from its middle, a laugh
// pushed its top into the nose (user: "the nose is broken").
const MOUTH_HINGE = 0.12;
const RISE_MS = 700;
// Her feet (art units): she lands and squashes about them.
const FEET = { x: 112, y: 243 };
const RISE: Frame<{ sx: number; sy: number }>[] = [
	[0, { sx: 1.12, sy: 0.84 }],
	[0.35, { sx: 0.94, sy: 1.08 }],
	[0.6, { sx: 1.04, sy: 0.96 }],
	[0.8, { sx: 0.99, sy: 1.01 }],
	[1, { sx: 1, sy: 1 }],
];
const PUSH: Frame<{ sx: number; sy: number; lean: number }>[] = [
	[0, { sx: 1, sy: 1, lean: 0 }],
	[0.22, { sx: 1.07, sy: 0.92, lean: -4 }],
	[0.42, { sx: 0.95, sy: 1.06, lean: 12 }],
	[0.7, { sx: 1.02, sy: 0.98, lean: 6 }],
	[1, { sx: 1, sy: 1, lean: 0 }],
];
const BREATH_MS = 3400;
const SWAY_MS = 6100;
const BLINK_MS = 160;
// A chatter: she mutters to herself, the smile half-closing a few times.
const CHATTER_MS = 900;
// The mouth's smile <-> "o" hand-over follows her mood over about this long.
const MOUTH_SHUT_MS = 320;
// The right arm mesh's columns and rows.
const ARM_GRID: [number, number] = [6, 10];
// How long she's let down after a teased bonus doesn't come.
const SAD_MS = 2600;
// After the push she shuts her eyes tight; every PEEK_MS she peeks.
const COVER_AFTER_MS = 380;
const PEEK_MS = 1700;
const CLAP_MS = 420;
const BROW_MS = 4700;
const DANCE_BEAT_MS = 540;
// Dancing, every other landing flicks a few jelly drops off the top of her head, in her spots'
// colours; they arc out, fall and fade (user, 2026-10-30: "from her head some small spills").
const SPILL_COLORS = ['#ffd84a', '#5fc8ff', '#b98bff', '#ff7ac3'];
const SPILL_MS = 900;
const SPILL_G = 0.0006; // her units per ms²
// The top of her head (art units), where the drops leave from.
const CROWN = { x: 104, y: 10 };
type Spill = { g: Graphics; x: number; y: number; vx: number; vy: number; at: number };

const smooth = (from: number, to: number, dt: number, ms: number) => to + (from - to) * Math.exp(-dt / ms);

export class MamaView {
	private pixi = new PixiApp();
	private app = this.pixi.app;
	private unwatchMotion: (() => void) | null = null;
	private root = new Container();
	// All of her, squashed about her feet as she lands.
	private figure = new Container();
	private mesh!: Mesh;
	private rest!: Float32Array;
	private parts = new Map<string, Sprite>();
	private eyes: {
		e: EyeData;
		c: Container;
		iris: Sprite;
		lid: Graphics;
		lash: Sprite;
		hull: Pt[];
		key: string;
	}[] = [];
	private paws: { side: 'L' | 'R'; s: Sprite; cx: number; cy: number; wrist: [number, number] }[] = [];
	private oMouth = new Graphics();
	// The smile, its tongue (masked to it) moving inside, hinged near its top edge.
	private mouthBox = new Container();
	// The mouth's centre in root space, kept by frame() for mouthAt().
	private mouthXY = { x: 0, y: 0 };
	// Her right arm hangs from her shoulder: a mesh pinned there, its fist end moving like a paw.
	private arm: { mesh: Mesh<MeshGeometry>; rest: Float32Array } | null = null;
	private tongue: Sprite | null = null;
	private chatterAt = 0;
	private blush = new Graphics();
	private sweat = new Graphics();
	private host: HTMLElement | null = null;
	private reduced = false;
	private destroyed = false;
	private res = 0;
	private frames = 0;
	private last = performance.now();
	// Moods, eased toward their targets every frame.
	private joy = 0;
	private fright = 0;
	// The mouth's own smile <-> "o" blend, eased slower than the fright that drives it.
	private shut = 0;
	private afraid = false;
	private fearAt = 0;
	private winning = false;
	private edging = false;
	private edge = 0;
	// Bonus dance: on/off, and its eased amount.
	private dancing = false;
	private groove = 0;
	// The spills fly free of her (not in `root`, which bobs with her hop).
	private fx = new Container();
	private spills: Spill[] = [];
	private lastLand = 0;
	private cover = 0;
	private peek = 0;
	// Hidden until shown, then landing from riseAt (Infinity: not shown yet).
	private riseAt = Infinity;
	private clap = 0;
	private resizeObs: ResizeObserver | null = null;
	private hopAt = -1e9;
	private fidget: { kind: Fidget; at: number; ms: number } | null = null;
	private lastFidget: Fidget | null = null;
	private waveAmt = 0;
	private wavePhase = 0;
	private curious = 0;
	// Let down (a teased bonus that didn't come): SAD_MS from sadAt, 0..1 in `sad`.
	private sulkBeat = 0;
	private sadAt = -Infinity;
	private sad = 0;
	private frown = new Graphics();
	private nextFidget = performance.now() + 2500;
	private pushAt = -1e9;
	private beat = 0;
	private pushes = 0;
	// The bun's lag: a damped spring chasing the body's lean.
	private bun = { x: 0, v: 0 };
	private look = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
	private gaze: { x: number; y: number } | null = null;
	private blinkAt = performance.now() + 1800;
	private twice = false;

	async init(host: HTMLElement) {
		this.host = host;
		if (import.meta.env.DEV) (globalThis as { __mama?: MamaView }).__mama = this;
		this.unwatchMotion = watchReducedMotion((r) => (this.reduced = r));
		if (!(await this.pixi.init({ resizeTo: host, antialias: true, resolution: this.measureRes() }))) return;
		const tex = new Map<string, Texture>();
		await Promise.all(
			Object.values(PARTS).map(async (p) => tex.set(p.src, await Assets.load<Texture>({ src: p.src, data: { autoGenerateMipmaps: true } }))),
		);
		if (this.destroyed) return;
		const gl = this.app.renderer.texture as unknown as { initSource?: (s: unknown) => void };
		for (const t of tex.values()) gl.initSource?.(t.source);
		this.mesh = this.bodyMesh(tex.get(PARTS.body.src)!);
		this.root.addChild(this.mesh, this.blush);
		for (const name of ['brow-L', 'brow-R']) {
			const p = PARTS[name];
			const s = new Sprite(tex.get(p.src));
			s.width = p.w;
			s.height = p.h;
			s.anchor.set(0.5);
			this.parts.set(name, s);
			this.root.addChild(s);
		}
		{
			const p = PARTS.mouth;
			const t = PARTS.tongue;
			const mouth = new Sprite(tex.get(p.src));
			const mask = new Sprite(tex.get(p.src));
			for (const s of [mouth, mask]) {
				s.width = p.w;
				s.height = p.h;
			}
			const tongue = new Sprite(tex.get(t.src));
			tongue.width = t.w;
			tongue.height = t.h;
			// It sways from its root at the back of the mouth.
			tongue.anchor.set(0.5, 0.9);
			tongue.position.set(t.x - p.x + t.w / 2, t.y - p.y + t.h * 0.9);
			tongue.mask = mask;
			this.tongue = tongue;
			this.mouthBox.addChild(mouth, tongue, mask);
			this.mouthBox.pivot.set(p.w / 2, p.h * MOUTH_HINGE);
			this.root.addChild(this.mouthBox);
			// Drawn over the mouth, when the art has one (Mama-2 doesn't).
			const n = PARTS.nose;
			if (n) {
				const nose = new Sprite(tex.get(n.src));
				nose.width = n.w;
				nose.height = n.h;
				nose.anchor.set(0.5);
				this.parts.set('nose', nose);
				this.root.addChild(nose);
			}
		}
		this.root.addChild(this.oMouth, this.frown);
		for (const e of MAMA.eyes) this.eyes.push(this.buildEye(e, tex));
		for (const side of ['L', 'R'] as const) {
			const p = PARTS[`paw-${side}`];
			const d = MAMA.paws[side];
			const s = new Sprite(tex.get(p.src));
			s.width = p.w;
			s.height = p.h;
			s.anchor.set((d.cx - p.x) / p.w, (d.cy - p.y) / p.h);
			this.paws.push({ side, s, cx: d.cx, cy: d.cy, wrist: d.wrist as [number, number] });
			if (side === 'R') {
				this.arm = this.armMesh(tex.get(p.src)!);
				this.root.addChild(this.arm.mesh);
			} else this.root.addChild(s);
		}
		this.root.addChild(this.sweat);
		this.drawSweat();
		this.figure.addChild(...this.root.children);
		this.figure.pivot.set(FEET.x, FEET.y);
		this.figure.position.set(FEET.x, FEET.y);
		this.root.addChild(this.figure);
		this.app.stage.addChild(this.root, this.fx);
		this.app.canvas.style.display = 'block';
		host.appendChild(this.app.canvas);
		this.layout();
		this.app.renderer.on('resize', () => this.layout());
		this.pixi.run(() => this.frame());
		addEventListener('resize', this.onResize);
		// resizeTo only follows window resizes: a box the CSS resizes (a layout change, a reload of
		// the styles) would leave the canvas at its old size, spilling out of the box.
		this.resizeObs = new ResizeObserver(() => {
			(this.app as unknown as { queueResize?: () => void }).queueResize?.();
			this.onResize();
		});
		this.resizeObs.observe(host);
	}

	set onfail(fn: ((e: unknown) => void) | null) {
		this.pixi.onfail = fn;
	}

	/** A spin started: hop for joy (every new `beat`). */
	cheer(beat: number) {
		if (beat === this.beat) return;
		this.beat = beat;
		this.hopAt = performance.now();
	}
	/** A scatter tease ended without the bonus: a moment let down (every new `beat`). */
	sulk(beat: number) {
		if (beat === this.sulkBeat) return;
		this.sulkBeat = beat;
		this.sadAt = performance.now();
	}
	/** Tiles are splitting: fret until it's over. */
	fear(on: boolean) {
		if (on && !this.afraid) this.fearAt = performance.now();
		this.afraid = on;
	}
	/** A scatter tease is holding a reel: up on her toes, hoping, until it lands. */
	tense(on: boolean) {
		this.edging = on;
	}
	/** The base game is on screen: land (once); `instant`: she's simply there. */
	appear(on: boolean, instant = false) {
		if (on && this.riseAt === Infinity) this.riseAt = instant ? -Infinity : performance.now();
	}
	/** Her mouth's centre as fractions of her canvas, as last drawn: where App's ghost leaves from. */
	mouthAt(): { fx: number; fy: number } | null {
		if (!this.root.parent || !this.app.screen.width) return null;
		const p = this.root.toGlobal(this.mouthXY);
		return { fx: p.x / this.app.screen.width, fy: p.y / this.app.screen.height };
	}
	/** A bonus round is on: dance until it's over. */
	dance(on: boolean) {
		this.dancing = on;
	}
	/** A win is on show: laugh and clap. */
	win(on: boolean) {
		this.winning = on;
	}
	/** She sends her spirit (every new `n`). */
	push(n: number) {
		if (n === this.pushes) return;
		this.pushes = n;
		this.pushAt = performance.now();
	}
	/** Where to stare (a unit vector in screen terms), or null to glance about. */
	setGaze(g: { x: number; y: number } | null) {
		this.gaze = g;
	}

	private measureRes() {
		const h = this.host;
		const dpr = devicePixelRatio || 1;
		if (!h?.offsetWidth) return this.res || dpr;
		const scale = h.getBoundingClientRect().width / h.offsetWidth;
		// Raised while pinch-zoomed, within a GPU budget (lib/canvasRes.ts).
		this.res = canvasRes(dpr * scale, h.offsetWidth, h.offsetHeight);
		return this.res;
	}
	private onResize = () => {
		const prev = this.res;
		const next = this.measureRes();
		if (prev && Math.abs(next - prev) / prev > 0.04) this.app.renderer.resize(this.app.screen.width, this.app.screen.height, next);
		else if (prev) this.res = prev;
	};
	// The canvas is the box plus the pads; her units map to it uniformly.
	private layout() {
		const w = this.app.screen.width;
		const h = this.app.screen.height;
		const k = Math.min(w / (W + 2 * PAD_X), h / (H + PAD_TOP + PAD_BOTTOM));
		this.root.scale.set(k);
		this.root.position.set((w - W * k) / 2, h - (H + PAD_BOTTOM) * k);
		this.fx.scale.set(k);
		this.fx.position.copyFrom(this.root.position);
	}

	private armMesh(tex: Texture) {
		const p = PARTS['paw-R'];
		const nx = ARM_GRID[0] + 1;
		const ny = ARM_GRID[1] + 1;
		const positions = new Float32Array(nx * ny * 2);
		const uvs = new Float32Array(nx * ny * 2);
		const indices = new Uint32Array(ARM_GRID[0] * ARM_GRID[1] * 6);
		for (let j = 0; j < ny; j++)
			for (let i = 0; i < nx; i++) {
				const k = (j * nx + i) * 2;
				positions[k] = p.x + (i / ARM_GRID[0]) * p.w;
				positions[k + 1] = p.y + (j / ARM_GRID[1]) * p.h;
				uvs[k] = i / ARM_GRID[0];
				uvs[k + 1] = j / ARM_GRID[1];
			}
		let q = 0;
		for (let j = 0; j < ARM_GRID[1]; j++)
			for (let i = 0; i < ARM_GRID[0]; i++) {
				const a = j * nx + i;
				indices.set([a, a + 1, a + nx, a + 1, a + nx + 1, a + nx], q);
				q += 6;
			}
		return { mesh: new Mesh({ geometry: new MeshGeometry({ positions, uvs, indices }), texture: tex }), rest: positions.slice() };
	}

	private bodyMesh(tex: Texture) {
		const p = PARTS.body;
		const n = GRID + 1;
		const positions = new Float32Array(n * n * 2);
		const uvs = new Float32Array(n * n * 2);
		const indices = new Uint32Array(GRID * GRID * 6);
		for (let j = 0; j < n; j++)
			for (let i = 0; i < n; i++) {
				const k = (j * n + i) * 2;
				positions[k] = p.x + (i / GRID) * p.w;
				positions[k + 1] = p.y + (j / GRID) * p.h;
				uvs[k] = i / GRID;
				uvs[k + 1] = j / GRID;
			}
		let q = 0;
		for (let j = 0; j < GRID; j++)
			for (let i = 0; i < GRID; i++) {
				const a = j * n + i;
				indices.set([a, a + 1, a + n, a + 1, a + n + 1, a + n], q);
				q += 6;
			}
		this.rest = positions.slice();
		return new Mesh({ geometry: new MeshGeometry({ positions, uvs, indices }), texture: tex });
	}

	private buildEye(e: EyeData, tex: Map<string, Texture>) {
		const c = new Container();
		c.pivot.set(e.cx, e.cy);
		const sprite = (name: string) => {
			const p = PARTS[name];
			const s = new Sprite(tex.get(p.src));
			s.position.set(p.x, p.y);
			s.width = p.w;
			s.height = p.h;
			return s;
		};
		const hull = convex(parsePts(e.hull));
		const mask = new Graphics().poly(flat(hull), true).fill('#fff');
		const irisBox = new Container();
		const iris = sprite(`iris-${e.side}`);
		// About its own centre, so a frightened pupil shrinks in place.
		iris.anchor.set(0.5);
		iris.position.set(PARTS[`iris-${e.side}`].x + PARTS[`iris-${e.side}`].w / 2, PARTS[`iris-${e.side}`].y + PARTS[`iris-${e.side}`].h / 2);
		irisBox.addChild(iris);
		irisBox.mask = mask;
		const lid = new Graphics();
		const lash = sprite(`lash-${e.side}`);
		const lp = PARTS[`lash-${e.side}`];
		// The lash line hangs from the eye's top; blinking drops it and flips it into a closed lid.
		lash.anchor.set(0.5, (e.top + 3 - lp.y) / lp.h);
		lash.position.set(lp.x + lp.w / 2, e.top + 3);
		c.addChild(sprite(`eye-${e.side}`), mask, irisBox, lid, lash);
		this.root.addChild(c);
		return { e, c, iris, lid, lash, hull, key: '' };
	}

	// The afraid "o": a small dark mouth with the tongue at the bottom, its rim quivering.
	private drawO(t: number) {
		const m = MAMA.mouth;
		const g = this.oMouth.clear();
		const pts: number[] = [];
		const q = this.reduced ? 0 : 1;
		for (let i = 0; i < 24; i++) {
			const a = (i / 24) * Math.PI * 2;
			const w = 1 + q * 0.06 * Math.sin(a * 3 + t * 0.031) + q * 0.04 * Math.sin(a * 5 - t * 0.047);
			pts.push(Math.cos(a) * 8.5 * w, Math.sin(a) * 10 * w);
		}
		g.poly(pts, true).fill(m.dark).stroke({ width: 1.6, color: '#3a0410', join: 'round' });
		g.ellipse(0, 5.6, 5.4, 3.4).fill(m.tongue);
		g.ellipse(-2.6, -5.2, 2.2, 1.1).fill({ color: '#ffffff', alpha: 0.35 });
	}

	private drawSweat() {
		this.sweat
			.clear()
			.moveTo(0, -7)
			.bezierCurveTo(3.8, -1.5, 5, 2, 5, 3.6)
			.bezierCurveTo(5, 6.6, 2.6, 8.6, 0, 8.6)
			.bezierCurveTo(-2.6, 8.6, -5, 6.6, -5, 3.6)
			.bezierCurveTo(-5, 2, -3.8, -1.5, 0, -7)
			.closePath()
			.fill('#9fe6ff')
			.stroke({ width: 1.1, color: '#2f8fd1' })
			.ellipse(-1.8, 3, 1.2, 2)
			.fill({ color: '#ffffff', alpha: 0.9 });
	}

	// Where a point of the art moves this frame (her units; feet stay planted).
	private warp(x: number, y: number, m: { sx: number; sy: number; lean: number; shiver: number }): [number, number] {
		const h = Math.max(0, Math.min(1, (H - y) / H));
		let dx = (x - CX) * (m.sx - 1) * (0.35 + 0.65 * h) + m.lean * h ** 1.6 + m.shiver * h;
		if (y < BUN) dx += this.bun.x * ((BUN - y) / BUN) ** 1.5;
		const dy = -(H - y) * (m.sy - 1);
		return [x + dx, y + dy];
	}

	private frame() {
		const now = performance.now();
		const dt = Math.min(100, now - this.last);
		this.last = now;
		if (++this.frames % 30 === 0) this.onResize();
		const still = this.reduced;
		// Moods: joy rises with the hop and fades after it; fright follows the split.
		const hp = (now - this.hopAt) / HOP_MS;
		const pp = (now - this.pushAt) / PUSH_MS;
		const hopping = hp >= 0 && hp < 1;
		// Fidgets, only while nothing else is going on.
		const idle = !hopping && !this.winning && !this.afraid && !this.edging && this.fright < 0.05 && this.edge < 0.05 && !still;
		if (this.fidget && (now - this.fidget.at > this.fidget.ms || !idle)) this.fidget = null;
		if (!this.fidget && idle && now > this.nextFidget) {
			const prev = this.lastFidget;
			// Dancing: no giggle or look. Every second or so they flipped her eyes between the ^^
			// squint and darting glances (user, 2026-10-30: "the eyes act very strange in bonus").
			const pool = FIDGETS.filter(([k]) => k !== prev && !(this.dancing && (k === 'giggle' || k === 'look')));
			const [kind, ms] = pool[Math.floor(Math.random() * pool.length)];
			this.fidget = { kind, at: now, ms };
			this.lastFidget = kind;
			// Dancing, she can't keep still: a fidget every beat or two instead of every few seconds.
			this.nextFidget = now + ms + (this.dancing ? 300 + Math.random() * 900 : 2200 + Math.random() * 3000);
		}
		const f = this.fidget;
		const fp = f ? (now - f.at) / f.ms : 0;
		const fk = f?.kind;
		this.waveAmt = fk === 'wave' ? ramp(fp) : 0;
		this.wavePhase = fp;
		this.curious = fk === 'look' ? ramp(fp) : 0;
		const happy = (hopping || this.winning || fk === 'giggle') && !this.afraid;
		this.groove = smooth(this.groove, this.dancing && !still ? 1 : 0, dt, 350);
		this.joy = smooth(this.joy, happy ? 1 : 0, dt, happy ? 70 : 420);
		// Not while dancing (bonus): there every split shut her eyes and peeked through white slits
		// (user 2026-11-02: "closing them and staying like wrong"); she watches, wide-eyed.
		this.cover = smooth(this.cover, this.afraid && !this.dancing && now - this.fearAt > COVER_AFTER_MS ? 1 : 0, dt, this.afraid ? 110 : 150);
		this.clap = smooth(this.clap, this.winning && !this.afraid ? 1 : 0, dt, 120);
		this.fright = smooth(this.fright, this.afraid ? 1 : 0, dt, this.afraid ? 90 : 380);
		this.edge = smooth(this.edge, this.edging && !this.afraid ? 1 : 0, dt, this.edging ? 160 : 300);
		const joy = this.joy;
		const ed = this.edge;
		const fr = this.fright;
		// Let down: in over 12%, held, out over the last 30%; a win or a fright cuts it short.
		const st = (now - this.sadAt) / SAD_MS;
		const sd = (this.sad = st < 0 || st > 1 || this.winning || this.afraid ? 0 : EASE_IN_OUT(Math.min(1, st / 0.12, (1 - st) / 0.3)));

		const breath = still ? 0 : Math.sin((now / BREATH_MS) * Math.PI * 2);
		const sway = still ? 0 : Math.sin((now / SWAY_MS) * Math.PI * 2);
		let hop = hopping && !still ? keyframes(HOP, hp, EASE_IN_OUT) : { sx: 1, sy: 1, ty: 0 };
		// A fidget hop is the spin hop at half height; a giggle bounces on the spot; a wiggle sways
		// her side to side, squashing at each turn.
		let wig = 0;
		if (fk === 'hop') {
			const h = keyframes(HOP, fp, EASE_IN_OUT);
			hop = { sx: 1 + (h.sx - 1) * 0.7, sy: 1 + (h.sy - 1) * 0.7, ty: h.ty * 0.45 };
		} else if (fk === 'giggle') {
			const b = Math.abs(Math.sin(fp * Math.PI * 5)) * ramp(fp);
			hop = { sx: 1 + 0.025 * b, sy: 1 - 0.035 * b, ty: -2.5 * b };
		} else if (fk === 'wiggle') {
			wig = Math.sin(fp * Math.PI * 4) * ramp(fp);
			hop = { sx: 1 + 0.02 * Math.abs(wig), sy: 1 - 0.025 * Math.abs(wig), ty: 0 };
		}
		const push = pp >= 0 && pp < 1 && !still ? keyframes(PUSH, pp, EASE_IN_OUT) : { sx: 1, sy: 1, lean: 0 };
		// The dance: off the floor on every beat, squashed flat for a moment on each landing,
		// rocking over four beats; smaller while she frets or hopes, so those still read.
		const gd = this.groove * (1 - 0.75 * fr) * (1 - 0.6 * ed);
		const beat = now / DANCE_BEAT_MS;
		const air = Math.abs(Math.sin(beat * Math.PI));
		const land = (1 - air) ** 6;
		const dance = {
			ty: -11 * air * gd,
			sx: 1 + gd * (0.07 * land - 0.025 * air),
			sy: 1 + gd * (0.045 * air - 0.09 * land),
			lean: 8 * Math.sin((beat * Math.PI) / 2) * gd,
		};
		// Frightened she shrinks into herself and shivers (two uneven sines, not a buzz).
		const shiver = still ? 0 : fr * (0.55 * Math.sin(now * 0.052) + 0.35 * Math.sin(now * 0.083 + 1.3));
		// Hoping (a scatter tease): she leans in toward the board and bobs slowly, eagerly.
		const eager = still ? 0 : Math.sin(now * 0.0055);
		const lean = 3.4 * sway * (1 - ed) * (1 - gd) + dance.lean + push.lean + fr * 3 + 9 * wig + 5 * this.curious + ed * (7 + 1.5 * eager) - 2.5 * sd;
		const rp = still ? 1 : Math.max(0, Math.min(1, (now - this.riseAt) / RISE_MS));
		const rise = rp >= 1 ? { sx: 1, sy: 1 } : keyframes(RISE, rp, EASE_IN_OUT);
		if (rp < 1) this.nextFidget = Math.max(this.nextFidget, now + 2500);
		const m = {
			sx: rise.sx * hop.sx * push.sx * dance.sx * (1 - 0.012 * breath) * (1 + 0.025 * fr) * (1 + 0.02 * sd),
			// Hoping she holds her breath and rises onto her toes, bobbing.
			sy: rise.sy * hop.sy * push.sy * dance.sy * (1 + 0.022 * breath * (1 - ed)) * (1 - 0.035 * fr) * (1 + ed * (0.035 + 0.012 * eager)) * (1 - 0.045 * sd),
			lean,
			shiver,
		};
		// The bun chases the lean (and the hop's height) on a soft spring.
		const goal = lean * 0.6 - (hop.ty + dance.ty) * 0.12;
		const s = this.bun;
		s.v += ((goal - s.x) * 0.00018 - s.v * 0.011) * dt;
		s.x += s.v * dt;
		if (still) s.x = s.v = 0;

		const pos = this.mesh.geometry.positions;
		for (let i = 0; i < pos.length; i += 2) {
			const [x, y] = this.warp(this.rest[i], this.rest[i + 1], m);
			pos[i] = x;
			pos[i + 1] = y;
		}
		this.mesh.geometry.getBuffer('aPosition').update();
		this.root.pivot.y = -(hop.ty + dance.ty);
		this.frameSpills(now, dt, beat, gd, m);

		// Brows: up with joy; up and knitted (inner ends raised) with fright. At rest they lift
		// together now and then, the right one alone a little later (a curious look), and tilt a
		// touch as she sways.
		const bp = still ? -1 : (now % BROW_MS) / BROW_MS;
		const flash = bp >= 0 && bp < 0.1 ? Math.sin((bp / 0.1) * Math.PI) : 0;
		const quirk = bp >= 0.55 && bp < 0.7 ? Math.sin(((bp - 0.55) / 0.15) * Math.PI) : 0;
		const calm = 1 - Math.max(joy, fr, ed, sd);
		for (const side of ['L', 'R'] as const) {
			const p = PARTS[`brow-${side}`];
			const [x, y] = this.warp(p.x + p.w / 2, p.y + p.h / 2, m);
			const b = this.parts.get(`brow-${side}`)!;
			const lift = calm * (2.2 * flash + (side === 'R' ? 2 * quirk + 3 * this.curious : 0.8 * this.curious));
			b.position.set(x + (side === 'L' ? 1 : -1) * fr * 1.5, y - 3.5 * joy - 6 * fr - 4.5 * ed * (1 - fr) - lift - 1.5 * sd - 2.5 * gd * air);
			// Afraid or let down, the brows tilt up at their inner ends.
			b.rotation =
				(side === 'L' ? -1 : 1) * (0.3 * fr + 0.26 * sd) +
				(side === 'L' ? 1 : -1) * 0.08 * joy +
				calm * (0.03 * sway + (side === 'R' ? -0.08 * quirk : 0));
		}
		this.framePaws(now, m);
		const np = PARTS.nose;
		if (np) {
			const [nx, ny] = this.warp(np.x + np.w / 2, np.y + np.h / 2, m);
			this.parts.get('nose')!.position.set(nx, ny);
		}
		// Mouth: the smile laughs with joy and folds away into the "o" with fright.
		const mp = PARTS.mouth;
		const [mx, my] = this.warp(mp.x + mp.w / 2, mp.y + mp.h / 2, m);
		this.mouthXY.x = mx;
		this.mouthXY.y = my;
		const [hx, hy] = this.warp(mp.x + mp.w / 2, mp.y + mp.h * MOUTH_HINGE, m);
		// Dancing she smiles wide with her mouth only (a ^^ squint held all bonus read as odd eyes).
		const laugh = Math.max(joy, 0.5 * this.groove) * (1 + (still ? 0 : 0.12 * Math.sin(now * 0.028)));
		// Hoping: a small "ooh" (the fright's "o", smaller).
		// Eased on its own (MOUTH_SHUT_MS): straight off `fright` (90ms) the smile snapped to the
		// "o" in about 60ms as she sent a ghost (user, 2026-10-30).
		this.shut = smooth(this.shut, Math.min(1, Math.max(fr * 1.6, ed * 1.3, sd * 1.5)), dt, MOUTH_SHUT_MS);
		const shut = this.shut;
		// Alive at rest too: the smile breathes a little, and now and then she chatters to
		// herself (a few quick half-closes), the tongue moving with it.
		if (!still && now > this.chatterAt + CHATTER_MS) this.chatterAt = now + 3500 + Math.random() * 5500;
		const ct = (now - this.chatterAt) / CHATTER_MS;
		const chat = still || ct < 0 || ct > 1 || joy > 0.3 ? 0 : Math.sin(ct * Math.PI) * Math.abs(Math.sin(ct * Math.PI * 5));
		const breathe = still ? 0 : Math.sin(now / 900);
		const open = 1 + 0.3 * laugh + 0.05 * breathe - 0.38 * chat;
		this.mouthBox.position.set(hx, hy);
		// Smile <-> "o" is a hand-over: the smile puckers (narrower, then shorter) toward the "o"'s
		// size as it fades over 0.2..0.6 of `shut`, and the "o" grows out of it over 0.4..0.85.
		const pucker = EASE_IN_OUT(Math.min(1, shut / 0.6));
		this.mouthBox.scale.set((1 + 0.16 * laugh + 0.025 * Math.sin(now / 1300) + 0.06 * chat) * (1 - 0.5 * pucker), open * (1 - 0.35 * pucker));
		this.mouthBox.alpha = EASE_IN_OUT(Math.max(0, Math.min(1, (0.6 - shut) / 0.4)));
		this.mouthBox.visible = shut < 0.6;
		if (this.tongue) {
			// The tongue bobs at its root; a laugh waggles it, a chatter flicks it up.
			const wag = still ? 0 : Math.sin(now / (laugh > 0.3 ? 110 : 650));
			this.tongue.y = PARTS.tongue.y - mp.y + PARTS.tongue.h * 0.9 + 1.2 * wag - 2.5 * chat;
			this.tongue.rotation = (laugh > 0.3 ? 0.12 : 0.06) * wag;
			this.tongue.scale.y = (PARTS.tongue.h / this.tongue.texture.height) * (1 + 0.08 * Math.max(0, wag) + 0.15 * chat);
		}
		this.oMouth.visible = shut > 0.4 && (fr > 0.02 || ed > 0.02);
		if (this.oMouth.visible) {
			this.drawO(now);
			this.oMouth.position.set(mx - 2, my + 4);
			const o = Math.min(1, Math.max(fr * 1.3, ed * 0.7 * (1 - sd)));
			const grow = EASE_IN_OUT(Math.max(0, Math.min(1, (shut - 0.4) / 0.45)));
			this.oMouth.scale.set((0.55 + 0.45 * o) * (ed > fr ? 0.75 : 1) * (0.7 + 0.3 * grow));
			this.oMouth.alpha = grow;
		}
		// Let down: a small frown, its corners trembling a touch.
		this.frown.visible = sd > 0.02;
		if (this.frown.visible) {
			const w = still ? 0 : 0.6 * Math.sin(now * 0.021);
			this.frown
				.clear()
				.moveTo(-7, 3 + w)
				.quadraticCurveTo(0, -3.5, 7, 3 - w)
				.stroke({ color: MAMA.mouth.dark, width: 2.4, cap: 'round' });
			this.frown.position.set(mx, my + 5);
			this.frown.alpha = sd;
			this.frown.scale.set(0.7 + 0.3 * sd);
		}
		// Extra blush with joy, over the painted cheeks.
		const bl = this.blush.clear();
		if (joy > 0.02)
			for (const [cx, cy] of [
				[94, 126],
				[188, 103],
			]) {
				const [x, y] = this.warp(cx, cy, m);
				for (let i = 0; i < 4; i++) bl.ellipse(x, y, 15 - i * 3, 9 - i * 1.8).fill({ color: '#ff3d8b', alpha: 0.09 * joy });
			}
		// The sweat drop slides down her right temple, again and again, while she frets.
		// No sweat drop (user, 2026-10-27: "its not cool").
		this.sweat.visible = false;
		if (this.sweat.visible) {
			const k = (now % 1300) / 1300;
			const [x, y] = this.warp(181, 60, m);
			this.sweat.position.set(x + 2 * k, y + 16 * k);
			this.sweat.alpha = Math.min(1, (fr - 0.3) * 2) * (k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25);
			this.sweat.scale.set(1 + 0.4 * Math.min(1, k * 4));
		}
		this.frameEyes(now, m, joy, fr);
		this.figure.visible = this.riseAt !== Infinity;
	}

	private frameSpills(now: number, dt: number, beat: number, gd: number, m: { sx: number; sy: number; lean: number; shiver: number }) {
		const n = Math.round(beat);
		if (gd > 0.5 && n !== this.lastLand && Math.abs(beat - n) < 0.12) {
			this.lastLand = n;
			if (n % 2 === 0) {
				// Where her crown is this frame, on screen (root's bob included).
				const [cx, cy] = this.warp(CROWN.x, CROWN.y, m);
				const y0 = cy - this.root.pivot.y;
				const count = 3 + Math.floor(Math.random() * 2);
				for (let i = 0; i < count; i++) {
					const r = 5.5 + Math.random() * 3.5;
					const c = SPILL_COLORS[Math.floor(Math.random() * SPILL_COLORS.length)];
					const g = new Graphics()
						.circle(0, 0, r)
						.fill(c)
						.stroke({ width: 0.9, color: '#3a1360', alpha: 0.35 })
						.circle(-r * 0.35, -r * 0.4, r * 0.32)
						.fill({ color: '#ffffff', alpha: 0.85 });
					const side = (i % 2 ? 1 : -1) * (0.4 + Math.random() * 0.6);
					this.fx.addChild(g);
					this.spills.push({ g, x: cx + side * 6, y: y0, vx: side * 0.09, vy: -0.2 - Math.random() * 0.07, at: now });
				}
			}
		}
		for (let i = this.spills.length - 1; i >= 0; i--) {
			const d = this.spills[i];
			const t = (now - d.at) / SPILL_MS;
			if (t >= 1) {
				d.g.destroy();
				this.spills.splice(i, 1);
				continue;
			}
			d.vy += SPILL_G * dt;
			d.x += d.vx * dt;
			d.y += d.vy * dt;
			d.g.position.set(d.x, d.y);
			// Stretched along its fall, popping in and fading over its last 35%.
			const st = Math.min(0.35, Math.abs(d.vy) * 0.9);
			d.g.scale.set((1 - st * 0.4) * Math.min(1, t * 8), (1 + st) * Math.min(1, t * 8));
			d.g.rotation = Math.atan2(d.vy, d.vx) - Math.PI / 2;
			d.g.alpha = Math.min(1, (1 - t) / 0.35);
		}
	}

	// Paws: they stay on her belly and move in place only: patting, bouncing for joy on a win,
	// a little wave, and clutched up to her chest while she can't watch.
	private framePaws(now: number, m: { sx: number; sy: number; lean: number; shiver: number }) {
		const still = this.reduced;
		// Clasped at her chest: while she can't watch, and (a little less) while she hopes.
		const c = Math.max(this.cover, 0.8 * this.edge);
		// Dancing, the paws pump the way they do for a win, a little less.
		const k = Math.max(this.clap, 0.7 * this.groove * (1 - this.fright)) * (1 - c);
		// Peeking: her eyes open a crack for a moment, every PEEK_MS.
		this.peek = still || this.cover < 0.5 ? 0 : Math.max(0, Math.sin(((now - this.fearAt - COVER_AFTER_MS) / PEEK_MS) * Math.PI * 2 - Math.PI / 2)) ** 2;
		const bounce = still ? 1 : Math.abs(Math.sin((now / CLAP_MS) * Math.PI));
		for (const p of this.paws) {
			const dir = p.side === 'L' ? -1 : 1;
			// Patting: a small lift and tilt, the two paws taking turns.
			const pat = still ? 0 : Math.max(0, Math.sin((now / 1300) * Math.PI + (p.side === 'L' ? 0 : Math.PI))) ** 6;
			let x = p.cx;
			let y = p.cy - 2.2 * pat * (1 - k) * (1 - c);
			let r = dir * 0.07 * pat * (1 - k) * (1 - c);
			// A win: both paws hop on her belly, out of step, tilting in.
			const off = p.side === 'L' ? bounce : Math.abs(Math.cos((now / CLAP_MS) * Math.PI));
			y -= k * (2 + 6 * (still ? 0 : off));
			r -= k * dir * 0.18 * off;
			// A wave: the right paw lifts a little and rocks about its wrist.
			if (p.side === 'R' && this.waveAmt > 0) {
				const w = this.waveAmt;
				y -= 7 * w;
				r += w * (-0.25 + 0.3 * Math.sin(this.wavePhase * Math.PI * 7));
			}
			// Clutched: drawn up and in to her chest, tight, trembling a little.
			x -= c * dir * 6;
			y -= c * (9 - 3 * this.peek);
			// Let down, they slide down her belly.
			y += 3 * this.sad;
			r -= c * dir * 0.22;
			if (!still) y += this.cover * 0.8 * Math.sin(now * 0.09 + (p.side === 'L' ? 0 : 1.7));
			const [wx, wy] = this.warp(x, y, m);
			const scale = 1 + 0.04 * c;
			if (p.side === 'R' && this.arm) {
				// Each vertex: where the paw's move takes it, blended toward its own place on her
				// body from the fist up to the shoulder, where it stays put (no seam to open).
				const { mesh, rest } = this.arm;
				const pos = mesh.geometry.positions;
				const top = PARTS['paw-R'].y;
				const cos = Math.cos(r) * scale;
				const sin = Math.sin(r) * scale;
				for (let i = 0; i < pos.length; i += 2) {
					const vx = rest[i] - p.cx;
					const vy = rest[i + 1] - p.cy;
					const t = Math.max(0, Math.min(1, (rest[i + 1] - top) / (p.cy - top)));
					const w = t * t * (3 - 2 * t);
					const [bx, by] = this.warp(rest[i], rest[i + 1], m);
					pos[i] = bx + (wx + cos * vx - sin * vy - bx) * w;
					pos[i + 1] = by + (wy + sin * vx + cos * vy - by) * w;
				}
				mesh.geometry.getBuffer('aPosition').update();
				continue;
			}
			p.s.position.set(wx, wy);
			p.s.rotation = r;
			p.s.scale.set(Math.sign(p.s.scale.x) * Math.abs((PARTS[`paw-${p.side}`].w / p.s.texture.width) * scale), (PARTS[`paw-${p.side}`].h / p.s.texture.height) * scale);
		}
	}

	private frameEyes(now: number, m: { sx: number; sy: number; lean: number; shiver: number }, joy: number, fr: number) {
		const still = this.reduced;
		// Blinks: every 2.5–5s, sometimes twice; never through the ^^ squint.
		if (now > this.blinkAt + BLINK_MS) {
			this.twice = !this.twice && Math.random() < 0.25;
			this.blinkAt = now + (this.twice ? 260 : 2500 + Math.random() * 2500);
		}
		const bt = (now - this.blinkAt) / BLINK_MS;
		// No blinking while she frets: she stares, wide-eyed.
		const blink = still || fr > 0.3 || this.edge > 0.5 || bt < 0 || bt > 1 ? 0 : Math.sin(bt * Math.PI);
		// Pupils: stare where told (or at the board while frightened), else glance about.
		const L = this.look;
		if (this.gaze) {
			L.tx = this.gaze.x;
			L.ty = this.gaze.y;
		} else if (fr > 0.5 || this.edge > 0.3 || this.curious > 0.3) {
			L.tx = 1;
			L.ty = this.curious > 0.3 ? 0.35 : 0.1;
		} else if (now > L.next) {
			const r = Math.random();
			[L.tx, L.ty] = r < 0.4 ? [0, 0] : r < 0.7 ? [0.9, 0.2] : r < 0.85 ? [-0.8, 0.3] : [0.3, -0.7];
			L.next = now + 1400 + Math.random() * 2200;
		}
		if (joy > 0.5) [L.tx, L.ty] = [0, -0.4];
		else if (this.sad > 0.3) [L.tx, L.ty] = [0.15, 0.8];
		// Peeking through shut eyes: the slit opens at the eye's foot, so the pupils drop into it
		// (looking up at the tile they hid behind the lid and left a white slit).
		if (this.cover > 0.5) [L.tx, L.ty] = [L.tx * 0.5, 0.9];
		L.x = smooth(L.x, L.tx, 16, 45);
		L.y = smooth(L.y, L.ty, 16, 45);
		for (const ev of this.eyes) {
			const { e } = ev;
			const [x, y] = this.warp(e.cx, e.cy, m);
			ev.c.position.set(x, y);
			// Wide with fright.
			const wide = 1 + 0.1 * fr + 0.07 * this.edge;
			// The dance's squash would pinch the eyes every beat: they take only a little of it.
			const ek = 1 - 0.75 * this.groove;
			ev.c.scale.set((1 + (m.sx - 1) * ek) * wide, (1 + (m.sy - 1) * ek) * wide);
			const ew = e.right - e.left;
			const eh = e.bottom - e.top;
			const ip = PARTS[`iris-${e.side}`];
			const ir = 1 - 0.3 * fr;
			ev.iris.width = ip.w * ir;
			ev.iris.height = ip.h * ir;
			const reach = (1 - ir * 0.75) * 0.5;
			ev.iris.position.set(ip.x + ip.w / 2 + L.x * ew * 0.16 + L.x * ew * reach * 0.3, ip.y + ip.h / 2 + L.y * eh * 0.14);
			// Upper lid down for a blink, lower lid up into a ^^ smile.
			// Shut tight while she can't watch, opening a crack to peek.
			// Dancing (bonus) her eyes stay open: no let-down droop, no ^^ squint (held through the
			// round's wins it read as odd eyes); blinks only.
			const calm = 1 - this.groove;
			const top = Math.max(blink, this.cover * (1 - 0.55 * this.peek), 0.42 * this.sad * calm);
			const up = (still ? joy * 0.4 : joy * 0.55) * calm;
			const key = `${top.toFixed(3)},${up.toFixed(3)}`;
			if (key !== ev.key) {
				ev.key = key;
				const g = ev.lid.clear();
				// Shut, the lid reaches past the eye's foot; the lash line rides its edge.
				const lidY = e.top + (e.bottom + 3 - e.top) * top;
				const big = ev.hull.map(([px, py]) => [e.cx + (px - e.cx) * 1.08, e.cy + (py - e.cy) * 1.08] as Pt);
				if (top > 0.01) {
					// Its edge bows like the lash line riding it (ends lower than the middle),
					// flattening as it shuts: a straight edge left white slivers under the arc.
					const bow = eh * 0.22 * Math.min(1, top * 4) * (1 - top);
					const edge: Pt[] = [];
					for (let i = 10; i >= 0; i--) {
						const t = i / 10;
						edge.push([e.left - 4 + (ew + 8) * t, lidY + bow * (1 - Math.sin(t * Math.PI))]);
					}
					const shape = clipConvex([[e.left - 4, e.top - 6], [e.right + 4, e.top - 6], ...edge], big);
					if (shape.length > 2) g.poly(flat(shape), true).fill(e.lid);
				}
				if (up > 0.01) {
					const yTop = e.bottom - eh * up;
					const arc: Pt[] = [];
					for (let i = 0; i <= 10; i++) {
						const t = i / 10;
						arc.push([e.left - 4 + (ew + 8) * t, yTop + eh * 0.22 * up * (1 - Math.sin(t * Math.PI)) * 2]);
					}
					arc.push([e.right + 4, e.bottom + 6], [e.left - 4, e.bottom + 6]);
					const shape = clipConvex(arc, big);
					if (shape.length > 2) g.poly(flat(shape), true).fill(e.lid);
				}
			}
			// The lash line rides the lid down (a blink, eyes shut tight, a let-down droop) and turns
			// over in the last half of the way: shut, its lashes hang down. Riding the blink alone,
			// it stayed up while the lid shut under it (white bands under the arc).
			const flip = EASE_IN_OUT(Math.max(0, (top - 0.5) / 0.5));
			ev.lash.y = e.top + 3 + (e.bottom - 4 - e.top) * top;
			ev.lash.scale.y = (PARTS[`lash-${e.side}`].h / ev.lash.texture.height) * (1 - 1.6 * flip);
		}
	}

	destroy() {
		this.destroyed = true;
		this.unwatchMotion?.();
		removeEventListener('resize', this.onResize);
		this.resizeObs?.disconnect();
		this.pixi.destroy();
	}
}

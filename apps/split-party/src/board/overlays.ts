// The board's DOM overlays, drawn on the board canvas: each cluster's win pill with its
// confetti (.cluster-pop). Same sizes, colours and keyframes as the CSS.
import { Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { bezier, keyframes, type Frame } from './anim';
import { CELL_W, CELL_H, GRID_H, GRID_W, GRID_X, GRID_Y, cellX, cellY } from './geometry';
import { DISPOSE } from './pixiApp';
import { BLOB_TINT, shade } from '../lib/premium';

export type ClusterPop = { id: number; x: number; y: number; amount: string; s?: number; symbol?: string };

const TEX_RES = 3;
function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
	const c = document.createElement('canvas');
	c.width = Math.ceil(w * TEX_RES);
	c.height = Math.ceil(h * TEX_RES);
	const ctx = c.getContext('2d')!;
	ctx.scale(TEX_RES, TEX_RES);
	draw(ctx);
	return Texture.from(c);
}
const measure = (font: string, text: string) => {
	const ctx = document.createElement('canvas').getContext('2d')!;
	ctx.font = font;
	return ctx.measureText(text).width;
};

// ---- Cluster pop ------------------------------------------------------------------------------

const PILL_FONT = "400 22px 'Coiny', sans-serif";
const PILL_H = 2 + 22 * 1.3;
const PILL_PAD = 24;
const PILL_MARGIN = 24;
const AMOUNT: Frame<{ a: number; ty: number; s: number }>[] = [
	[0, { a: 0, ty: 14, s: 0.3 }],
	[0.22, { a: 1, ty: -6, s: 1.12 }],
	[0.36, { a: 1, ty: -10, s: 1 }],
	[0.8, { a: 1, ty: -10, s: 1 }],
	[1, { a: 0, ty: -26, s: 0.9 }],
];
const C_SPRING = bezier(0.3, 1.5, 0.5, 1);
const C_SPARK = bezier(0.15, 0.7, 0.4, 1);
const SPARK_A: Frame<{ v: number }>[] = [
	[0, { v: 1 }],
	[0.65, { v: 1 }],
	[1, { v: 0 }],
];
// App's SPARKS: 16 confetti dots thrown out round the cluster's centre, in the winning blob's
// colour, a lighter tint of it and white.
const SPARKS = Array.from({ length: 16 }, (_, i) => {
	const a = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
	const d = 58 + (i % 3) * 22;
	return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, tone: i % 3, s: 8 + (i % 3) * 3 };
});
export const sparkColor = (c: string, tone: number) => (tone === 0 ? c : tone === 1 ? shade(c, 0.45) : '#ffffff');
const DRIP = 9;
// The win amount on a drop of the winning blob's jelly: its colour lit from the top, a dark
// rim of it, a gloss streak, and a drip hanging off the underside (the blobs' own material,
// where the old pill was the UI's purple).
function pillTexture(label: string, color: string) {
	const w = measure(PILL_FONT, label) + PILL_PAD;
	const m = PILL_MARGIN;
	const h = PILL_H;
	const r = h / 2;
	const ink = shade(color, -0.62);
	const tex = canvasTexture(w + 2 * m, h + DRIP + 2 * m, (ctx) => {
		ctx.translate(m, m);
		const body = () => {
			ctx.beginPath();
			ctx.roundRect(0, 0, w, h, r);
			// The drip: a bead hanging from a third of the way along the underside.
			const dx = w * 0.68;
			ctx.moveTo(dx - 7, h - 1);
			ctx.bezierCurveTo(dx - 4, h + 2, dx - 4.5, h + DRIP - 4, dx, h + DRIP);
			ctx.bezierCurveTo(dx + 4.5, h + DRIP - 4, dx + 4, h + 2, dx + 7, h - 1);
		};
		// Canvas shadows are in device pixels.
		ctx.save();
		ctx.shadowColor = 'rgba(10,6,30,.55)';
		ctx.shadowBlur = 12 * TEX_RES;
		ctx.shadowOffsetY = 4 * TEX_RES;
		body();
		ctx.fillStyle = ink;
		ctx.fill();
		ctx.restore();
		ctx.save();
		ctx.translate(2, 2);
		ctx.scale((w - 4) / w, (h - 4) / h);
		body();
		const g = ctx.createLinearGradient(0, 0, 0, h + DRIP);
		g.addColorStop(0, shade(color, 0.42));
		g.addColorStop(0.45, color);
		g.addColorStop(1, shade(color, -0.28));
		ctx.fillStyle = g;
		ctx.fill();
		ctx.restore();
		// Gloss: a soft streak along the top, a dot at the left end.
		ctx.beginPath();
		ctx.roundRect(r * 0.7, 3.5, w - r * 1.6, h * 0.24, h * 0.12);
		ctx.fillStyle = 'rgba(255,255,255,.42)';
		ctx.fill();
		ctx.beginPath();
		ctx.arc(r * 0.55, h * 0.3, 2.2, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,.7)';
		ctx.fill();
		ctx.font = PILL_FONT;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		const ty = 2 + (22 * 1.3) / 2;
		ctx.lineJoin = 'round';
		ctx.lineWidth = 5;
		ctx.strokeStyle = ink;
		ctx.strokeText(label, w / 2, ty + 1.5);
		ctx.fillStyle = ink;
		ctx.fillText(label, w / 2, ty + 2.5);
		ctx.fillStyle = '#fff';
		ctx.fillText(label, w / 2, ty);
	});
	return { tex, w };
}

// ---- Scatter tease ---------------------------------------------------------------------------

/** A column held back while the eggs could still add up (ms from the wave's start). */
export type Tease = { col: number; from: number; to: number };
const TEASE_IN = 180;
const TEASE_OUT = 260;
const TEASE_BUBBLES = 10;
const GRID_COL_H = cellY(6) + CELL_H - cellY(0);
const COL_W = CELL_W + 8;
const COL_H = GRID_COL_H + 8;
// Light bands running down the column, one every BEAM_PERIOD px (tiled).
const BEAM_PERIOD = 150;
// The spotlight's dim stops this far either side of the teased column.
const GAP_DIM = 4;
// The waiting column's rim: a thick gold frame with a white inner line and a pink halo (the
// lit pad's colours), no fill, so the empty pads and the light inside read through.
function teaseRim() {
	const m = 30;
	return canvasTexture(COL_W + 2 * m, COL_H + 2 * m, (ctx) => {
		ctx.translate(m, m);
		// The wide pink halo first, then the gold frame with its own tighter glow.
		ctx.save();
		ctx.shadowColor = '#fa52e5';
		ctx.shadowBlur = 30 * TEX_RES;
		ctx.lineWidth = 8;
		ctx.strokeStyle = 'rgba(250,82,229,.85)';
		for (let i = 0; i < 2; i++) {
			ctx.beginPath();
			ctx.roundRect(0, 0, COL_W, COL_H, 14);
			ctx.stroke();
		}
		ctx.restore();
		ctx.save();
		ctx.shadowColor = '#ffe066';
		ctx.shadowBlur = 10 * TEX_RES;
		ctx.lineWidth = 5;
		ctx.strokeStyle = '#fece06';
		// Three passes: one shadow pass is a faint halo at this blur.
		for (let i = 0; i < 3; i++) {
			ctx.beginPath();
			ctx.roundRect(2.5, 2.5, COL_W - 5, COL_H - 5, 13);
			ctx.stroke();
		}
		ctx.restore();
		ctx.lineWidth = 1.6;
		ctx.strokeStyle = '#fffbe0';
		ctx.beginPath();
		ctx.roundRect(4.6, 4.6, COL_W - 9.2, COL_H - 9.2, 10);
		ctx.stroke();
	});
}
// One light band: bright in the middle of the column, fading to its sides and along its length.
function teaseBeam() {
	const w = COL_W;
	return canvasTexture(w, BEAM_PERIOD, (ctx) => {
		const v = ctx.createLinearGradient(0, 0, 0, BEAM_PERIOD);
		v.addColorStop(0, 'rgba(250,82,229,0)');
		v.addColorStop(0.3, 'rgba(250,82,229,.5)');
		v.addColorStop(0.45, 'rgba(254,206,6,.85)');
		v.addColorStop(0.52, 'rgba(255,255,240,1)');
		v.addColorStop(0.62, 'rgba(254,206,6,.6)');
		v.addColorStop(1, 'rgba(254,206,6,0)');
		ctx.fillStyle = v;
		ctx.fillRect(0, 0, w, BEAM_PERIOD);
		ctx.globalCompositeOperation = 'destination-in';
		const h = ctx.createLinearGradient(0, 0, w, 0);
		h.addColorStop(0, 'rgba(0,0,0,.45)');
		h.addColorStop(0.5, 'rgba(0,0,0,1)');
		h.addColorStop(1, 'rgba(0,0,0,.45)');
		ctx.fillStyle = h;
		ctx.fillRect(0, 0, w, BEAM_PERIOD);
	});
}
// A pad lighting up as the chase runs down the column: a gold inner glow on the pad's shape.
function teasePad() {
	const m = 4;
	return canvasTexture(CELL_W + 2 * m, CELL_H + 2 * m, (ctx) => {
		ctx.translate(m, m);
		const g = ctx.createRadialGradient(CELL_W / 2, CELL_H / 2, 4, CELL_W / 2, CELL_H / 2, CELL_W * 0.62);
		g.addColorStop(0, 'rgba(255,224,102,.75)');
		g.addColorStop(0.55, 'rgba(254,170,40,.45)');
		g.addColorStop(1, 'rgba(250,82,229,.7)');
		ctx.beginPath();
		ctx.roundRect(0, 0, CELL_W, CELL_H, 8);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 2;
		ctx.strokeStyle = '#fece06';
		ctx.stroke();
	});
}
// A soap bubble rising up the column: a thin bright ring, a faint fill and a glint.
function teaseBubble() {
	const r = 8;
	return canvasTexture(2 * r + 2, 2 * r + 2, (ctx) => {
		ctx.translate(r + 1, r + 1);
		ctx.beginPath();
		ctx.arc(0, 0, r - 0.8, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255,255,255,.14)';
		ctx.fill();
		ctx.lineWidth = 1.4;
		ctx.strokeStyle = 'rgba(255,255,255,.9)';
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
		ctx.fillStyle = '#fff';
		ctx.fill();
	});
}
// ---- Layer ------------------------------------------------------------------------------------

type Pop = { root: Container; pill: Sprite; sparks: Graphics[]; start: number; k: number };

export class Overlays {
	pops = new Container();
	private popViews = new Map<number, Pop>();
	tease = new Container();
	private teaseTex: Texture[] = [];
	private teaseView: {
		rim: Sprite;
		beam: TilingSprite;
		pads: Sprite[];
		bubbles: Sprite[];
		dim: Graphics;
		dimCol: number;
	} | null = null;
	private teasing: { start: number; spans: Tease[] } | null = null;

	/** The wave's teased columns (or none), timed from `start`. */
	setTease(start: number, spans: Tease[]) {
		this.teasing = spans.length ? { start, spans } : null;
		if (!this.teasing || this.teaseView) return;
		const [rimTex, beamTex, padTex, bubbleTex] = (this.teaseTex = [teaseRim(), teaseBeam(), teasePad(), teaseBubble()]);
		const sprite = (t: Texture) => {
			const s = new Sprite(t);
			s.scale.set(1 / TEX_RES);
			s.anchor.set(0.5);
			return s;
		};
		// Back to front: the chasing pads, the light running down (clipped to the column's
		// rounded box), the rising bubbles, then the rim over it all.
		const pads = Array.from({ length: 7 }, () => sprite(padTex));
		const beam = new TilingSprite({ texture: beamTex, width: COL_W * TEX_RES, height: COL_H * TEX_RES });
		beam.scale.set(1 / TEX_RES);
		const clip = new Graphics().roundRect(0, 0, COL_W, COL_H, 13).fill('#fff');
		beam.mask = clip;
		const bubbles = Array.from({ length: TEASE_BUBBLES }, () => sprite(bubbleTex));
		const rim = sprite(rimTex);
		// The rest of the board's pads dim (under the blobs, which stay bright), a spotlight.
		const dim = new Graphics();
		this.tease.addChild(dim, ...pads, beam, clip, ...bubbles, rim);
		this.teaseView = { rim, beam, pads, bubbles, dim, dimCol: -1 };
		this.teaseClip = clip;
	}
	private teaseClip: Graphics | null = null;
	/** Whether a column is being teased right now (the board pulses the landed eggs meanwhile). */
	teaseActive(now: number) {
		const t = this.teasing;
		return !!t && t.spans.some((s) => now >= t.start + s.from && now < t.start + s.to);
	}
	update(now: number, pops: ClusterPop[]) {
		// Cluster pops live until App clears them.
		const ids = new Set(pops.map((p) => p.id));
		for (const [id, v] of this.popViews)
			if (!ids.has(id)) {
				v.pill.texture.destroy(true);
				v.root.destroy(DISPOSE);
				this.popViews.delete(id);
			}
		for (const p of pops) {
			if (this.popViews.has(p.id)) continue;
			const root = new Container();
			root.position.set(GRID_X + p.x * GRID_W, GRID_Y + p.y * GRID_H);
			const color = BLOB_TINT[p.symbol ?? ''] ?? '#9a78f2';
			const sparks = SPARKS.map((k) => {
				const g = new Graphics().circle(0, 0, k.s / 2).fill(sparkColor(color, k.tone));
				root.addChild(g);
				return g;
			});
			const t = pillTexture(p.amount, color);
			const pill = new Sprite(t.tex);
			pill.scale.set(1 / TEX_RES);
			// Centred on the pill, not on the pill plus its drip.
			pill.anchor.set(0.5, (PILL_MARGIN + PILL_H / 2) / (PILL_H + DRIP + 2 * PILL_MARGIN));
			root.addChild(pill);
			this.pops.addChild(root);
			this.popViews.set(p.id, { root, pill, sparks, start: now, k: p.s ?? 1 });
		}
	}

	private tickTease(now: number, reduced: boolean) {
		const t = this.teasing;
		const v = this.teaseView;
		if (!v) return;
		// The span on now, else the one just ended (fading out). Spans run back to back, so the
		// live one must win or the next column would wait out the last one's fade.
		const span =
			t?.spans.find((s) => now >= t.start + s.from && now < t.start + s.to) ??
			t?.spans.find((s) => now >= t.start + s.to && now < t.start + s.to + TEASE_OUT);
		this.tease.visible = !!span;
		if (!t || !span) return;
		const local = now - t.start - span.from;
		const len = span.to - span.from;
		const fade = Math.min(1, local / TEASE_IN) * (local > len ? Math.max(0, 1 - (local - len) / TEASE_OUT) : 1);
		// It builds while the column waits: the light runs and the chase steps faster.
		const k = Math.min(1, local / len);
		const x = cellX(span.col) + CELL_W / 2;
		const y = cellY(0) + GRID_COL_H / 2;
		const left = x - COL_W / 2;
		const top = y - COL_H / 2;
		const pulse = reduced ? 1 : 0.5 + 0.5 * Math.sin((now / 260) * Math.PI);
		if (v.dimCol !== span.col) {
			v.dimCol = span.col;
			const l = cellX(span.col) - GAP_DIM;
			const r = cellX(span.col) + CELL_W + GAP_DIM;
			v.dim.clear();
			if (l > GRID_X) v.dim.rect(GRID_X, GRID_Y, l - GRID_X, GRID_H);
			if (r < GRID_X + GRID_W) v.dim.rect(r, GRID_Y, GRID_X + GRID_W - r, GRID_H);
			v.dim.fill('#0d0420');
		}
		v.dim.alpha = fade * 0.42;
		v.rim.position.set(x, y);
		v.rim.alpha = fade * (0.8 + 0.2 * pulse);
		v.rim.scale.set((1 + 0.012 * pulse) / TEX_RES);
		this.teaseClip!.position.set(left, top);
		v.beam.position.set(left, top);
		v.beam.visible = !reduced;
		// px/ms down the column, 0.3 rising to 0.75.
		v.beam.tilePosition.y = ((local * (0.3 + 0.225 * k)) % BEAM_PERIOD) * TEX_RES;
		v.beam.alpha = fade * 0.55;
		// The chase: a lit pad runs top to bottom with a short trail, ever quicker.
		const period = 760 - 360 * k;
		const head = reduced ? -1 : (local / period) % 1;
		v.pads.forEach((p, row) => {
			p.position.set(x, cellY(row) + CELL_H / 2);
			const behind = (((head - row / 7) % 1) + 1) % 1;
			p.alpha = fade * (reduced ? 0.35 : 0.15 + 0.85 * Math.max(0, 1 - behind * 4.5));
		});
		// Bubbles rise up the column on their own loops, wobbling, and pop at the top.
		v.bubbles.forEach((b, i) => {
			const cyc = 1500 + (i % 4) * 330;
			const p = (((now + i * 431) % cyc) + cyc) % cyc / cyc;
			b.visible = !reduced;
			b.position.set(x + Math.sin(i * 2.1 + p * 7) * CELL_W * 0.28, top + COL_H * (0.97 - 0.94 * p));
			const size = 0.45 + (i % 3) * 0.22;
			const pop = p > 0.9 ? (p - 0.9) / 0.1 : 0;
			b.scale.set((size * (1 + 0.6 * pop)) / TEX_RES);
			b.alpha = fade * Math.min(1, p * 6) * (1 - pop);
		});
	}

	tick(now: number, reduced: boolean) {
		this.tickTease(now, reduced);
		for (const v of this.popViews.values()) {
			const p = reduced ? 0.5 : Math.min(1, (now - v.start) / 1500);
			const a = keyframes(AMOUNT, p, C_SPRING);
			v.pill.alpha = a.a;
			v.pill.scale.set((a.s * v.k) / TEX_RES);
			v.pill.position.set(0, a.ty);
			const sp = reduced ? 1 : Math.min(1, (now - v.start) / 1100);
			const e = C_SPARK(sp);
			const alpha = keyframes(SPARK_A, sp, C_SPARK).v;
			v.sparks.forEach((g, i) => {
				const k = SPARKS[i];
				g.position.set(k.dx * e, (k.dy + 24) * e);
				g.scale.set(1 - 0.6 * e);
				g.alpha = reduced ? 0 : alpha;
			});
		}
	}

	destroy() {
		for (const t of this.teaseTex) t.destroy(true);
		for (const v of this.popViews.values()) v.pill.texture.destroy(true);
	}
}

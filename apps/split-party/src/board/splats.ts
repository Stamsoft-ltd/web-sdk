// A winning blob's pop bursts into jelly: a soft flash, a ring of goo spreading over its tile and a
// spray of droplets in its colour that arc out under gravity, wobble and shrink away. Drawn once
// into white textures and tinted per blob; sprites are pooled (a full-board win pops 49 at once).
import { Container, Sprite, Texture } from 'pixi.js';
import { BLOB_TINT, shade } from '../lib/premium';

const TEX_RES = 3;
const G = 900; // board px/s²
const DROPS = 9;
const DROP_MS = [520, 760];
const RING_MS = 380;
const FLASH_MS = 220;
const MAX = 700;

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, r: number) => void) {
	const c = document.createElement('canvas');
	c.width = c.height = Math.ceil(size * TEX_RES);
	const ctx = c.getContext('2d')!;
	ctx.scale(TEX_RES, TEX_RES);
	draw(ctx, size / 2);
	return Texture.from(c);
}
// A glossy drop: body a shade under white so the tint reads, a white highlight top-left.
const dropTexture = () =>
	canvasTexture(24, (ctx, r) => {
		const g = ctx.createRadialGradient(r * 0.8, r * 0.75, 0, r, r, r);
		g.addColorStop(0, '#ffffff');
		g.addColorStop(0.55, '#e4e4e4');
		g.addColorStop(0.92, '#a8a8a8');
		g.addColorStop(1, 'rgba(168,168,168,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(r, r, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = 'rgba(255,255,255,.95)';
		ctx.beginPath();
		ctx.ellipse(r * 0.68, r * 0.6, r * 0.26, r * 0.17, -0.6, 0, Math.PI * 2);
		ctx.fill();
	});
const ringTexture = () =>
	canvasTexture(96, (ctx, r) => {
		const g = ctx.createRadialGradient(r, r, r * 0.55, r, r, r);
		g.addColorStop(0, 'rgba(255,255,255,0)');
		g.addColorStop(0.55, 'rgba(255,255,255,.9)');
		g.addColorStop(0.8, 'rgba(255,255,255,.5)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 2 * r, 2 * r);
	});
const flashTexture = () =>
	canvasTexture(96, (ctx, r) => {
		const g = ctx.createRadialGradient(r, r, 0, r, r, r);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.4, 'rgba(255,255,255,.55)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 2 * r, 2 * r);
	});

type Bit =
	| { kind: 'drop'; s: Sprite; at: number; ms: number; x: number; y: number; vx: number; vy: number; r: number; spin: number }
	| { kind: 'ring' | 'flash'; s: Sprite; at: number; ms: number; size: number };

export class Splats {
	readonly root = new Container();
	private tex = { drop: dropTexture(), ring: ringTexture(), flash: flashTexture() };
	private live: Bit[] = [];
	private pool: Sprite[] = [];

	get textures() {
		return Object.values(this.tex);
	}

	private sprite(t: Texture) {
		const s = this.pool.pop() ?? new Sprite();
		s.texture = t;
		s.anchor.set(0.5);
		s.visible = true;
		s.rotation = 0;
		this.root.addChild(s);
		return s;
	}

	/** A blob at (x, y) (its tile's centre, board px) pops now. */
	burst(x: number, y: number, symbol: string, now: number) {
		if (this.live.length > MAX) return;
		const color = BLOB_TINT[symbol] ?? '#f782fe';
		const flash = this.sprite(this.tex.flash);
		flash.position.set(x, y);
		flash.tint = shade(color, 0.6);
		flash.blendMode = 'add';
		this.live.push({ kind: 'flash', s: flash, at: now, ms: FLASH_MS, size: 110 });
		const ring = this.sprite(this.tex.ring);
		ring.position.set(x, y);
		ring.tint = shade(color, 0.25);
		ring.blendMode = 'normal';
		this.live.push({ kind: 'ring', s: ring, at: now, ms: RING_MS, size: 120 });
		for (let i = 0; i < DROPS; i++) {
			// Mostly up and out, like goo flicked off a spoon; one or two fall straight off.
			const a = -Math.PI / 2 + (i / (DROPS - 1) - 0.5) * 2.6 + (Math.random() - 0.5) * 0.4;
			const v = 150 + Math.random() * 150;
			const s = this.sprite(this.tex.drop);
			// Lifted toward white: candy goo, never a red splatter.
			s.tint = shade(color, i % 3 === 2 ? 0.5 : 0.22);
			s.blendMode = 'normal';
			const r = 3.8 + Math.random() * 4.6;
			this.live.push({
				kind: 'drop',
				s,
				at: now + Math.random() * 40,
				ms: DROP_MS[0] + Math.random() * (DROP_MS[1] - DROP_MS[0]),
				x: x + Math.cos(a) * 12,
				y: y + Math.sin(a) * 10,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v - 60,
				r,
				spin: (Math.random() - 0.5) * 8,
			});
		}
	}

	tick(now: number) {
		let n = 0;
		for (const b of this.live) {
			const t = now - b.at;
			const p = t / b.ms;
			if (p >= 1) {
				b.s.visible = false;
				b.s.removeFromParent();
				this.pool.push(b.s);
				continue;
			}
			this.live[n++] = b;
			if (t < 0) {
				b.s.visible = false;
				continue;
			}
			b.s.visible = true;
			if (b.kind === 'drop') {
				const sec = t / 1000;
				b.s.position.set(b.x + b.vx * sec, b.y + b.vy * sec + 0.5 * G * sec * sec);
				// Stretched along its flight, wobbling as it goes; shrinks away in the last third.
				const vy = b.vy + G * sec;
				const speed = Math.hypot(b.vx, vy);
				const k = (1 - Math.max(0, (p - 0.6) / 0.4)) * (2 * b.r) / (24 * TEX_RES);
				const st = 1 + Math.min(0.5, speed / 900) + 0.08 * Math.sin(t / 45 + b.spin);
				b.s.rotation = Math.atan2(vy, b.vx) + Math.PI / 2;
				b.s.scale.set(k / Math.sqrt(st), k * st);
				b.s.alpha = 1;
			} else if (b.kind === 'ring') {
				const e = 1 - (1 - p) ** 3;
				const k = ((0.35 + 0.75 * e) * b.size) / (96 * TEX_RES);
				b.s.scale.set(k, k * 0.82);
				b.s.alpha = 0.85 * (1 - p) ** 1.5;
			} else {
				const k = ((0.6 + 0.6 * p) * b.size) / (96 * TEX_RES);
				b.s.scale.set(k);
				b.s.alpha = 0.9 * (1 - p) ** 2;
			}
		}
		this.live.length = n;
	}

	destroy() {
		for (const s of this.pool) s.destroy();
		this.root.destroy({ children: true });
		for (const t of Object.values(this.tex)) t.destroy(true);
	}
}

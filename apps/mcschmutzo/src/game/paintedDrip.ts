import { PIXI } from 'pixi-svelte';

// The painted sauce drip (same look + motion as CardDrip's free-fall mode on the turn / buy-bonus
// buttons) for pixi scenes: the drip is redrawn from the PAINTED pixels of a sauce-only texture —
// it oozes longer, a neck thins above the heavy end, the end lets go as a teardrop that falls with
// gravity and fades, and the stub springs back into the painted rest pose. Every slice is a
// texture-filled rect (Graphics fill with a texture matrix), so shading / outline / gloss are the
// art's own.

export type PaintedTendril = {
	cx: number; // tendril centre x (source px)
	tip: number; // lowest pixel of the painted end (source px)
	bulb: number; // height of the painted end (source px)
	half: number; // half-width of the slice (covers the tube + outline, not its neighbours)
	reach: number; // how far it oozes before pinching (source px)
	run: number; // how far the drop falls (source px)
	period: number; // ms per drip
	phase: number; // ms offset
	dropStretch?: number; // falling drop's height × this (wide, shallow ends read as round drops)
	dropNarrow?: number; // …and its width × this
};

type Gfx = {
	rect: (x: number, y: number, w: number, h: number) => { fill: (s: object) => unknown };
};

const ease = (q: number) => q * q * (3 - 2 * q);
const PINCH_AT = 0.5;
const neckG = (f: number) =>
	f < PINCH_AT ? ease(f / PINCH_AT) : 1 - Math.sin((Math.PI / 2) * ((f - PINCH_AT) / (1 - PINCH_AT)));

/**
 * Draw one tendril at time `now`. `map` turns source px into the Graphics' local coords:
 * local = (tx, ty) + (src − origin) × (k·kx, k·ky)  (kx / ky default 1, tx / ty default 0) — so the
 * drip can ride a layer that is being scaled non-uniformly (e.g. a pulsing splat).
 */
export const drawPaintedDrip = (
	g: Gfx,
	tex: InstanceType<typeof PIXI.Texture>,
	t: PaintedTendril,
	now: number,
	map: { ox: number; oy: number; k: number; kx?: number; ky?: number; tx?: number; ty?: number },
) => {
	const { ox, oy, k } = map;
	const KX = k * (map.kx ?? 1);
	const KY = k * (map.ky ?? 1);
	const TX = map.tx ?? 0;
	const TY = map.ty ?? 0;
	const m = new PIXI.Matrix();
	const H = t.half;
	// Source rect (sx, sy, sw, sh) → dest rect in SOURCE px (dx, dy, dw, dh), converted with `map`.
	const slice = (sy: number, sh: number, dx: number, dy: number, dw: number, dh: number, alpha = 1) => {
		if (dw <= 0.2 || dh <= 0.05) return;
		const sx = t.cx - H;
		const X = TX + (dx - ox) * KX;
		const Y = TY + (dy - oy) * KY;
		const W = dw * KX;
		const Hh = dh * KY;
		m.set(W / (2 * H), 0, 0, Hh / sh, X - (sx * W) / (2 * H), Y - (sy * Hh) / sh);
		g.rect(X, Y, W, Hh).fill({ texture: tex, matrix: m.clone(), alpha, textureSpace: 'global' });
	};
	const top = t.tip - t.bulb + 2;
	const tubeRow = (y0: number, y1: number, wf = 1, alpha = 1) =>
		slice(top, 1, t.cx - H * wf, y0, 2 * H * wf, y1 - y0 + 0.4, alpha);
	const end = (y: number, from: number, s: number, alpha = 1, sy = s) =>
		slice(top + from, t.bulb - from, t.cx - H * s, y, 2 * H * s, (t.bulb - from) * sy, alpha);
	// rows y0..y1 squeezed by wf(f), each taken from source row srcRow(y)
	const rows = (y0: number, y1: number, srcRow: (y: number) => number, wf: (f: number) => number, alpha = 1) => {
		const n = Math.max(1, Math.ceil(y1 - y0));
		const step = (y1 - y0) / n;
		for (let i = 0; i < n; i++) {
			const f = (i + 0.5) / n;
			const w = Math.max(0, wf(f));
			if (w <= 0.01) continue;
			slice(srcRow(y0 + i * step), 1, t.cx - H * w, y0 + i * step, 2 * H * w, step + 0.5, alpha);
		}
	};

	const P = t.period;
	const p = ((((now + t.phase) % P) + P) % P) / P;
	const E = t.reach;
	const SAG = E * 0.3;
	const STRETCH = 0.48;
	const PINCH = 0.64;
	const MIN_NECK = 0.12;
	const eq = Math.round(t.bulb * 0.45);
	const POS = (pp: number) => (E + SAG) * Math.min(1, pp / PINCH) ** 1.7;
	const yA = top + E * 0.3;

	if (p < STRETCH) {
		const ext = POS(p);
		tubeRow(top, top + ext + 1);
		end(top + ext, 0, 1);
		return;
	}
	if (p < PINCH) {
		const q = ease((p - STRETCH) / (PINCH - STRETCH));
		const yb = top + POS(p);
		const yEq = yb + eq;
		const mn = 1 - (1 - MIN_NECK) * q;
		tubeRow(top, yA + 1);
		end(yEq, eq, 1);
		rows(yA, yEq + 0.5, (y) => (y < yb ? top : top + (y - yb)), (f) => 1 - (1 - mn) * neckG(f));
		return;
	}
	const q = (p - PINCH) / (1 - PINCH);
	const yb0 = top + E + SAG;
	const yEq0 = yb0 + eq;
	const yP = yA + (yEq0 - yA) * PINCH_AT;
	const v0 = ((E + SAG) * 1.7 * (1 - PINCH)) / PINCH / t.run;
	const sp = Math.min(1, v0 * q + (1 - v0) * Math.min(1, q / 0.7) ** 2);
	const fall = t.run * sp;
	const s = 1 - 0.06 * q;
	const fade = q > 0.42 ? Math.max(0, 1 - (q - 0.42) / 0.28) : 1;
	const tailPull = ease(Math.min(1, q / 0.3));
	const tipW = MIN_NECK * (1 - ease(Math.min(1, q / 0.1)));
	const yEq = yEq0 + fall;
	const H0 = yEq0 - yP;
	const Hd = Math.max(8, (t.bulb - eq) * 1.5);
	const tailTop = yEq - (H0 + (Hd - H0) * tailPull) * s;
	const dq = Math.min(1, q * 3);
	const dsx = s * (1 + ((t.dropNarrow ?? 1) - 1) * dq);
	const dsy = s * (1 + ((t.dropStretch ?? 1) - 1) * dq);
	end(yEq, eq, dsx, fade, dsy);
	rows(
		tailTop,
		yEq + 0.5,
		(y) => {
			const f = (y - tailTop) / Math.max(1, yEq - tailTop);
			const yo = yP + (yEq0 - yP) * f;
			return yo < yb0 ? top : top + (yo - yb0);
		},
		(f) => {
			const yo = yP + (yEq0 - yP) * f;
			const fo = (yo - yA) / (yEq0 - yA);
			const neck = 1 - (1 - tipW) * neckG(fo);
			const tear = Math.sin((Math.PI / 2) * f) ** 1.4;
			return dsx * (neck + (tear - neck) * tailPull);
		},
		fade,
	);
	// stub springs back into the painted rest pose, beading up as it arrives
	const u = ease(Math.min(1, q / 0.28));
	const wob = q > 0.28 ? 2 * Math.exp(-(q - 0.28) * 9) * Math.sin((q - 0.28) * 26) : 0;
	const su = MIN_NECK + 0.25 + (0.75 - MIN_NECK) * u;
	const yEnd = top + (yP - top) * (1 - u);
	rows(top, yEnd + 0.5, () => top, (f) => 1 - (1 - su) * f * f);
	end(yEnd + Math.max(0, wob), 0, su);
};

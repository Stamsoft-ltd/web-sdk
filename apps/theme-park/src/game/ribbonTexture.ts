import { PIXI, type Texture } from 'pixi-svelte';

// Satin lookup texture for the payline ribbon.
//
// The ribbon mesh is a two-triangle-wide strip, so all of its shading has to come out of the
// texture it samples. This bakes a 2D lookup instead of a plain gradient:
//
//   x (u) — position ACROSS the ribbon's width, 0 = near cut edge, 1 = far cut edge.
//           Carries the satin cross-section: broad sheen, a tight specular line just inside the
//           near edge, the far side rolling into shadow, and darkened rims at both cut edges.
//   y (v) — how the face is turned, from fully reversed (row 0) through edge-on (centre row) to
//           face-on (last row). Carries the twist: the reverse of a satin ribbon is matte and
//           duller, edge-on is dark apart from a bright crease.
//
// Per-frame the mesh only has to write positions and a v row per cross-section; the fabric look is
// interpolated by the GPU. That is what keeps this cheap enough to animate.

const LUT_W = 128;
const LUT_H = 64;

type Rgb = [number, number, number];
type Palette = {
	/** Deepest shadow the fabric falls to. */
	deep: Rgb;
	/** The ribbon's own colour, at plain diffuse light. */
	base: Rgb;
	/** Specular highlight — the sheen, not the ribbon colour. */
	hi: Rgb;
};

export const GOLD_RIBBON: Palette = {
	deep: [0x2b, 0x10, 0x00],
	base: [0xf2, 0x97, 0x14],
	hi: [0xff, 0xf6, 0xdc],
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

const smoothstep = (a: number, b: number, x: number) => {
	const t = clamp01((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};

const gauss = (x: number, centre: number, width: number) =>
	Math.exp(-(((x - centre) / width) ** 2));

/**
 * Intensity → colour along a three-stop ramp. Ramping through a dedicated shadow and highlight
 * colour is what separates fabric from plastic: multiplying one flat colour by a brightness factor
 * gives a muddy dark and a washed-out light, neither of which reads as satin.
 */
const ramp = (i: number, p: Palette): number => {
	let r: number, g: number, b: number;
	if (i <= 1) {
		const t = clamp01(i);
		r = p.deep[0] + (p.base[0] - p.deep[0]) * t;
		g = p.deep[1] + (p.base[1] - p.deep[1]) * t;
		b = p.deep[2] + (p.base[2] - p.deep[2]) * t;
	} else {
		const t = clamp01((i - 1) / 0.55);
		r = p.base[0] + (p.hi[0] - p.base[0]) * t;
		g = p.base[1] + (p.hi[1] - p.base[1]) * t;
		b = p.base[2] + (p.hi[2] - p.base[2]) * t;
	}
	return (r << 16) | (g << 8) | b;
};

const cache = new Map<string, Texture>();

export const getRibbonTexture = (palette: Palette = GOLD_RIBBON): Texture => {
	const key = [...palette.deep, ...palette.base, ...palette.hi].join(',');
	const cached = cache.get(key);
	if (cached) return cached;

	const canvas = document.createElement('canvas');
	canvas.width = LUT_W;
	canvas.height = LUT_H;
	const ctx = canvas.getContext('2d')!;
	const image = ctx.createImageData(LUT_W, LUT_H);
	const data = image.data;

	for (let j = 0; j < LUT_H; j++) {
		// facing: -1 fully reversed, 0 edge-on, +1 face-on.
		const facing = (j / (LUT_H - 1)) * 2 - 1;
		const face = Math.abs(facing);
		const reversed = facing < 0;

		// Edge-on catches almost no light; face-on catches all of it.
		const diffuse = 0.44 + 0.56 * face ** 0.7;
		// The reverse of satin is the matte weave: it keeps the hue but loses the sheen.
		const sheen = reversed ? 0.28 : 1;
		const body = reversed ? 0.68 : 1;
		// At a twist point the fold itself catches a bright crease of light.
		const crease = 0.5 * (1 - face) ** 4;

		for (let k = 0; k < LUT_W; k++) {
			const u = k / (LUT_W - 1);

			let across =
				0.66 +
				0.42 * gauss(u, 0.38, 0.34) + // broad sheen band
				0.42 * gauss(u, 0.3, 0.08) * sheen - // tight specular line
				0.2 * smoothstep(0.52, 1, u) + // far half rolls into shadow
				0.02 * Math.sin(u * Math.PI * 14); // faint weave grain

			// Both cut edges darken — the thickness of the fabric turning away from the light.
			const rim = Math.min(smoothstep(0, 0.05, u), smoothstep(1, 0.95, u));
			across *= 0.5 + 0.5 * rim;

			const colour = ramp(across * diffuse * body + crease, palette);

			// Feather the outermost texels so the mesh's own hard edge never shows: the strip's
			// border vertices sit exactly at u=0 and u=1.
			const alpha = Math.min(smoothstep(0, 0.022, u), smoothstep(1, 0.978, u));

			const o = (j * LUT_W + k) * 4;
			data[o] = (colour >> 16) & 0xff;
			data[o + 1] = (colour >> 8) & 0xff;
			data[o + 2] = colour & 0xff;
			data[o + 3] = Math.round(alpha * 255);
		}
	}

	ctx.putImageData(image, 0, 0);

	const texture = PIXI.Texture.from(canvas);
	texture.source.scaleMode = 'linear';
	// Clamp: a bilinear sample at u=1 must not wrap round to the near edge's specular line.
	texture.source.addressMode = 'clamp-to-edge';
	cache.set(key, texture);
	return texture;
};

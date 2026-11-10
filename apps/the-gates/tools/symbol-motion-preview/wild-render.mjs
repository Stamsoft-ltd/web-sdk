import { wildCrystalMask } from './live-premium-motion.mjs';
import { WILD_CLUSTERS, wildGlowFrame } from './wild-motion.mjs';
const SIZE = 512,
	INK = 448,
	PAD = (SIZE - INK) / 2;
function surface() {
	const c = document.createElement('canvas');
	c.width = c.height = SIZE;
	return c;
}
/** One-time pixel read and cached palette stamps; no per-frame readbacks/filters. */
export async function createWildRenderer() {
	const image = new Image();
	image.src = new URL('../../static/assets/the-gates/wild/flower.png', import.meta.url).href;
	await image.decode();
	const base = surface(),
		b = base.getContext('2d');
	b.drawImage(image, PAD, PAD, INK, INK);
	const mask = surface(),
		m = mask.getContext('2d');
	const pixels = b.getImageData(0, 0, SIZE, SIZE),
		maskPixels = m.createImageData(SIZE, SIZE);
	const coverage = wildCrystalMask(pixels.data, SIZE, SIZE, PAD, INK);
	for (let n = 0; n < coverage.length; n++) {
		const i = n * 4;
		maskPixels.data[i] = maskPixels.data[i + 1] = maskPixels.data[i + 2] = 255;
		maskPixels.data[i + 3] = coverage[n];
	}
	m.putImageData(maskPixels, 0, 0);
	const cache = new Map();
	function palette(colour) {
		if (cache.has(colour)) return cache.get(colour);
		const tint = surface(),
			t = tint.getContext('2d');
		t.drawImage(base, 0, 0);
		t.globalCompositeOperation = 'multiply';
		t.fillStyle = colour;
		t.fillRect(0, 0, SIZE, SIZE);
		t.globalCompositeOperation = 'destination-in';
		t.drawImage(mask, 0, 0);
		// Static shadow render: original art covers its interior; only colored halo escapes.
		const halo = surface(),
			h = halo.getContext('2d');
		h.shadowColor = colour;
		h.shadowBlur = 22;
		h.drawImage(base, 0, 0);
		const result = { tint, halo };
		cache.set(colour, result);
		return result;
	}
	for (const variant of WILD_CLUSTERS) palette(variant.colour);
	return function drawWild(
		c,
		ms,
		{ size = 300, x = 0, y = 0, speed = 1, reduced = false, cluster = '#58ff14' } = {},
	) {
		const variant = WILD_CLUSTERS.find((v) => v.id === cluster || v.colour === cluster) ?? {
			colour: cluster,
			accent: cluster,
		};
		// Gallery accepts old custom hex selections; keep the texture cache bounded.
		const colour = /^#[0-9a-f]{6}$/i.test(variant.colour) ? variant.colour : '#58ff14';
		const layer = cache.get(colour) ?? cache.get('#58ff14'),
			f = wildGlowFrame(ms, { speed, reduced });
		c.save();
		c.translate(x, y);
		c.scale(size / SIZE, size / SIZE);
		if (f.halo) {
			c.globalAlpha = f.halo;
			c.drawImage(layer.halo, 0, 0);
			c.globalAlpha = 1;
		}
		c.drawImage(base, 0, 0);
		if (f.light) {
			c.globalAlpha = f.light * 0.9;
			c.drawImage(layer.tint, 0, 0);
			c.globalAlpha = 1;
		}
		// Small jewel-light catches follow the six crystal petals; no icon shaking.
		for (let i = 0; i < 6; i++)
			if (f.glints[i] > 0.001) {
				const a = -Math.PI / 2 + (i * Math.PI) / 3,
					px = SIZE / 2 + Math.cos(a) * INK * 0.29,
					py = SIZE / 2 + Math.sin(a) * INK * 0.29;
				c.save();
				c.translate(px, py);
				c.globalAlpha = f.glints[i] * 0.7;
				c.fillStyle = variant.accent;
				c.beginPath();
				c.moveTo(0, -8);
				c.lineTo(2, -2);
				c.lineTo(8, 0);
				c.lineTo(2, 2);
				c.lineTo(0, 8);
				c.lineTo(-2, 2);
				c.lineTo(-8, 0);
				c.lineTo(-2, -2);
				c.closePath();
				c.fill();
				c.globalAlpha = f.glints[i] * 0.9;
				c.fillStyle = '#fffcec';
				c.fillRect(-1.2, -1.2, 2.4, 2.4);
				c.restore();
			}
		c.restore();
	};
}

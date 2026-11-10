import {
	palaceFrame,
	visorPoint,
	VISOR_HINGES,
	VISOR_AXIS_LENGTH,
	visorUV,
} from './palace-motion.mjs';
const surface = () => {
	const c = document.createElement('canvas');
	c.width = c.height = 300;
	return c;
};
function path(c, points) {
	c.beginPath();
	points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
	c.closePath();
}
function glowStamp(colour) {
	const out = surface(),
		c = out.getContext('2d'),
		g = c.createRadialGradient(150, 150, 5, 150, 150, 130);
	g.addColorStop(0, colour + 'aa');
	g.addColorStop(0.6, colour + '44');
	g.addColorStop(1, colour + '00');
	c.fillStyle = g;
	c.fillRect(0, 0, 300, 300);
	return out;
}
/** Rough Canvas masks for concept approval. All originals retained unchanged.
 * No production imports, no per-frame texture readback, no new animation clock.
 */
export async function createPalaceRenderer(load, fit) {
	const [knightImage, visorImage, chaliceImage] = await Promise.all(
		['spirit-knight-body', 'knight-visor-source', 'gold-chalice-pink'].map((n) =>
			load('./assets/palace/' + n + '.png'),
		),
	);
	const knight = fit(knightImage, 96, 270, 270),
		chalice = fit(chaliceImage, 96, 270, 270);
	// One source faceplate. Smooth masked perimeter replaces studs; both poses use THIS texture.
	const visor = surface(),
		v = visor.getContext('2d');
	v.save();
	path(v, [
		[53, 120],
		[116, 130],
		[215, 126],
		[212, 204],
		[202, 216],
		[145, 257],
		[127, 259],
		[67, 227],
		[59, 213],
	]);
	v.clip();
	v.drawImage(visorImage, 1129, 323, 524, 370, 53, 120, 164, 141);
	v.restore();
	// Soft golden light at same pupil slit / holes of this canonical plate.
	const visorLight = surface(),
		vl = visorLight.getContext('2d');
	vl.drawImage(visor, 0, 0);
	const vp = vl.getImageData(0, 0, 300, 300);
	for (let i = 0; i < vp.data.length; i += 4) {
		const d = vp.data,
			ink = d[i + 2] > d[i] * 1.25 && d[i] < 65 && d[i + 1] < 75 && d[i + 3] > 100;
		d[i] = 255;
		d[i + 1] = 220;
		d[i + 2] = 95;
		d[i + 3] = ink ? 220 : 0;
	}
	vl.putImageData(vp, 0, 0);
	// Source-position surface masks. No global recolor; gold, gem and rim remain untouched.
	const liquid = surface(),
		lc = liquid.getContext('2d');
	lc.drawImage(chalice, 0, 0);
	const lp = lc.getImageData(0, 0, 300, 300);
	for (let y = 0; y < 300; y++)
		for (let x = 0; x < 300; x++) {
			const i = (y * 300 + x) * 4,
				d = lp.data,
				rx = (x - 150) / 75,
				ry = (y - 55) / 21;
			const inside = rx * rx + ry * ry < 1 && y < 79;
			d[i + 3] = inside ? d[i + 3] : 0;
		}
	lc.putImageData(lp, 0, 0);
	const pinkGlow = glowStamp('#ff399e'),
		goldGlow = glowStamp('#ffcf24');
	const basin = surface(),
		bc = basin.getContext('2d');
	// Cached elliptical ripple/sheen: rotates inside the basin, not the gold cup.
	bc.translate(150, 150);
	for (let i = 0; i < 3; i++) {
		bc.strokeStyle = ['#ffe1f5bb', '#ff92d4aa', '#ffedfa99'][i];
		bc.lineWidth = 2 - i * 0.35;
		bc.beginPath();
		bc.ellipse(i * 5 - 8, i * 3 - 7, 40 + i * 22, 28 + i * 13, 0.25 + i * 0.8, 0.15, Math.PI * 1.3);
		bc.stroke();
	}
	const spiritMaskPoints = [
		[67, 128],
		[117, 139],
		[160, 133],
		[198, 145],
		[192, 183],
		[181, 205],
		[152, 223],
		[135, 254],
		[119, 259],
		[84, 237],
		[74, 207],
	];
	const spiritTexture = surface(),
		sc = spiritTexture.getContext('2d');
	sc.drawImage(knight, 0, 0);
	sc.globalCompositeOperation = 'destination-in';
	path(sc, spiritMaskPoints);
	sc.fill();
	const composed = surface(),
		cc = composed.getContext('2d');
	const addGlow = (c, stamp, alpha) => {
		if (alpha <= 0) return;
		c.save();
		c.globalAlpha = alpha;
		c.drawImage(stamp, 0, 0);
		c.restore();
	};
	// Shared projected plate caches: one neutral and one current clock sample for all cells.
	const plateRest = surface(),
		plateFrame = surface(),
		litVisor = surface();
	let plateFrameKey = '';
	function texturedTriangle(c, image, source, dest) {
		const [s0, s1, s2] = source,
			[p0, p1, p2] = dest;
		const sx = s1.x - s0.x,
			sy = s1.y - s0.y,
			tx = s2.x - s0.x,
			ty = s2.y - s0.y,
			det = sx * ty - sy * tx;
		const area = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
		if (Math.abs(area) < 0.002) return;
		const a = ((p1.x - p0.x) * ty - (p2.x - p0.x) * sy) / det;
		const b = ((p1.y - p0.y) * ty - (p2.y - p0.y) * sy) / det;
		const cc = ((p2.x - p0.x) * sx - (p1.x - p0.x) * tx) / det;
		const d = ((p2.y - p0.y) * sx - (p1.y - p0.y) * tx) / det;
		const mx = (p0.x + p1.x + p2.x) / 3,
			my = (p0.y + p1.y + p2.y) / 3;
		c.save();
		// Subpixel overlap avoids hairline cracks between cached mesh triangles.
		path(
			c,
			dest.map((p) => {
				const dx = p.x - mx,
					dy = p.y - my,
					k = 0.18 / Math.max(1, Math.hypot(dx, dy));
				return [p.x + dx * k, p.y + dy * k];
			}),
		);
		c.clip();
		c.transform(a, b, cc, d, p0.x - a * s0.x - cc * s0.y, p0.y - b * s0.x - d * s0.y);
		c.drawImage(image, 0, 0);
		c.restore();
	}
	function projectPlate(out, f) {
		const c = out.getContext('2d'),
			light = litVisor.getContext('2d');
		c.clearRect(0, 0, 300, 300);
		light.clearRect(0, 0, 300, 300);
		light.drawImage(visor, 0, 0);
		light.globalAlpha = f.spirit * 0.55;
		light.drawImage(visorLight, 0, 0);
		light.globalAlpha = 1;
		// Mesh rows/columns contain BOTH exact visible pins (u=±L/2,v=0).
		// A rectangular grid missed them and let the rendered corners slide.
		const half = VISOR_AXIS_LENGTH / 2;
		const us = [
			-half - 3,
			-half,
			-half + 5,
			-half + 12,
			-half + 23,
			-half + 36,
			-half / 2,
			0,
			half / 2,
			half - 36,
			half - 23,
			half - 12,
			half - 5,
			half,
			half + 3,
		].sort((a, b) => a - b);
		const vs = [-10, 0, 12, 35, 65, 100, 144];
		const vertex = (i, j) => visorUV(us[i], vs[j]);
		for (let j = 0; j < vs.length - 1; j++)
			for (let i = 0; i < us.length - 1; i++) {
				const quad = [vertex(i, j), vertex(i + 1, j), vertex(i + 1, j + 1), vertex(i, j + 1)];
				const projected = quad.map((p) => visorPoint(p.x, p.y, f.closed, f.impact));
				for (const indices of [
					[0, 1, 2],
					[0, 2, 3],
				])
					texturedTriangle(
						c,
						litVisor,
						indices.map((n) => quad[n]),
						indices.map((n) => projected[n]),
					);
			}
	}
	projectPlate(plateRest, palaceFrame(0));
	function plate(c, f) {
		if (!f.active && !f.closed) {
			c.drawImage(plateRest, 0, 0);
			return;
		}
		const key = [f.closed, f.impact, f.spirit].join(':');
		if (key !== plateFrameKey) {
			projectPlate(plateFrame, f);
			plateFrameKey = key;
		}
		c.drawImage(plateFrame, 0, 0);
	}
	function splash(c, f) {
		if (!f.splash) return;
		// A small liquid crown rises behind the foreground gold lip. No body recolor.
		const height = 40 * f.splash * (0.78 + 0.22 * Math.sin(f.p * Math.PI * 8));
		c.save();
		const g = c.createLinearGradient(0, 54 - height, 0, 58);
		g.addColorStop(0, '#ffe9f8');
		g.addColorStop(0.3, '#ff8ed0');
		g.addColorStop(1, '#f21b94');
		c.fillStyle = g;
		c.strokeStyle = '#b80b66';
		c.lineWidth = 1.3;
		c.beginPath();
		c.moveTo(118, 56);
		c.bezierCurveTo(128, 49, 123, 54 - height * 0.65, 124, 54 - height * 0.8);
		c.bezierCurveTo(135, 47 - height * 0.4, 137, 53, 141, 48);
		c.bezierCurveTo(148, 43, 147, 54 - height, 151, 54 - height);
		c.bezierCurveTo(158, 54 - height, 153, 42, 164, 47);
		c.bezierCurveTo(171, 49, 174, 54 - height * 0.7, 180, 54 - height * 0.55);
		c.bezierCurveTo(180, 48, 174, 51, 180, 56);
		c.closePath();
		c.fill();
		c.stroke();
		c.strokeStyle = '#fff0fa';
		c.lineWidth = 1.5;
		c.beginPath();
		c.moveTo(147, 48);
		c.quadraticCurveTo(149, 38, 151, 58 - height);
		c.stroke();
		for (const d of f.droplets) {
			if (!d.radius) continue;
			c.globalAlpha = d.alpha;
			c.fillStyle = '#ff7ec7';
			c.beginPath();
			c.ellipse(d.x, d.y, d.radius * 0.7, d.radius * 1.3, -0.25, 0, Math.PI * 2);
			c.fill();
			c.fillStyle = '#ffe8f5';
			c.beginPath();
			c.ellipse(d.x - 0.5, d.y - 0.6, d.radius * 0.24, d.radius * 0.5, -0.25, 0, Math.PI * 2);
			c.fill();
		}
		c.restore();
	}

	return function renderPalace(c, id, ms, options = {}) {
		const f = palaceFrame(ms, options);
		if (id === 'pharaoh') {
			c.save();
			addGlow(c, goldGlow, f.active * 0.25);
			c.drawImage(knight, 0, 0);
			if (f.spirit) {
				c.save();
				path(c, spiritMaskPoints);
				c.clip();
				c.globalCompositeOperation = 'screen';
				c.globalAlpha = f.spirit * 0.27;
				c.drawImage(spiritTexture, 0, -f.spirit * 1.3);
				c.restore();
			}
			plate(c, f);
			if (options.anchors) {
				for (const h of VISOR_HINGES) {
					c.save();
					c.strokeStyle = '#06162b';
					c.lineWidth = 1.4;
					c.fillStyle = '#32fff1';
					c.beginPath();
					c.arc(h.x, h.y, 2.3, 0, Math.PI * 2);
					c.fill();
					c.stroke();
					c.restore();
				}
			}
			c.restore();
		} else {
			c.save();
			c.translate(150 + f.cupX, 260 + f.cupY);
			c.rotate(f.cupAngle);
			c.translate(-150, -260);
			addGlow(c, pinkGlow, f.liquidGlow * 0.32);
			c.drawImage(chalice, 0, 0);
			if (f.active) {
				cc.clearRect(0, 0, 300, 300);
				cc.save();
				cc.translate(150, 55 + f.liquidLift);
				cc.scale(1, 0.275);
				cc.rotate(f.liquidAngle);
				cc.drawImage(basin, -150, -150);
				cc.restore();
				cc.globalCompositeOperation = 'destination-in';
				cc.drawImage(liquid, 0, 0);
				cc.globalCompositeOperation = 'source-over';
				c.save();
				c.globalAlpha = f.active * 0.82;
				c.drawImage(composed, 0, 0);
				c.globalCompositeOperation = 'screen';
				c.globalAlpha = f.liquidGlow * 0.25;
				c.drawImage(liquid, 0, 0);
				c.restore();
			}
			splash(c, f);
			c.restore();
		}
	};
}

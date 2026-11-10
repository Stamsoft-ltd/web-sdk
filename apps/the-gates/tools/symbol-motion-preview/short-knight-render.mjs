import { shortVisorPoint, shortUV, SHORT_KNIGHT_PINS, affine3 } from './short-knight-motion.mjs';
const surface = () => {
	const c = document.createElement('canvas');
	c.width = c.height = 300;
	return c;
};
function polygon(c, pts) {
	c.beginPath();
	pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
	c.closePath();
}
async function load(name) {
	const i = new Image();
	i.src = new URL('./assets/palace/' + name, import.meta.url).href;
	await i.decode();
	return i;
}
export async function createShortKnight() {
	const [bodyImage, visorImage] = await Promise.all(
		['short-knight-body.png', 'short-knight-visor-source.png'].map(load),
	);
	const body = surface(),
		b = body.getContext('2d');
	// Canonical body's alpha>96 fit: same exact fixed surface in every panel.
	b.drawImage(bodyImage, 82, 39, 1074, 1184, 27.542229729729726, 15, 244.91554054054055, 270);
	const visor = surface(),
		v = visor.getContext('2d');
	const shape = [
		[958, 365],
		[1120, 348],
		[1290, 359],
		[1450, 382],
		[1545, 395],
		[1542, 520],
		[1518, 550],
		[1390, 570],
		[1180, 579],
		[1050, 561],
		[973, 523],
		[957, 499],
	].map(([x, y]) => ({ x, y }));
	const matrix = affine3(
		[
			{ x: 958, y: 365 },
			{ x: 1545, y: 395 },
			{ x: 1240, y: 579 },
		],
		[SHORT_KNIGHT_PINS[0], SHORT_KNIGHT_PINS[1], { x: 132, y: 208 }],
	);
	v.save();
	v.transform(...matrix);
	polygon(v, shape);
	v.clip();
	v.drawImage(visorImage, 0, 0);
	v.restore();
	const open = surface(),
		closed = surface(),
		animated = surface();
	let key = -1;
	function mesh(out, amount) {
		const c = out.getContext('2d');
		c.clearRect(0, 0, 300, 300);
		const L = Math.hypot(195, 15),
			h = L / 2;
		const us = [
				-h - 5,
				-h,
				-h + 7,
				-h + 15,
				-h + 25,
				-h + 38,
				-h / 2,
				0,
				h / 2,
				h - 38,
				h - 25,
				h - 15,
				h - 7,
				h,
				h + 5,
			].sort((a, b) => a - b),
			vs = [-20, 0, 14, 34, 56, 84];
		for (let j = 0; j < vs.length - 1; j++)
			for (let i = 0; i < us.length - 1; i++) {
				const q = [
						shortUV(us[i], vs[j]),
						shortUV(us[i + 1], vs[j]),
						shortUV(us[i + 1], vs[j + 1]),
						shortUV(us[i], vs[j + 1]),
					],
					p = q.map((t) => shortVisorPoint(t.x, t.y, amount));
				for (const indices of [
					[0, 1, 2],
					[0, 2, 3],
				]) {
					const s = indices.map((n) => q[n]),
						d = indices.map((n) => p[n]),
						cx = d.reduce((a, p) => a + p.x, 0) / 3,
						cy = d.reduce((a, p) => a + p.y, 0) / 3;
					c.save();
					polygon(
						c,
						d.map((p) => {
							const dx = p.x - cx,
								dy = p.y - cy,
								k = 0.12 / Math.max(1, Math.hypot(dx, dy));
							return { x: p.x + dx * k, y: p.y + dy * k };
						}),
					);
					c.clip();
					c.transform(...affine3(s, d));
					c.drawImage(visor, 0, 0);
					c.restore();
				}
			}
	}
	mesh(open, 0);
	mesh(closed, 1);
	return (c, amount, { anchors = false } = {}) => {
		c.clearRect(0, 0, 500, 500);
		c.save();
		c.scale(500 / 300, 500 / 300);
		c.drawImage(body, 0, 0);
		let texture = amount === 0 ? open : amount === 1 ? closed : animated;
		if (texture === animated && key !== amount) {
			mesh(animated, amount);
			key = amount;
		}
		c.drawImage(texture, 0, 0);
		if (anchors)
			for (const h of SHORT_KNIGHT_PINS) {
				c.fillStyle = '#2af7e5';
				c.strokeStyle = '#071d32';
				c.lineWidth = 1;
				c.beginPath();
				c.arc(h.x, h.y, 2.5, 0, Math.PI * 2);
				c.fill();
				c.stroke();
			}
		c.restore();
	};
}

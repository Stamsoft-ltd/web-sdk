import {
	KNIGHT_PLACEMENT,
	KNIGHT_PINS,
	KNIGHT_GRID_U,
	KNIGHT_GRID_V,
	knightUV,
	knightPoint,
} from './component-knight-motion.mjs';
import { affine3 } from './short-knight-motion.mjs';
const SIZE = 600;
function surface() {
	const c = document.createElement('canvas');
	c.width = c.height = SIZE;
	return c;
}
function poly(c, points) {
	c.beginPath();
	points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
	c.closePath();
}
async function load(file) {
	const i = new Image();
	i.src = new URL('./assets/palace/knight-components/' + file, import.meta.url).href;
	await i.decode();
	return i;
}
export async function createComponentKnight() {
	const [helmet, visor] = await Promise.all(['helmet.png', 'visor.png'].map(load));
	const body = surface(),
		spirit = surface(),
		plate = surface(),
		moving = surface(),
		raised = surface();
	// A feathered, cached interior patch lifts only the spirit; shell/rim pixels stay fixed.
	const s = spirit.getContext('2d');
	s.scale(2, 2);
	s.drawImage(helmet, 0, KNIGHT_PLACEMENT.spiritY, 300, 300);
	s.globalCompositeOperation = 'destination-in';
	const vertical = s.createLinearGradient(0, 121, 0, 189);
	vertical.addColorStop(0, 'transparent');
	vertical.addColorStop(0.24, 'white');
	vertical.addColorStop(0.86, 'white');
	vertical.addColorStop(1, 'transparent');
	s.fillStyle = vertical;
	s.fillRect(0, 0, 300, 300);
	const horizontal = s.createLinearGradient(52, 0, 210, 0);
	horizontal.addColorStop(0, 'transparent');
	horizontal.addColorStop(0.13, 'white');
	horizontal.addColorStop(0.84, 'white');
	horizontal.addColorStop(1, 'transparent');
	s.fillStyle = horizontal;
	s.fillRect(0, 0, 300, 300);
	const b = body.getContext('2d');
	b.scale(2, 2);
	b.drawImage(helmet, 0, 0, 300, 300);
	b.drawImage(spirit, 0, 0, 300, 300);
	const p = plate.getContext('2d');
	p.scale(2, 2);
	p.drawImage(
		visor,
		KNIGHT_PLACEMENT.x,
		KNIGHT_PLACEMENT.y,
		KNIGHT_PLACEMENT.width,
		(KNIGHT_PLACEMENT.width * visor.height) / visor.width,
	);
	const vertices = KNIGHT_GRID_V.flatMap((v) => KNIGHT_GRID_U.map((u) => knightUV(u, v)));
	const triangles = [];
	for (let j = 0; j < KNIGHT_GRID_V.length - 1; j++)
		for (let i = 0; i < KNIGHT_GRID_U.length - 1; i++) {
			const a = j * KNIGHT_GRID_U.length + i,
				b = a + 1,
				c = a + KNIGHT_GRID_U.length,
				d = c + 1;
			triangles.push([a, b, d], [a, d, c]);
		}
	function mesh(out, open) {
		const c = out.getContext('2d');
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, SIZE, SIZE);
		c.scale(2, 2);
		if (open === 0) {
			c.drawImage(plate, 0, 0, 300, 300);
			return;
		}
		// Project shared vertices once, rather than once per adjoining triangle.
		const projected = vertices.map((p) => knightPoint(p.x, p.y, open));
		for (const indices of triangles) {
			const q = indices.map((i) => vertices[i]),
				d = indices.map((i) => projected[i]);
			const cx = (d[0].x + d[1].x + d[2].x) / 3,
				cy = (d[0].y + d[1].y + d[2].y) / 3;
			c.save();
			// Subpixel overlap avoids hairline cracks between antialiased clips.
			poly(
				c,
				d.map((p) => {
					const dx = p.x - cx,
						dy = p.y - cy,
						k = 0.12 / Math.max(1, Math.hypot(dx, dy));
					return { x: p.x + dx * k, y: p.y + dy * k };
				}),
			);
			c.clip();
			c.transform(...affine3(q, d));
			c.drawImage(plate, 0, 0, 300, 300);
			c.restore();
		}
	}
	mesh(raised, 1);
	let last = -1;
	return function render(c, open, { anchors = false, showVisor = true } = {}) {
		c.setTransform(1, 0, 0, 1, 0, 0);
		c.clearRect(0, 0, c.canvas.width, c.canvas.height);
		c.save();
		c.scale(c.canvas.width / 300, c.canvas.height / 300);
		c.drawImage(body, 0, 0, 300, 300);
		if (showVisor) {
			let image = open === 0 ? plate : open === 1 ? raised : moving;
			if (image === moving && last !== open) {
				mesh(moving, open);
				last = open;
			}
			c.drawImage(image, 0, 0, 300, 300);
		}
		if (anchors)
			for (const h of KNIGHT_PINS) {
				c.fillStyle = '#22ffee';
				c.strokeStyle = '#03192f';
				c.lineWidth = 1;
				c.beginPath();
				c.arc(h.x, h.y, 2.7, 0, Math.PI * 2);
				c.fill();
				c.stroke();
			}
		c.restore();
	};
}

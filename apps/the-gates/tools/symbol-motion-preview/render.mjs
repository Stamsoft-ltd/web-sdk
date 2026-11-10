import { eyeLookFrame, irisProjection } from '../eye-look-preview/motion.mjs';
import {
	createSuppliedEyeLayers,
	eyeSilhouette,
	createRollingBackground,
} from '../eye-look-preview/layers.mjs';
import { symbolMotion, keyPayingFrame } from './motion.mjs';
import { createWildRenderer } from './wild-render.mjs';
import { createPalaceRenderer } from './palace-render.mjs';
export const SYMBOLS = [
	{
		id: 'eye',
		name: 'Sacred Eye',
		note: 'New supplied Eye layers · rolling volume + iris perspective',
		colour: '#19ceff',
	},
	{
		id: 'envelope',
		name: 'Enchanted Chalice',
		note: 'Pink liquid swirls and splashes upward → gentle cup wobble → settles',
		colour: '#f34a9e',
		quality:
			'Concept replaces Envelope in this preview only. Rough liquid mask; final aligned basin/rim layers needed.',
	},
	{
		id: 'coin',
		name: 'Sun medallion',
		note: 'Supplied badge / rays / face · full ray rotation; no added glare or wink',
		colour: '#ffb52c',
	},
	{
		id: 'orb',
		name: 'Red orb',
		note: 'Supplied split art · three faster counterclockwise turns; fixed frame',
		colour: '#ff772c',
	},
	{
		id: 'pharaoh',
		name: 'Spirit Knight',
		note: 'Golden spirit charges → visor shuts → outward/upward swing from both hinges',
		colour: '#ffe64e',
		quality:
			'Concept replaces Pharaoh in this preview only. One rough-cut visor texture for both poses; final body/visor split needed.',
	},
	...['red', 'blue', 'green', 'purple', 'gold'].map((c, i) => ({
		id: c + '-gem',
		name: (c === 'gold' ? 'Amber' : c[0].toUpperCase() + c.slice(1)) + ' gem',
		note: 'Facet light crosses the stone → single corner sparkle',
		colour: ['#ff4855', '#16dfff', '#6dff37', '#c94bff', '#ffc62f'][i],
	})),
	{
		id: 'wild',
		name: 'Crystal Lotus Wild',
		note: 'Selected crystal art · cluster-colored petal light + halo; gold and center jewel stay fixed',
		colour: '#58ff14',
		quality: 'Selected high-resolution Crystal Lotus; all ten cluster palettes available.',
	},
	{
		id: 'key',
		name: 'Key',
		note: 'Original game paying track · rock + lift; blue card stays fixed',
		colour: '#ffd629',
	},
];
const canvas = () => {
	const c = document.createElement('canvas');
	c.width = c.height = 300;
	return c;
};
function fit(
	image,
	alphaThreshold = 30,
	targetWidth = 270,
	targetHeight = targetWidth,
	cx = 150,
	cy = 150,
) {
	const scratch = document.createElement('canvas');
	scratch.width = image.width;
	scratch.height = image.height;
	const c = scratch.getContext('2d');
	c.drawImage(image, 0, 0);
	const p = c.getImageData(0, 0, image.width, image.height).data;
	let x0 = image.width,
		y0 = image.height,
		x1 = 0,
		y1 = 0;
	for (let y = 0; y < image.height; y++)
		for (let x = 0; x < image.width; x++)
			if (p[(y * image.width + x) * 4 + 3] > alphaThreshold) {
				x0 = Math.min(x0, x);
				x1 = Math.max(x1, x);
				y0 = Math.min(y0, y);
				y1 = Math.max(y1, y);
			}
	const out = canvas(),
		o = out.getContext('2d'),
		w = x1 - x0 + 1,
		h = y1 - y0 + 1,
		s = Math.min(targetWidth / w, targetHeight / h);
	o.drawImage(image, x0, y0, w, h, cx - (w * s) / 2, cy - (h * s) / 2, w * s, h * s);
	return out;
}
function star(c, x, y, r, alpha = 1) {
	if (alpha <= 0) return;
	c.save();
	c.globalAlpha = alpha;
	c.translate(x, y);
	c.fillStyle = '#fff9ce';
	c.beginPath();
	for (let i = 0; i < 8; i++) {
		let a = (i * Math.PI) / 4,
			d = i % 2 ? r * 0.22 : r;
		c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
	}
	c.closePath();
	c.fill();
	c.restore();
}
function shine(c, image, m) {
	if (!m.active) return;
	c.save();
	c.globalCompositeOperation = 'screen';
	// Isolated compositing surface keeps the sweep inside the symbol alpha.
	const o = (shine.buffer ??= canvas()),
		g = o.getContext('2d');
	g.clearRect(0, 0, 300, 300);
	g.drawImage(image, 0, 0);
	g.globalCompositeOperation = 'source-in';
	const x = -110 + m.sweep * 520,
		light = g.createLinearGradient(x - 36, 0, x + 36, 0);
	light.addColorStop(0, '#fff0');
	light.addColorStop(0.5, `rgba(255,251,194,${m.active * 0.55})`);
	light.addColorStop(1, '#fff0');
	g.fillStyle = light;
	g.fillRect(0, 0, 300, 300);
	g.globalCompositeOperation = 'source-over';
	c.drawImage(o, 0, 0);
	c.restore();
}
function blueCard(c) {
	c.fillStyle = '#06182b';
	c.beginPath();
	c.roundRect(24, 31, 252, 238, 23);
	c.fill();
	c.strokeStyle = '#ffd524';
	c.lineWidth = 6;
	c.stroke();
	c.fillStyle = '#0849b6';
	c.beginPath();
	c.roundRect(33, 40, 234, 220, 17);
	c.fill();
}
export async function createSymbolRenderer() {
	const base = '../../static/assets/the-gates/',
		paths = {};
	for (const { id } of SYMBOLS)
		if (!['eye', 'orb', 'coin', 'wild', 'envelope', 'pharaoh'].includes(id))
			paths[id] = base + 'art/symbols/' + id + '.png';
	const load = async (src) => {
		const i = new Image();
		i.src = src;
		await i.decode();
		return i;
	};
	const art = Object.fromEntries(
		await Promise.all(
			Object.entries(paths).map(async ([k, v]) => [k, fit(await load(v), k === 'key' ? 96 : 30)]),
		),
	);
	const [frame, blueEye, irisImage] = await Promise.all(
		['eye-border', 'eye-background', 'eye-iris-new'].map((k) =>
			load('../eye-look-preview/assets/' + k + '.png'),
		),
	);
	const eye = createSuppliedEyeLayers(frame, blueEye, irisImage),
		rolling = createRollingBackground(eye.background, { supplied: true }),
		silhouette = eyeSilhouette();
	const iris = eye.iris;
	const [orbFrame, orbSpiral, sunBadge, sunRays, sunFace, keyRig] = await Promise.all([
		load('./assets/orb-frame.png').then(fit),
		load('./assets/orb-spiral.png'),
		load('./assets/sun-badge.png').then((i) => fit(i, 96)),
		load('./assets/sun-rays.png').then((i) => fit(i, 96)),
		load('./assets/sun-face.png').then((i) => fit(i, 96)),
		fetch(base + 'art/animations/KEY.json').then((r) => {
			if (!r.ok) throw Error('Cannot load original KEY rig');
			return r.json();
		}),
	]);
	const renderPremium = await createPalaceRenderer(load, fit);
	const drawCrystalWild = await createWildRenderer();
	let eyeStamp = canvas(),
		lastEye = '';
	function drawEye(c, ms, options) {
		const f = eyeLookFrame(ms, options),
			sig = f.x + ',' + f.y;
		if (sig !== lastEye) {
			lastEye = sig;
			const e = eyeStamp.getContext('2d');
			e.clearRect(0, 0, 300, 300);
			e.save();
			e.translate(0, 38);
			e.drawImage(rolling(f), 0, 0);
			const p = irisProjection(f);
			e.save();
			e.clip(silhouette);
			e.translate(149.5 + f.x, 112 + f.y);
			e.scale(p.width / 131, p.height / 131);
			e.drawImage(iris, -149.5, -112);
			e.restore();
			e.drawImage(eye.border, 0, 0);
			e.restore();
		}
		c.drawImage(eyeStamp, 0, 0);
	}
	function drawCoin(c, m) {
		c.drawImage(sunBadge, 0, 0);
		c.save();
		c.translate(150, 150);
		c.rotate(m.rayAngle);
		c.drawImage(sunRays, -116, -116, 232, 232);
		c.restore();
		c.drawImage(sunFace, 88, 88, 124, 124);
	}
	function drawOrb(c, m) {
		c.drawImage(orbFrame, 0, 0);
		const scale = 270 / 272,
			w = orbSpiral.width * scale,
			h = orbSpiral.height * scale;
		c.save();
		c.translate(150, 128);
		c.rotate(m.orbAngle);
		c.drawImage(orbSpiral, -w / 2, -h / 2, w, h);
		c.restore();
	}
	function drawGem(c, id, m) {
		c.drawImage(art[id], 0, 0);
		shine(c, art[id], m);
		c.save();
		c.globalCompositeOperation = 'screen';
		c.globalAlpha = m.active * 0.13;
		c.fillStyle = SYMBOLS.find((s) => s.id === id).colour;
		c.beginPath();
		c.moveTo(150, 68);
		c.lineTo(229, 150);
		c.lineTo(150, 232);
		c.lineTo(150, 150);
		c.closePath();
		c.fill();
		c.restore();
		star(c, 151, 34, 15, m.active * Math.max(0, Math.sin((m.p - 0.48) * Math.PI * 5)));
	}
	function drawKey(c, ms, options) {
		const pose = keyPayingFrame(keyRig, ms, options),
			scale = 270 / 144;
		blueCard(c);
		c.save();
		c.translate(150, 150 - pose.y * scale);
		c.rotate((-pose.degrees * Math.PI) / 180);
		c.drawImage(art.key, -150, -150);
		c.restore();
	}

	return function render(
		c,
		id,
		ms,
		{
			size = 300,
			x = 0,
			y = 0,
			speed = 1,
			reduced = false,
			cluster = '#7bff3c',
			anchors = false,
		} = {},
	) {
		const m = symbolMotion(ms, { speed, reduced });
		c.save();
		c.translate(x, y);
		c.scale(size / 300, size / 300);
		if (id === 'eye') drawEye(c, ms, { speed, reduced });
		else if (id === 'envelope') renderPremium(c, id, ms, { speed, reduced, anchors });
		else if (id === 'coin') drawCoin(c, m);
		else if (id === 'orb') drawOrb(c, m);
		else if (id === 'pharaoh') renderPremium(c, id, ms, { speed, reduced, anchors });
		else if (id === 'wild') drawCrystalWild(c, ms, { speed, reduced, cluster, size: 300 });
		else if (id === 'key') drawKey(c, ms, { speed, reduced });
		else drawGem(c, id, m);
		c.restore();
	};
}

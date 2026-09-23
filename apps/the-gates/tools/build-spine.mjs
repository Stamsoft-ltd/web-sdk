/** Authored Spine 4.2 rigs. No outcome logic or image editing. Rebuild: node tools/build-spine.mjs */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../static/assets/the-gates/spine/', import.meta.url));
const artLayout = JSON.parse(readFileSync(out + 'art-layout.json', 'utf8'));
const save = (name, data) =>
	writeFileSync(out + name, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
const regions = {
	frame: [8, 8, 270, 298],
	red: [318, 28, 218, 260],
	blue: [592, 28, 220, 260],
	green: [876, 28, 224, 260],
	purple: [1164, 26, 230, 265],
	amber: [35, 310, 227, 257],
	crown: [273, 282, 300, 310],
	face: [588, 322, 228, 251],
	rays: [825, 281, 305, 313],
	sun: [1155, 338, 240, 216],
	eyeFrame: [5, 576, 274, 260],
	iris: [329, 630, 186, 178],
	bowl: [559, 591, 273, 193],
	stem: [848, 624, 265, 182],
	orb: [1124, 573, 273, 258],
	stand: [3, 840, 280, 259],
	wildFrame: [282, 813, 290, 287],
	vortex: [577, 831, 249, 246],
	glint: [928, 904, 108, 128],
	wisp: [1147, 825, 224, 292],
};
function atlas(page, w, h, entries) {
	return (
		`${page}\nsize: ${w},${h}\nfilter: Linear,Linear\npma: false\n` +
		Object.entries(entries)
			.map(([n, [x, y, w, h]]) => `${n}\n  bounds: ${x},${y},${w},${h}\n`)
			.join('')
	);
}
save('symbols.atlas', atlas('symbols.png', 1402, 1122, regions));
function rig(w, h) {
	return {
		skeleton: { spine: '4.2.74', x: -w / 2, y: -h / 2, width: w, height: h },
		bones: [{ name: 'root' }],
		slots: [],
		skins: [{ name: 'default', attachments: {} }],
		animations: {},
	};
}
function part(r, name, path, w, h, x = 0, y = 0, parent = 'root', alpha = 1) {
	r.bones.push({ name, parent, x, y });
	r.slots.push({
		name,
		bone: name,
		attachment: name,
		color: `ffffff${Math.round(alpha * 255)
			.toString(16)
			.padStart(2, '0')}`,
	});
	r.skins[0].attachments[name] = { [name]: { path, width: w, height: h } };
}
// Align an artwork landmark to its bone, NOT the rectangular atlas region center.
function register(r, name, region, landmark) {
	const a = r.skins[0].attachments[name][name];
	a.x = ((region[0] + region[2] / 2 - landmark[0]) * a.width) / region[2];
	a.y = ((landmark[1] - region[1] - region[3] / 2) * a.height) / region[3];
}
const rotate = (d, amplitude) =>
	[0, 0.25, 0.5, 0.75, 1].map((t, i) => ({
		time: t * d,
		value: [0, amplitude, 0, -amplitude, 0][i],
	}));
const move = (d, x, y) => [
	{ time: 0, x: 0, y: 0 },
	{ time: d * 0.25, x, y },
	{ time: d * 0.5, x: 0, y: 0 },
	{ time: d * 0.75, x: -x, y: -y },
	{ time: d, x: 0, y: 0 },
];
const scale = (d, x, y = x) => [
	{ time: 0, x: 1, y: 1 },
	{ time: d * 0.5, x, y },
	{ time: d, x: 1, y: 1 },
];
const alpha = (d, max = 1) => [
	{ time: 0, value: 0 },
	{ time: d * 0.42, value: 0 },
	{ time: d * 0.55, value: max },
	{ time: d * 0.75, value: 0 },
	{ time: d, value: 0 },
];
const names = [
	'RED_GEM',
	'BLUE_GEM',
	'GREEN_GEM',
	'PURPLE_GEM',
	'AMBER_GEM',
	'GUARDIAN_MASK',
	'SUN_MEDALLION',
	'SACRED_EYE',
	'RUNE_CHALICE',
	'CRYSTAL_ORB',
	'WILD',
];
for (const name of names) {
	const r = rig(280, 280);
	const idle = { bones: {}, slots: {} },
		pay = { bones: {}, slots: {} };
	if (name.endsWith('_GEM')) {
		part(r, 'gem', name.split('_')[0].toLowerCase(), 164, 202, 0, 0);
		part(r, 'setting', 'frame', 228, 250);
		idle.bones.gem = { rotate: rotate(5.6, 0.7) };
		pay.bones.gem = { rotate: rotate(0.85, 5), scale: scale(0.85, 1.025, 0.99) };
		pay.bones.setting = { rotate: rotate(0.85, -1.3) };
	} else if (name === 'GUARDIAN_MASK') {
		part(r, 'face', 'face', 112, 131, 0, -50);
		part(r, 'crown', 'crown', 241, 249);
		idle.bones.crown = { translate: move(5.2, 0, 1.2) };
		pay.bones.crown = { translate: move(1.15, 0, 7), rotate: rotate(1.15, 1.8) };
		pay.bones.face = { translate: move(1.15, 0, 2), rotate: rotate(1.15, -2) };
	} else if (name === 'SUN_MEDALLION') {
		part(r, 'rays', 'rays', 248, 248);
		part(r, 'face', 'sun', 108, 102);
		register(r, 'rays', regions.rays, [976.9, 445.72]);
		register(r, 'face', regions.sun, [1259.5, 447]);
		idle.bones.rays = { rotate: rotate(6, 3) };
		pay.bones.rays = {
			rotate: [
				{ time: 0, value: 0 },
				{ time: 2.4, value: 360 },
			],
		};
		pay.bones.face = { scale: scale(0.8, 1.065) };
	} else if (name === 'SACRED_EYE') {
		part(r, 'iris', 'iris', 142, 73);
		part(r, 'frame', 'eyeFrame', 246, 234);
		idle.bones.iris = { translate: move(5.8, 3, 0) };
		pay.bones.iris = { translate: move(0.9, 8, 0), scale: scale(0.9, 1.06, 1.12) };
		pay.bones.frame = { rotate: rotate(0.9, 1) };
	} else if (name === 'RUNE_CHALICE') {
		part(r, 'stem', 'stem', 166, 106, 0, -73);
		part(r, 'bowl', 'bowl', 224, 160, 0, 34);
		part(r, 'magic', 'wisp', 65, 105, 0, 88, 'root', 0);
		idle.bones.bowl = { rotate: rotate(5, 1) };
		pay.bones.bowl = { rotate: rotate(1.1, 4), translate: move(1.1, 0, 4) };
		pay.bones.magic = { translate: move(1.1, 6, 13), scale: scale(1.1, 1.1, 1.2) };
		pay.slots.magic = { alpha: alpha(1.1, 0.75) };
	} else if (name === 'CRYSTAL_ORB') {
		part(r, 'orb', 'orb', 206, 196, 0, 27);
		part(r, 'base', 'stand', 227, 174, 0, -44);
		idle.bones.orb = { rotate: rotate(5, 3), translate: move(5, 0, 2) };
		pay.bones.orb = {
			rotate: [
				{ time: 0, value: 0 },
				{ time: 2.2, value: 360 },
			],
			translate: move(1.1, 0, 10),
		};
		pay.bones.base = { rotate: rotate(1.1, -1.5) };
	} else {
		part(r, 'vortex', 'vortex', 188, 188);
		part(r, 'rim', 'wildFrame', 248, 248);
		idle.bones.vortex = {
			rotate: [
				{ time: 0, value: 0 },
				{ time: 12, value: 360 },
			],
		};
		pay.bones.vortex = {
			rotate: [
				{ time: 0, value: 0 },
				{ time: 1.2, value: 360 },
			],
		};
		pay.bones.rim = { rotate: rotate(1.2, 4) };
	}
	part(r, 'spark', 'glint', 31, 35, -44, 68, 'root', 0);
	idle.slots.spark = { alpha: alpha(5.6, 0.7) };
	idle.bones.spark = { rotate: rotate(5.6, 40), scale: scale(5.6, 1.2) };
	pay.slots.spark = { alpha: alpha(0.75, 1) };
	pay.bones.spark = { rotate: rotate(0.75, 65), scale: scale(0.75, 1.5) };
	r.animations = { idle, paying: pay };
	save(`${name}.json`, r);
}
// Fire layers share one atlas, but each plume has an independent bone and timeline.
const flameRegions = {};
for (const [row, color] of ['gold', 'green', 'red'].entries()) {
	[
		[0, 490],
		[550, 250],
		[840, 280],
		[1190, 340],
	].forEach(([x, w], col) => (flameRegions[`${color}-${col}`] = [x, row * 341, w, 340]));
}
let flameAtlas = atlas('flames.png', 1536, 1024, flameRegions);
for (const color of ['gold', 'green', 'red']) {
	const page = artLayout['burn-' + color];
	flameAtlas +=
		'\n' +
		atlas(
			'burn-' + color + '.png',
			...page.size,
			Object.fromEntries(page.frames.map((f, i) => [`${color}-frame-${i}`, f.region])),
		);
	const r = rig(160, 180),
		burn = { slots: {} };
	const duration = 1.2,
		step = 0.1;
	for (const [layer, parity] of [
		['flow-a', 0],
		['flow-b', 1],
	]) {
		part(r, layer, `${color}-frame-${parity}`, 160, 160, 0, -75);
		const slot = r.slots.at(-1);
		slot.blend = 'additive';
		slot.attachment = 'frame-' + parity;
		const attachments = {};
		page.frames.forEach((f, i) => {
			const [x, y, w, h] = f.region;
			attachments['frame-' + i] = {
				path: `${color}-frame-${i}`,
				width: 160,
				height: 160,
				x: ((w / 2 - f.centerX) * 160) / w,
				y: ((f.baseline - h / 2) * 160) / h,
			};
		});
		r.skins[0].attachments[layer] = attachments;
		const attachment = [{ time: 0, name: 'frame-' + parity }],
			opacity = [];
		for (let k = 0; k <= 12; k++) {
			const time = Number((k * step).toFixed(4));
			opacity.push({ time, value: k % 2 === parity ? 0.86 : 0 });
			// Next source frame changes only while this layer is fully transparent.
			if (k > 0 && k % 2 !== parity) attachment.push({ time, name: 'frame-' + ((k + 1) % 12) });
		}
		burn.slots[layer] = { attachment, alpha: opacity };
	}
	part(r, 'coal-bed', `${color}-0`, 144, 38, 0, -56, 'root', 0.12);
	r.slots.at(-1).blend = 'additive';
	burn.slots['coal-bed'] = {
		alpha: [
			{ time: 0, value: 0.12 },
			{ time: 0.3, value: 0.18 },
			{ time: 0.7, value: 0.1 },
			{ time: duration, value: 0.12 },
		],
	};
	r.animations.burn = burn;
	save(`fire-${color}.json`, r);
}
save('flames.atlas', flameAtlas);
save('manifest.json', {
	version: '4.2.74',
	symbols: names,
	flames: ['gold', 'green', 'red'],
	sourceLayers: 20 + 12,
});

// Hand-traced architectural energy parts, separate transparent vector source layers.
// Rasterized into energy.png by rasterize-spine.mjs. Each path has its own Spine slot.
const energyRegions = {},
	energyPaths = [];
let packX = 8,
	packY = 8,
	rowHeight = 0;
for (const mode of ['base', 'normal', 'super', 'hidden']) {
	const r = rig(1536, 1024),
		pulse = { slots: {} };
	const color = { base: '#5df4ff', normal: '#ffd87b', super: '#71ffc0', hidden: '#ff3f22' }[mode];
	const paths = [];
	if (mode === 'hidden') {
		// Wall fissures split into staggered branches; bright core stays inside the fracture.
		paths.push(
			[
				[976, 245],
				[948, 254],
				[934, 268],
				[921, 279],
			],
			[
				[921, 279],
				[928, 299],
				[909, 307],
				[884, 317],
			],
			[
				[884, 317],
				[876, 339],
				[862, 352],
				[846, 374],
			],
			[
				[957, 423],
				[939, 435],
				[950, 452],
				[932, 470],
			],
			[
				[932, 470],
				[940, 494],
				[919, 511],
				[909, 529],
			],
			[
				[375, 437],
				[397, 451],
				[407, 478],
				[423, 488],
			],
			[
				[423, 488],
				[440, 491],
				[455, 515],
				[472, 521],
			],
			[
				[701, 78],
				[724, 96],
				[739, 90],
				[753, 105],
			],
			[
				[1407, 664],
				[1417, 651],
				[1408, 633],
				[1421, 616],
			],
			[
				[328, 65],
				[319, 81],
				[329, 102],
				[322, 118],
			],
		);
	} else if (mode === 'base') {
		// Existing cyan runes on jambs: independent pulses, not a whole-scene brightness wash.
		for (const x of [204, 1028, 1435])
			for (const y of [120, 217, 310, 486])
				paths.push([
					[x, y - 11],
					[x + 3, y],
					[x - 3, y + 11],
					[x + 2, y],
					[x + 7, y + 4],
				]);
	} else if (mode === 'normal') {
		for (const [x, y] of [
			[201, 144],
			[202, 269],
			[197, 473],
			[1030, 278],
			[1432, 278],
			[1031, 501],
			[1433, 501],
		])
			paths.push([
				[x, y - 14],
				[x + 6, y],
				[x, y + 14],
				[x - 6, y],
				[x, y - 14],
			]);
		paths.push(
			[
				[345, 60],
				[560, 60],
				[768, 60],
			],
			[
				[769, 60],
				[910, 60],
				[992, 60],
			],
			[
				[578, 847],
				[767, 805],
				[932, 845],
			],
		);
	} else {
		for (const [x, y] of [
			[206, 154],
			[205, 272],
			[198, 493],
			[1031, 274],
			[1434, 274],
			[1031, 508],
			[1434, 508],
		])
			paths.push([
				[x, y - 13],
				[x + 5, y],
				[x, y + 13],
				[x - 5, y],
				[x, y - 13],
			]);
		paths.push(
			[
				[1154, 95],
				[1169, 123],
				[1199, 137],
			],
			[
				[1309, 95],
				[1295, 122],
				[1266, 137],
			],
			[
				[729, 839],
				[766, 812],
				[807, 839],
			],
			[
				[729, 839],
				[766, 875],
				[807, 839],
			],
		);
	}
	paths.forEach((points, i) => {
		const minX = Math.min(...points.map((p) => p[0])) - 7,
			minY = Math.min(...points.map((p) => p[1])) - 7;
		const w = Math.max(...points.map((p) => p[0])) - minX + 7,
			h = Math.max(...points.map((p) => p[1])) - minY + 7;
		if (packX + w > 1024) {
			packX = 8;
			packY += rowHeight + 8;
			rowHeight = 0;
		}
		const name = `${mode}-${i}`;
		energyRegions[name] = [packX, packY, w, h];
		const pointsText = points.map(([x, y]) => `${x - minX + packX},${y - minY + packY}`).join(' ');
		energyPaths.push(
			`<g fill="none" stroke-linejoin="round" stroke-linecap="round"><polyline points="${pointsText}" stroke="${color}" stroke-width="5" opacity=".22"/><polyline points="${pointsText}" stroke="${color}" stroke-width="1.6"/><polyline points="${pointsText}" stroke="#fff3df" stroke-width=".5" opacity=".8"/></g>`,
		);
		part(r, name, name, w, h, minX + w / 2 - 768, 512 - (minY + h / 2));
		const offset = (i * 0.43) % 6;
		const keys = [0, 6, ...[0, 0.6, 1.25, 2.4, 4.5].map((t) => (t + offset) % 6)].sort(
			(a, b) => a - b,
		);
		const value = (t) => {
			const p = (((t - offset) % 6) + 6) % 6;
			return p < 0.6
				? 0.08 + (p / 0.6) * 0.57
				: p < 1.25
					? 0.65 - ((p - 0.6) / 0.65) * 0.4
					: p < 2.4
						? 0.25 - ((p - 1.25) / 1.15) * 0.17
						: 0.08;
		};
		pulse.slots[name] = { alpha: keys.map((time) => ({ time, value: value(time) })) };
		packX += w + 8;
		rowHeight = Math.max(rowHeight, h);
	});
	r.animations.pulse = pulse;
	save(`ambient-${mode}.json`, r);
}
const energyHeight = Math.ceil((packY + rowHeight + 8) / 16) * 16;
save(
	'energy.svg',
	`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="${energyHeight}" viewBox="0 0 1024 ${energyHeight}">${energyPaths.join('')}</svg>`,
);
save('energy.atlas', atlas('energy.png', 1024, energyHeight, energyRegions));

// Presentation art: separate wings, socket, gem, plaque and lettering.
const presentationRegions = {
	left: [6, 94, 349, 280],
	right: [373, 93, 338, 281],
	plaque: [712, 216, 398, 195],
	crest: [1119, 62, 324, 362],
	normal: [14, 578, 332, 90],
	super: [367, 578, 347, 90],
	hidden: [733, 578, 349, 90],
	complete: [1097, 578, 347, 90],
	cyanGem: [48, 778, 264, 259],
	greenGem: [412, 778, 264, 259],
	redGem: [778, 778, 262, 259],
	goldGem: [1140, 778, 264, 259],
};
// Large text/plaque live on standalone pages; never upscale the old tiny cells.
for (const name of ['plaque', 'normal', 'super', 'hidden', 'complete'])
	delete presentationRegions[name];
let presentationAtlas = atlas('presentations.png', 1448, 1086, presentationRegions);
for (const name of ['plaque', 'normal', 'super', 'hidden', 'complete']) {
	const art = artLayout['hq-' + name];
	const [x, y, right, bottom] = art.bounds;
	presentationAtlas +=
		'\n' + atlas('hq-' + name + '.png', ...art.size, { [name]: [x, y, right - x, bottom - y] });
}
save('presentations.atlas', presentationAtlas);
for (const mode of ['normal', 'super', 'hidden', 'complete']) {
	const r = rig(1100, 600);
	part(r, 'left-wing', 'left', 360, 270, -105, 55);
	r.skins[0].attachments['left-wing']['left-wing'].x = -164;
	r.skins[0].attachments['left-wing']['left-wing'].y = 74;
	part(r, 'right-wing', 'right', 360, 270, 105, 55);
	r.skins[0].attachments['right-wing']['right-wing'].x = 164;
	r.skins[0].attachments['right-wing']['right-wing'].y = 74;
	part(
		r,
		'gem',
		{ normal: 'cyanGem', super: 'greenGem', hidden: 'redGem', complete: 'goldGem' }[mode],
		91,
		91,
		0,
		140,
	);
	part(r, 'crest', 'crest', 246, 269, 0, 140);
	register(r, 'crest', presentationRegions.crest, [1272.34, 252.8]);
	const gemRegion =
		presentationRegions[
			{ normal: 'cyanGem', super: 'greenGem', hidden: 'redGem', complete: 'goldGem' }[mode]
		];
	register(
		r,
		'gem',
		gemRegion,
		{ normal: [180, 903], super: [542, 903], hidden: [904.5, 903.5], complete: [1267, 902] }[mode],
	);
	const plate = artLayout['hq-plaque'].bounds,
		title = artLayout['hq-' + mode].bounds;
	part(r, 'plaque', 'plaque', 1000, (1000 * (plate[3] - plate[1])) / (plate[2] - plate[0]), 0, -83);
	// Writing well center is (1024,283) in the HD plate, above pendant/bounds center.
	const titleY = -83 + (((plate[1] + plate[3]) / 2 - 283) * 1000) / (plate[2] - plate[0]);
	part(r, 'title', mode, 660, (660 * (title[3] - title[1])) / (title[2] - title[0]), 0, titleY);
	r.animations.enter = {
		bones: {
			'left-wing': {
				rotate: [
					{ time: 0, value: 24 },
					{ time: 0.35, value: -2 },
					{ time: 0.65, value: 0 },
				],
			},
			'right-wing': {
				rotate: [
					{ time: 0, value: -24 },
					{ time: 0.4, value: 2 },
					{ time: 0.7, value: 0 },
				],
			},
			crest: {
				scale: [
					{ time: 0, x: 0.7, y: 0.7 },
					{ time: 0.4, x: 1.06, y: 1.06 },
					{ time: 0.7, x: 1, y: 1 },
				],
			},
			title: {
				translate: [
					{ time: 0, x: 0, y: -18 },
					{ time: 0.2, x: 0, y: -18 },
					{ time: 0.6, x: 0, y: 0 },
				],
				scale: [
					{ time: 0, x: 0.85, y: 0.85 },
					{ time: 0.6, x: 1, y: 1 },
				],
			},
		},
		slots: {
			title: {
				alpha: [
					{ time: 0, value: 0 },
					{ time: 0.15, value: 0 },
					{ time: 0.4, value: 1 },
				],
			},
		},
	};
	r.animations.idle = {
		bones: {
			'left-wing': { rotate: rotate(4.8, 1.8) },
			'right-wing': { rotate: rotate(4.8, -1.8) },
			gem: { rotate: rotate(4.8, 5), scale: scale(4.8, 1.04) },
			crest: { rotate: rotate(4.8, 0.7) },
		},
	};
	save(`bonus-${mode}.json`, r);
}
for (const tier of ['sweet', 'wild', 'epic', 'mythic', 'legendary', 'max']) {
	const plaque = tier === 'max' ? 'legendary' : tier;
	save(
		`win-${tier}.atlas`,
		atlas(`../wins/${plaque}-plaque.png`, 1942, 809, { plaque: [0, 0, 1942, 809] }) +
			'\n' +
			atlas(`../wins/${tier}-title.png`, 2172, 724, { title: [0, 0, 2172, 724] }),
	);
	const r = rig(1942, 809);
	part(r, 'frame', 'plaque', 1942, 809);
	part(r, 'lettering', 'title', 1320, 440, 0, plaque === 'legendary' ? -81 : -40);
	r.animations.enter = {
		bones: {
			frame: {
				scale: [
					{ time: 0, x: 0.85, y: 0.85 },
					{ time: 0.3, x: 1.025, y: 1.025 },
					{ time: 0.55, x: 1, y: 1 },
				],
			},
			lettering: {
				scale: [
					{ time: 0, x: 0.7, y: 0.7 },
					{ time: 0.18, x: 0.7, y: 0.7 },
					{ time: 0.45, x: 1.05, y: 1.05 },
					{ time: 0.7, x: 1, y: 1 },
				],
				translate: [
					{ time: 0, x: 0, y: -35 },
					{ time: 0.7, x: 0, y: 0 },
				],
			},
		},
		slots: {
			lettering: {
				alpha: [
					{ time: 0, value: 0 },
					{ time: 0.14, value: 0 },
					{ time: 0.4, value: 1 },
				],
			},
		},
	};
	r.animations.idle = {
		bones: { frame: { rotate: rotate(4.8, 0.3) }, lettering: { translate: move(4.8, 0, 4) } },
	};
	save(`win-${tier}.json`, r);
}

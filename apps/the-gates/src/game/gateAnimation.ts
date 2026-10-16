/** Standalone gate authoring: eventId changes cosmetic shake only, never rewards. */
import { visualRandom } from './visualRandom.ts';
export const GATE_CYCLE = {
	impact: 0.36,
	openStart: 0.58,
	opened: 1.02,
	rewardStart: 1.1,
	rewardHoldEnd: 1.85,
	rewardGone: 2.02,
	finished: 2.18,
};
export const GATE_SPARK_COUNT = 12;
const move = (f: number[][]) => f.map(([time, x, y = 0]) => ({ time, x, y }));
const scale = (f: number[][]) => f.map(([time, x, y = x]) => ({ time, x, y }));
const rotate = (f: number[][]) => f.map(([time, value]) => ({ time, value }));
const alpha = (f: number[][]) => f.map(([time, value]) => ({ time, value }));
export function gateImpactSparks(eventId: string) {
	const random = visualRandom(`${eventId}:gate-sparks`);
	return Array.from({ length: GATE_SPARK_COUNT }, (_, i) => ({
		name: `impact-spark-${i}`,
		x: (random() - 0.5) * 5,
		y: (Math.floor(i / 2) - 2.5) * 48 + (random() - 0.5) * 14,
		width: 28 + random() * 17,
		rotation: (random() - 0.5) * 44,
		delay: random() * 0.014,
		life: 0.145 + random() * 0.044,
		dx: (i % 2 === 0 ? -1 : 1) * (48 + random() * 67),
		dy: (random() - 0.5) * 94,
		spin: (random() - 0.5) * 95,
	}));
}
export function gateCycleTracks(eventId: string) {
	const random = visualRandom(`${eventId}:gate-impact`),
		kick = 5 + random() * 2,
		sign = random() < 0.5 ? -1 : 1;
	const left = [
		[0, -650],
		[0.14, -490],
		[0.26, -220],
		[0.33, -55],
		[0.36, 4],
		[0.395, -3],
		[0.44, 1],
		[0.48, 0],
		[0.58, 0],
		[0.67, -18],
		[0.8, -175],
		[0.94, -470],
		[1.02, -650],
		[2.18, -650],
	];
	const doorAlpha = alpha([
		[0, 1],
		[1.02, 1],
		[1.021, 0],
		[2.18, 0],
	]);
	const tracks: {
		bones: Record<string, unknown>;
		slots: Record<string, unknown>;
		events: { time: number; name: string }[];
	} = {
		bones: {
			stage: {
				translate: move([
					[0, 0],
					[0.36, 0],
					[0.378, sign * kick, -2],
					[0.403, -sign * kick * 0.8, 2],
					[0.43, sign * kick * 0.5, -1],
					[0.46, -sign * kick * 0.25, 0],
					[0.51, 0],
					[2.18, 0],
				]),
				rotate: rotate([
					[0, 0],
					[0.36, 0],
					[0.388, sign * 0.45],
					[0.424, -sign * 0.3],
					[0.468, sign * 0.12],
					[0.51, 0],
					[2.18, 0],
				]),
			},
			'door-left': { translate: move(left) },
			'door-right': { translate: move(left.map(([t, x]) => [t, -x])) },
			'portal-root': {
				scale: scale([
					[0, 0.001],
					[0.5, 0.001],
					[0.68, 1.06],
					[0.83, 0.98],
					[1.02, 1],
					[1.85, 1],
					[1.91, 0.48],
					[1.98, 0.001],
					[2.18, 0.001],
				]),
				translate: move([
					[0, 0],
					[1.02, 0],
					[1.4, 0, 3],
					[1.85, 0],
					[2.18, 0],
				]),
			},
			'portal-vortex': {
				rotate: rotate([
					[0, 0],
					[0.5, 0],
					[1.02, 85],
					[1.85, 235],
					[2.18, 290],
				]),
			},
			'portal-rim': {
				rotate: rotate([
					[0, 0],
					[0.5, 0],
					[1.02, -3],
					[1.42, 3],
					[1.85, 0],
					[2.18, 0],
				]),
			},
			reward: {
				// Reverse suction: two turns out of the portal while the leaves part.
				// Adjacent angles stay below 180 degrees (Spine shortest-arc interpolation).
				rotate: rotate([
					[0, -720],
					[0.58, -720],
					[0.67, -576],
					[0.76, -432],
					[0.85, -288],
					[0.94, -144],
					[1.02, -24],
					[1.1, 0],
					[2.18, 0],
				]),
				scale: scale([
					[0, 0.02],
					[0.58, 0.02],
					[0.67, 0.08],
					[0.76, 0.24],
					[0.85, 0.49],
					[0.94, 0.8],
					[1.02, 1.08],
					[1.1, 1],
					[1.85, 1],
					[1.96, 0.82],
					[2.02, 0.05],
					[2.18, 0.05],
				]),
				translate: move([
					[0, 0, -14],
					[0.58, 0, -14],
					[0.76, 0, -10],
					[0.94, 0, -4],
					[1.1, 0],
					[1.45, 0, 4],
					[1.85, 0],
					[2.02, 0, -9],
					[2.18, 0, -9],
				]),
			},
		},
		slots: {
			'door-left': { alpha: doorAlpha },
			'door-right': { alpha: doorAlpha },
			'portal-vortex': {
				alpha: alpha([
					[0, 0],
					[0.5, 0],
					[0.56, 1],
					[2.08, 1],
					[2.18, 0],
				]),
			},
			'portal-rim': {
				alpha: alpha([
					[0, 0],
					[0.5, 0],
					[0.56, 1],
					[2.08, 1],
					[2.18, 0],
				]),
			},
			reward: {
				alpha: alpha([
					[0, 0],
					[0.58, 0],
					[0.67, 1],
					[1.85, 1],
					[2.02, 0],
					[2.18, 0],
				]),
			},
		},
		events: [
			{ time: 0.36, name: 'gateImpact' },
			{ time: 1.02, name: 'gateOpened' },
			{ time: 1.1, name: 'rewardShown' },
			{ time: 2.02, name: 'rewardRemoved' },
			{ time: 2.18, name: 'gateFinished' },
		],
	};
	// Frontmost comic flash + sparks launched from several points along the seam.
	tracks.bones['impact-flash'] = {
		scale: scale([
			[0, 0.001],
			[0.36, 0.001],
			[0.375, 1.2, 0.8],
			[0.397, 0.85, 1.05],
			[0.445, 0.001],
			[2.18, 0.001],
		]),
	};
	tracks.slots['impact-flash'] = {
		alpha: alpha([
			[0, 0],
			[0.36, 0],
			[0.365, 1],
			[0.397, 1],
			[0.445, 0],
			[2.18, 0],
		]),
	};
	for (const spark of gateImpactSparks(eventId)) {
		const start = GATE_CYCLE.impact + spark.delay,
			end = start + spark.life;
		const size = spark.width / 36;
		tracks.bones[spark.name] = {
			translate: move([
				[0, spark.x, spark.y],
				[start, spark.x, spark.y],
				[start + 0.045, spark.x + spark.dx * 0.48, spark.y + spark.dy * 0.4],
				[end, spark.x + spark.dx, spark.y + spark.dy - 12],
				[2.18, spark.x + spark.dx, spark.y + spark.dy - 12],
			]),
			scale: scale([
				[0, 0.001],
				[start, 0.001],
				[start + 0.013, 1.15 * size],
				[start + 0.055, 0.9 * size],
				[end, 0.05],
				[2.18, 0.05],
			]),
			rotate: rotate([
				[0, spark.rotation],
				[start, spark.rotation],
				[end, spark.rotation + spark.spin],
				[2.18, spark.rotation + spark.spin],
			]),
		};
		tracks.slots[spark.name] = {
			alpha: alpha([
				[0, 0],
				[start, 0],
				[start + 0.004, 1],
				[start + 0.045, 1],
				[end, 0],
				[2.18, 0],
			]),
		};
	}
	return tracks;
}
/** Move/outro obey live speed; full reward hold stays 750ms at every speed. */
export function gateClockStep(trackTime: number, delta: number, rate: number) {
	if (
		!Number.isFinite(trackTime) ||
		!Number.isFinite(delta) ||
		delta < 0 ||
		!Number.isFinite(rate) ||
		rate <= 0
	)
		throw new Error('Invalid gate clock');
	let t = trackTime,
		remaining = delta;
	for (let i = 0; i < 3 && remaining > 0; i++) {
		const holding = t >= GATE_CYCLE.rewardStart && t < GATE_CYCLE.rewardHoldEnd;
		const boundary =
			t < GATE_CYCLE.rewardStart
				? GATE_CYCLE.rewardStart
				: t < GATE_CYCLE.rewardHoldEnd
					? GATE_CYCLE.rewardHoldEnd
					: Infinity;
		const speed = holding ? 1 : rate,
			needed = (boundary - t) / speed;
		if (remaining < needed) {
			t += remaining * speed;
			break;
		}
		t = boundary;
		remaining -= needed;
	}
	return t - trackTime;
}

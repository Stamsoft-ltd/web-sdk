import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
	KNIGHT_PLACEMENT,
	KNIGHT_PINS,
	KNIGHT_MS,
	KNIGHT_AXIS_LENGTH,
	KNIGHT_GRID_U,
	KNIGHT_GRID_V,
	KNIGHT_ARC_CENTER,
	KNIGHT_ARC_APEX_U,
	KNIGHT_ARC_SEGMENTS,
	knightUV,
	knightPoint,
	knightOpen,
} from './component-knight-motion.mjs';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
test('dense arc mesh keeps silhouette faceting below one tenth of a backing pixel', () => {
	assert.equal(KNIGHT_ARC_SEGMENTS, 64);
	for (let i = 0; i < KNIGHT_GRID_U.length - 1; i++) {
		const a = KNIGHT_GRID_U[i],
			b = KNIGHT_GRID_U[i + 1];
		if (a < -KNIGHT_AXIS_LENGTH / 2 || b > KNIGHT_AXIS_LENGTH / 2) continue;
		assert.ok(b - a <= KNIGHT_AXIS_LENGTH / 64 + 1e-8);
		for (const v of KNIGHT_GRID_V)
			for (const open of [0.25, 0.5, 0.75, 1]) {
				const p = knightUV(a, v),
					q = knightUV(b, v),
					m = knightUV((a + b) / 2, v);
				const P = knightPoint(p.x, p.y, open),
					Q = knightPoint(q.x, q.y, open),
					M = knightPoint(m.x, m.y, open);
				assert.ok(Math.hypot(M.x - (P.x + Q.x) / 2, M.y - (P.y + Q.y) / 2) < 0.05);
			}
	}
});
test('visor arc peaks left of midpoint to match the three-quarter lower guard', () => {
	assert.equal(KNIGHT_ARC_CENTER, 0.4);
	assert.ok(KNIGHT_GRID_U.includes(KNIGHT_ARC_APEX_U));
	const apex = knightUV(KNIGHT_ARC_APEX_U, 0),
		middle = knightUV(0, 0);
	assert.ok(apex.x < middle.x - 20);
	close(knightPoint(apex.x, apex.y, 1).depth, 110);
	assert.ok(knightPoint(apex.x, apex.y, 1).depth > knightPoint(middle.x, middle.y, 1).depth);
	for (let n = 0; n <= 100; n++) {
		const p = knightUV((n / 100 - 0.5) * KNIGHT_AXIS_LENGTH, 0);
		assert.ok(knightPoint(p.x, p.y, 1).depth <= 110 + 1e-8);
	}
});
test('actual PNG end anchors stay fixed at every angle and are mesh vertices', () => {
	for (const p of KNIGHT_PINS)
		for (let n = 0; n <= 100; n++) {
			const q = knightPoint(p.x, p.y, n / 100);
			close(q.x, p.x);
			close(q.y, p.y);
			close(q.z, 0);
		}
	for (const u of [-KNIGHT_AXIS_LENGTH / 2, KNIGHT_AXIS_LENGTH / 2])
		assert.ok(KNIGHT_GRID_U.includes(u));
	assert.ok(KNIGHT_GRID_V.includes(0));
	for (let n = 0; n < 2; n++) {
		const p = knightUV((n - 0.5) * KNIGHT_AXIS_LENGTH, 0);
		close(p.x, KNIGHT_PINS[n].x);
		close(p.y, KNIGHT_PINS[n].y);
	}
});
test('visor is a rigid 3D rotation, not independent vertical squashing', () => {
	const points = [knightUV(-80, 0), knightUV(0, -25), knightUV(0, 45), knightUV(80, 10)];
	for (let n = 0; n <= 100; n++) {
		const r = points.map((p) => knightPoint(p.x, p.y, n / 100));
		for (let i = 0; i < points.length; i++)
			for (let j = i + 1; j < points.length; j++) {
				close(
					Math.hypot(r[i].wx - r[j].wx, r[i].wy - r[j].wy, r[i].wz - r[j].wz),
					Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y, r[i].depth - r[j].depth),
				);
			}
	}
});
test('same transparent plate is identity at rest and lifts smoothly toward forehead', () => {
	for (const u of KNIGHT_GRID_U)
		for (const v of KNIGHT_GRID_V) {
			const p = knightUV(u, v),
				q = knightPoint(p.x, p.y, 0);
			close(q.x, p.x);
			close(q.y, p.y);
		}
	const p = knightUV(0, 15);
	assert.ok(knightPoint(p.x, p.y, 1).y < p.y - 60);
	let previous = knightPoint(p.x, p.y, 0);
	for (let n = 1; n <= 1000; n++) {
		const q = knightPoint(p.x, p.y, n / 1000);
		assert.ok(Object.values(q).every(Number.isFinite));
		assert.ok(Math.hypot(q.x - previous.x, q.y - previous.y) < 0.4);
		previous = q;
	}
	const top = knightUV(0, -25),
		bottom = knightUV(0, 45);
	assert.ok(knightPoint(bottom.x, bottom.y, 1).y - knightPoint(top.x, top.y, 1).y > 40);
});
test('placement is left/up; spirit moves up independently; deterministic timeline settles', () => {
	assert.ok(KNIGHT_PLACEMENT.x < 0);
	assert.ok(KNIGHT_PLACEMENT.y < 300 * 0.3876);
	assert.ok(KNIGHT_PLACEMENT.spiritY < 0);
	assert.equal(knightOpen(0), 0);
	assert.equal(knightOpen(1200), 1);
	assert.equal(knightOpen(KNIGHT_MS), 0);
	for (let ms = -100; ms <= 4000; ms += 7) {
		const a = knightOpen(ms);
		assert.ok(a >= 0 && a <= 1);
		assert.equal(a, knightOpen(ms));
		assert.equal(knightOpen(ms, { reduced: true }), 0);
	}
});
test('one clock, load-time surfaces and original alpha-bearing PNGs retained', async () => {
	const renderer = await readFile(
		new URL('./component-knight-render.mjs', import.meta.url),
		'utf8',
	);
	const frame = renderer.slice(renderer.indexOf('return function render'));
	assert.doesNotMatch(frame, /createElement|new Image|getImageData|putImageData/);
	assert.doesNotMatch(renderer, /requestAnimationFrame|setInterval|closedImage|openImage/);
	const preview = await readFile(
		new URL('./component-knight-preview.mjs', import.meta.url),
		'utf8',
	);
	assert.match(preview, /visibilitychange/);
	assert.match(preview, /prefers-reduced-motion/);
	const validation = JSON.parse(
		await readFile(
			new URL('./assets/palace/knight-components/validation.json', import.meta.url),
			'utf8',
		),
	);
	for (const file of ['helmet.png', 'visor.png']) {
		const data = await readFile(
			new URL('./assets/palace/knight-components/' + file, import.meta.url),
		);
		assert.equal(createHash('sha256').update(data).digest('hex'), validation[file].sha256);
		assert.equal(data[25], 6);
	}
	for (const s of validation.eyeSlit.transparentSamples) assert.equal(s.alpha, 0);
});

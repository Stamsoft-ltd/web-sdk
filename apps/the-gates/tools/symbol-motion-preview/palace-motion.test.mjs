import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
	palaceFrame,
	PALACE_MS,
	PALACE_TIMELINE,
	visorPoint,
	visorWorldPoint,
	VISOR_HINGES,
	VISOR_AXIS_LENGTH,
	visorUV,
} from './palace-motion.mjs';
test('palace concepts have deterministic bounded reversible visor, no whole-helmet shake', () => {
	for (let ms = 0; ms <= 3600; ms += 7) {
		const f = palaceFrame(ms);
		for (const k of ['p', 'active', 'closed', 'spirit', 'liquidGlow'])
			assert.ok(f[k] >= 0 && f[k] <= 1, k);
		assert.ok(Math.abs(f.impact) <= 1);
		assert.ok(Math.abs(f.liquidLift) <= 1.5);
		assert.equal('bodyRotation' in f, false);
	}
	for (const ms of [-10, 0, PALACE_MS, 5000]) {
		const f = palaceFrame(ms);
		assert.equal(f.closed, 0);
		assert.equal(f.active, 0);
		assert.equal(f.impact, 0);
		assert.equal(f.liquidLift, 0);
	}
	assert.equal(palaceFrame(900).closed, 1);
	assert.equal(palaceFrame(1700).closed, 0);
});
test('fast/turbo share one timeline; reduced motion holds golden spirit and liquid rest', () => {
	for (let t = 0; t <= PALACE_MS; t += 19)
		for (const speed of [1, 1.8, 3]) {
			const a = palaceFrame(t),
				b = palaceFrame(t / speed, { speed });
			for (const k of Object.keys(a)) {
				if (k === 'droplets') {
					a[k].forEach((d, i) => {
						for (const field of Object.keys(d))
							assert.ok(Math.abs(d[field] - b[k][i][field]) < 1e-9, field);
					});
				} else assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
			}
			assert.deepEqual(palaceFrame(t, { speed, reduced: true }), palaceFrame(0));
		}
});
test('timeline references are valid, ordered and fit the 1800ms concept clock', () => {
	const c = PALACE_TIMELINE;
	for (const t of c.timelines) {
		assert.ok(c.states.includes(t.fromState));
		assert.ok(c.states.includes(t.toState));
		assert.ok(c.events.includes(t.event));
		assert.ok(
			c.transitions.some(
				(x) => x.from === t.fromState && x.to === t.toState && x.event === t.event,
			),
		);
		let start = -1;
		for (const s of t.steps) {
			assert.ok(s.startMs >= start);
			assert.ok(s.durationMs > 0);
			assert.ok(s.startMs + s.durationMs <= PALACE_MS);
			start = s.startMs;
		}
	}
});
test('one visor texture drives both poses, no two-state composite swap or per-frame readback', async () => {
	const source = await readFile(new URL('./palace-render.mjs', import.meta.url), 'utf8');
	assert.match(source, /light.drawImage\(visor, 0, 0\)/);
	assert.doesNotMatch(source, /closedImage|openImage|crossfade|requestAnimationFrame|setInterval/);
	const frame = source.slice(source.indexOf('return function renderPalace'));
	assert.doesNotMatch(frame, /getImageData|putImageData|new Image|createElement/);
	assert.match(source, /destination-in/);
});
test('preview replaces Envelope/Pharaoh only; concepts retain saved source hashes', async () => {
	const source = await readFile(new URL('./render.mjs', import.meta.url), 'utf8');
	assert.match(source, /name: 'Spirit Knight'/);
	assert.match(source, /name: 'Enchanted Chalice'/);
	assert.match(source, /colour: '#f34a9e'/);
	const provenance = JSON.parse(
		await readFile(new URL('./assets/palace/provenance.json', import.meta.url), 'utf8'),
	);
	for (const a of provenance.assets) {
		const b = await readFile(new URL('./assets/palace/' + a.file, import.meta.url));
		assert.equal(createHash('sha256').update(b).digest('hex'), a.sha256);
		assert.equal(b[25], 6);
	}
});

test('both top visor connections remain fixed through a rigid 3D rotation', () => {
	const points = [
		[53, 120],
		[215, 126],
		[127, 259],
		[75, 205],
		[200, 198],
	];
	for (let i = 0; i <= 100; i++) {
		const closed = i / 100;
		for (const h of VISOR_HINGES) {
			assert.equal(h.z, 0, 'No hidden pivot offset');
			const p = visorPoint(h.x, h.y, closed);
			assert.ok(Math.abs(p.x - h.x) < 1e-9);
			assert.ok(Math.abs(p.y - h.y) < 1e-9);
			assert.ok(Math.abs(p.z) < 1e-9);
		}
		for (let a = 0; a < points.length; a++)
			for (let b = a + 1; b < points.length; b++) {
				const p = visorPoint(...points[a], closed),
					q = visorPoint(...points[b], closed);
				assert.ok(
					Math.abs(
						Math.hypot(p.wx - q.wx, p.wy - q.wy, p.wz - q.wz) -
							Math.hypot(
								points[a][0] - points[b][0],
								points[a][1] - points[b][1],
								p.depth - q.depth,
							),
					) < 1e-9,
				);
			}
	}
	assert.ok(visorPoint(127, 259, 0).y < 140);
	for (const [x, y] of points) {
		const p = visorPoint(x, y, 1);
		assert.ok(Math.abs(p.x - x) < 1e-9);
		assert.ok(Math.abs(p.y - y) < 1e-9);
	}
});
test('visor has a smooth finite outward swing and return, never a pose switch', () => {
	let prev = visorPoint(127, 259, 0);
	for (let i = 1; i <= 1000; i++) {
		const p = visorPoint(127, 259, i / 1000);
		assert.ok(Object.values(p).every(Number.isFinite));
		assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 1);
		prev = p;
	}
});
test('splash is upward, finite and settles; cup wobble stays under 1.5 degrees', () => {
	for (let ms = 0; ms <= 3600; ms += 9) {
		const f = palaceFrame(ms);
		assert.ok(f.splash >= 0 && f.splash <= 1);
		assert.ok(Math.abs(f.cupAngle) <= 0.025);
		assert.ok(Math.abs(f.cupX) <= 1.5);
		assert.ok(Math.abs(f.cupY) <= 0.7);
		assert.equal(f.droplets.length, 7);
		for (const d of f.droplets) {
			assert.ok(Number.isFinite(d.x) && Number.isFinite(d.y));
			assert.ok(d.y <= 53);
			assert.ok(d.alpha >= 0 && d.alpha <= 1);
			assert.ok(d.radius >= 0 && d.radius <= 3);
		}
	}
	for (const ms of [0, 1800, 3600]) {
		const f = palaceFrame(ms);
		assert.equal(f.cupAngle, 0);
		assert.equal(f.cupX, 0);
		assert.equal(f.cupY, 0);
		assert.equal(f.splash, 0);
		assert.ok(f.droplets.every((d) => d.alpha === 0));
	}
	assert.ok(palaceFrame(800).splash > 0.9);
});
test('visor uses a projected texture mesh and fixed top axis, not lift arms or uniform flattening', async () => {
	const src = await readFile(new URL('./palace-render.mjs', import.meta.url), 'utf8');
	assert.doesNotMatch(src, /hingeArms|linkage.dx|linkage.dy|c.scale\(0.76/);
	assert.match(src, /visorPoint\(p.x, p.y, f.closed, f.impact\)/);
	assert.match(src, /texturedTriangle\(/);
	assert.match(src, /projectPlate\(plateRest, palaceFrame\(0\)\)/);
	assert.match(src, /key !== plateFrameKey/);
});

test('raised visor never flips or passes edge-on; face orientation stays upright', () => {
	for (let i = 0; i <= 100; i++) {
		const closed = i / 100,
			top = visorPoint(134, 138, closed),
			bottom = visorPoint(134, 248, closed);
		assert.ok(top.angle >= 0 && top.angle < Math.PI / 2);
		assert.ok(bottom.y > top.y, 'front must remain upright');
		assert.ok(bottom.y - top.y > 40, 'no edge-on collapse');
	}
});

test('actual rendered pin vertices use the exact visible connection coordinates', async () => {
	for (const [i, u] of [-VISOR_AXIS_LENGTH / 2, VISOR_AXIS_LENGTH / 2].entries()) {
		const source = visorUV(u, 0),
			pin = VISOR_HINGES[i];
		assert.ok(Math.hypot(source.x - pin.x, source.y - pin.y) < 1e-10);
		for (const closed of [0, 0.1, 0.25, 0.5, 0.75, 1])
			for (const impact of [-1, 0, 1]) {
				const p = visorPoint(source.x, source.y, closed, impact);
				assert.ok(Math.hypot(p.x - pin.x, p.y - pin.y) < 1e-9, 'texture connection must not slide');
			}
	}
	const renderer = await readFile(new URL('./palace-render.mjs', import.meta.url), 'utf8');
	assert.match(renderer, /const vs = \[[-0-9, ]+, 0,/);
	assert.match(renderer, /const vertex = \(i, j\) => visorUV\(us\[i\], vs\[j\]\)/);
	assert.doesNotMatch(renderer, /const mount|lineTo\(mount/);
	const source = await readFile(new URL('./preview.mjs', import.meta.url), 'utf8');
	assert.match(source, /anchors: \$\('hinges'\).checked/);
});

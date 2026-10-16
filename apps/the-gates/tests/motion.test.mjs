import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	cellMotion,
	MOTION,
	skipAdjust,
	sampleTileTravel,
	landingProgress,
} from '../src/game/motion.ts';
const wave = (speed = 'normal', kind = 'tumble') => ({ speed, kind, cut: null, tail: 130 });
test('Veggie-style gravity scales with sqrt(distance), bottom rows start first', () => {
	const one = cellMotion(wave(), 0, 4, -100);
	const four = cellMotion(wave(), 0, 4, -400);
	assert.equal(four.duration, one.duration * 2);
	assert.ok(
		cellMotion(wave('normal', 'spin'), 0, 0, -600).delay >
			cellMotion(wave('normal', 'spin'), 0, 4, -600).delay,
	);
	assert.ok(Math.abs(one.offset + 109) < 1e-9);
});
test('three distinct speeds shorten travel, removal and landing', () => {
	for (const kind of ['spin', 'tumble', 'exit', 'remove']) {
		const duration = ['normal', 'fast', 'turbo'].map((speed) => {
			const m = cellMotion(wave(speed, kind), 5, 0, -600);
			return m.delay + m.duration + m.impact;
		});
		assert.ok(duration[0] > duration[1] && duration[1] > duration[2]);
	}
	// Updated presentation spec: slower full-scale portal suction, not the retired 520ms curve.
	assert.equal(MOTION.normal.remove, 820);
});
test('skip preserves landed cells, pulls pending cells forward, never lengthens fast cells', () => {
	assert.deepEqual(skipAdjust(20, 80, 110), { delay: 20, duration: 80 });
	assert.deepEqual(skipAdjust(300, 400, 100), { delay: 100, duration: 130 });
	assert.deepEqual(skipAdjust(20, 500, 100), { delay: 20, duration: 210 });
	assert.deepEqual(skipAdjust(0, 50, 10), { delay: 0, duration: 50 });
	assert.deepEqual(skipAdjust(20, 500, 0), { delay: 0, duration: 130 });
});
test('every airborne cell ends by skip tail; no finished animation rewinds', () => {
	for (const kind of ['spin', 'tumble', 'exit', 'remove']) {
		for (let reel = 0; reel < 6; reel++)
			for (let row = 0; row < 5; row++) {
				const initial = cellMotion(wave('normal', kind), reel, row, -600);
				const cut = 150;
				const shortened = cellMotion({ ...wave('normal', kind), cut }, reel, row, -600);
				if (initial.delay + initial.duration <= cut) assert.deepEqual(shortened, initial);
				else assert.ok(shortened.delay + shortened.duration <= cut + 130);
			}
	}
});
test('normal exit plus full board drop stays within the readable normal budget', () => {
	let exit = 0,
		drop = 0;
	for (let reel = 0; reel < 6; reel++)
		for (let row = 0; row < 5; row++) {
			const e = cellMotion(wave('normal', 'exit'), reel, row, -600);
			const d = cellMotion(wave('normal', 'spin'), reel, row, -600);
			exit = Math.max(exit, e.delay + e.duration + 24);
			drop = Math.max(drop, d.delay + d.duration + d.impact + 24);
		}
	assert.ok(
		exit + drop >= 1200 && exit + drop < 1400,
		`${exit + drop}ms outside deliberate Normal budget`,
	);
});

test('normal staggers left-to-right; Fast/Turbo move every tile together', () => {
	for (const kind of ['spin', 'tumble', 'exit']) {
		const delays = Array.from(
			{ length: 6 },
			(_, reel) => cellMotion(wave('normal', kind), reel, 2, -600).delay,
		);
		for (let i = 1; i < 6; i++) assert.ok(delays[i] > delays[i - 1]);
		for (const speed of ['fast', 'turbo']) {
			const contacts = [];
			for (let reel = 0; reel < 6; reel++)
				for (let row = 0; row < 5; row++) {
					const m = cellMotion(wave(speed, kind), reel, row, -(row + 1) * 100);
					assert.equal(m.delay, 0);
					contacts.push(m.duration);
				}
			assert.equal(new Set(contacts).size, 1);
		}
	}
});

test('GPU gravity travel reaches exact cell target at contact without top-left drift', () => {
	const m = cellMotion(wave('normal', 'tumble'), 2, 3, -300);
	assert.ok(sampleTileTravel(m, 0, false) < 0);
	assert.ok(Math.abs(sampleTileTravel(m, m.delay + m.duration, false)) < 1e-10);
	assert.ok(Math.abs(sampleTileTravel(m, m.delay + m.duration + 500, false)) < 1e-10);
	assert.ok(Math.abs(sampleTileTravel(m, 0, true)) < 1e-10);
	assert.ok(sampleTileTravel(m, m.delay + m.duration, true) < 0);
});
test('contact squash clock starts only after the tile reaches its final cell', () => {
	assert.equal(landingProgress(100, { startedAt: 100, delay: 50, duration: 120 }), null);
	assert.equal(landingProgress(150, { startedAt: 100, delay: 50, duration: 120 }), 0);
	assert.equal(landingProgress(210, { startedAt: 100, delay: 50, duration: 120 }), 0.5);
	assert.equal(landingProgress(500, { startedAt: 100, delay: 50, duration: 120 }), 1);
});
test('skip target and renderer contact share one frozen wave clock', () => {
	for (const speed of ['normal', 'fast', 'turbo']) {
		const w = { ...wave(speed, 'spin'), cut: 35, tail: 75 };
		for (let reel = 0; reel < 6; reel++)
			for (let row = 0; row < 5; row++) {
				const m = cellMotion(w, reel, row, -600);
				assert.ok(Math.abs(sampleTileTravel(m, m.delay + m.duration, false)) < 1e-10);
				assert.equal(
					landingProgress(m.delay + m.duration, {
						startedAt: 0,
						delay: m.delay + m.duration,
						duration: m.impact,
					}),
					0,
				);
			}
	}
});

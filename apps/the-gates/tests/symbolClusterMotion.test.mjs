import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
	CLUSTER_SYMBOLS,
	CLUSTER_GESTURE_MS,
	GEM_GESTURE_MS,
	clusterGestureMs,
	clusterClock,
	clusterFrame,
	clusterArtUnits,
	SYMBOL_PART_FILES,
} from '../src/game/symbolClusterMotion.ts';
test('only approved symbols opt into the layered renderer', () => {
	assert.equal(CLUSTER_SYMBOLS.length, 11);
	for (const n of [
		'CRYSTAL_ORB',
		'SACRED_EYE',
		'SUN_MEDALLION',
		'GUARDIAN_MASK',
		'RUNE_CHALICE',
		'WILD',
		'RED_GEM',
		'BLUE_GEM',
		'GREEN_GEM',
		'PURPLE_GEM',
		'AMBER_GEM',
	])
		assert.ok(CLUSTER_SYMBOLS.includes(n));
	for (const n of ['KEY']) assert.ok(!CLUSTER_SYMBOLS.includes(n));
	assert.equal(clusterArtUnits('SACRED_EYE'), 144);
	assert.equal(clusterArtUnits('RED_GEM'), 160);
});
test('one bounded gesture, three CCW Orb turns and one Sun turn, no looping', () => {
	const rest = clusterFrame(0),
		end = clusterFrame(CLUSTER_GESTURE_MS);
	assert.equal(rest.eyeX, 0);
	assert.equal(end.eyeX, 0);
	assert.equal(end.active, 0);
	assert.equal(end.orbAngle, -6 * Math.PI);
	assert.equal(end.sunAngle, 2 * Math.PI);
	assert.deepEqual(clusterFrame(5000), end);
	for (let t = 0; t <= CLUSTER_GESTURE_MS; t++) {
		const f = clusterFrame(t);
		assert.ok(Math.abs(f.eyeX) <= 44 && Math.abs(f.eyeY) <= 13);
		assert.ok(f.irisWidth >= 110 && f.irisWidth <= 131);
		assert.ok(f.active >= 0 && f.active <= 1);
		assert.ok(f.orbAngle <= 0 && f.orbAngle >= -Math.PI * 6);
	}
});
test('speed change accelerates remaining gesture without reset; paused and reduced hold', () => {
	const normal = clusterClock(0, 100, 'normal');
	assert.equal(normal, 100);
	const fast = clusterClock(normal, 100, 'fast');
	assert.equal(fast, 300);
	assert.equal(clusterClock(fast, 100, 'turbo'), 600);
	assert.equal(clusterClock(fast, 100, 'turbo', true), fast);
	assert.equal(clusterClock(800, 100, 'turbo'), 1100);
	assert.equal(clusterClock(1700, 100, 'turbo'), GEM_GESTURE_MS);
	assert.deepEqual(clusterFrame(500, true), clusterFrame(0));
});
test('live layers are byte-identical to approved supplied PNGs and runtime paths exist', async () => {
	const root = new URL('../static/assets/the-gates/symbol-parts/', import.meta.url);
	const provenance = JSON.parse(await readFile(new URL('provenance.json', root), 'utf8'));
	assert.equal(provenance.assets.length, 20);
	assert.equal(Object.keys(SYMBOL_PART_FILES).length, 19);
	for (const a of provenance.assets) {
		const bytes = await readFile(new URL(a.file, root));
		assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
	}
	for (const file of Object.values(SYMBOL_PART_FILES))
		await readFile(new URL('../static/' + file.replace(/^\.\//, ''), import.meta.url));
});

test('layered art uses Spine slot order and existing lifecycle; no extra renderer or timer', async () => {
	const board = await readFile(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	const layers = await readFile(
		new URL('../src/game/gpuClusterSymbols.ts', import.meta.url),
		'utf8',
	);
	assert.match(board, /addSlotObject\('body', tile.cluster.view\)/);
	assert.match(board, /removeSlotObject\('body'\)/);
	assert.match(board, /clusterArt\?\.destroy\(\)/);
	assert.match(layers, /slot.color.a = 0/);
	assert.match(layers, /body.a, body.c, body.b, body.d, body.worldX, body.worldY/);
	assert.doesNotMatch(
		layers,
		/requestAnimationFrame|setInterval|new Application|\.source\.update\(/,
	);
});

test('gem shimmer runs at half speed without changing other approved gestures or spin waits', async () => {
	for (const name of CLUSTER_SYMBOLS) {
		const duration = clusterGestureMs(name);
		assert.equal(
			duration,
			name.endsWith('_GEM') || name === 'WILD' ? CLUSTER_GESTURE_MS * 2 : CLUSTER_GESTURE_MS,
		);
		for (let age = 0; age <= CLUSTER_GESTURE_MS; age += 25) {
			const factor = name.endsWith('_GEM') || name === 'WILD' ? 2 : 1;
			assert.deepEqual(clusterFrame(age * factor, false, duration), clusterFrame(age));
		}
		assert.equal(clusterFrame(duration, false, duration).active, 0);
		assert.equal(clusterFrame(duration / 2, true, duration).active, 0);
	}
	const layers = await readFile(
		new URL('../src/game/gpuClusterSymbols.ts', import.meta.url),
		'utf8',
	);
	const board = await readFile(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	assert.match(layers, /clusterFrame\(age, reduced, clusterGestureMs\(name\)\)/);
	assert.match(board, /payingAge < clusterGestureMs\(tile.name!\)/);
});

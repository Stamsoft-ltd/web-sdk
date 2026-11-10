import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scatterCellScale, SCATTER_ART_WIDTH, SCATTER_ART_HEIGHT } from '../src/game/scatterFit.ts';
test('standalone scatter protrudes past its generated cell without stretching', () => {
	for (const [w, h] of [
		[55, 45],
		[95, 78],
		[160, 130],
	]) {
		const s = scatterCellScale(w, h),
			x = s * SCATTER_ART_WIDTH,
			y = s * SCATTER_ART_HEIGHT;
		assert.ok(x > w && y > h);
		assert.ok(x / w < 1.15 && y / h < 1.15);
		assert.ok(Math.abs(x / y - 500 / 431) < 1e-9);
	}
	const atlas = readFileSync(
		new URL(
			'../static/assets/the-gates/art/animations/symbols-normal.atlas',
			import.meta.url,
		),
		'utf8',
	);
	assert.match(atlas, /KEY-art\n  bounds: 215,252,500,431/);
});

test('Wild protrudes uniformly and uses Scatter landing guard and above-frame layer', async () => {
	const { wildCellScale, WILD_ART_WIDTH, WILD_ART_HEIGHT, scatterOverFrame } = await import(
		'../src/game/scatterFit.ts'
	);
	for (const [w, h] of [
		[55, 45],
		[95, 78],
		[160, 130],
	]) {
		const scale = wildCellScale(w, h);
		assert.ok(scale * WILD_ART_HEIGHT > h);
		assert.ok(scale * WILD_ART_HEIGHT <= h * 1.35 + 1e-8);
		assert.ok(Math.abs((scale * WILD_ART_WIDTH) / (scale * WILD_ART_HEIGHT) - 278 / 292) < 1e-8);
	}
	const contact = { delay: 90, duration: 140 };
	assert.equal(scatterOverFrame('dropping', true, false, 229, contact), false);
	assert.equal(scatterOverFrame('dropping', true, false, 230, contact), true);
	assert.equal(scatterOverFrame('spinning', true, false, 1000, contact), false);
	assert.equal(scatterOverFrame('winning', false, false, 0, contact), true);
	const board = readFileSync(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	assert.match(board, /\(tile.name === 'KEY' \|\| tile.name === 'WILD'\) &&\s*scatterOverFrame/);
	assert.match(board, /wildCellScale\(tile.width, tile.height\)/);
	assert.match(board, /parent = overFrame \? keyLayer : tile.root/);
	assert.doesNotMatch(board, /keyLayer.mask\s*=/);
});

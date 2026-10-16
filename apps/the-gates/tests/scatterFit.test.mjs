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
		assert.ok(Math.abs(x / y - 113 / 95) < 1e-9);
	}
	const atlas = readFileSync(
		new URL(
			'../static/assets/the-gates/figma-20261012/motion/symbols-normal.atlas',
			import.meta.url,
		),
		'utf8',
	);
	assert.match(atlas, /KEY-art\n  bounds: 12,13,113,95/);
});

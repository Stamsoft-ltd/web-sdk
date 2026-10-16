import test from 'node:test';
import assert from 'node:assert/strict';
import { ashProgress } from '../src/game/symbolAsh.ts';
import { cellMotion } from '../src/game/motion.ts';
test('portal progress ends inside removal barrier at every speed; live skip never restarts it', () => {
	for (const speed of ['normal', 'fast', 'turbo']) {
		const wave = { speed, kind: 'remove', cut: null, tail: 60 };
		const m = cellMotion(wave, 2, 3, 0);
		const timing = { ...m, startedAt: 1000, seed: 'test' };
		assert.equal(ashProgress(999, timing), 0);
		assert.equal(ashProgress(1000 + m.delay + m.duration + 0.001, timing), 1);
		const cut = cellMotion({ ...wave, cut: 40 }, 2, 3, 0);
		assert.ok(ashProgress(1060, { ...timing, ...cut }) >= ashProgress(1060, timing));
		assert.equal(ashProgress(1100, { ...timing, ...cut }), 1);
	}
});

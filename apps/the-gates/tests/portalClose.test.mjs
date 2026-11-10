import test from 'node:test';
import assert from 'node:assert/strict';
import { portalCloseFrame, gateCloseProgress, PORTAL_CLOSE_MS } from '../src/game/portalClose.ts';
import { bonusTransitionFrame } from '../src/game/bonusTransition.ts';
import { applyPortalClose } from '../src/game/portalCloseVfx.ts';
test('closure shrinks continuously, fades before endpoint and keeps reduced motion still', () => {
	let previous = 1;
	for (let i = 0; i <= 1000; i++) {
		const f = portalCloseFrame(i / 1000);
		assert.ok(f.scale <= previous && f.scale > 0);
		previous = f.scale;
		assert.ok(f.alpha >= 0 && f.alpha <= 1);
	}
	assert.equal(portalCloseFrame(0).scale, 1);
	assert.equal(portalCloseFrame(1).alpha, 0);
	assert.equal(portalCloseFrame(1).pin, 0);
	assert.ok(portalCloseFrame(0.8).pin > 0);
	assert.equal(portalCloseFrame(0.7, true).rotation, 0);
	assert.equal(portalCloseFrame(0.7, true).scale, 1);
	assert.deepEqual(PORTAL_CLOSE_MS, { normal: 500, fast: 260, turbo: 220 });
});
test('runtime overrides old pinched scale uniformly and is transparent at completion', () => {
	const root = { scaleX: 0.2, scaleY: 0.3 },
		rim = { rotation: 0 },
		vortex = { rotation: 0 };
	const slots = { 'portal-rim': { color: { a: 1 } }, 'portal-vortex': { color: { a: 1 } } };
	const skeleton = {
		findBone: (n) => ({ 'portal-root': root, 'portal-rim': rim, 'portal-vortex': vortex })[n],
		findSlot: (n) => slots[n],
		updateWorldTransform: () => {},
	};
	applyPortalClose(skeleton, 0.5);
	assert.equal(root.scaleX, root.scaleY);
	assert.ok(root.scaleX > 0.3);
	applyPortalClose(skeleton, 1);
	assert.equal(slots['portal-rim'].color.a, 0);
	assert.equal(slots['portal-vortex'].color.a, 0);
});
test('Gate closure uses final 500ms of reward outro, not its hold or Hidden wait', () => {
	assert.equal(gateCloseProgress(1.85), 0);
	assert.ok(Math.abs(gateCloseProgress(2.18) - 1) < 1e-10);
	const start = 2.18 - (0.33 * 500) / 1300;
	assert.ok(Math.abs(gateCloseProgress(start + (0.33 * 250) / 1300) - 0.5) < 1e-10);
});
test('bonus popup disappears before portal closure; no portal on base reopening', () => {
	for (const kind of ['dismiss', 'exit']) {
		const t = { kind, startedAt: 0, reduced: false };
		assert.equal(bonusTransitionFrame(t, 400).artScale, 0);
		assert.equal(bonusTransitionFrame(t, 400).portalClose, 0);
		assert.equal(bonusTransitionFrame(t, 650).portalClose, 0.5);
		assert.equal(bonusTransitionFrame(t, 900).portalClose, 1);
		assert.equal(bonusTransitionFrame(t, 900).portalVisible, false);
	}
});

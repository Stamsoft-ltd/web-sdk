import test from 'node:test';
import assert from 'node:assert/strict';
import { isMobileDevice } from '../src/game/deviceType.ts';
test('phone evidence overrides desktop launch hint; viewport size alone never identifies mobile', () => {
	assert.equal(isMobileDevice({ device: 'mobile' }), true);
	assert.equal(
		isMobileDevice({ device: 'desktop', userAgent: 'iPhone', clientHintMobile: true }),
		true,
	);
	assert.equal(isMobileDevice({ userAgent: 'Mozilla Windows Chrome', maxTouchPoints: 10 }), false);
	assert.equal(isMobileDevice({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 0 }), false);
	assert.equal(isMobileDevice({ userAgent: 'Mozilla Macintosh', maxTouchPoints: 5 }), true);
	assert.equal(isMobileDevice({ userAgent: 'Android Tablet' }), true);
	assert.equal(isMobileDevice({ userAgent: 'iPhone' }), true);
	assert.equal(isMobileDevice({ clientHintMobile: true }), true);
	assert.equal(isMobileDevice({}), false);
});

test('DevTools touch emulation works without reloading desktop user agent', () => {
	assert.equal(
		isMobileDevice({
			device: 'desktop',
			userAgent: 'Windows Chrome',
			maxTouchPoints: 1,
			coarsePointer: true,
		}),
		true,
	);
	assert.equal(
		isMobileDevice({
			device: 'desktop',
			userAgent: 'Windows Chrome',
			maxTouchPoints: 10,
			coarsePointer: false,
		}),
		false,
	);
	assert.equal(isMobileDevice({ device: 'desktop', userAgent: 'Windows Chrome' }), false);
});

test('phone emulation rotates into compact and back without desktop window heuristics', async () => {
	const { fitFigmaLayout } = await import('../src/game/figmaLayout.ts');
	const mobile = isMobileDevice({
		device: 'desktop',
		userAgent: 'Windows Chrome',
		maxTouchPoints: 1,
		coarsePointer: true,
	});
	assert.equal(fitFigmaLayout(390, 844, mobile).width, 360);
	assert.equal(fitFigmaLayout(844, 390, mobile).width, 800);
	assert.equal(fitFigmaLayout(390, 844, mobile).width, 360);
	assert.equal(fitFigmaLayout(844, 390, isMobileDevice({ device: 'desktop' })).width, 1200);
	const { readFileSync } = await import('node:fs');
	const code = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	for (const event of ['resize', 'orientationchange']) {
		assert.ok(code.includes(`window.addEventListener('${event}', fitStage)`));
		assert.ok(code.includes(`window.removeEventListener('${event}', fitStage)`));
	}
	assert.match(code, /pointerMedia.addEventListener\('change', fitStage\)/);
	assert.match(code, /pointerMedia.removeEventListener\('change', fitStage\)/);
});

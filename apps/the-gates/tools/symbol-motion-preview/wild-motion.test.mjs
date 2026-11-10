import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WILD_CLUSTERS, WILD_GLOW_MS, wildGlowFrame, crystalMaskWeight } from './wild-motion.mjs';
import { wildSymbolFrame, wildCrystalWeight } from './live-premium-motion.mjs';

test('all ten regular symbols have the exact live paying-glow accent; no scatter variant', async () => {
	const live = await readFile(new URL('../../src/game/symbolGlow.ts', import.meta.url), 'utf8');
	assert.equal(WILD_CLUSTERS.length, 10);
	assert.equal(new Set(WILD_CLUSTERS.map((v) => v.symbol)).size, 10);
	for (const variant of WILD_CLUSTERS) {
		const match = live.match(new RegExp('\\b' + variant.symbol + ':\\s*0x([0-9a-f]+)', 'i'));
		assert.ok(match, variant.symbol);
		assert.equal(variant.colour, '#' + match[1].toLowerCase());
		assert.match(variant.accent, /^#[0-9a-f]{6}$/i);
	}
	assert.equal(
		WILD_CLUSTERS.some((v) => ['KEY', 'WILD'].includes(v.symbol)),
		false,
	);
});
test('one bounded glow, six subtle facet catches, exact rest before and after; no shake', () => {
	for (let ms = 0; ms <= WILD_GLOW_MS * 2; ms += 3) {
		const f = wildGlowFrame(ms);
		for (const v of [f.p, f.light, f.halo, ...f.glints]) assert.ok(v >= 0 && v <= 1);
		assert.equal(f.glints.length, 6);
		assert.equal('rotation' in f, false);
		assert.equal('scale' in f, false);
	}
	for (const ms of [-20, 0, WILD_GLOW_MS, WILD_GLOW_MS * 3]) {
		const f = wildGlowFrame(ms);
		assert.equal(f.light, 0);
		assert.equal(f.halo, 0);
		assert.ok(f.glints.every((v) => v === 0));
	}
	assert.ok(wildGlowFrame(700).light > 0.7);
});
test('all speed previews sample one common timeline; reduced motion never flashes', () => {
	for (const speed of [1, 1.8, 3])
		for (let ms = 0; ms <= WILD_GLOW_MS; ms += 17) {
			const normal = wildGlowFrame(ms),
				fast = wildGlowFrame(ms / speed, { speed });
			assert.ok(Math.abs(normal.light - fast.light) < 1e-9);
			normal.glints.forEach((g, i) => assert.ok(Math.abs(g - fast.glints[i]) < 1e-9));
			const reduced = wildGlowFrame(ms, { speed, reduced: true });
			assert.equal(reduced.light, 0);
			assert.equal(reduced.halo, 0);
			assert.ok(reduced.glints.every((v) => v === 0));
		}
});
test('petal light mask protects the central jewel, gold and transparent margins', () => {
	assert.equal(crystalMaskWeight(0.5, 0.5, 255, 255, 255, 255), 0);
	assert.equal(crystalMaskWeight(0.5, 0.243, 255, 192, 0, 255), 0);
	assert.equal(crystalMaskWeight(0.5, 0.243, 0, 35, 110, 255), 0);
	assert.equal(crystalMaskWeight(0.5, 0.243, 255, 255, 255, 0), 0);
	assert.equal(crystalMaskWeight(0, 0, 255, 255, 255, 255), 0);
	for (let i = 0; i < 6; i++) {
		const a = (i * Math.PI) / 3,
			x = 0.5 + Math.sin(a) * 0.257,
			y = 0.5 - Math.cos(a) * 0.257;
		assert.ok(crystalMaskWeight(x, y, 200, 215, 230, 255) > 0.95);
		assert.ok(crystalMaskWeight(x, y, 200, 215, 230, 128) < 0.51);
	}
});
test('selected uploaded PNG stays unchanged; preview has no live import or per-frame readback', async () => {
	const provenance = JSON.parse(
		await readFile(new URL('./assets/wild-provenance.json', import.meta.url), 'utf8'),
	);
	const bytes = await readFile(new URL('./assets/wild-crystal-lotus.png', import.meta.url));
	assert.equal(createHash('sha256').update(bytes).digest('hex'), provenance.sha256);
	assert.equal(provenance.modified, false);
	assert.equal(bytes[25], 6); // RGBA, real transparent source.
	const renderer = await readFile(new URL('./wild-render.mjs', import.meta.url), 'utf8');
	const frame = renderer.slice(renderer.indexOf('return function drawWild'));
	assert.doesNotMatch(frame, /getImageData|putImageData|\.filter\s*=|new Image|createElement/);
	assert.doesNotMatch(renderer, /src\/game|requestAnimationFrame|setInterval/);
	const preview = await readFile(new URL('./wild-preview.mjs', import.meta.url), 'utf8');
	assert.match(preview, /WILD_CLUSTERS.map/);
	assert.match(preview, /prefers-reduced-motion/);
	assert.match(preview, /visibilitychange/);
});

 test('redrawn Wild is the live flower, and preview glow/mask match live math exactly', async()=>{
  const root=new URL('../../static/assets/the-gates/',import.meta.url);
  const provenance=JSON.parse(await readFile(new URL('wild/provenance.json',root),'utf8'));
  const bytes=await readFile(new URL('wild/flower.png',root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),provenance.sha256);
  const renderer=await readFile(new URL('./wild-render.mjs',import.meta.url),'utf8');
  assert.match(renderer,/static\/assets\/the-gates\/wild\/flower.png/);
  for(let age=0;age<=3600;age+=11){const preview=wildGlowFrame(age),live=wildSymbolFrame(age);assert.equal(preview.light,live.light);assert.equal(preview.halo,live.halo);assert.deepEqual(preview.glints,live.glints)}
  for(const sample of [[.5,.5,255,255,255,255],[.5,.24,150,220,255,255],[.5,.24,255,192,0,255]])assert.equal(crystalMaskWeight(...sample),wildCrystalWeight(...sample));
 });

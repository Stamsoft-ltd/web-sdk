import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { celebrationCount, WIN_COMPOSITION, WIN_TIER_COMPOSITION } from '../src/game/winLayout.ts';

test('Pixi celebration count progresses, settles exactly, and preserves tiny/large targets', () => {
	for (const target of [0, 0.000025, 20000, 12333444, Number.MAX_SAFE_INTEGER]) {
		assert.deepEqual(celebrationCount(target, 0, 5250, false), { value: 0, done: false });
		let prior = 0;
		for (let t = 0; t < 5250; t += 17) {
			const p = celebrationCount(target, t, 5250, false);
			assert.ok(p.value >= prior && p.value <= target);
			prior = p.value;
		}
		assert.deepEqual(celebrationCount(target, 5250, 5250, false), { value: target, done: true });
		assert.deepEqual(celebrationCount(target, 0, 5250, true), { value: target, done: true });
		assert.deepEqual(celebrationCount(target, 0, 0, false), { value: target, done: true });
	}
});
test('skip eases from current value to exact final value in 120ms', () => {
	const target = 12345,
		start = 1000,
		duration = 5250;
	assert.equal(
		celebrationCount(target, start, duration, false, start).value,
		celebrationCount(target, start, duration, false).value,
	);
	assert.equal(celebrationCount(target, start + 119, duration, false, start).done, false);
	assert.deepEqual(celebrationCount(target, start + 120, duration, false, start), {
		value: target,
		done: true,
	});
});
test('tiered native win rigs layer inward trumpet tips behind fitted titles and grow with the award', () => {
	let priorScale = 0,
		priorHornWidth = 0;
	for (const tier of ['sweet', 'wild', 'epic', 'mythic', 'legendary']) {
		const layout = WIN_TIER_COMPOSITION[tier];
		const rig = JSON.parse(
			readFileSync(
				new URL(
					`../static/assets/the-gates/figma-20261012/motion/win-${tier}.json`,
					import.meta.url,
				),
				'utf8',
			),
		);
		const bone = (n) => rig.bones.find((b) => b.name === n);
		assert.equal(bone('banner').y, WIN_COMPOSITION.bannerY);
		assert.equal(bone('title').y, WIN_COMPOSITION.titleY);
		assert.equal(bone('horn-left').y, layout.hornY);
		assert.equal(bone('amount').y, WIN_COMPOSITION.amountY);
		assert.equal(bone('horn-left').x, -layout.hornX);
		assert.equal(bone('celebration').scaleX, layout.scale);
		assert.equal(bone('celebration').scaleY, layout.scale);
		assert.ok(layout.scale > priorScale);
		assert.ok(layout.hornWidth > priorHornWidth);
		priorScale = layout.scale;
		priorHornWidth = layout.hornWidth;
		assert.ok(layout.hornY < 118, 'horns remain within title row');
		const attachments = rig.skins[0].attachments;
		assert.equal(attachments.title.title.width, layout.titleWidth);
		assert.equal(attachments['horn-left']['horn-left'].width, layout.hornWidth);
		assert.ok(
			-layout.hornX + layout.hornWidth * 0.3 > -layout.titleWidth * 0.44,
			'inner tip extends inside title side letters',
		);
		assert.ok(
			layout.hornX < layout.titleWidth * 0.44,
			'inward half starts beneath title, not only the tip',
		);
		const slots = rig.slots.map((s) => s.name);
		assert.ok(slots.indexOf('horn-left') < slots.indexOf('title'), 'title covers inner tips');
		assert.equal(slots.includes('horn-right'), true, 'Both trumpet tips remain behind the title');
		assert.ok(bone('amount').y + WIN_COMPOSITION.amountHeight / 2 < bone('banner').y - 80);
		assert.equal(rig.slots.find((s) => s.name === 'amount').attachment, undefined);
	}
	assert.ok(
		WIN_TIER_COMPOSITION.legendary.titleWidth < 620,
		'Legendary native title no longer dominates its plaque',
	);
	const win = readFileSync(new URL('../src/components/WinScreen.svelte', import.meta.url), 'utf8');
	assert.match(win, /<GpuWinArt/);
	assert.doesNotMatch(win, /<CountUp|win-award/);
	const gpu = readFileSync(new URL('../src/components/GpuWinArt.svelte', import.meta.url), 'utf8');
	assert.match(gpu, /new Text\(/);
	assert.match(gpu, /findBone\('amount'\)/);
	assert.match(gpu, /Math.max\(1, reserve\)/);
});

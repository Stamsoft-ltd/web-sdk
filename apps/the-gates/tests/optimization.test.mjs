import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createNumericMeasurer } from '../src/game/numberMeasure.ts';
import {
	runtimeAssets,
	staticAssetReferences,
	atlasPageReferences,
} from '../tools/package-assets.mjs';

test('100 numeric updates reuse widest-digit and normalized currency measurement', () => {
	let cachedCalls = 0,
		baselineCalls = 0;
	const glyphWidth = (char) => (/^\d$/.test(char) ? 7 + Number(char) / 10 : 5);
	const width = (text) => [...text].reduce((sum, char) => sum + glyphWidth(char), 0);
	const context = {
		font: '',
		measureText: (text) => {
			cachedCalls++;
			return { width: width(text) };
		},
	};
	const cached = createNumericMeasurer(context);
	for (let i = 0; i < 100; i++) {
		const value = `$123.${String(i).padStart(2, '0')}`;
		const legacyMeasure = (text) => {
			baselineCalls++;
			return width(text);
		};
		const digit = [...'0123456789'].sort((a, b) => legacyMeasure(b) - legacyMeasure(a))[0];
		const expected = legacyMeasure(value.replace(/\d/g, digit)) / 16;
		assert.equal(cached.measure('900 16px GatesCartoon', 16, value), expected);
	}
	assert.equal(cachedCalls, 11, 'ten glyph checks and one currency-pattern measurement');
	assert.ok(baselineCalls > 1000);
});
test('numeric metric cache handles locale/precision/font changes and font-load invalidation', () => {
	let generation = 1;
	const context = { font: '', measureText: (text) => ({ width: text.length * generation * 10 }) };
	const cached = createNumericMeasurer(context);
	for (const text of ['$4,999,999.85', '€1.0025', '₿0.00000001', '1 234,50', '+125×']) {
		assert.equal(cached.measure('900 20px Test', 20, text), text.length / 2);
	}
	generation = 2;
	cached.clear();
	assert.equal(cached.measure('900 20px Test', 20, '$1.00'), 5);
	assert.equal(cached.measure('900 10px Test', 10, '$1.00'), 10);
	assert.equal(cached.measure('900 0px Test', 0, '$1.00'), undefined);
});
test('numeric cache remains bounded rather than storing every distinct text/font forever', () => {
	let calls = 0;
	const cached = createNumericMeasurer({
		font: '',
		measureText: (text) => {
			calls++;
			return { width: text.length * 10 };
		},
	});
	cached.measure('font-0', 10, 'initial');
	for (let i = 1; i < 600; i++) cached.measure(`font-${i}`, 10, `text-${i}`);
	const before = calls;
	cached.measure('font-0', 10, 'initial');
	assert.equal(calls - before, 11, 'old entries evicted; recompute bounded glyph + width data');
});
test('packaging includes every tier, native symbol, rainbow Wild, atlas page and required font', async () => {
	const { keep } = await runtimeAssets();
	for (const tier of ['normal', 'super', 'hidden']) {
		for (const kind of ['gate', 'bonus']) {
			assert.ok(keep.has(`assets/the-gates/figma-20261012/motion/${kind}-${tier}.json`));
			assert.ok(keep.has(`assets/the-gates/figma-20261012/motion/${kind}-${tier}.atlas`));
		}
		assert.ok(keep.has(`assets/the-gates/portals-20261012/${tier}-portal-layers-v1.png`));
	}
	for (const tier of ['sweet', 'wild', 'epic', 'mythic', 'legendary']) {
		assert.ok(keep.has(`assets/the-gates/figma-20261012/motion/win-${tier}.json`));
		assert.ok(keep.has(`assets/the-gates/figma-20261012/wins/${tier}-crown.png`));
	}
	assert.ok(keep.has('assets/the-gates/rainbow-wild-20261016/WILD.json'));
	assert.ok(keep.has('assets/the-gates/rainbow-wild-20261016/rainbow-wild.png'));
	assert.ok(keep.has('assets/the-gates/figma-20261013/backgrounds/cloud-castle-original.png'));
	assert.ok(keep.has('assets/the-gates/figma-20261013/d883a.png'));
	assert.ok(keep.has('fonts/figma-20261013/OFL.txt'));
	assert.ok(keep.has('fonts/figma-20261012/OFL.txt'));
	for (const file of keep)
		assert.ok(existsSync(new URL(`../static/${file}`, import.meta.url)), file);
	assert.ok(!keep.has('assets/the-gates/scene-super.png'), 'retired art not shipped');
	assert.ok(
		!keep.has('assets/the-gates/spine/ambient-normal.json'),
		'unimported atmosphere not shipped',
	);
	assert.ok(
		!existsSync(new URL('../static/assets/the-gates/scene-super.png', import.meta.url)),
		'retired source deleted',
	);
});
test('asset scanners preserve CSS, preload and literal roots; atlas pages resolve independently', () => {
	const refs = staticAssetReferences(`url('./assets/the-gates/symbols.png')
 href="%sveltekit.assets%/fonts/cinzel.woff2"
 src="\${UI_ART_ROOT}d883a.png" src="\${ART_ROOT}wins/\${tier}-title.png"`);
	assert.deepEqual([...refs].sort(), [
		'assets/the-gates/figma-20261013/d883a.png',
		'assets/the-gates/symbols.png',
		'fonts/cinzel.woff2',
	]);
	assert.deepEqual(
		atlasPageReferences(
			'a.png\nsize: 100,100\nfilter: Linear,Linear\nregion\n  bounds: 0,0,1,1\n\n../b.png\nsize: 10,10\n',
		),
		['a.png', '../b.png'],
	);
});
test('numeric observers stay mounted across text changes; closed gate startup and idle layout reads are avoided', () => {
	const source = (name) =>
		readFileSync(new URL(`../src/components/${name}.svelte`, import.meta.url), 'utf8');
	const fit = source('FitNumber');
	assert.doesNotMatch(fit, /createElement\('canvas'\)|\.sort\(/);
	assert.match(fit, /const node = element;\s*if \(!node\) return/);
	assert.match(fit, /const value = untrack\(\(\) => reserve\)/);
	assert.match(fit, /untrack\(\(\) => remeasure\(\)\)/);
	assert.match(
		source('TempleGate'),
		/gateOpen = \$derived\(runtime.game.gateOpen && runtime.phase !== 'removing'\)/,
	);
	assert.match(source('TempleGate'), /if \(!engine \|\| !element \|\| !gateOpen\) return/);
	assert.match(source('TempleGate'), /engine.register/);
	const board = readFileSync(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	const draw = board.slice(board.indexOf('draw: (dt, now)'), board.indexOf('return moving;'));
	assert.doesNotMatch(draw, /getBoundingClientRect|getComputedStyle|offsetHeight/);
});

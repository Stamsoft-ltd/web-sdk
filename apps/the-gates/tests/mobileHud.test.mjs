import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const mobile = '.figma-layout:is(.portrait, .compact)';
const rule = (selector) => {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
	return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'g'))].at(-1)?.[1] ?? '';
};

test('HTML HUD and status remain above the viewport Pixi scene without opaque host fills', () => {
	const ancestor = rule('.temple.figma-temple');
	assert.match(ancestor, /z-index: 5/);
	assert.match(ancestor, /background: transparent/);
	const layout = [...css.matchAll(/\.figma-layout\s*\{([^}]+)\}/g)]
		.map((match) => match[1])
		.join('\n');
	assert.match(layout, /position: relative/);
	assert.match(layout, /z-index: 5/);
	assert.doesNotMatch(layout, /background:/);
	const status = rule('.figma-temple > .status-line');
	assert.match(status, /position: relative/);
	assert.match(status, /z-index: 5/);
	assert.doesNotMatch(status, /background:/);
});

test('extra dark HUD contours are mobile-only; desktop keeps native art', () => {
	assert.match(rule('.figma-layout .hud-button-rail'), /display: contents/);
	assert.doesNotMatch(rule('.figma-layout .control-deck::before'), /box-shadow/);
	assert.doesNotMatch(rule('.figma-layout .feature-button'), /outline|box-shadow/);
	assert.match(rule(`${mobile} .control-deck::before`), /display: none/);
	assert.match(rule(`${mobile} .hud-button-rail::before`), /#071f35/);
	assert.match(rule(`${mobile} .hud-button-rail::before`), /box-sizing: border-box/);
	assert.match(rule(`${mobile} .hud-button-rail .feature-button`), /border-radius: 11px/);
	assert.match(rule(`${mobile} .hud-button-rail .feature-button`), /height: 30px/);
});

test('landscape rail, branding and win card share an axis with a positive bottom gap', () => {
	assert.match(rule('.figma-layout.compact .hud-button-rail'), /left: calc\(var\(--hud-axis\)/);
	assert.match(rule('.figma-layout.compact .topbar'), /left: var\(--hud-axis\)/);
	const win = rule('.figma-layout.compact .hud-metrics .win-display');
	assert.match(win, /left: calc\(var\(--hud-axis\) - 52px\)/);
	assert.match(win, /width: 104px/);
	assert.match(win, /top: calc\(var\(--hud-rail-top\) \+ var\(--hud-rail-height\) \+ 7px\)/);
});

test('Bonus and Spin render one native rim, without extra CSS ring stacks', () => {
	for (const name of ['feature-button', 'spin-button'])
		assert.match(rule(`${mobile} .hud-button-rail .${name}`), /box-shadow: none/);
	assert.match(
		game,
		/layoutWidth === 1200\s*\? `\$\{UI_ART_ROOT\}f05f2.svg`\s*: '\.\/assets\/the-gates\/hud\/spin-mobile.svg'/,
	);
	const art = (name) =>
		readFileSync(
			new URL(`../static/assets/the-gates/figma-20261013/${name}`, import.meta.url),
			'utf8',
		);
	const mobileArt = readFileSync(
		new URL('../static/assets/the-gates/hud/spin-mobile.svg', import.meta.url),
		'utf8',
	);
	assert.match(mobileArt, /r="46.5"/);
	assert.match(mobileArt, /r="54.5" fill="url\(#mobile-rim\)"/);
	assert.match(mobileArt, /r="46.5"[^>]*stroke-width="2.5"/);
	assert.doesNotMatch(mobileArt, /r="51.5"/);
	assert.match(art('f05f2.svg'), /r="51.5"/);
	const bonus = rule(`${mobile} .hud-button-rail .feature-button`);
	assert.match(bonus, /bonus-mobile\.svg/);
	assert.match(bonus, /background-size: 100% 100%/);
	const capsule = readFileSync(
		new URL('../static/assets/the-gates/hud/bonus-mobile.svg', import.meta.url),
		'utf8',
	);
	assert.equal((capsule.match(/<rect\b/g) ?? []).length, 2);
	assert.match(capsule, /viewBox="0 0 108 60"/);
});

test('desktop control sizes derive top offsets from the same centerline', () => {
	const desktop = '.figma-layout:not(.portrait):not(.compact)';
	assert.match(rule(`${desktop} .control-deck`), /--hud-center-y: 610px/);
	assert.match(rule(`${desktop} .bet-stepper`), /top: calc\(var\(--hud-center-y\) - 25\.5px\)/);
	assert.match(rule(`${desktop} .feature-button`), /top: calc\(var\(--hud-center-y\) - 31px\)/);
	assert.match(rule(`${desktop} .feature-button`), /min-height: 0/);
	assert.match(rule(`${desktop} .spin-button`), /top: calc\(var\(--hud-center-y\) - 58\.5px\)/);
	for (const [height, offset] of [
		[51, 25.5],
		[62, 31],
		[117, 58.5],
	])
		assert.equal(610 - offset + height / 2, 610);
});

test('disabled controls retain opaque artwork while native disabled state blocks input', () => {
	const disabled = /button:disabled\s*\{([^}]+)\}/.exec(style)?.[1] ?? '';
	assert.match(disabled, /opacity: 1/);
	assert.match(disabled, /filter: brightness\(0\.8\)/);
	assert.doesNotMatch(style, /(?:button|\.spin-button):disabled\s*\{[^}]*opacity:\s*0\./);
	assert.match(rule('.figma-layout button:disabled'), /filter: brightness\(0\.8\)/);
	assert.match(rule('.figma-layout.entry-leaving button:disabled'), /filter: none/);
	assert.match(game, /class:entry-leaving=\{!!entryLeavingAt\}/);
	assert.match(game, /disabled=\{!canPlay/);
});

test('mobile rail uses a single centered grid instead of independent button offsets', () => {
	assert.match(game, /<div class="hud-button-rail">/);
	const base = rule(`${mobile} .hud-button-rail`);
	assert.match(base, /display: grid/);
	assert.match(base, /align-items: center/);
	assert.match(base, /justify-items: center/);
	for (const [name, index] of [
		['menu-button', 1],
		['feature-button', 2],
		['spin-button', 3],
		['speed', 4],
	]) {
		assert.match(
			rule(`.figma-layout.portrait .hud-button-rail .${name}`),
			new RegExp(`grid-column: ${index}`),
		);
		const landscape = rule(`.figma-layout.compact .hud-button-rail .${name}`);
		assert.match(landscape, /grid-column: 1/);
		assert.match(landscape, new RegExp(`grid-row: ${index}`));
	}
	assert.match(
		rule(`${mobile} .hud-button-rail .spin-actions > .icon-button:not(.speed)`),
		/position: relative/,
	);
});

test('inset mobile bet controls paint over the metric card and reserve numeric space', () => {
	assert.match(rule(`${mobile} .bet-stepper`), /z-index: 2/);
	assert.match(rule(`${mobile} .hud-metrics .bet-control strong`), /width: calc\(100% - 82px\)/);
	assert.match(rule(`${mobile} .control-deck .bet-stepper .icon-button`), /width: 40px/);
	assert.match(rule('.figma-layout.portrait .bet-stepper'), /height: 45px/);
	assert.match(rule('.figma-layout.compact .bet-stepper'), /height: 44px/);
});

test('autoplay stop retains circular artwork and locks bet/autoplay controls', () => {
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	const stop = readFileSync(
		new URL('../static/assets/the-gates/hud/stop.svg', import.meta.url),
		'utf8',
	);
	assert.match(
		game,
		/autoSpinsCounter \|\| busy\}<img\s+src="\.\/assets\/the-gates\/hud\/stop.svg"/,
	);
	assert.match(stop, /<circle/);
	assert.match(stop, /<rect[^>]*fill="white"[^>]*stroke="#021D42"/);
	assert.match(game, /disabled=\{!canPlay \|\|\s*stateBet.autoSpinsCounter > 0 \|\|\s*demo/);
	assert.match(game, /stateBet.autoSpinsCounter > 0/);
});

test('autoplay counter sits below stop square with outlined white text; disabled cursor is explicit', () => {
	const css = readFileSync(new URL('../src/figma.css', import.meta.url), 'utf8');
	const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
	const counter = css.match(/\.figma-layout \.spin-button > span \{([^}]+)\}/)[1];
	assert.match(counter, /top: 70%/);
	assert.match(counter, /bottom: auto/);
	assert.match(counter, /color: #fff/);
	assert.match(counter, /-webkit-text-stroke: 1px #021d42/);
	assert.match(counter, /paint-order: stroke fill/);
	assert.match(style, /button:disabled \{\s*cursor: not-allowed/);
});

test('speed button shows outline, one and two bolts for normal, fast and turbo', () => {
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.match(
		game,
		/speed === 'turbo'[\s\S]*hud\/speed-2.svg[\s\S]*speed === 'fast'[\s\S]*c8de1.svg[\s\S]*speed-normal.svg/,
	);
	for (const count of [2]) {
		const art = readFileSync(
			new URL(`../static/assets/the-gates/hud/speed-${count}.svg`, import.meta.url),
			'utf8',
		);
		assert.equal((art.match(/<g transform=/g) ?? []).length, count);
		assert.match(art, /<circle/);
	}
});

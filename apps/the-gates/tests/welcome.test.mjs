import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	fitWelcome,
	welcomeSlide,
	welcomeSwipe,
	startWelcomeRotation,
	WELCOME_CARDS,
	WELCOME_ROTATION_MS,
} from '../src/game/welcome.ts';

test('landing fits portrait, landscape and desktop without changing the card aspect ratio', () => {
	for (const [width, height] of [
		[320, 568],
		[390, 844],
		[667, 375],
		[844, 390],
		[1200, 680],
		[1440, 900],
		[1920, 1080],
	]) {
		const frame = fitWelcome(width, height);
		assert.ok(frame.width * frame.scale <= width + 1e-9);
		assert.ok(frame.height * frame.scale <= height + 1e-9);
		assert.equal(frame.portrait, width < height);
		assert.equal(frame.compact, width >= height && height < 540);
	}
	const source = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.match(source, /cardWidth \* 1215\) \/ 1478/);
	assert.match(source, /new Rectangle\(130, 178, 1478, 1215\)/);
	assert.match(source, /backgrounds\.set\('wide', wide\)/);
	assert.match(source, /UI_ART_ROOT\}28fc1\.png/);
	assert.match(source, /backgrounds\/cloud-castle-original\.png/);
});

test('carousel wraps all three cards and accepts only deliberate horizontal swipes', () => {
	assert.equal(WELCOME_CARDS.length, 3);
	assert.equal(welcomeSlide(2, 1), 0);
	assert.equal(welcomeSlide(0, -1), 2);
	assert.equal(welcomeSlide(1, 1), 2);
	assert.equal(welcomeSwipe(-80, 10), 1);
	assert.equal(welcomeSwipe(80, -10), -1);
	for (const [x, y] of [
		[39, 0],
		[10, 90],
		[80, 80],
		[0, 0],
	])
		assert.equal(welcomeSwipe(x, y), 0);
});

test('rotation schedules exactly every three seconds and releases its timer on cleanup', () => {
	let scheduled,
		interval,
		removed,
		count = 0;
	const stop = startWelcomeRotation(
		() => {
			count++;
		},
		{
			setInterval(fn, ms) {
				scheduled = fn;
				interval = ms;
				return 17;
			},
			clearInterval(id) {
				removed = id;
			},
		},
	);
	assert.equal(WELCOME_ROTATION_MS, 3000);
	assert.equal(interval, 3000);
	scheduled();
	scheduled();
	assert.equal(count, 2);
	stop();
	assert.equal(removed, 17);
});

test('landing carousel is isolated and cleaned up without a pause button; tagline is not rendered', () => {
	const source = readFileSync(new URL('../src/components/Welcome.svelte', import.meta.url), 'utf8');
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.match(source, /!layout.portrait \|\| reduced \|\| hovered \|\| !visible/);
	assert.match(source, /return startWelcomeRotation/);
	assert.match(source, /removeEventListener\('visibilitychange'/);
	assert.match(source, /onpointerup/);
	assert.match(source, /welcomeSwipe\(/);
	assert.match(source, /event.key === 'ArrowRight'/);
	assert.match(source, /aria-hidden=\{layout.portrait && slide !== index\}/);
	assert.doesNotMatch(source, /PAUSE CARDS|paused/);
	assert.doesNotMatch(source + game, /t\('INTRO'\)|Beyond every gate/);
	assert.match(game, /if \(!entered\) return;/);
	const gpu = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.match(gpu, /'GUARDIAN_MASK',[\s\S]*'RED_GEM',[\s\S]*'GREEN_GEM'/);
	assert.match(gpu, /'SUN_MEDALLION',[\s\S]*'CRYSTAL_ORB',[\s\S]*'PURPLE_GEM'/);
});

test('updated landing cards retain approved order and copy keys', () => {
	assert.deepEqual(WELCOME_CARDS, [
		{ value: 'CASCADING WINS', text: 'INTRO CASCADING COPY' },
		{ value: 'MAX WIN 25,000×', text: 'INTRO MAX WIN COPY' },
		{ value: 'THREE BONUS MODES', text: 'INTRO BONUS MODES COPY' },
	]);
	const gpu = readFileSync(new URL('../src/game/gpuScene.ts', import.meta.url), 'utf8');
	assert.match(gpu, /labelFit\(\s*card.title,\s*translate\(info.value\)/);
});

test('landing continue target covers the full screen in every layout without swallowing swipes', () => {
	const source = readFileSync(new URL('../src/components/Welcome.svelte', import.meta.url), 'utf8');
	assert.match(
		source,
		/onclick=\{\(event\) => \{\s*if \(active && \(!swiped \|\| event.detail === 0\)\) enter\(\);/,
	);
	assert.match(source, /onpointerdown=\{\(\) => \{\s*swiped = false;/);
	assert.match(source, /swiped = true;\s*move\(direction\)/);
	assert.match(
		source,
		/\.landing-enter \{\s*position: absolute;\s*inset: 0;\s*width: 100%;\s*height: 100%;/,
	);
	assert.doesNotMatch(source, /\.(?:compact|portrait) \.landing-enter/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('options use independent persisted sound/music toggles with crossed icons and Info', () => {
	const game = src('components/Game.svelte'),
		css = src('figma.css');
	assert.match(game, /aria-pressed=\{stateSound.volumeValueSoundEffect > 0\}/);
	assert.match(game, /aria-pressed=\{stateSound.volumeValueMusic > 0\}/);
	assert.match(game, /onclick=\{\(\) => toggleAudio\('sound'\)\}/);
	assert.match(game, /onclick=\{\(\) => toggleAudio\('music'\)\}/);
	assert.match(game, /class:muted=\{stateSound.volumeValueMusic === 0\}/);
	assert.match(css, /\.option-icon.muted::after/);
	assert.match(
		game,
		/installGameAudio\(\s*\(\) => stateSound.volumeValueSoundEffect,\s*\(\) => stateSound.volumeValueMusic/,
	);
	assert.match(game, /destroyAudio\(\)/);
});

test('options SVGs reset legacy margins and Info has no inner ring', () => {
	const css = src('figma.css'),
		icon = src('components/OptionsIcon.svelte');
	assert.match(css, /\.option-icon > svg\s*\{[^}]*margin: 0;[^}]*transform: none/);
	assert.doesNotMatch(icon, /r="(?:10|12|14)"/);
	assert.match(icon, /rect x="12" y="14"/);
});

test('small-screen popover shrinks about its anchored corner; mobile rules reserve a close lane', () => {
	const css = src('figma.css');
	assert.match(css, /--options-scale: clamp\(0\.65/);
	assert.match(css, /transform: scale\(var\(--options-scale\)\)/);
	assert.match(css, /\.figma-layout.compact \.utility-menu\s*\{\s*transform-origin: right top/);
	assert.match(css, /height: min\(600px, calc\(100dvh - 92px\)\)/);
	assert.match(css, /\.figma-temple.mobile-scene ~ \.modal-overlay:has/);
});

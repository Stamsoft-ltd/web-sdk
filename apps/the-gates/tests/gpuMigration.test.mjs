import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
test('gameplay and FX share two bounded compositing layers and one clock; no per-symbol canvas or autonomous Spine ticker', () => {
	const engine = source('game/gpuRenderer.ts');
	assert.equal((engine.match(/new Application\(/g) || []).length, 2);
	assert.match(engine, /autoStart: false/);
	assert.match(engine, /this.overlayApp.destroy/);
	assert.match(engine, /job.overlay \? this.overlayApp.stage : this.app.stage/);
	assert.match(engine, /sharedTicker: false/);
	assert.match(engine, /autoUpdate: false/);
	assert.match(engine, /Math.min\(devicePixelRatio \|\| 1, 2\)/);
	assert.match(engine, /if \(moving\) this.invalidate\(\)/);
	assert.match(engine, /cancelAnimationFrame\(this.frame\)/);
	assert.match(engine, /texture.destroy\(true\)/);
	assert.match(engine, /this.images.get\(image\)/);
	for (const name of ['Board', 'SpineArt', 'TempleGate', 'WinCoins'])
		assert.doesNotMatch(
			source(`components/${name}.svelte`),
			/getContext\('2d'\)|<canvas|spineClock\(/,
			name,
		);
});
test('GPU drops move full tiles, keep event-driven timing, and remove actors/listeners on unmount', () => {
	const board = source('game/gpuBoard.ts');
	assert.match(board, /sampleTileTravel\(contact, elapsed/);
	assert.match(board, /tile.root.position.set/);
	assert.match(
		board,
		/state.reduced \|\| \(state.paused && !celebration\?\.keys.includes\(key\)\)/,
	);
	assert.match(board, /portalRemovalTracks\(seed\)/);
	assert.match(board, /pose.actor.sample\(progress === null \? 'setup' : 'land'/);
	assert.match(source('components/Board.svelte'), /observer.disconnect\(\)/);
	assert.match(source('components/SpineArt.svelte'), /remove\(\)/);
	const css = source('figma.css');
	assert.match(
		css,
		/\.figma-layout.portrait \.hud-button-rail\s*\{[^}]*grid-template-rows: minmax\(0, 1fr\)/,
	);
});

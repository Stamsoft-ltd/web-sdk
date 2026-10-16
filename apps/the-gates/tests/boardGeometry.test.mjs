import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardGeometry } from '../src/game/boardGeometry.ts';
const src = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('Pixi owns all thirty tile coordinates without querying HTML cells', () => {
	for (const [width, height, mobile] of [
		[777, 574, false],
		[360, 247, true],
		[504, 343, true],
		[1200, 840, false],
	]) {
		const { field, border, cells } = boardGeometry(width, height, mobile);
		assert.equal(cells.length, 30);
		for (let i = 0; i < 30; i++) {
			const cell = cells[i];
			assert.ok(cell.width > 0 && cell.height > 0);
			assert.ok(cell.x >= field.x + border - 1e-9 && cell.y >= field.y + border - 1e-9);
			assert.ok(cell.x + cell.width <= field.x + field.width - border + 1e-9);
			assert.ok(cell.y + cell.height <= field.y + field.height - border + 1e-9);
			if (i % 5 < 4) assert.equal(cells[i + 1].x, cell.x);
			assert.equal(cell.pitch, cell.height + 2);
		}
		assert.ok(Math.abs(cells[29].x + cells[29].width - (field.x + field.width - border)) < 1e-9);
		assert.ok(Math.abs(cells[29].y + cells[29].height - (field.y + field.height - border)) < 1e-9);
	}
	assert.doesNotMatch(src('game/gpuBoard.ts'), /querySelectorAll|querySelector\(|getComputedStyle/);
	assert.match(src('game/gpuBoard.ts'), /boardGeometry\(width, height, state.mobile\)/);
});
test('gameplay has no hidden HTML grid, duplicate frame image or alternate visual fallback', () => {
	const board = src('components/Board.svelte');
	assert.doesNotMatch(
		board,
		/<img|\{#each|class="cell|class="reel|gpu-hidden|static-symbol|static-loading/,
	);
	assert.match(board, /class="gpu-board-host"/);
	assert.match(board, /aria-busy=\{!ready\}/);
	for (const file of ['WinScreen', 'BonusScreen'])
		assert.doesNotMatch(src(`components/${file}.svelte`), /fallback|<img/);
	assert.doesNotMatch(src('components/TempleGate.svelte'), /reward-fallback/);
	assert.doesNotMatch(src('components/Symbol.svelte'), /fallback|symbols\.png|background-image/);
	for (const css of ['style.css', 'figma.css'])
		assert.doesNotMatch(src(css), /\.(?:board-shell|figma-board-frame|reel|cell)(?![\w-])/);
});
test('GPU board remains behind overlays; covered animations stop and failures are explicit', () => {
	assert.match(src('game/gpuBoard.ts'), /underlay: true/);
	assert.match(src('game/gpuRenderer.ts'), /job.root.visible = !job.overlay/);
	assert.match(
		src('components/Board.svelte'),
		/paused: paused \|\| \(gpu.presenting && !runtime.scatterCelebration\)/,
	);
	assert.match(src('game/gpuBoard.ts'), /failed\(error\)/);
	assert.match(src('components/SpineArt.svelte'), /gpu.error = String\(error\)/);
});

test('mobile generated rim has equal horizontal and vertical insets', () => {
	for (const [w, h] of [
		[360, 247],
		[504, 343],
		[320, 220],
	]) {
		const { field } = boardGeometry(w, h, true);
		assert.equal(field.x, field.y);
		assert.equal(field.x, w - field.x - field.width);
		assert.equal(field.y, h - field.y - field.height);
	}
});

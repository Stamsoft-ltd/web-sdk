import test from 'node:test';
import assert from 'node:assert/strict';
import {
	bonusScatterKeys,
	refreshScatterCelebration,
	isCelebratingScatter,
	scatterCelebrationFrame,
	SCATTER_CELEBRATION_MS,
} from '../src/game/scatterCelebration.ts';
import { readFileSync } from 'node:fs';
test('only actual keys celebrate, pulse stays bounded and reduced motion never shakes', () => {
	assert.deepEqual(bonusScatterKeys([[{ name: 'KEY' }, { name: 'RED_GEM' }], [{ name: 'KEY' }]]), [
		'0:0',
		'1:0',
	]);
	for (let age = 0; age <= 900; age += 10) {
		const f = scatterCelebrationFrame(age, 900);
		assert.ok(f.scale >= 1 && f.scale <= 1.12);
		assert.ok(Math.abs(f.rotation) <= 0.065);
	}
	assert.equal(scatterCelebrationFrame(40, 140, true).scale, 1);
	assert.equal(scatterCelebrationFrame(40, 140, true).rotation, 0);
	assert.ok(SCATTER_CELEBRATION_MS.turbo < SCATTER_CELEBRATION_MS.fast);
});
test('trigger celebration runs after landing before settlement and doors, never guesses from key count alone', () => {
	const code = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	assert.match(code, /if \(!pendingBonus\) return/);
	assert.match(code, /if \(scatterCelebrated\) return/);
	const reveal = code.slice(code.indexOf("case 'reveal':"), code.indexOf("case 'cascadeWin':"));
	assert.match(reveal, /await celebrateScatters\(\)/);
	assert.match(reveal, /events.some\(\(event\) => event.type === 'freeSpinTrigger'\)/);
	assert.match(code, /bonusScatterKeys\(runtime.game.board\)/);
	assert.match(code, /runtime.scatterCelebration = null/);
	const game = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
	assert.doesNotMatch(game, /disabled=\{busy \|\| !entered\}/);
});
test('fast/turbo scatter loop accelerates at most 1.2x independently of entry gates', () => {
	for (const speed of ['normal', 'fast', 'turbo']) {
		const duration = SCATTER_CELEBRATION_MS[speed];
		assert.ok(duration >= SCATTER_CELEBRATION_MS.normal / 1.2);
		assert.ok(duration <= SCATTER_CELEBRATION_MS.normal);
		assert.deepEqual(
			scatterCelebrationFrame(180, duration),
			scatterCelebrationFrame(180 + duration, duration),
		);
	}
	const code = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	const trigger = code.slice(
		code.indexOf('const celebrateScatters = async'),
		code.indexOf('const enterBonus = async'),
	);
	assert.match(trigger, /SCATTER_CELEBRATION_MS\[currentSpeed\(\)\]/);
	assert.doesNotMatch(trigger, /\/\s*(?:factor|speedFactor)/);
});

test('trigger loop follows falling Keys across repeated cascade destinations, not stale cells', () => {
	const makeBoard = (rows) => [
		Array.from({ length: 5 }, (_, row) => ({ name: rows.includes(row) ? 'KEY' : 'RED_GEM' })),
	];
	const first = makeBoard([0, 1, 2]);
	const original = { keys: bonusScatterKeys(first), startedAt: 1234, duration: 900 };
	assert.equal(refreshScatterCelebration(null, first), null);
	let celebration = original;
	for (const rows of [
		[0, 2, 3],
		[1, 3, 4],
	]) {
		const board = makeBoard(rows);
		celebration = refreshScatterCelebration(celebration, board);
		assert.equal(celebration.startedAt, original.startedAt);
		assert.equal(celebration.duration, original.duration);
		for (let row = 0; row < 5; row++) {
			assert.equal(
				isCelebratingScatter(celebration, `0:${row}`, board[0][row].name),
				rows.includes(row),
			);
		}
	}
	assert.deepEqual(original.keys, ['0:0', '0:1', '0:2']);
	assert.equal(isCelebratingScatter(original, '0:0', 'RED_GEM'), false);
	assert.equal(isCelebratingScatter(original, '0:0', 'WILD'), false);
	assert.equal(isCelebratingScatter(null, '0:0', 'KEY'), false);
	assert.equal(isCelebratingScatter(undefined, '0:0', 'KEY'), false);
});
test('refresh happens before cascade motion; glow and outline follow the same moving tile as Key art', () => {
	const playback = readFileSync(new URL('../src/game/playback.svelte.ts', import.meta.url), 'utf8');
	const reveal = playback.slice(
		playback.indexOf("case 'reveal':"),
		playback.indexOf("case 'cascadeWin':"),
	);
	assert.ok(reveal.indexOf('refreshScatterCelebration(') < reveal.indexOf('beginWave('));
	const code = readFileSync(new URL('../src/game/gpuBoard.ts', import.meta.url), 'utf8');
	assert.match(code, /isCelebratingScatter\(celebration, key, tile.name\)/);
	const glow = code.slice(
		code.indexOf('if (celebrating && celebration)'),
		code.indexOf('const pose = tile.pose;', code.indexOf('if (celebrating && celebration)')),
	);
	assert.match(glow, /cx = tile.root.x \+ tile.width \/ 2/);
	assert.match(glow, /cy = tile.root.y \+ tile.height \/ 2/);
	assert.match(glow, /roundRect\(tile.root.x \+ 2, tile.root.y \+ 2/);
	assert.doesNotMatch(glow, /tile\.x|tile\.y/);
});

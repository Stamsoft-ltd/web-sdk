import test from 'node:test';
import assert from 'node:assert/strict';
import {
	bonusScatterKeys,
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

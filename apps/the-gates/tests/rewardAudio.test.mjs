import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dingRewardArrival } from '../src/game/rewardAudio.ts';
test('reward arrivals safely no-op before audio is installed and never synthesize sound', () => {
	for (let i = 0; i < 20; i++) assert.doesNotThrow(() => dingRewardArrival(i));
	const source = readFileSync(new URL('../src/game/rewardAudio.ts', import.meta.url), 'utf8');
	assert.doesNotMatch(source, /new AudioContext|createOscillator|fetch\(/);
});

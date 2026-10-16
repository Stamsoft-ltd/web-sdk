import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitReplaySummary, formatReplayMultiplier } from '../src/game/replayLayout.ts';
const src = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');
test('replay card fits desktop, portrait and short landscape without cutting action', () => {
	for (const [w, h] of [
		[1440, 900],
		[1200, 680],
		[844, 390],
		[798, 438],
		[667, 320],
		[390, 844],
		[320, 568],
	]) {
		const f = fitReplaySummary(w, h);
		assert.ok(f.width * f.scale <= w - 24 + 0.001);
		assert.ok(f.height * f.scale <= h - 24 + 0.001);
	}
});
test('multipliers are localized, finite, zero-safe and preserve sub-cent precision', () => {
	assert.equal(formatReplayMultiplier(0), '0×');
	assert.equal(formatReplayMultiplier(750), '750×');
	assert.equal(formatReplayMultiplier(0.0025), '0.0025×');
	assert.equal(formatReplayMultiplier(25000), '25,000×');
	assert.equal(formatReplayMultiplier(2.5, 'de'), '2,5×');
	assert.equal(formatReplayMultiplier(NaN), '0×');
});
test('summary includes full labeled replay metadata, source-derived amounts and replay-only action', () => {
	const component = src('components/ReplaySummary.svelte'),
		game = src('components/Game.svelte');
	for (const label of [
		'MODE',
		'EVENT',
		'BASE BET',
		'TOTAL COST',
		'COST MULTIPLIER',
		'PAYOUT MULTIPLIER',
		'TOTAL WIN',
		'GAME',
		'VERSION',
		'REPLAY DISCLAIMER',
	])
		assert.ok(component.includes(`t('${label}')`), label);
	assert.match(component, /played \? 'PLAY AGAIN' : 'START REPLAY'/);
	assert.match(component, /installModalFocus\(overlay, \{ close: \(\) => \{\}, locked: true \}\)/);
	assert.match(component, /FitNumber text=\{win\}/);
	assert.match(game, /version=\{stateUrlDerived.version\(\)\}/);
	assert.match(game, /formatWinAmount\(stateBet.currency, gatesStakeDerived.replayWinAmount\(\)\)/);
	assert.match(game, /replay && !busy/);
	assert.match(game, /gatesStakeState.replayStartRequested \|\| !gatesStakeState.replaySnapshot/);
	assert.doesNotMatch(component, /requestBet|requestEndRound|sessionID|rgsUrl/);
});
test('replay mode remains stable after actor resets active mode; cursor never masquerades as event ID', () => {
	const state = src('state/gatesStake.svelte.ts');
	assert.match(
		state,
		/replaySnapshot[\s\S]*stateUrlDerived.mode\(\) \|\|\s*stateBet.activeBetModeKey/,
	);
	assert.match(state, /stateUrlDerived.event\(\) \|\| String\(\(bet as \{ eventID\?/);
	assert.doesNotMatch(state, /bet as \{ event\?: string \| number \}/);
});

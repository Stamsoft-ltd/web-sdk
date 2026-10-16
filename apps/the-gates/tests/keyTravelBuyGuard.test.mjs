import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scatterOverFrame } from '../src/game/scatterFit.ts';
import { cellMotion } from '../src/game/motion.ts';
import { COSTS } from '../src/game/contract.ts';
import { canAffordMode, modeOptionAvailable } from '../src/game/buyAvailability.ts';
const source = (file) => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
test('falling Keys stay masked through every reel delay and promote exactly at contact', () => {
	for (const speed of ['normal', 'fast', 'turbo'])
		for (let reel = 0; reel < 6; reel++)
			for (let row = 0; row < 5; row++) {
				for (const cut of [null, 40]) {
					const contact = cellMotion({ speed, kind: 'spin', cut, tail: 130 }, reel, row, -500);
					const end = contact.delay + contact.duration;
					for (const elapsed of [-1, 0, Math.max(0, contact.delay - 0.01), end - 0.01])
						assert.equal(scatterOverFrame('dropping', true, false, elapsed, contact), false);
					assert.equal(scatterOverFrame('dropping', true, false, end, contact), true);
					assert.equal(
						scatterOverFrame('dropping', true, false, end + contact.impact, contact),
						true,
					);
				}
			}
});
test('departing Keys never escape the mask; stationary and reduced-motion landed Keys keep overlap', () => {
	const contact = { delay: 50, duration: 400 };
	for (const elapsed of [0, 50, 449, 450, 10000])
		for (const reduced of [true, false])
			assert.equal(scatterOverFrame('spinning', true, reduced, elapsed, contact), false);
	assert.equal(scatterOverFrame('dropping', true, true, 0, contact), true);
	for (const phase of ['idle', 'winning', 'gate', 'removing', 'dropping'])
		assert.equal(scatterOverFrame(phase, false, false, 0, contact), true);
	const board = source('game/gpuBoard.ts');
	assert.match(board, /scatterOverFrame\(state.phase, travel, state.reduced, elapsed, contact\)/);
	assert.match(board, /parent = overFrame \? keyLayer : tile.root/);
	assert.match(board, /if \(pose.view.parent !== parent\) parent.addChild\(pose.view\)/);
	assert.match(board, /tile.root.addChild\(tile.pose.view\)/);
});
test('$280 at $1 disables Super and Mystery even if already the active mode', () => {
	for (const active of Object.keys(COSTS)) {
		assert.equal(modeOptionAvailable('BONUS', active, 1, 280), true);
		assert.equal(modeOptionAvailable('SUPER', active, 1, 280), false);
		assert.equal(modeOptionAvailable('MYSTERY', active, 1, 280), false);
	}
});
test('all buy thresholds use wallet precision, including exact funds, wager changes and malformed values', () => {
	for (const mode of ['FEATURE', 'BONUS', 'SUPER', 'MYSTERY'])
		for (const bet of [0.000025, 0.25, 1, 1.11, 1.75, 100000]) {
			const price = Math.round(bet * COSTS[mode] * 1e6) / 1e6;
			assert.equal(canAffordMode(mode, bet, price), true, `${mode} ${bet} exact funds`);
			assert.equal(
				canAffordMode(mode, bet, price - 0.000001),
				false,
				`${mode} one wallet unit short`,
			);
			assert.equal(modeOptionAvailable(mode, mode, bet, price - 0.000001), mode === 'FEATURE');
		}
	assert.equal(canAffordMode('SUPER', 1.11, 333), true);
	assert.equal(canAffordMode('BONUS', 2, 280), true);
	assert.equal(canAffordMode('BONUS', 3, 280), false);
	for (const bet of [0, -1, NaN, Infinity]) assert.equal(canAffordMode('SUPER', bet, 1000), false);
	for (const balance of [-1, NaN, Infinity])
		assert.equal(canAffordMode('SUPER', 1, balance), false);
});
test('only active Chance/Feature toggles can be disabled without money; fresh activation is blocked', () => {
	for (const mode of ['CHANCE', 'FEATURE']) {
		assert.equal(modeOptionAvailable(mode, mode, 1, 0), true);
		assert.equal(modeOptionAvailable(mode, 'BASE', 1, 0), false);
	}
	for (const mode of ['BONUS', 'SUPER', 'MYSTERY'])
		assert.equal(modeOptionAvailable(mode, mode, 1, 0), false);
});
test('card, caption, selection guard and final confirmation share affordability; no active-buy exemption', () => {
	const game = source('components/Game.svelte');
	const choose = game.slice(game.indexOf('function choose('), game.indexOf('function confirm('));
	assert.ok(choose.indexOf('!availableMode(key)') < choose.indexOf('modal = null'));
	assert.ok(choose.indexOf('!availableMode(key)') < choose.indexOf('selected = key'));
	const confirm = game.slice(game.indexOf('function confirm('), game.indexOf('function resume('));
	assert.ok(
		confirm.indexOf('!affordableMode(selected)') <
			confirm.indexOf('stateBet.activeBetModeKey = next'),
	);
	assert.match(game, /disabled=\{!availableMode\(key as Mode\)\}/);
	assert.match(game, /disabled=\{!affordableMode\(selected\)\}/);
	assert.doesNotMatch(game, /mode !== key|selectedCost > stateBet.balanceAmount/);
});

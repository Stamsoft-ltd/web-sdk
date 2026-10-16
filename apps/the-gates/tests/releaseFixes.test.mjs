import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	formatExactWinAmount,
	formatWinAmount,
	formatWalletAmount,
} from '../../../packages/utils-shared/currency.ts';
import { replayAmountUnits } from '../../../packages/components-shared/src/replayAmount.ts';
import { autoplayMessageKey } from '../src/game/uiErrors.ts';
import { socialEnglish } from '../src/game/platformConfig.ts';
const source = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

test('Gates preserves every settled micro-stake × hundredths-book digit, not just nonzero wins', () => {
	for (const [value, expected] of [
		[0.00025, '$0.00025'],
		[0.000125, '$0.000125'],
		[0.012345, '$0.012345'],
		[0.00000125, '$0.00000125'],
		[0.00000001, '$0.00000001'],
		[0.005, '$0.005'],
		[1.125, '$1.125'],
		[0, '$0.00'],
	])
		assert.equal(formatExactWinAmount('USD', value), expected);
	assert.equal(formatExactWinAmount('USD', 0.1 + 0.2), '$0.30');
	assert.equal(formatExactWinAmount('JPY', 0.000125), '¥0.000125');
	assert.equal(formatExactWinAmount('XSC', 0.00025), '0.00025 SC');
	assert.equal(formatExactWinAmount('XGC', 0.00025), '0.00025 GC');
	assert.equal(formatExactWinAmount('KWD', 1.123456), 'KD1.123456');
	for (const frame of [0, 0.123456789, 1.987654321, 2])
		assert.match(formatExactWinAmount('USD', frame, 2), /^\$\d+\.\d{2}$/);
	assert.equal(formatExactWinAmount('USD', NaN), '$0.00');
	// Explicit opt-in: neither other games' four-digit display nor fixed wallets changes.
	assert.equal(formatWinAmount('USD', 0.00025), '$0.0003');
	assert.equal(formatWalletAmount('USD', 999.946), '$999.95');
});

test('accepted replay amounts and mode costs are exact, including JPY and social suffixes', () => {
	const base = replayAmountUnits(1250) / 1_000_000;
	assert.equal(formatExactWinAmount('XSC', base), '0.00125 SC');
	assert.equal(formatExactWinAmount('XSC', base * 0.2), '0.00025 SC');
	assert.equal(formatExactWinAmount('XSC', base * 300), '0.375 SC');
	assert.equal(formatExactWinAmount('JPY', base), '¥0.00125');
	assert.equal(formatExactWinAmount('EUR', 5), '€5.00');
	const game = source('components/Game.svelte');
	assert.match(
		game,
		/bet=\{formatWinAmount\(stateBet.currency, gatesStakeDerived.replayBetAmount\(\)\)\}/,
	);
	assert.match(
		game,
		/cost=\{formatWinAmount\(stateBet.currency, gatesStakeDerived.replayCostAmount\(\)\)\}/,
	);
	assert.doesNotMatch(game, /(?:bet|cost)=\{money\(gatesStakeDerived.replay/);
	for (const file of [
		'components/Game.svelte',
		'components/Board.svelte',
		'state/gatesStake.svelte.ts',
	])
		assert.match(source(file), /formatExactWinAmount as formatWinAmount/);
});

test('every autoplay reason is allowlisted, translated, social-safe; unknown reasons never leak', () => {
	for (const [reason, expected] of Object.entries({
		insufficientFunds: 'ERROR BALANCE',
		lossLimitReached: 'AUTO LOSS LIMIT',
		singleWinLimitReached: 'AUTO WIN LIMIT',
	}))
		assert.equal(autoplayMessageKey(reason), expected);
	for (const value of [null, undefined, 'BUY BET $999 secret', {}, '__proto__'])
		assert.equal(autoplayMessageKey(value), 'ERROR CONNECTION');
	const game = source('components/Game.svelte');
	assert.match(game, /t\(autoplayMessageKey\(stateModal.modal.message\)\)/);
	assert.doesNotMatch(game, /<p>\{stateModal.modal.message\}/);
	assert.doesNotMatch(
		socialEnglish('Autoplay stopped: loss limit reached.'),
		/\b(bet|buy|fund|stake|pay)\b/i,
	);
});

test('bonus entry/end share a white slow prompt, only when acknowledgement is actually enabled', () => {
	const screen = source('components/BonusScreen.svelte');
	assert.match(screen, /runtime.waiting && !runtime.bonusTransition/);
	assert.match(screen, /t\('TAP ANYWHERE TO CONTINUE'\)/);
	assert.match(screen, /bonus-continue-pulse 2s ease-in-out infinite/);
	assert.match(screen, /color: #fff/);
	assert.match(screen, /prefers-reduced-motion: reduce/);
	assert.match(screen, /bonus-continue\.reduced\s*\{\s*animation: none/);
	assert.doesNotMatch(screen, /<button/);
});

test('asset cleanup preserves distribution notices, including current Spine and Pixi copyrights', () => {
	const notices = readFileSync(
		new URL('../static/assets/the-gates/licenses/THIRD-PARTY.txt', import.meta.url),
		'utf8',
	);
	assert.match(notices, /Spine Runtimes License Agreement/);
	assert.match(notices, /Last updated July 28, 2023/);
	assert.match(notices, /Copyright \(c\) 2013-2023, Esoteric Software LLC/);
	assert.match(notices, /Copyright \(c\) 2013-2023 Mathew Groves, Chad Engler/);
	assert.match(
		readFileSync(new URL('../tools/package-assets.mjs', import.meta.url), 'utf8'),
		/add\('assets\/the-gates\/licenses\/THIRD-PARTY.txt'\)/,
	);
});

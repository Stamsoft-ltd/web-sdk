import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COSTS } from '../src/game/contract.ts';
import { hudBetAmount } from '../src/game/hudPresentation.ts';
import { winCoinFountain, WIN_COIN_ORIGIN_Y } from '../src/game/winCoins.ts';
import { RULES_PAGES, rulesPageIndex, RULE_BUYS } from '../src/game/rulesPages.ts';
const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('Feature HUD shows full spin cost without changing base bet or other mode prices', () => {
	for (const bet of [0.000025, 0.25, 1, 1000000]) {
		for (const mode of Object.keys(COSTS))
			assert.equal(hudBetAmount(bet, mode), bet * (mode === 'FEATURE' || mode === 'CHANCE' ? COSTS[mode] : 1));
	}
	const game = source('components/Game.svelte');
	assert.match(game, /money\(hudBetAmount\(stateBet.betAmount, mode\)\)/);
	assert.match(game, /class:feature-cost=\{mode === 'FEATURE' \|\| mode === 'CHANCE'\}/);
	const hud = game.slice(
		game.indexOf('<footer class="control-deck">'),
		game.indexOf('<div class="status-line">'),
	);
	assert.doesNotMatch(hud, /t\('COST'\)|<small/);
	assert.doesNotMatch(game, /t\('READY'\)/);
	assert.match(source('i18n/index.ts'), /DEACTIVATE: 'Disable'/);
});

test('coins have larger bounded fountains and launch behind title instead of from screen bottom', () => {
	const oldFrequency = [0.15, 0.105, 0.075, 0.052, 0.036];
	for (let tier = 0; tier < 5; tier++) {
		const c = winCoinFountain(tier);
		assert.ok(c.max >= 90 && c.max <= 260);
		assert.ok(c.frequency > 0 && c.frequency < oldFrequency[tier] / 2);
		assert.ok(c.burst >= 12 && c.burst <= c.max);
		if (tier) assert.ok(c.max > winCoinFountain(tier - 1).max);
	}
	assert.deepEqual(winCoinFountain(-1), winCoinFountain(0));
	assert.deepEqual(winCoinFountain(9), winCoinFountain(4));
	assert.equal(WIN_COIN_ORIGIN_Y, 0.45833);
	const coins = source('components/WinCoins.svelte'),
		win = source('components/WinScreen.svelte');
	assert.match(coins, /source\?\.getBoundingClientRect/);
	assert.match(coins, /p.y = originY/);
	assert.doesNotMatch(coins, /y: height \* 0\.72/);
	assert.match(coins, /if \(!engine \|\| !element \|\| reduced\) return/);
	assert.match(coins, /remove\(\)/);
	assert.match(win, /WinCoins origin=\{winArt\}/);
	assert.match(win, /\.win-body\s*\{\s*position: relative;\s*z-index: 1;/);
});

test('rules use seven ordered pages with bounded navigation and verified payout source', () => {
	assert.deepEqual(RULES_PAGES, [
		'OVERVIEW',
		'PAYOUT TABLE',
		'FEATURES PAGE',
		'WAYS TO WIN',
		'FEATURE BUY',
		'GENERAL INFO',
		'UI GUIDE',
	]);
	assert.equal(rulesPageIndex(0, -1), 0);
	assert.equal(rulesPageIndex(6, 1), 6);
	for (let i = 0; i < 6; i++) assert.equal(rulesPageIndex(i, 1), i + 1);
	assert.deepEqual(RULE_BUYS, ['CHANCE', 'FEATURE', 'BONUS', 'SUPER', 'MYSTERY']);
	const rules = source('components/Rules.svelte');
	assert.match(rules, /each PAYS.slice\(start, start \+ capacity\) as pays/);
	assert.match(rules, /disabled=\{page === RULES_PAGES.length - 1\}/);
	assert.match(rules, /event.key === 'ArrowRight'/);
	assert.match(rules, /content.scrollTop = 0/);
	assert.doesNotMatch(rules, /Magnetic|7 × 7|7x7/);
	assert.match(source('components/Game.svelte'), /<Rules \/>/);
});

test('card symbols have a fitting viewport and headings retain an opaque yellow fill', () => {
	assert.match(source('components/Symbol.svelte'), /fit \? 180 :/);
	assert.match(source('figma.css'), /-webkit-text-fill-color: #ffdc12;/);
	const game = source('components/Game.svelte');
	assert.match(game, /decorative\s+fit/);
	const motion = new URL('../static/assets/the-gates/figma-20261012/motion/', import.meta.url);
	for (const name of ['RED_GEM', 'KEY', 'SACRED_EYE', 'GUARDIAN_MASK', 'CRYSTAL_ORB']) {
		const rig = JSON.parse(readFileSync(new URL(`${name}.json`, motion), 'utf8'));
		const body = rig.skins[0].attachments.body.body;
		assert.ok(body.width <= 144 && body.height <= 144, `${name}: fits 180-unit icon viewport`);
	}
});

test('paytable matches the supplied authoritative symbol order and all 30 payouts', async () => {
	const { PAYS, SYMBOLS } = await import('../src/game/contract.ts');
	const { SYMBOL_ART } = await import('../src/game/art.ts');
	const expected = {
		GUARDIAN_MASK: [10, 25, 50],
		SUN_MEDALLION: [2.5, 10, 25],
		SACRED_EYE: [2, 5, 15],
		RUNE_CHALICE: [1.5, 2, 12],
		CRYSTAL_ORB: [1, 1.5, 10],
		RED_GEM: [0.8, 1.2, 8],
		BLUE_GEM: [0.5, 1, 5],
		GREEN_GEM: [0.4, 0.9, 4],
		PURPLE_GEM: [0.25, 0.75, 2],
		AMBER_GEM: [0.2, 0.5, 1.5],
	};
	assert.deepEqual(SYMBOLS.slice(0, PAYS.length), Object.keys(expected));
	assert.deepEqual(PAYS, Object.values(expected));
	assert.equal(SYMBOL_ART.SUN_MEDALLION, 'coin');
	assert.equal(SYMBOL_ART.SACRED_EYE, 'eye');
	assert.equal(SYMBOL_ART.RUNE_CHALICE, 'letter');
	assert.equal(SYMBOL_ART.CRYSTAL_ORB, 'orb');
	const rules = source('components/Rules.svelte');
	assert.match(rules, /data-pay-symbol=\{SYMBOLS\[i\]\}/);
	assert.match(rules, /t\(`SYMBOL \$\{SYMBOLS\[i\]\}`\)/);
	assert.match(rules, /pay.toFixed\(2\)/);
});

test('idle preview board retains its runtime symbol-list import', () => {
	const game = source('components/Game.svelte');
	assert.match(game, /import\s*\{[^}]*\bSYMBOLS\b[^}]*\}\s*from '\.\.\/game\/contract'/);
	assert.match(game, /name: SYMBOLS\[/);
});

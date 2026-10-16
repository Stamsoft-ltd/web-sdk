import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('HTML modals own focus without moving the GPU canvas into a native dialog', () => {
	const modal = source('components/Modal.svelte');
	assert.match(modal, /role="dialog"/);
	assert.match(modal, /aria-modal="true"/);
	assert.match(modal, /installModalFocus\(overlay, \{ close, locked \}\)/);
	assert.doesNotMatch(modal, /showModal|HTMLDialogElement|<dialog/);
	assert.match(modal, /if !locked\}[\s\S]*?modal-screen-close/);
	const css = source('figma.css');
	assert.match(css, /\.modal-overlay\s*\{[^}]*position: fixed;[^}]*z-index: 80/);
	assert.match(css, /\.modal-overlay \.modal-screen-close\s*\{[^}]*position: fixed/);
	assert.doesNotMatch(
		css.slice(css.indexOf('/* HTML modal interaction layer')),
		/backdrop-filter|\.temple[^}]*opacity/,
	);
});

test('focus trap supports Escape, wraps Tab and restores the prior connected control', () => {
	const focus = source('game/modalFocus.ts');
	assert.match(focus, /event.key === 'Escape'/);
	assert.match(focus, /if \(!locked\) close\(\)/);
	assert.match(focus, /event.shiftKey/);
	assert.match(focus, /document.removeEventListener\('keydown', keyboard, true\)/);
	assert.match(focus, /document.removeEventListener\('focusin', focus\)/);
	assert.match(focus, /if \(prior\?\.isConnected\) prior.focus\(\)/);
});

test('feature confirmations have one explanation, one price and Back/OK, without a close X', () => {
	const game = source('components/Game.svelte');
	const confirmation = game.slice(
		game.indexOf('{:else if selected}'),
		game.indexOf("{:else if modal === 'features'}"),
	);
	assert.match(confirmation, /locked compact/);
	assert.match(confirmation, /confirmation-symbol/);
	assert.equal((confirmation.match(/selected\} DESC/g) ?? []).length, 1);
	assert.match(confirmation, /money\(selectedCost\)/);
	assert.match(confirmation, /t\('BACK'\)/);
	assert.match(confirmation, /t\('OK'\)/);
	assert.doesNotMatch(confirmation, /BUY NOTE|COSTS\[selected\]/);
});

test('autoplay UI uses existing exclusive speed flags, bounded spin count and earned-bonus opt in', () => {
	const controls = source('components/AutoplayControls.svelte');
	assert.match(controls, /stateBet.isTurbo = selected === 'fast'/);
	assert.match(controls, /stateBet.isSuperTurbo = selected === 'turbo'/);
	assert.match(controls, /disabledSuperTurbo/);
	assert.match(controls, /type="range"[\s\S]*?max=\{AUTOPLAY_COUNTS.length - 1\}/);
	assert.match(controls, /bind:checked=\{autoplaySettings.continueOnBonus\}/);
	assert.match(source('game/autoplaySettings.svelte.ts'), /continueOnBonus: false/);
	assert.doesNotMatch(controls, /requestBet|activeBetModeKey|AUTO_BET/);
	const game = source('components/Game.svelte');
	assert.match(game, /function autoStart\(\)[\s\S]*?disabledAutoplay[\s\S]*?return/);
	assert.match(game, /stateBet.autoSpinsLossLimitAmount = Infinity/);
	assert.match(game, /stateBet.autoSpinsSingleWinLimitAmount = Infinity/);
	assert.match(game, /gameActor.send\(\{ type: 'AUTO_BET' \}\)/);
});

test('compact panels reset inherited spacing and reserve a visible 48px footer on short screens', () => {
	const css = source('figma.css');
	assert.match(css, /\.modal-overlay \.compact-confirm p\s*\{\s*margin: 0;/);
	assert.match(
		css,
		/\.modal-overlay \.compact-confirm \.confirm-price\s*\{\s*margin: 0;\s*padding: 0;\s*min-height: 0;/,
	);
	assert.match(
		css,
		/\.modal-overlay \.compact-confirm \.confirm-price strong\s*\{\s*margin: 0;\s*padding: 0;/,
	);
	assert.match(css, /\.modal-overlay \.confirmation-actions > button\s*\{[^}]*height: 48px;/);
	assert.match(
		css,
		/@media \(max-height: 450px\)[\s\S]*?grid-template-columns: 74px minmax\(0, 1fr\)/,
	);
	assert.match(css, /\.autoplay-slider input\s*\{[^}]*height: 28px;/);
});

test('autoplay owns a wide sheet with three horizontal switches and a centered slider heading', () => {
	const css = source('figma.css');
	assert.match(
		css,
		/\.modal-overlay \.compact-confirm:has\(\.autoplay-controls\)\s*\{\s*width: min\(820px, calc\(100dvw - 32px\)\)/,
	);
	assert.match(css, /\.autoplay-switches input\s*\{\s*order: -1;/);
	assert.match(
		css,
		/@media \(min-width: 600px\)[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
	);
	assert.match(css, /\.autoplay-slider > span\s*\{\s*grid-column: 1 \/ -1;\s*grid-row: 1;/);
	assert.match(css, /\.autoplay-slider output\s*\{\s*grid-column: 2;\s*grid-row: 2;/);
});

test('rules shell reserves navigation outside its fitted page', () => {
	const css = source('figma.css');
	assert.match(
		css,
		/\.modal-overlay > \.cartoon-modal.rules\s*\{[^}]*display: flex;[^}]*flex-direction: column;[^}]*overflow: hidden/,
	);
	const rules = source('components/Rules.svelte');
	assert.match(rules, /\.rules-page\s*\{[^}]*flex: 1;[^}]*min-height: 0;[^}]*overflow: hidden/);
});

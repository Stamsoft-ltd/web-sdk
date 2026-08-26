import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

describe('Roller Wild Mega Wild animation contract', () => {
	it('uses one 64-frame rig per affected reel with no separate cart or row stack', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const board = readSource('components/Board.svelte');
		const game = readSource('components/Game.svelte');

		expect(overlay).toContain('const INTRO_MS = 1990');
		expect(overlay).toContain('const SUPER_TURBO_INTRO_FACTOR = 0.2');
		expect(overlay).toContain('waitForTimeout(introWaitMs())');
		expect(overlay).toContain('<MegaWildFullReel');
		expect(overlay).toContain('multiplier={roller.multiplier}');
		expect(overlay).toContain("animationName={phase === 'revealing' ? 'intro' : 'idle'}");
		expect(overlay).toContain("winning={phase === 'settled' && reelIsWinning(roller.reel)}");
		expect(overlay).not.toContain('<LoopingSpineSprite');
		expect(overlay).not.toContain('<RollerMultiplierCell');
		expect(overlay).not.toContain('<CoasterWildBackground');
		expect(overlay).not.toContain('rollerWildRail');
		expect(overlay).not.toContain('carYs');
		expect(overlay).not.toContain('SPREAD_ORDER');
		expect(overlay).not.toContain('contributionFor');
		expect(overlay).toContain('<Graphics isMask draw={drawBoardMask} />');
		expect(overlay).toContain("<Container zIndex={phase === 'settled' ? 0 : 5}>");
		expect(overlay).not.toContain('drawForegroundGrid');
		expect(game).not.toContain('BoardGridOverlay');
		expect(board).toContain('<Graphics isMask draw={drawBoardContentMask} />');
	});

	it('pops each landed Mega Wild before showing the synchronized carts', () => {
		const board = readSource('components/Board.svelte');
		const handler = readSource('game/bookEventHandlerMap.ts');
		const rollerStart = handler.indexOf('rollerWildsApply: async');
		const rollerEnd = handler.indexOf('coasterSetup: async', rollerStart);
		const rollerHandler = handler.slice(rollerStart, rollerEnd);

		expect(board).toMatch(
			/isInitialRollerTriggerCell[\s\S]*?return getSpecialSymbolKey\('megaWild', layoutType\)/,
		);
		expect(board).toMatch(/if \(rawSymbol\.rollerTrigger\) return true/);
		expect(board).not.toContain("assetKey: 'rollerWildCarSpine'");
		expect(board).not.toContain("return 'rollerWildCarStill'");
		expect(rollerHandler).toContain(
			'const triggerPositions = reels.map(({ reel, triggerRow }) => ({ reel, row: triggerRow }))',
		);
		expect(rollerHandler).toContain("type: 'boardWithAnimateSymbols'");
		expect(rollerHandler).toContain('await waitForTimeout(380)');
		expect(rollerHandler).toContain("if (symbol) symbol.symbolState = 'static'");
		expect(rollerHandler.indexOf("type: 'boardWithAnimateSymbols'")).toBeLessThan(
			rollerHandler.indexOf("type: 'rollerWildsShow'"),
		);
	});

	it('uses fake/real values without replacing the authored reveal reel', () => {
		const handler = readSource('game/bookEventHandlerMap.ts');
		const rollerStart = handler.indexOf('rollerWildsApply: async');
		const rollerEnd = handler.indexOf('coasterSetup: async', rollerStart);
		const rollerHandler = handler.slice(rollerStart, rollerEnd);
		expect(rollerHandler).toContain('multiplier: Math.max(1, entry.multiplier)');
		expect(rollerHandler).toContain(
			'fakeMultiplier: Math.max(1, entry.fakeMultiplier ?? entry.multiplier)',
		);
		expect(rollerHandler).toContain(
			'initialReal: seededEventChoice(bookEvent.index, entry.reel, 17, 2) === 1',
		);
		expect(rollerHandler).not.toContain('entry.multipliers');
		expect(rollerHandler).not.toContain('symbol.rawSymbol =');
		expect(rollerHandler).not.toContain('reelMultiplier: roller.multiplier');
		expect(rollerHandler).toContain('stateGame.activeRollerReels = reels');
	});

	it('startup-gates the combined full-reel rig', () => {
		const assets = readSource('game/assets.ts');
		const rigStart = assets.indexOf('megaWildFullReelSpine:');
		// Ends at the next real entry, not at the dead `coasterCarSickAnim` registration this used
		// to name: that key pointed at a WebM nothing drew and has been deleted.
		const rigEnd = assets.indexOf('tpDuckSignWingLeft:', rigStart);
		const rigRegistration = assets.slice(rigStart, rigEnd);

		expect(rigStart).toBeGreaterThan(-1);
		expect(rigEnd).toBeGreaterThan(rigStart);
		expect(rigRegistration).toContain("type: 'spine'");
		expect(rigRegistration).not.toMatch(/defer\s*:\s*true/);
	});

	it('keeps one overlay-owned result, then reveals the original symbols on the next spin', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const game = readSource('components/Game.svelte');
		const handler = readSource('game/bookEventHandlerMap.ts');
		const actor = readSource('game/actor.ts');
		const rollerStart = handler.indexOf('rollerWildsApply: async');
		const rollerEnd = handler.indexOf('coasterSetup: async', rollerStart);
		const rollerHandler = handler.slice(rollerStart, rollerEnd);

		expect(overlay).toContain('<MegaWildFullReel');
		expect(overlay).toContain('multiplier={roller.multiplier}');
		expect(overlay).toContain("animationName={phase === 'revealing' ? 'intro' : 'idle'}");
		expect(overlay).toContain("type: 'rollerWildsRollOut'");
		expect(overlay).toContain('type RollOutAnchor = { symbolY: () => number; lastY: number }');
		expect(overlay).toContain('let rollOutOffsets = $state(new Map<number, number>())');
		expect(overlay).toContain('const deltaY = currentY - anchor.lastY');
		expect(overlay).toContain('if (deltaY > 0)');
		expect(overlay).toContain('(nextOffsets.get(roller.reel) ?? 0) + deltaY');
		expect(overlay).not.toContain('anchor.symbolY() - anchor.startY');
		expect(overlay).not.toMatch(
			/rollerWildsRollOut:[\s\S]*if \(stateBet\.isTurbo \|\| stateBet\.isSuperTurbo\)[\s\S]*phase = 'hidden'/,
		);
		expect(overlay).toContain('y={rollOutOffsetY(roller)}');
		expect(overlay).not.toContain('rollOutY');
		expect(overlay).toContain('setClearedReels(triggerReels.slice(0, index + 1))');
		expect(overlay).toMatch(
			/rollerWildsShow[\s\S]*context\.stateGame\.rollerClearedCells = \[\][\s\S]*phase = 'revealing'/,
		);
		expect(overlay).toContain("presentationOwner = 'overlay'");
		expect(overlay).toContain("<Container zIndex={phase === 'settled' ? 0 : 5}>");
		expect(game.indexOf('<RollerWildsOverlay />')).toBeLessThan(
			game.indexOf('{#if context.stateGame.paylineWins.length > 0}'),
		);
		expect(handler).toContain('await tick();');
		expect(handler).toContain("await eventEmitter.broadcastAsync({ type: 'rollerWildsHandoff' })");
		expect(rollerHandler).not.toContain("eventEmitter.broadcast({ type: 'rollerWildsHide' })");
		expect(handler).toMatch(
			/const hadActiveRollerReels = stateGame\.activeRollerReels\.length > 0[\s\S]*rollerRollOutPromise[\s\S]*rollerWildsRollOut[\s\S]*stateGame\.activeRollerReels = \[\][\s\S]*Promise\.all\(\[spinPromise, rollerRollOutPromise\]\)/,
		);
		expect(actor).toContain("broadcastAsync({ type: 'rollerWildsRollOut' })");
	});
});

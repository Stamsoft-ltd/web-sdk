import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boardKeyForMultiplier } from '../src/game/winPresentation';
import { INITIAL_BOARD } from '../src/game/constants';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

describe('shared frontend completeness guards', () => {
	it('converts replay API units and exposes replay multipliers', () => {
		const replay = source('src/state/templateStake.svelte.ts');
		expect(replay).toContain('API_AMOUNT_MULTIPLIER');
		expect(replay).toContain('replayCostMultiplier');
		expect(replay).toContain('replayPayoutMultiplier');
	});

	it('isolates replay HUD from live controls', () => {
		const game = source('src/components/Game.svelte');
		expect(game).toContain("stateUi.config.mode !== 'replay'");
	});

	it('recognises every one-shot Theme Park bonus during recovery', () => {
		const resume = source('src/components/ResumeBet.svelte');
		for (const mode of ['DUCK', 'ROLLER', 'COASTER'])
			expect(resume).toContain(`mode === '${mode}'`);
	});

	it('uses a bounded renderer and self-hosted fonts', () => {
		const game = source('src/components/Game.svelte');
		const html = source('src/app.html');
		expect(game).toContain('maxResolution={2}');
		expect(game).toContain('rendererPreference="webgl"');
		expect(html).not.toContain('https://');
		expect(html).toContain('@font-face');
	});

	it('keeps the three-state speed selector visible in the scaled HUD', () => {
		const hud = source('src/components/HudHtml.svelte');
		expect(hud).toContain('data-speed={speedMode}');
		expect(hud).toContain('--hud-u: calc(min(93.8vw, 1400px) / 1126)');
		expect(hud).toContain(".pt-turbo[data-speed='fast']");
	});

	it('shrinks long HUD currency values in layout instead of paint-only transforms', () => {
		const hud = source('src/components/HudHtml.svelte');
		expect(hud).toContain("node.style.removeProperty('font-size')");
		expect(hud).toContain('node.style.fontSize =');
		expect(hud).not.toContain('node.style.transform =');
		expect(hud).toMatch(
			/\.value-pill--balance \{[\s\S]*?width: calc\(var\(--hud-u\) \* 130\.333\);[\s\S]*?overflow: hidden;/,
		);
		expect(hud).toMatch(/\.bet-values \{[\s\S]*?overflow: hidden;/);
		expect(hud).toMatch(/\.pt-bet__values \{[\s\S]*?flex: 1 1 0;[\s\S]*?overflow: hidden;/);
	});

	it('does not self-subscribe while rebuilding reactive metadata', () => {
		const game = source('src/components/Game.svelte');
		expect(game).toContain('registerArtDeep(betModeMeta)');
		expect(game).toContain('registerArtDeep(gameRuleMeta)');
		expect(game).not.toContain('registerArtDeep(stateMeta.betModeMeta)');
		expect(game).not.toContain('registerArtDeep(stateMeta.gameRuleMeta)');
	});

	it('keeps per-spin wins in the HUD and uses ordered win boards', () => {
		const events = source('src/game/bookEventHandlerMap.ts');
		const hud = source('src/components/HudHtml.svelte');
		expect(events).toContain('stateGame.roundWin = bookEvent.totalWin');
		expect(events).toContain("stateGame.gameType === 'freegame'");
		expect(events).toContain('getWinLevelDataForAmount(bookEvent.totalWin)');
		expect(events).toContain('if (stateGame.bonusSummaryShown) return');
		expect(hud).toContain('context.stateGame.roundWin');
		expect(boardKeyForMultiplier(49.99)).toBe('winSweet');
		expect(boardKeyForMultiplier(50)).toBe('winWild');
		expect(boardKeyForMultiplier(100)).toBe('winEpic');
		expect(boardKeyForMultiplier(250)).toBe('winMythic');
		expect(boardKeyForMultiplier(1000)).toBe('winLegendary');
	});

	it('shows a normal win board before the Duck Your Luck bonus summary', () => {
		const events = source('src/game/bookEventHandlerMap.ts');
		const duckEnd = events.slice(
			events.indexOf('duckPickEnd: async'),
			events.indexOf('rollerWildsApply: async'),
		);
		expect(duckEnd).toContain("type: 'winUpdate'");
		expect(duckEnd.indexOf("type: 'winShow'")).toBeLessThan(
			duckEnd.indexOf("type: 'freeSpinOutroShow'"),
		);
		expect(duckEnd.indexOf("type: 'winHide'")).toBeLessThan(
			duckEnd.indexOf("type: 'freeSpinOutroShow'"),
		);
		expect(duckEnd.indexOf('stateGame.bonusSummaryShown = true')).toBeGreaterThan(
			duckEnd.indexOf("type: 'winHide'"),
		);
	});

	it('loops paylines until the next physical spin starts', () => {
		const events = source('src/game/bookEventHandlerMap.ts');
		const actor = source('src/game/actor.ts');
		const state = source('src/game/stateGame.svelte.ts');
		const neon = source('src/components/NeonPaylines.svelte');
		const finalWin = events.slice(
			events.indexOf('finalWin: async'),
			events.indexOf('freeSpinTrigger: async'),
		);
		const reveal = events.slice(events.indexOf('reveal: async'), events.indexOf('winInfo: async'));

		expect(finalWin).not.toContain('stateGame.paylineWins = []');
		expect(state.slice(state.indexOf('const resetBonusState'))).not.toContain(
			'stateGame.paylineWins = []',
		);
		expect(reveal).toContain('stateGame.paylineWins = []');
		expect(reveal.indexOf('stateGame.paylineWins = []')).toBeLessThan(
			reveal.indexOf('stateGameDerived.enhancedBoard.spin'),
		);
		expect(actor).toMatch(/onNewGameStart:[\s\S]*stateGame\.paylineWins = \[\]/);
		expect(neon).toContain('app.ticker.add(tick');
		expect(neon).toContain('time = elapsed / 1000');
		expect(neon).toContain('const cycleTime = elapsed % cycleMs');
		expect(neon).toContain('lineAlpha = 0');
	});

	it('keeps the initial reel contract identical to seven-row reveal boards', () => {
		expect(INITIAL_BOARD).toHaveLength(5);
		for (const reel of INITIAL_BOARD) expect(reel).toHaveLength(7);
	});

	it('keeps Mega Coaster routing executable', () => {
		const presenter = source('src/components/CoasterSetupPresenter.svelte');
		expect(presenter).not.toContain('MIN_CARTS_PER_LINE');
		expect(presenter).toContain('ROWS.flatMap((row) =>');
		expect(presenter).toContain('return impacts.map((impact, lane) =>');
		expect(presenter).toContain('return { row, launchDelayUnits, impact }');
		expect(presenter).toContain('route.launchDelayUnits * timing.stagger');
		expect(presenter).toContain('assetKey="coasterVomitSpine"');
	});

	it('ships a complete catalog for every configured locale', async () => {
		const en = (await import('../src/i18n/messagesMap/en')).default;
		const locales = [
			'ar',
			'de',
			'es',
			'fi',
			'fr',
			'hi',
			'id',
			'ja',
			'ko',
			'pl',
			'pt',
			'ru',
			'tr',
			'vi',
			'zh',
		];
		const placeholders = (value: string) =>
			[...value.matchAll(/%\w+%/g)].map(([match]) => match).sort();

		for (const locale of locales) {
			const catalog = (await import(`../src/i18n/messagesMap/${locale}.ts`)).default;
			expect(Object.keys(catalog).sort(), locale).toEqual(Object.keys(en).sort());
			for (const key of Object.keys(en) as Array<keyof typeof en>) {
				expect(catalog[key]?.trim().length, `${locale}:${key}`).toBeGreaterThan(0);
				expect(placeholders(catalog[key]), `${locale}:${key}`).toEqual(placeholders(en[key]));
			}
		}
	});
});

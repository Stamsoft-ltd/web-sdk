import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tierForMultiplier } from '../src/game/winPresentation';
import { INITIAL_BOARD } from '../src/game/constants';

const source = (path: string) => readFileSync(resolve(import.meta.dirname, '..', path), 'utf8');

describe('shared frontend completeness guards', () => {
	it('converts replay API units and exposes replay multipliers', () => {
		const replay = source('src/state/templateStake.svelte.ts');
		const replayHud = source('src/components/replay/ReplayHud.svelte');
		expect(replay).toContain('API_AMOUNT_MULTIPLIER');
		expect(replay).toContain('replayCostMultiplier');
		expect(replay).toContain('replayPayoutMultiplier');
		expect(replayHud).toContain('replayPayoutMultiplier().toFixed(2)');
		expect(replayHud).not.toContain('replayPayoutMultiplier().toFixed(4)');
	});

	it('holds Space to chain spins until release or insufficient balance', () => {
		const hud = source('src/components/HudHtml.svelte');
		expect(hud).toContain('onhold={beginSpaceHold}');
		expect(hud).toContain('onholdend={endSpaceHold}');
		expect(hud).toContain('stateBet.isSpaceHold = true');
		expect(hud).toContain(
			'if (stateBet.isSpaceHold && !stateBetDerived.isBetCostAvailable()) endSpaceHold()',
		);
	});

	it('runs triggered and bought bonuses at normal speed', () => {
		const actor = source('src/game/actor.ts');
		const events = source('src/game/bookEventHandlerMap.ts');
		const buy = source('src/components/CustomBuyBonusModal.svelte');
		const stateBet = source('../../packages/state-shared/src/stateBet.svelte.ts');
		expect(stateBet).toContain('const setNormalSpeed = () =>');
		expect(actor).toContain('if (shouldDeferEndRound(bet)) stateBetDerived.setNormalSpeed();');
		expect(events).toContain('stateBetDerived.setNormalSpeed();');
		expect(buy).toContain('stateBetDerived.setNormalSpeed();');
	});

	it('states that the highest-paying symbol wins each line', () => {
		const en = source('src/i18n/messagesMap/en.ts');
		const social = source('src/i18n/socialOverridesEn.ts');
		const modal = source('src/components/CustomInfoModal.svelte');
		expect(en).toContain("'INFO WTW HIGHEST': 'Highest paying symbol per line wins.'");
		expect(social).toContain("'INFO WTW HIGHEST': 'Highest awarding symbol per line wins.'");
		expect(modal).toContain("pays: ['-', '-', paysFor('H1')[2]]");
		expect(en).toContain('Five Wilds on a line award 20x');
		expect(social).toContain('Five Wilds on a line award 20x');
	});

	it('uses the Engine legal mark without legacy Stake branding', async () => {
		for (const locale of [
			'ar',
			'de',
			'en',
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
		]) {
			const catalog = (await import(`../src/i18n/messagesMap/${locale}.ts`)).default;
			expect(catalog['INFO GI LEGAL TM'], locale).toContain('© 2026 Engine.');
			expect(catalog['INFO GI LEGAL TM'], locale).not.toContain('Stake');
		}
	});

	it('caps the desktop logo against the real board top on short screens', () => {
		const hud = source('src/components/HudHtml.svelte');
		expect(hud).toContain('const gameLogoWidth = $derived.by');
		expect(hud).toContain('board.height * board.boardScale * FRAME_OVER_GRID_Y');
		expect(hud).toContain('Math.min(authoredWidth, availableHeight * (1300 / 386))');
		expect(hud).toContain('style={gameLogoWidth != null ? `width:${gameLogoWidth}px` : undefined}');
	});

	it('isolates replay HUD from live controls', () => {
		const game = source('src/components/Game.svelte');
		expect(game).toContain("stateUi.config.mode !== 'replay'");
	});

	it('fits the replay panel into short popout viewports', () => {
		const replayHud = source('src/components/replay/ReplayHud.svelte');
		expect(replayHud).toContain('position: absolute;');
		expect(replayHud).toContain('container-type: size;');
		expect(replayHud).toContain('@container (orientation: landscape) and (max-height: 520px)');
		expect(replayHud).toContain('width: min(760px, calc(100% - 32px));');
		expect(replayHud).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
		expect(replayHud).toContain('grid-template-columns: 1fr;');
		expect(replayHud).not.toContain('100vw');
		expect(replayHud).not.toContain('100vh');
		expect(replayHud).not.toContain('overflow: auto;');
	});

	it('recognises every one-shot Theme Park bonus during recovery', () => {
		const resume = source('src/components/ResumeBet.svelte');
		for (const mode of ['DUCK', 'ROLLER', 'COASTER'])
			expect(resume).toContain(`mode === '${mode}'`);
	});

	it('uses a bounded renderer and self-hosted fonts', () => {
		const game = source('src/components/Game.svelte');
		const html = source('src/app.html');
		// The point of the guard is that the renderer is CAPPED, not that it is capped at any one
		// number: a retina display would otherwise render at devicePixelRatio, and 2 already means four
		// times the fragment work of 1. Lowered to 1.5 on 2026-08-26 after real-Safari profiling.
		const maxResolution = game.match(/maxResolution=\{([\d.]+)\}/);
		expect(maxResolution).not.toBeNull();
		expect(Number(maxResolution![1])).toBeLessThanOrEqual(2);
		expect(game).toContain('rendererPreference="webgl"');
		expect(html).not.toContain('https://');
		expect(html).toContain('@font-face');
	});

	it('ships every facade the buy-bonus cards ask for, at every breakpoint', () => {
		// A missing file here is SILENT: the card renders its 55x55 box and nothing in it, which is
		// how Roller Wilds and Mega Coaster went blank when their art was renamed `-marquee` ->
		// `-still` and this screen was not updated with game/assets.ts. Resolve the paths the way the
		// component does — off its own suffix map — so the guard follows a future rename instead of
		// pinning today's filenames.
		const modal = source('src/components/CustomBuyBonusModal.svelte');
		const suffixes = [...modal.matchAll(/'([a-z-]+)':\s*'([a-z-]+)',/g)];
		expect(suffixes.length).toBe(3);
		for (const [, icon, suffix] of suffixes) {
			for (const variant of ['desktop', 'mobile', 'mobile-landscape']) {
				const file = `static/assets/theme-park/v2/modes/${icon}-${variant}-${suffix}.webp`;
				expect(existsSync(resolve(import.meta.dirname, '..', file)), file).toBe(true);
			}
		}
	});

	it('scales the popup close button by the frame, not by width alone', () => {
		// A popout is short and wide. The game fits its 1200x670 frame by HEIGHT there, so a close
		// button sized off 100vw drifted out of proportion with the panel it closes — 1.4x too big at
		// 800x470, 2.6x at 420x240. Both terms have to be in the fit, and the 40px tap floor has to
		// stay behind a coarse pointer or it re-creates the bug on every small desktop popout.
		const close = source('src/components/PopupCloseButton.svelte');
		const fit = close.match(/--close-fit:\s*([^;]+);/)?.[1];
		expect(fit).toBe('min(100vw / 1200, 100vh / 670, 1.25px)');
		expect(close).toMatch(
			/@media \(pointer: coarse\) \{[\s\S]*?--close-u: max\(var\(--close-fit\), 0\.8214px\);/,
		);
		// The buy screen reserves headroom with a copy of that formula; a drifted copy puts the cards
		// back under the button.
		const modal = source('src/components/CustomBuyBonusModal.svelte');
		expect(modal).toContain(`--close-clear: calc(${fit} * 73);`);
		expect(modal).toContain(
			'--close-clear: calc(max(min(100vw / 1200, 100vh / 670, 1.25px), 0.8214px) * 73);',
		);
	});

	it('centres the balloon bunch in its symbol frame', () => {
		// The board maps a symbol's whole 448x360 canvas onto the cell, so there is no per-symbol nudge
		// to correct art that sits off-centre in its canvas with — the canvas IS the framing. The
		// design's composition hung this bunch 38px high, a tenth of the cell above every other symbol.
		// The build script re-centres it, and must keep doing so through the PLACEMENTS, since the
		// balloonParts table that drives the live bob and fly is derived from them.
		const build = source('scripts/balloons/build_balloons.py');
		expect(build).toContain('def centring(masters):');
		expect(build).toMatch(/def assemble\(masters\):[\s\S]*?shift_x, shift_y = centring\(masters\)/);
		expect(build).toContain('x, y = px + shift_x, py + shift_y');
	});

	it('keeps the three-state speed selector visible in the scaled HUD', () => {
		const hud = source('src/components/HudHtml.svelte');
		expect(hud).toContain('data-speed={speedMode}');
		expect(hud).toContain('--hud-u: calc(min(93.8vw, 1400px) / 1126)');
		// Every bar shows the speed as art, one bolt per step, so OFF can never read as turbo-on:
		// the outlined bolt, one solid bolt, two solid bolts. Both the desktop row and the portrait
		// row pick between the same three files; landscape does the same with its own PNG set.
		expect(hud).toContain('turbo-1.webp');
		expect(hud).toContain('turbo-2.webp');
		expect(hud).toContain('turbo-3.webp');
		const turboPicks = hud.match(
			/stateBet\.isSuperTurbo\s*\?\s*navTurboDouble\s*:\s*stateBet\.isTurbo\s*\?\s*navTurboSolid\s*:\s*navTurboOutline/g,
		);
		expect(turboPicks?.length).toBe(2);
		expect(hud).toContain(
			'stateBet.isSuperTurbo ? ptTurboSuper : stateBet.isTurbo ? ptTurboFast : ptTurbo',
		);
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
		expect(tierForMultiplier(49.99)).toBe('sweet');
		expect(tierForMultiplier(50)).toBe('wild');
		expect(tierForMultiplier(100)).toBe('epic');
		expect(tierForMultiplier(250)).toBe('mythic');
		expect(tierForMultiplier(1000)).toBe('legendary');
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

// The settings popout is one design, drawn by both mobile layouts. Portrait rendered the desktop
// panel until 2026-08-27, so a fix aimed at the landscape one silently changed nothing on a phone.
it('portrait and landscape draw the same design settings popout', () => {
	const hud = source('src/components/HudHtml.svelte');
	expect(hud).toContain("settingsMenu('hud-menu--pt')");
	expect(hud).toContain("settingsMenu('hud-menu--ls')");
	expect(hud).toContain("settingsMenu('hud-menu--dk')");
	// No layout may fall back to the old desktop panel by rendering the menu with no variant.
	expect(hud).not.toContain("settingsMenu('')");
	// Every design rule below has to name both variants, or one layout drifts back to the desktop panel.
	for (const part of [
		'',
		' .hud-menu__item',
		' .hud-menu__badge',
		' .hud-menu__glyph',
		' .hud-menu__label',
		' .hud-menu__divider',
	]) {
		expect(hud).toContain(
			`.hud-menu--ls${part},\n\t.hud-menu--pt${part},\n\t.hud-menu--dk${part} {`,
		);
	}
	expect(hud).toContain('--menu-u: var(--pt-u);');
	expect(hud).toContain('--menu-u: calc(var(--hud-u) * 1.7);');
});

// The info modal draws its OWN close button (.info-x), not <PopupCloseButton> — a move applied to
// the shared one leaves this untouched. Its offsets must stay proportional to its diameter: the
// fixed-px clamps they replaced bottomed out at every wide size and cut into the card's corner arc.
it('the info modal close sits clear of the card corner', () => {
	const info = source('src/components/CustomInfoModal.svelte');
	expect(info).toContain('--chrome-d: clamp(22px, 9vh, 40px);');
	// The close X and the page arrows share the game's round-button behaviour; they had none.
	expect(info).toContain('\t.info-x,\n\t.nav-arrow {');
	expect(info).toContain('.info-x:not(:disabled):hover,');
	expect(info).toContain('.info-x:not(:disabled):active,');
	expect(info).toContain('top: max(calc(var(--chrome-d) * -1.15), calc(4px - 9.1vh));');
	expect(info).toContain('right: max(calc(var(--chrome-d) * -0.85), calc(4px - 4.6vw));');
});

// Card body copy across the info modal is one design token: Nunito 400 / 12px / normal leading /
// 3% tracking / #D7D7D7. `line-height: 1` here came from Figma's line-height box, not the text's.
it('info card body text carries the design body spec', () => {
	const info = source('src/components/CustomInfoModal.svelte');
	for (const cls of ['.ov-card__p', '.feat-p']) {
		const block = info.slice(info.indexOf(`\t${cls} {`));
		const body = block.slice(0, block.indexOf('\n\t}'));
		expect(body, cls).toContain('font-weight: 400;');
		expect(body, cls).toContain('font-size: 12px;');
		expect(body, cls).toContain('line-height: normal;');
		expect(body, cls).toContain('letter-spacing: 0.03em;');
		expect(body, cls).toContain('color: #d7d7d7;');
	}
	expect(info).not.toMatch(/\.ov-card__p \{[^}]*line-height: 1;/s);
});

// MUSIC had no muted glyph — only SOUND did — so the row's only "off" signal was the dimmed label.
it('the music menu item has its own muted glyph', () => {
	const hud = source('src/components/HudHtml.svelte');
	expect(hud).toContain('menu_music_muted.svg');
	expect(hud).toContain('musicMuted ? menuIconMusicMuted : menuIconMusic');
	expect(
		existsSync(
			resolve(import.meta.dirname, '..', 'static/assets/theme-park/v2/hud/menu_music_muted.svg'),
		),
	).toBe(true);
});

// Six build scripts each carried their own copy of the paper key, and every copy returned a hard
// 0/255 alpha — which ships a Figma export's antialiasing as OPAQUE pale pixels, a white fringe
// tracing the outline of every symbol on the purple board. The keyer lives in one place now and
// un-mattes that rim; a script that goes back to its own `np.where(seen, 0, 255)` brings it back.
it('the build scripts key Figma paper through the shared un-matting keyer', () => {
	expect(source('scripts/lib/figma_paper.py')).toContain('def keyed(path, holes=False):');
	for (const script of [
		'scripts/roller/build_roller.py',
		'scripts/wheel/build_wheel.py',
		'scripts/popcorn/build_popcorn.py',
		'scripts/wild/build_wild.py',
		'scripts/duck/build_duck.py',
		// NOT build_duck_sign.py. Its three sources are the design's own layers pulled straight out
		// of Figma as RGBA, so they arrive with real antialiasing and no paper behind them at all —
		// about 1% of the duck's pixels are partial alpha. Running the keyer over a drawing that was
		// never on paper is what would damage that rim, not what would save it.
	]) {
		const text = source(script);
		expect(text, script).toContain('from lib.figma_paper import keyed');
		expect(text, script).not.toContain('np.where(seen, 0, 255)');
	}
});

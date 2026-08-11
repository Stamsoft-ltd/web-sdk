import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rigRoot = path.join(appRoot, 'static', 'assets', 'sprites', 'rollerCar');
const skeleton = JSON.parse(fs.readFileSync(path.join(rigRoot, 'roller_car_spine.json'), 'utf8'));
const atlas = fs.readFileSync(path.join(rigRoot, 'roller_car.atlas'), 'utf8');
const readSource = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

const animationDuration = (value: unknown): number => {
	if (Array.isArray(value)) {
		return value.reduce((max, item) => Math.max(max, animationDuration(item)), 0);
	}
	if (!value || typeof value !== 'object') return 0;

	const record = value as Record<string, unknown>;
	const ownTime = typeof record.time === 'number' ? record.time : 0;
	return Object.values(record).reduce(
		(max, item) => Math.max(max, animationDuration(item)),
		ownTime,
	);
};

const animationAttachmentNames = (value: unknown, names = new Set<string>()): Set<string> => {
	if (Array.isArray(value)) {
		for (const item of value) animationAttachmentNames(item, names);
		return names;
	}
	if (!value || typeof value !== 'object') return names;

	const record = value as Record<string, unknown>;
	if (typeof record.name === 'string' && record.name.startsWith('roller_car_')) {
		names.add(record.name);
	}
	for (const item of Object.values(record)) animationAttachmentNames(item, names);
	return names;
};

describe('Roller Wild Mega Wild animation contract', () => {
	it('exports one fast 48-frame frontal-to-vertical Spine ride', () => {
		expect(skeleton.skeleton.spine).toBe('4.2.0');
		expect(skeleton.skeleton.hash).toBe(
			'theme-park-roller-car-v6-frontal-to-vertical-arms-48frame-fast',
		);
		expect(Object.keys(skeleton.animations).sort()).toEqual(['idle', 'ride']);
		expect(animationDuration(skeleton.animations.idle)).toBe(0);
		expect(animationDuration(skeleton.animations.ride)).toBe(0.48);
	});

	it('uses 48 monotonic registered pose swaps with no invisible handoff', () => {
		const frames = skeleton.animations.ride.slots.art.attachment;
		expect(frames).toHaveLength(48);
		expect(frames.map(({ time }: { time: number }) => time)).toEqual(
			[...frames].map(({ time }: { time: number }) => time).sort((a: number, b: number) => a - b),
		);
		expect(frames.map(({ name }: { name: string }) => name)).toEqual(
			Array.from({ length: 48 }, (_, index) => `roller_car_ride_${String(index).padStart(3, '0')}`),
		);
		expect(frames[0].time).toBe(0);
		expect(frames.at(-1).time).toBe(0.48);
		expect(JSON.stringify(skeleton.animations.ride)).not.toContain('rgba');
		expect(skeleton.slots).toHaveLength(1);
	});

	it('resolves every registered perspective frame through the skin and atlas', () => {
		const animatedNames = animationAttachmentNames(skeleton.animations);
		const skinNames = new Set(Object.keys(skeleton.skins[0].attachments.art));

		expect(animatedNames).toHaveLength(48);
		expect(skinNames).toHaveLength(48);
		for (const name of animatedNames) {
			expect(skinNames, `${name} missing from the Spine skin`).toContain(name);
			expect(atlas, `${name} missing from the atlas`).toContain(`\n${name}\n`);
		}
		expect(fs.statSync(path.join(rigRoot, 'roller_car_ride.webp')).size).toBeLessThan(1400 * 1024);
	});

	it('spawns one cart above every affected reel and drops all carts in lockstep', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');

		expect(overlay).toMatch(/let carYs = \$state<Record<number, Tween<number>>>\(\{\}\)/);
		expect(overlay).toMatch(
			/carYs = Object\.fromEntries\(event\.reels\.map\(\(\{ reel \}\) => \[reel, new Tween\(CAR_START_Y\)\]\)\)/,
		);
		expect(overlay).toMatch(
			/const descents = event\.reels\.map\(\(\{ reel \}\) =>[\s\S]*?carYs\[reel\]\.set\(CAR_END_Y/,
		);
		expect(overlay).toContain('carYs[roller.reel]?.current ?? CAR_START_Y');
		expect(overlay).not.toMatch(/new Tween\(cellY\(triggerRow\)\)|CAR_STATION_Y/);
		expect(overlay).toMatch(/phase === 'ready' \|\| phase === 'dropping'/);
	});

	it('replaces every passed row with a visible contribution on every affected reel', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const descentLoopStart = overlay.indexOf('for (const row of ROWS)');
		const descentLoopEnd = overlay.indexOf(
			'if (!(await runOrSkip(Promise.all(descents))))',
			descentLoopStart,
		);
		const descentLoop = overlay.slice(descentLoopStart, descentLoopEnd);

		expect(descentLoopStart).toBeGreaterThan(-1);
		expect(descentLoopEnd).toBeGreaterThan(descentLoopStart);
		expect(descentLoop).toMatch(
			/rollerClearedCells = \[[\s\S]*?event\.reels\.map\(\(\{ reel \}\) => `\$\{reel\},\$\{row\}`\)/,
		);
		expect(descentLoop).toContain('for (const roller of event.reels)');
		expect(descentLoop).toContain('revealedRows =');
		expect(overlay).toContain('const contributionFor =');
		expect(overlay).toContain('text={`${contributionFor(roller, row)}X`}');
		expect(overlay).toContain('contentOffsetY={(REEL_CENTER_Y - cellY(row)) * ct}');
		expect(overlay).toContain('return explicit ?? 1;');
		expect(overlay).not.toContain('return 0;');
	});

	it('keeps carts below bulb borders and exposes the single authored grid through masks', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const multiplierCell = readSource('components/RollerMultiplierCell.svelte');
		const game = readSource('components/Game.svelte');
		const board = readSource('components/Board.svelte');
		const railBlockStart = overlay.indexOf("{#if phase === 'ready' || phase === 'dropping'}");
		const railSprite = overlay.indexOf('key="rollerWildRail"', railBlockStart);
		const cartComment = overlay.indexOf('<!-- Every affected cart spawns', railSprite);

		expect(railBlockStart).toBeGreaterThan(-1);
		expect(railSprite).toBeGreaterThan(railBlockStart);
		expect(cartComment).toBeGreaterThan(railSprite);
		expect(overlay).toContain('<Graphics isMask draw={drawBoardContentMask} />');
		expect(overlay).toContain('for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1)');
		expect(overlay).toContain('for (const row of ROWS)');
		expect(
			overlay.match(/<Graphics isMask draw=\{drawReelMask\(roller\.reel\)\} \/>/g),
		).toHaveLength(2);
		expect(overlay).toContain('const GRID_LINE_CLEARANCE = 1.4');
		expect(overlay).toContain('const FRAME_LIGHT_CLEARANCE_X = 31');
		expect(overlay).toContain('const FRAME_LIGHT_CLEARANCE_Y = 16');
		expect(overlay).toContain('const edgeShift = BOARD_SIDE_CONTENT_INSET * 0.5');
		expect(overlay).toContain('CELL_W - leftInset - rightInset');
		expect(overlay).toContain('SYMBOL_H - topInset - bottomInset');
		expect(overlay).not.toContain('drawForegroundGrid');
		expect(overlay).toContain('<RollerMultiplierCell');
		expect(multiplierCell).toContain('const GRID_LINE_INSET = 1.4');
		expect(multiplierCell).toContain('isMask');
		expect(multiplierCell).toContain('contentOffsetY');
		expect(overlay.match(/<CoasterWildBackground/g)).toHaveLength(2);
		expect(overlay.match(/reel=\{roller\.reel\}/g)).toHaveLength(2);
		expect(overlay).not.toContain('coverTopEdge');
		expect(overlay).not.toContain('coverBottomEdge');
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

	it('preserves explicit empty plaque arrays and commits trigger-free final Wilds', () => {
		const handler = readSource('game/bookEventHandlerMap.ts');
		const rollerStart = handler.indexOf('rollerWildsApply: async');
		const rollerEnd = handler.indexOf('coasterSetup: async', rollerStart);
		const rollerHandler = handler.slice(rollerStart, rollerEnd);
		const finalSymbolStart = rollerHandler.indexOf('symbol.rawSymbol = {');
		const finalSymbolEnd = rollerHandler.indexOf('};', finalSymbolStart);
		const finalSymbol = rollerHandler.slice(finalSymbolStart, finalSymbolEnd);

		expect(rollerHandler).toMatch(
			/Array\.isArray\(entry\.multipliers\)\s*\?\s*entry\.multipliers\.map/,
		);
		expect(rollerHandler).not.toMatch(/entry\.multipliers(?:\?|\.)?\.length/);
		expect(finalSymbol).toContain("name: 'W'");
		expect(finalSymbol).toContain('reelMultiplier: roller.multiplier');
		expect(finalSymbol).not.toContain('rollerTrigger');
	});

	it('startup-gates the cart rig and restarts the selected fast ride without looping', () => {
		const assets = readSource('game/assets.ts');
		const rigStart = assets.indexOf('rollerWildCarSpine:');
		const rigEnd = assets.indexOf('coasterCarSickAnim:', rigStart);
		const rigRegistration = assets.slice(rigStart, rigEnd);
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const spineTags = overlay.match(/<LoopingSpineSprite[\s\S]*?\/>/g) ?? [];
		const spineSprite = readSource('components/LoopingSpineSprite.svelte');

		expect(rigStart).toBeGreaterThan(-1);
		expect(rigEnd).toBeGreaterThan(rigStart);
		expect(rigRegistration).toContain("type: 'spine'");
		expect(rigRegistration).not.toMatch(/defer\s*:\s*true/);
		expect(spineTags).toHaveLength(1);
		for (const tag of spineTags) {
			expect(tag).toContain('loop={false}');
			expect(tag).toContain('restartKey=');
			expect(tag).toContain("phase === 'dropping' ? 'ride' : 'idle'");
		}
		expect(spineSprite).toContain("`${props.animationName}:${props.restartKey ?? ''}`");
	});

	it('sums contributions, then leaves multiplier-only cells that roll out unchanged', () => {
		const overlay = readSource('components/RollerWildsOverlay.svelte');
		const persistent = readSource('components/PersistentWildBadges.svelte');
		const board = readSource('components/Board.svelte');
		const handler = readSource('game/bookEventHandlerMap.ts');

		expect(overlay).toMatch(/Promise\.all\(\[[\s\S]*?combineTweens\[reel\]\.set\(1/);
		expect(overlay).toContain('const SPREAD_ORDER = [2, 1, 3, 0, 4]');
		expect(overlay).toContain('for (const row of SPREAD_ORDER)');
		expect(overlay).toContain('finalizedRows =');
		expect(overlay).toContain('text={`${roller.multiplier}X`}');
		expect(overlay).toMatch(
			/showFinalPresentation[\s\S]*?totalAlphas = Object\.fromEntries\([\s\S]*?new Tween\(1\)/,
		);
		expect(overlay).not.toMatch(/totalAlphas\[[^\]]+\]\.set\(\s*0/);
		const finalState = overlay.slice(overlay.indexOf('<!-- Final state:'));
		expect(finalState).toContain('<RollerMultiplierCell text={`${roller.multiplier}X`}');
		expect(finalState).not.toContain('megaWildKey');
		expect(persistent).not.toContain('activeRollerReels');
		expect(persistent).not.toContain('RollerMultiplierText');
		expect(board).toMatch(
			/isRollerMultiplierCell[\s\S]*?Boolean\(rawSymbol\.reelMultiplier\)[\s\S]*?contentScale=\{0\.9 \* \(isWin \? winPulse : 1\)\}[\s\S]*?reelMultiplier\}X/,
		);
		expect(board).not.toMatch(
			/isRollerMultiplierCell[\s\S]{0,300}activeRollerReels|isRollerMultiplierCell[\s\S]{0,300}rollerReelSet/,
		);
		expect(handler).toContain('await tick();');
		expect(handler).toContain("eventEmitter.broadcast({ type: 'rollerWildsHide' })");
	});
});

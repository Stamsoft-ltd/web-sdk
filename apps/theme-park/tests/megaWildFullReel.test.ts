import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rigRoot = path.join(appRoot, 'static', 'assets', 'spines', 'megaWildFullReel');
const skeleton = JSON.parse(
	fs.readFileSync(path.join(rigRoot, 'mega_wild_full_reel.json'), 'utf8'),
);
const atlas = fs.readFileSync(path.join(rigRoot, 'mega_wild_full_reel.atlas'), 'utf8');
const source = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

const readableFaceSequence = (animation: typeof skeleton.animations.intro) => {
	const fakeKeys = animation.slots.fake_multiplier.rgba;
	const realKeys = animation.slots.multiplier.rgba;
	return fakeKeys
		.map((key: { color: string }, index: number) => {
			const fakeAlpha = Number.parseInt(key.color.slice(-2), 16);
			const realAlpha = Number.parseInt(realKeys[index].color.slice(-2), 16);
			if (Math.max(fakeAlpha, realAlpha) < 180) return null;
			return realAlpha > fakeAlpha ? 'real' : 'fake';
		})
		.filter((face: string | null): face is string => face !== null)
		.filter(
			(face: string, index: number, faces: string[]) => index === 0 || face !== faces[index - 1],
		);
};

describe('Duck Power Ride full-reel Mega Wild', () => {
	it('exports a 64-frame intro with a dense seven-view plaque roll', () => {
		expect(skeleton.skeleton.hash).toBe('theme-park-mega-wild-v22-seeded-start-face');
		expect(skeleton.skeleton.spine).toBe('4.2.0');
		expect(skeleton.skeleton.width).toBe(256);
		expect(skeleton.skeleton.height).toBe(824);
		expect(Object.keys(skeleton.animations).sort()).toEqual(['idle', 'intro', 'intro_real']);
		expect(skeleton.animations.intro.bones.ride.translate).toHaveLength(64);
		expect(skeleton.animations.intro.bones.plaque.scale).toHaveLength(128);
		expect(skeleton.animations.intro.bones.plaque.rotate).toHaveLength(128);
		expect(skeleton.animations.intro.bones.plaque_edge.scale).toHaveLength(128);
		expect(skeleton.animations.intro.bones.plaque_edge.rotate).toHaveLength(128);
		expect(
			Math.min(...skeleton.animations.intro.bones.plaque.scale.map((key: { y: number }) => key.y)),
		).toBeGreaterThanOrEqual(0.24);
		expect(skeleton.bones.find((bone: { name: string }) => bone.name === 'plaque').parent).toBe(
			'root',
		);
		expect(skeleton.bones.find((bone: { name: string }) => bone.name === 'plaque').y).toBe(0);
		expect(skeleton.animations.intro.bones.ride.translate.at(-1).time).toBe(1.05);
		expect(skeleton.animations.intro.bones.ride.translate.at(-1).y).toBe(0);
		expect(skeleton.animations.intro.bones.ride.translate[23].y).toBeGreaterThan(0);
		expect(skeleton.animations.intro.bones.ride.translate[24].y).toBe(0);
		expect(skeleton.bones.find((bone: { name: string }) => bone.name === 'ride').y).toBe(-112);
		expect(skeleton.bones.find((bone: { name: string }) => bone.name === 'cart').y).toBe(-205);
		expect(skeleton.animations.intro.bones.cart.scale).toHaveLength(64);
		expect(skeleton.animations.intro.bones.cart.scale[0].x).toBe(0.58);
		expect(skeleton.animations.intro.bones.cart.scale.at(-1).x).toBe(1);
		expect(readableFaceSequence(skeleton.animations.intro)).toEqual([
			'fake',
			'real',
			'fake',
			'real',
			'fake',
			'real',
		]);
		expect(readableFaceSequence(skeleton.animations.intro_real)).toEqual([
			'real',
			'fake',
			'real',
			'fake',
			'real',
		]);
		for (const view of ['cart_steep', 'cart_high_mid', 'cart_mid', 'cart_low_mid', 'cart']) {
			expect(skeleton.animations.intro.slots[view].rgba).toHaveLength(64);
		}
		expect(skeleton.bones.some((bone: { name: string }) => bone.name.includes('hand'))).toBe(false);
		expect(skeleton.slots.some((slot: { name: string }) => slot.name.includes('hand'))).toBe(false);
	});

	it('uses five cart perspectives and one fixed centre plaque with fake/real faces', () => {
		const slots = Object.fromEntries(
			skeleton.slots.map((slot: { name: string }) => [slot.name, slot]),
		);
		expect(slots.multiplier.bone).toBe('multiplier');
		expect(slots.fake_multiplier.bone).toBe('fake_multiplier');
		expect(slots.plaque.bone).toBe('plaque');
		for (const view of [
			'plaque_top_35',
			'plaque_top_60',
			'plaque_top_side',
			'plaque_bottom_35',
			'plaque_bottom_60',
			'plaque_bottom_side',
		]) {
			expect(slots[view].bone).toBe('plaque_edge');
		}
		expect(skeleton.animations.intro.bones.plaque).not.toHaveProperty('translate');
		expect(skeleton.animations.intro.bones).not.toHaveProperty('multiplier');
		expect(skeleton.animations.intro.bones).not.toHaveProperty('fake_multiplier');
		for (const region of [
			'background',
			'cart_steep',
			'cart_high_mid',
			'cart_mid',
			'cart_low_mid',
			'cart',
			'plaque',
			'plaque_top_35',
			'plaque_top_60',
			'plaque_top_side',
			'plaque_bottom_35',
			'plaque_bottom_60',
			'plaque_bottom_side',
			'sparkles',
			'fake_multiplier_slot',
			'multiplier_slot',
		]) {
			expect(atlas).toContain(`\n${region}\n`);
		}
		const component = source('components/MegaWildFullReel.svelte');
		expect(component).toContain('<SpineSlot slotName="fake_multiplier">');
		expect(component).toContain('<SpineSlot slotName="multiplier">');
		expect(component).toContain('<MegaWildMultiplierText text={fakeLabel} />');
		expect(component).toContain('<MegaWildMultiplierText text={finalLabel} />');
		expect(component).toContain(
			"animationName === 'intro' && props.initialReal ? 'intro_real' : animationName",
		);
		expect(component).toContain('animationName={spineAnimationName}');
		expect(component).toContain('const REEL_RENDER_WIDTH = CELL_W');
		expect(component).not.toContain('DIVIDER_INSET');
		expect(component).not.toContain('BOARD_EDGE_INSET');
		expect(component).not.toContain('reelIndex === 0');
		expect(component).not.toContain('reelIndex === 4');
		expect(component).toContain('x={props.x}');
		expect(component).not.toContain('edgeOffsetX');
		expect(component).not.toContain('reelCenterOffsetX');
		expect(component).toContain('width={REEL_RENDER_WIDTH}');
		expect(component).toContain('const REEL_RENDER_HEIGHT = BOARD_SIZES.height');
		expect(component).toContain(
			'const REEL_VERTICAL_OFFSET_Y = -CELL_H * 0.02875 + BOARD_SIZES.height * 0.002',
		);
		expect(component).not.toContain('REEL_VERTICAL_INSET');
		expect(component).toContain(
			'y={(props.y ?? BOARD_SIZES.height * 0.5) + REEL_VERTICAL_OFFSET_Y}',
		);
		expect(component).toContain('(props.originY ?? 0) - REEL_VERTICAL_OFFSET_Y');
		expect(component).toContain('height={REEL_RENDER_HEIGHT}');
		const spineProviderTag = component.match(/<SpineProvider[\s\S]*?>/)?.[0] ?? '';
		expect(spineProviderTag).not.toContain('anchor={0.5}');
		expect(component).toContain('const maskLeft = -CELL_W * 0.5');
		expect(component).not.toContain('const maskWidth');
		expect(component).not.toContain('{#key animationName}');
		expect(component).toContain(
			'<SpineBone boneName="plaque" scaleX={plaquePulse} scaleY={plaquePulse} />',
		);
		expect(component).not.toContain('trackIndex={1}');
	});

	it('fills the reel immediately and grows from the landed Mega Wild row', () => {
		const component = source('components/MegaWildFullReel.svelte');
		const overlay = source('components/RollerWildsOverlay.svelte');
		const builder = fs.readFileSync(
			path.join(appRoot, 'scripts', 'build-mega-wild-full-reel-spine.py'),
			'utf8',
		);

		expect(atlas).toContain('\nbackground\n');
		expect(builder).toContain('mega-wild-full-reel-background-no-plaque-v2.png');
		expect(builder).toContain('BACKGROUND_CENTERING_X = 0.37');
		expect(builder).toContain('centering=(BACKGROUND_CENTERING_X, 0.5)');
		expect(builder).toContain('fallback.alpha_composite(layers["background"])');
		expect(builder).toContain('mega-wild-plaque-standalone-v1.png');
		expect(builder).toContain('mega-wild-plaque-top-35-v1.png');
		expect(builder).toContain('mega-wild-plaque-top-60-v1.png');
		expect(builder).toContain('mega-wild-plaque-top-side-v1.png');
		expect(builder).toContain('mega-wild-plaque-bottom-35-v1.png');
		expect(builder).toContain('mega-wild-plaque-bottom-60-v1.png');
		expect(builder).toContain('mega-wild-plaque-bottom-side-v1.png');
		expect(builder).toContain('return contain(trim(Image.open(PLAQUE_SOURCE)), (244, 190))');
		expect(builder).toContain('PLAQUE_POSE_COUNT = 128');
		expect(builder).toContain('ROLL_START_FRAME = 12');
		expect(builder).toContain('ROLL_END_FRAME = 42');
		expect(builder).toContain('ROLL_FLIPS_FAKE_START = 5');
		expect(builder).toContain('ROLL_FLIPS_REAL_START = 4');
		expect(builder).toContain('face_is_real = plaque_face_is_real(');
		expect(builder).not.toContain('VALUE_SWAP_FRAME');
		expect(builder).toContain('SLIDE_END_FRAME = 24');
		expect(builder).toContain('CART_CROP_BOTTOM = 970');
		expect(builder).toContain('CART_LAYER_SIZE = (194, 245)');
		expect(builder).toContain('mega-wild-cart-semi-vertical-v1.png');
		expect(builder).toContain('mega-wild-cart-high-mid-v1.png');
		expect(builder).toContain('mega-wild-cart-mid-pitch-v1.png');
		expect(builder).toContain('mega-wild-cart-low-mid-v1.png');
		expect(builder).toContain('CART_START_SCALE = 0.58');
		expect(builder).toContain('CART_VIEWS = ("steep", "high_mid", "mid", "low_mid", "flat")');
		expect(builder).toContain('CART_VIEW_TRANSITIONS = ((8, 12), (12, 16), (16, 20), (20, 24))');
		expect(builder).toContain('RIDE_END_Y = -112');
		expect(builder).not.toContain('split_cart_plaque');
		expect(builder).not.toContain('plaque.putalpha(alpha)');
		for (const view of [
			'plaque',
			'plaque_top_35',
			'plaque_top_60',
			'plaque_top_side',
			'plaque_bottom_35',
			'plaque_bottom_60',
			'plaque_bottom_side',
		]) {
			expect(skeleton.animations.intro.slots[view].rgba).toHaveLength(128);
			expect(
				Math.max(
					...skeleton.animations.intro.slots[view].rgba.map((key: { color: string }) =>
						Number.parseInt(key.color.slice(-2), 16),
					),
				),
			).toBeGreaterThan(180);
		}
		expect(component).toContain(
			"untrack(() => (animationName === 'intro' ? CELL_H / REEL_RENDER_HEIGHT : 1))",
		);
		expect(component).toContain(
			"untrack(() => (animationName === 'intro' ? (props.originY ?? 0) - REEL_VERTICAL_OFFSET_Y : 0))",
		);
		expect(component).toContain('const INTRO_TIME_SCALE = 0.7 / 1.3');
		expect(component).toContain('const EXPAND_MS = 338');
		expect(component).toContain("timeScale={animationName === 'intro' ? INTRO_TIME_SCALE : 1}");
		expect(component).toContain('scale={{ x: 1, y: revealScaleY.current }}');
		expect(overlay).toContain('originY={CELL_H * (roller.triggerRow + 0.5) - REEL_CENTER_Y}');
	});

	it('startup-loads both rig and matching static fallback', () => {
		const assets = source('game/assets.ts');
		const start = assets.indexOf('megaWildFullReelFallback:');
		const end = assets.indexOf('coasterCarSickAnim:', start);
		const block = assets.slice(start, end);
		expect(block).toContain('mega_wild_full_reel_fallback.png');
		expect(block).toContain('mega_wild_full_reel.atlas');
		expect(block).toContain('mega_wild_full_reel.json');
		expect(block).not.toContain('defer: true');
	});

	it('restores the authored top border without changing the equal-cell grid', () => {
		const frame = source('components/BoardFrame.svelte');
		const game = source('components/Game.svelte');
		const overlay = source('components/RollerWildsOverlay.svelte');
		const borderBuilder = fs.readFileSync(
			path.join(appRoot, 'scripts', 'build-board-border-layer.py'),
			'utf8',
		);
		const assets = source('game/assets.ts');
		const boardArt = source('game/boardArt.ts');
		expect(frame).toContain('key="themeBoardGrid"');
		expect(frame).toContain('key="themeBoardBorderBackdrop"');
		expect(frame).toContain('key="themeBoardBorderExpanded"');
		expect(frame).toContain("type Props = { layer?: 'base' | 'border' }");
		expect(frame).not.toContain('BORDER_EXPAND_X');
		expect(frame).not.toContain('borderW');
		expect(frame).toContain('width={gridW}');
		expect(frame).toContain('height={gridH}');
		expect(frame).toContain('width={frameW}');
		expect(frame).toContain('<Graphics');
		expect(frame).toContain('.roundRect(-gridW * 0.5, -gridH * 0.5, gridW, gridH, gridRadius)');
		expect(frame).toContain('BOARD_BULBS');
		expect(frame).toContain('alpha={hotGlowAlpha}');
		expect(frame).toContain('alpha={coolGlowAlpha}');
		expect(game).toContain('<BoardFrame layer="base" />');
		expect(game).toContain('<BoardFrame layer="border" />');
		expect(game).toContain('const BOARD_BORDER_Z = 6');
		expect(overlay).toContain('BOARD_CORNER_RADIUS');
		expect(overlay).toContain('.roundRect(');
		expect(borderBuilder).toContain('LIGHT_PATH_LEFT = 33.8404');
		expect(borderBuilder).toContain('LIGHT_PATH_RIGHT = 1411.7267');
		expect(borderBuilder).toContain('DIVIDERS_X = (300, 584, 868, 1152)');
		expect(borderBuilder).toContain('TARGET_GRID_LEFT = 16');
		expect(borderBuilder).toContain('TARGET_GRID_RIGHT = 1436');
		expect(borderBuilder).toContain('backdrop = warp_border_x(backdrop)');
		expect(borderBuilder).toContain('bright_alpha = strongest.point(');
		expect(borderBuilder).toContain('lights = warp_border_x(lights)');
		expect(frame).not.toContain('drawFrameMask');
		expect(frame).not.toContain('key="spark"');
		expect(assets).toContain("src: './assets/theme-park/v2/board-lines-borderless.webp'");
		expect(assets).toContain("src: './assets/theme-park/v2/board-grid-backboard.webp'");
		expect(assets).toContain("src: './assets/theme-park/v2/board-border-backdrop.png'");
		expect(assets).toContain("src: './assets/theme-park/v2/board-border-expanded.png'");
		expect(boardArt).toContain('left: 16');
		expect(boardArt).toContain('right: 1436');
		expect(boardArt).toContain('ART_RAIL = { left: 21, top: 16, right: 1425, bottom: 958 }');
	});

	it('keeps one overlay rig above the grid until the next spin', () => {
		const overlay = source('components/RollerWildsOverlay.svelte');
		const handler = source('game/bookEventHandlerMap.ts');
		const game = source('components/Game.svelte');
		expect(overlay).toContain('const INTRO_MS = 1990');
		expect(overlay).toContain('const REEL_STAGGER_MS = INTRO_MS');
		expect(overlay).toContain('stateBet.isTurbo || stateBet.isSuperTurbo');
		expect(overlay).toContain('triggerReels.slice(0, revealedReelCount)');
		expect(overlay).toContain('initialReal={roller.initialReal}');
		expect(overlay).toContain('<Graphics isMask draw={drawBoardMask} />');
		expect(overlay).toContain("<Container zIndex={phase === 'settled' ? 0 : 5}>");
		expect(overlay).toContain("phase = 'revealing'");
		expect(overlay).toContain("animationName={phase === 'revealing' ? 'intro' : 'idle'}");
		expect(overlay).toContain('anchor.symbolY() - anchor.startY');
		expect(overlay).toContain('y={rollOutOffsetY(roller)}');
		expect(overlay).not.toContain('rollOutY');
		expect(overlay).toContain('setClearedReels(triggerReels.slice(0, index + 1))');
		expect(overlay).not.toContain("presentationOwner = 'board'");
		expect(overlay).toContain("presentationOwner = 'overlay'");
		expect(overlay).toContain("presentationOwner === 'overlay'");
		expect(overlay).not.toContain('RollerMultiplierCell');
		expect(overlay).not.toContain('contributionFor');
		expect(overlay).not.toContain('SPREAD_ORDER');
		expect(overlay).toMatch(
			/rollerWildsHandoff[\s\S]*phase = 'settled'[\s\S]*presentationOwner = 'overlay'[\s\S]*await tick\(\)/,
		);
		expect(handler).not.toContain('reelMultiplier: roller.multiplier');
		expect(handler).not.toContain('symbol.rawSymbol =');
		expect(game.indexOf('<RollerWildsOverlay />')).toBeLessThan(
			game.indexOf('{#if context.stateGame.paylineWins.length > 0}'),
		);
	});
});

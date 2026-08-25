import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CELL_H, COASTER_WILD_GRID_INSET } from '../src/game/constants';
import { getCoasterWildRect, toCoasterCellKeys } from '../src/game/coasterWildCells';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rigRoot = path.join(appRoot, 'static', 'assets', 'spines', 'coasterVomit');
const skeleton = JSON.parse(fs.readFileSync(path.join(rigRoot, 'coaster_vomit.json'), 'utf8'));
const atlas = fs.readFileSync(path.join(rigRoot, 'coaster_vomit.atlas'), 'utf8');
const atlasImage = fs.readFileSync(path.join(rigRoot, 'coaster_vomit.png'));
const source = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

describe('Mega Coaster screen-wide setup animation', () => {
	it('exports one layered, seamless 128-frame vomiting Spine loop', () => {
		const frames = skeleton.animations.vomit.slots.duck_pose.attachment;
		const poses = frames.slice(0, -1);
		const attachments = Object.keys(skeleton.skins[0].attachments.duck_pose);

		expect(skeleton.skeleton.spine).toBe('4.2.0');
		expect(skeleton.skeleton.hash).toBe('theme-park-mega-coaster-vomit-v29-handdrawn-128frame');
		expect(Object.keys(skeleton.animations)).toEqual(['idle', 'vomit']);
		expect(skeleton.slots.map(({ name }: { name: string }) => name)).toEqual([
			'cart_back',
			'duck_pose',
			'cart_front',
		]);
		expect(Object.keys(skeleton.skins[0].attachments.cart_back)).toEqual(['coaster_cart_back']);
		expect(Object.keys(skeleton.skins[0].attachments.cart_front)).toEqual(['coaster_cart_front']);
		expect(poses).toHaveLength(128);
		expect(new Set(poses.map(({ name }: { name: string }) => name)).size).toBe(128);
		expect(attachments).toHaveLength(128);
		expect(frames.at(-1)).toEqual({ name: 'coaster_vomit_127', time: 4.5 });
		expect(JSON.stringify(skeleton.animations.vomit)).not.toContain('rgba');
		for (const { name } of poses) {
			expect(attachments).toContain(name);
			expect(skeleton.skins[0].attachments.duck_pose[name]).toMatchObject({
				width: 256,
				height: 256,
			});
			expect(atlas).toContain(`\n${name}\n`);
		}
		expect(atlasImage.readUInt32BE(16)).toBeLessThanOrEqual(2048);
		expect(atlasImage.readUInt32BE(16) * atlasImage.readUInt32BE(20)).toBeLessThan(3_000_000);
		expect(atlas).toMatch(/offset: (?!0, 0)\d+, \d+/);
	});

	it('uses fixed-cart hand-drawn keys with one registered baseline', () => {
		const builder = fs.readFileSync(
			path.join(appRoot, 'scripts', 'build-coaster-vomit-spine.py'),
			'utf8',
		);

		expect(builder).toContain('FRAME_SIZE = 256');
		expect(builder).toContain('SOURCE_KEY_COUNT = 8');
		expect(builder).toContain('TIMELINE_KEY_COUNT = 16');
		expect(builder).toContain(
			'SOURCE = APP / "source-assets-unused/assets/theme-park/coaster-vomit-handdrawn"',
		);
		expect(builder).toContain('EMPTY_CART_SOURCE = SOURCE / "empty-cart.png"');
		expect(builder).toContain('DUCK_KEY_PATTERN = "duck-key-{index:02d}.png"');
		expect(builder).toContain('def normalize_cart(image: Image.Image)');
		expect(builder).toContain('def normalize_duck_keys(keys: list[Image.Image])');
		expect(builder).toContain('DUCK_BASELINE = 216');
		expect(builder).toContain('DUCK_CELL_LEFT = 47');
		expect(builder).toContain('FRAME_COUNT = 128');
		expect(builder).toContain('ATLAS_MAX_WIDTH = 2048');
		expect(builder).toContain('ATLAS_TRIM_PADDING = 2');
		expect(builder).toContain('ATLAS_REGION_GAP = 2');
		expect(builder).toContain(
			'sorted(regions, key=lambda item: item["crop"].height, reverse=True)',
		);
		expect(builder).toContain('Mega Coaster trimmed atlas changed region');
		expect(builder).toContain('def motion_interpolate_poses(source_poses: list[Image.Image])');
		expect(builder).toContain('minterpolate=fps=7.9375:mi_mode=mci:mc_mode=aobmc:');
		expect(builder).toContain('subprocess.run(');
		expect(builder).not.toContain('def alpha_interpolate_poses');
		expect(builder).toContain('def build_cart_front(');
		expect(builder).not.toContain('seat_fade');
		expect(builder).toContain('poses = motion_interpolate_poses([*timeline, duck_keys[0]])');
		expect(builder).toContain('build_atlas(poses, fixed_cart, cart_front)');
		expect(builder).toContain('ATLAS_IMAGE = "coaster_vomit.png"');
		expect(builder).toContain('transparent RGB zeroed');
		const sourceRoot = path.join(
			appRoot,
			'source-assets-unused',
			'assets',
			'theme-park',
			'coaster-vomit-handdrawn',
		);
		expect(fs.existsSync(path.join(sourceRoot, 'empty-cart.png'))).toBe(true);
		for (let index = 0; index < 8; index += 1) {
			expect(
				fs.existsSync(path.join(sourceRoot, `duck-key-${String(index).padStart(2, '0')}.png`)),
			).toBe(true);
		}
	});

	it('does not leave the temporary top-left QA duck mounted', () => {
		const game = source('components/Game.svelte');

		expect(game).not.toContain('COASTER_LOOP_PREVIEW');
		expect(game).not.toContain('Temporary QA view');
		expect(game).not.toContain('top-left-loop-preview');
		expect(game).not.toContain("import LoopingSpineSprite from './LoopingSpineSprite.svelte'");
	});

	it('draws one screen-wide rail per row and at least fifteen mixed carts', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');

		expect(presenter).toContain('const MIN_CART_COUNT = 15');
		expect(presenter).toContain('const MAX_EXTRA_CARTS = 7');
		expect(presenter).toContain('const COASTER_SETUP_Z = 7');
		expect(presenter).toContain('<FadeContainer {show} zIndex={COASTER_SETUP_Z}>');
		expect(presenter).toContain('ROWS.flatMap((row) =>');
		expect(presenter).toContain('return impacts.map((impact, lane) =>');
		expect(presenter).toContain('return { row, launchDelayUnits, impact }');
		expect(presenter).toContain('impact: null');
		expect(presenter).toContain('const extraCount = Math.max(\n\t\t\t1,');
		expect(presenter).not.toContain('groupsByReel');
		expect(presenter).toContain('const MIN_CART_GAP_UNITS = 1.35');
		expect(presenter).toContain('const CART_GAP_VARIANCE_UNITS = 0.35');
		expect(presenter).toContain('lane * (MIN_CART_GAP_UNITS + CART_GAP_VARIANCE_UNITS)');
		expect(presenter).toContain('seededValue(seed, lane + row * 7, 1)');
		expect(presenter).not.toContain('Math.random');
		expect(presenter).toContain('route.launchDelayUnits * timing.stagger');
		expect(presenter).toContain('tilesMap = { ...tilesMap, [key]: impact.multiplier }');
		expect(presenter).toContain('{#each ROWS as row (row)}');
		expect(presenter).toContain('width={trackWidth}');
		expect(presenter).toContain('zIndex={20}');
		expect(presenter).toContain('zIndex={10}');
		expect(presenter).toContain('mainLayout.width');
		expect(presenter).toContain('direction === 1 ? trackRight : trackLeft');
		expect(presenter).toContain('(row % 2 === 0 ? 1 : -1)');
		expect(presenter).toContain('scale={{ x: cart.direction, y: 1 }}');
		expect(presenter).not.toContain('followRailBend');
		expect(presenter).not.toContain('trackCells');
	});

	it('vomits only on authored symbol impacts while carts remain fluid', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');

		expect(presenter).not.toContain('decorativeVomitReel');
		expect(presenter).toContain('const impactAt = route.impact');
		expect(presenter).toContain('route.impact && routeTime >= route.vomitStartAt');
		expect(presenter).toContain("? 'vomit'");
		expect(presenter).toContain('pulseWild(route.impact, run, timing)');
		expect(presenter).not.toContain('impactsByReel');
		expect(presenter).not.toContain('routeEvents');
		expect(presenter).not.toContain('vomitRun');
		expect(presenter).toContain(
			'const movementDuration = durationForDistance(startX, endX, timing)',
		);
		expect(presenter).toContain('const playTimeline = async');
		expect(presenter).toContain('cart.x = route.startX +');
		expect(presenter).not.toContain('x: cellX(reel)');
		expect(presenter).toContain('assetKey="coasterVomitSpine"');
		expect(presenter).toContain("animationName={cart.state === 'vomit' ? 'vomit' : 'idle'}");
		expect(presenter).toContain("timeScale={cart.state === 'vomit' ? cart.vomitTimeScale : 0}");
		expect(presenter).toContain('loop={true}');
		expect(presenter).not.toContain('key="coasterCartFixed"');
		expect(presenter).toContain('fallbackKey={rigFallback(cart.state)}');
		expect(presenter).not.toContain('coasterCarVomitAnim');
	});

	it('runs only the setup reveal 1.3-times faster at every speed level', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');

		expect(presenter).toMatch(
			/const factor = stateBet\.isSuperTurbo \? 0\.2 : stateBet\.isTurbo \? 0\.42 : 1/,
		);
		expect(presenter).toContain('const SETUP_SPEED_BOOST = 1.69');
		expect(presenter).toContain('Initial setup reveal only');
		expect(presenter).toContain('Free-spin reel timing is owned elsewhere and remains unchanged');
		expect(presenter).toContain('const SEQUENCE_SPEED = 0.9 * SETUP_SPEED_BOOST * 0.85');
		expect(presenter).toContain('const VOMIT_SOURCE_MS = 4500');
		expect(presenter).toContain('const DUCK_PLAYBACK_SPEED = VOMIT_SOURCE_MS / VOMIT_CLIP_MS');
		expect(presenter).toContain('vomitTimeScale: DUCK_PLAYBACK_SPEED / timing.factor');
		expect(presenter).toContain('cell: Math.round((900 / SEQUENCE_SPEED) * factor)');
		expect(presenter).toContain('stagger: Math.round((940 / SEQUENCE_SPEED) * factor)');
		expect(presenter).toContain('intro: Math.round((260 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('outro: Math.round((380 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('pulseUp: Math.round((220 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('pulseDown: Math.round((170 / SETUP_SPEED_BOOST) * factor)');
	});

	it('gives the duck clip room for all three beats instead of fitting it to the cart', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');
		const clipMs = Number(/const VOMIT_CLIP_MS = (\d+)/.exec(presenter)?.[1]);

		// The 128 frames are a three-beat story — yellow duck, duck turning green, then the vomit.
		// Derived from the cart's speed the window was 592ms, about 130ms a beat, and the whole clip
		// read as one green flicker. It is now timed off the story, so keep every beat above ~400ms.
		expect(clipMs).toBeGreaterThanOrEqual(1500);
		expect(clipMs / 3).toBeGreaterThanOrEqual(400);
		// Still a clip, not the whole 4.5s source: the cart would otherwise be green end to end.
		expect(clipMs).toBeLessThan(4500);
	});

	it('fast-forwards the shared cart timeline per vomit and skips after the final one', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');

		expect(presenter).toContain('skipAllowedAt = performance.now() + 140');
		expect(presenter).toContain("event.code !== 'Space' || !sequenceActive");
		expect(presenter).toContain("window.addEventListener('click', onClick, { capture: true })");
		expect(presenter).toContain('requestNextVomit()');
		expect(presenter).toContain('requestedImpactIndexes.add(index)');
		expect(presenter).toContain('timelineOffsetMs += Math.max(0, dueAt - timelineNow)');
		expect(presenter).toContain('finishRequested = true');
		expect(presenter).toContain('carts.forEach((cart) => (cart.visible = false))');
		expect(presenter).toContain('if (!finishRequested) await waitForTimeout(timing.outro)');
		expect(presenter).toContain('completeImpact(route.impactIndex)');
		expect(presenter).not.toContain('finalTileMap()');
	});

	it('reuses one lightweight exact-size Wild presentation before and after handoff', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');
		const persistent = source('components/PersistentWildBadges.svelte');
		const tile = source('components/CoasterWildTile.svelte');
		const background = source('components/CoasterWildBackground.svelte');

		expect(presenter).toContain('<CoasterWildTile');
		expect(presenter).toContain('{multiplier}');
		expect(persistent).toContain('<CoasterWildTile');
		expect(persistent).toContain('multiplier={tile.multiplier}');
		// Drawn at the splat's own proportions, not squeezed into the symbol frame: this art is a
		// sign laid over a cell rather than a reel symbol, and the frame is a different shape.
		expect(tile).toContain('const SLIME_ASPECT = 512 / 391;');
		expect(tile).toContain('const SLIME_H = SYMBOL_H * 0.82;');
		expect(tile).toContain('width={SLIME_W}');
		expect(tile).toContain('height={SLIME_H}');
		expect(tile).toContain('scale={props.contentScale ?? 1}');
		expect(presenter).toContain('contentScale={tileScales[key]?.current ?? 1}');
		expect(persistent).toContain('contentScale={cellPulse(tile.reel, tile.row)}');
		expect(presenter).not.toContain('scale={tileScales[key]?.current ?? 1}');
		expect(persistent).not.toContain('scale={cellPulse(tile.reel, tile.row)}');
		expect(persistent).toContain('const drawWildContentMask =');
		expect(persistent).toContain('<Graphics isMask draw={drawWildContentMask} />');
		expect(persistent).toContain('reel={tile.reel}');
		expect(presenter).toContain('reel={position.reel}');
		expect(presenter).toContain('const drawWildContentMask =');
		expect(presenter).toContain('<Graphics isMask draw={drawWildContentMask} />');
		expect(tile).toContain("fontFamily: 'Cinzel'");
		expect(tile).toContain('const multiplierFill = new FillGradient');
		expect(tile).toContain('{ offset: 0, color: 0xfff7a0 }');
		expect(tile).toContain('{ offset: 0.5, color: 0xffe607 }');
		expect(tile).toContain('{ offset: 1, color: 0xdf9700 }');
		expect(tile).toContain('stroke: { color: 0x4d1d00');
		expect(tile).toContain('color: 0x062900');
		expect(tile).not.toContain('<BitmapText');
		// The cover is a cut of the board's OWN grid art, not a flat colour: the field is a radial
		// gradient, so no one colour sits right in twenty-five different cells and a flat fill read
		// as a black box behind the slime. One texture frame per Wild, and still no stencil.
		expect(background).toContain("import { BaseSprite, Graphics, PIXI, getContextApp } from 'pixi-svelte'");
		expect(background).toContain('loadedAssets?.themeBoardGrid');
		expect(background).toContain('new PIXI.Texture({');
		expect(background).toContain('<BaseSprite');
		expect(background).not.toContain('isMask');
	});

	it('closes the divider between two Wilds and keeps a lone Wild off the grid', () => {
		const stacked = toCoasterCellKeys([
			{ reel: 4, row: 0 },
			{ reel: 4, row: 1 },
		]);
		const top = getCoasterWildRect(4, 0, stacked);
		const bottom = getCoasterWildRect(4, 1, stacked);
		const alone = getCoasterWildRect(2, 2, toCoasterCellKeys([{ reel: 2, row: 2 }]));

		// The reported bug: a stack of Wilds left a lit slot between each pair, and the reel went on
		// scrolling through it in full view. Neighbours have to meet exactly on the cell boundary.
		expect(top.y + top.height).toBe(bottom.y);
		expect(bottom.y).toBe(CELL_H);
		// Free edges are unchanged, so a Wild on its own still leaves the authored grid visible.
		expect(top.y).toBe(COASTER_WILD_GRID_INSET);
		expect(alone.y).toBe(CELL_H * 2 + COASTER_WILD_GRID_INSET);
		expect(alone.height).toBe(CELL_H - COASTER_WILD_GRID_INSET * 2);
	});

	it('preserves the single authored grid between adjacent Wilds and pops Wild content on wins', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');
		const persistent = source('components/PersistentWildBadges.svelte');
		const tile = source('components/CoasterWildTile.svelte');
		const background = source('components/CoasterWildBackground.svelte');
		const game = source('components/Game.svelte');
		const board = source('components/Board.svelte');
		const constants = source('game/constants.ts');

		expect(background).toContain(
			"import { getCoasterWildRect, type CoasterCellKey } from '../game/coasterWildCells'",
		);
		expect(background).toContain('getCoasterWildRect(reel, row, props.occupied ?? EMPTY_CELLS)');
		expect(background).toContain('rect.x - CELL_W * (reel + 0.5)');
		expect(background).toContain('rect.y - CELL_H * (row + 0.5)');
		expect(background).not.toContain('EDGE_OVERLAP');
		expect(background).not.toContain('coverTopEdge');
		expect(background).not.toContain('coverBottomEdge');
		expect(tile).not.toContain('coverTopEdge');
		expect(tile).not.toContain('coverBottomEdge');
		expect(presenter).not.toContain('coverTopEdge');
		expect(presenter).not.toContain('coverBottomEdge');
		expect(persistent).not.toContain('coverTopEdge');
		expect(persistent).not.toContain('coverBottomEdge');
		expect(game).not.toContain('BoardGridOverlay');
		expect(board).toContain('const drawBoardContentMask =');
		expect(board).toContain('<Graphics isMask draw={drawBoardContentMask} />');
		// The board's own mask is ONE rect across the whole opening, not a cell each. Only the outer
		// inset is held back, so nothing of the authored grid is trimmed between adjacent cells —
		// the per-cell insets belong to the Wilds that cover a cell, not to the board.
		expect(board).toContain('CELL_W * BOARD_DIMENSIONS.x - BOARD_SIDE_CONTENT_INSET * 2');
		expect(board).toContain('CELL_H * BOARD_DIMENSIONS.y');
		expect(board).not.toContain('GRID_LINE_CLEARANCE');
		expect(board).toContain('!coasterCellSet.has(`${reelIndex},${symbolIndex - 1}`)');
		expect(constants).toContain('export const BOARD_SIDE_CONTENT_INSET = 1.4');
		expect(constants).toContain('export const COASTER_WILD_GRID_INSET = 2.5');
		expect(constants).toContain('export const getBoardCellCenterX =');
		expect(constants).toContain('CELL_W * (reelIndex + 0.5)');
		expect(constants).not.toContain('? BOARD_SIDE_CONTENT_INSET * 0.5');
		// Both masks cut the Wilds that are actually on the board, not all twenty-five cells, so the
		// opening for two neighbours is one shape and the reel cannot scroll through the divider.
		expect(persistent).toContain('const occupiedCells = $derived(toCoasterCellKeys(coasterTiles))');
		expect(persistent).toContain('for (const { reel, row } of coasterTiles)');
		expect(persistent).toContain('getCoasterWildRect(reel, row, occupiedCells)');
		expect(persistent).toContain('occupied={occupiedCells}');
		expect(presenter).toContain('const occupiedCells = $derived(toCoasterCellKeys(stampedCells))');
		expect(presenter).toContain('for (const { reel, row } of stampedCells)');
		expect(presenter).toContain('getCoasterWildRect(reel, row, occupiedCells)');
		expect(presenter).toContain('occupied={occupiedCells}');

		// The Wild plays no video any more — it is a flat marquee sign whose bulbs are lit by
		// <SymbolBulbs>, gated per sprite so the pattern never lands on the Coaster Wild tile.
		expect(board).not.toContain('tpWildAnim');
		expect(board).toContain('const bulbsFor = (name: SymbolName, spriteKey: string)');
		// Settled full-reel Roller rig, and persistent Coaster Wild content pulse.
		expect(board).toContain('width={SYMBOL_W * (isWin ? winPulse : 1)}');
		expect(board).toContain('<MegaWildFullReel');
		expect(board).toContain('animationName={!reelSymbol.rawSymbol.rollerExpanded');
		expect(board).toContain(': isRollerReelWinning(');
		expect(persistent).toContain('isCellWinning(reel, row) ? winPulse : 1');
		expect(persistent).toContain(
			'alpha={hasWinState && !isCellWinning(tile.reel, tile.row) ? 0.35 : 1}',
		);
		expect(persistent).toContain('This layer always owns persistent Coaster Wilds');
	});

	it('startup-loads the generated rig and keeps the supplied key art as fallback', () => {
		const assets = source('game/assets.ts');
		const start = assets.indexOf('coasterVomitSpine:');
		const end = assets.indexOf('megaWildFullReelFallback:', start);
		const block = assets.slice(start, end);

		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		expect(block).toContain("type: 'spine'");
		expect(block).toContain("atlas: './assets/spines/coasterVomit/coaster_vomit.atlas'");
		expect(block).toContain("skeleton: './assets/spines/coasterVomit/coaster_vomit.json'");
		expect(block).not.toContain('defer: true');
		for (const key of ['coasterTrack', 'coasterRigHappy', 'coasterRigVomit']) {
			expect(assets).toContain(`${key}:`);
		}
		expect(
			fs.existsSync(
				path.join(
					appRoot,
					'static',
					'assets',
					'theme-park',
					'v2',
					'features',
					'coaster-rig-happy.png',
				),
			),
		).toBe(true);
	});
});

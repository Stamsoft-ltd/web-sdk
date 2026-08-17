import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
		expect(skeleton.skeleton.hash).toBe('theme-park-mega-coaster-vomit-v28-trimmed-atlas-128frame');
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

	it('uses one regenerated rigid sheet with no per-frame shake correction', () => {
		const builder = fs.readFileSync(
			path.join(appRoot, 'scripts', 'build-coaster-vomit-spine.py'),
			'utf8',
		);

		expect(builder).toContain('FRAME_SIZE = 256');
		expect(builder).toContain('CART_VISUAL_TARGET_WIDTH = 175');
		expect(builder).toContain('CART_LEFT = 20');
		expect(builder).toContain('GROUND_BASELINE = 235');
		expect(builder).toContain('SOURCE_FRAME_COUNT = 16');
		expect(builder).toContain('REGENERATED_SHEET = SOURCE / "regenerated-16.png"');
		expect(builder).toContain('EMPTY_CART_SOURCE = SOURCE / "regenerated-empty-cart.png"');
		expect(builder).toContain('def extract_regenerated_frames()');
		expect(builder).toContain('row, col = divmod(index, 4)');
		expect(builder).toContain('def regenerated_scale(frames: list[Image.Image]) -> float:');
		expect(builder).toContain(
			'return CART_VISUAL_TARGET_WIDTH / cart_visual_metrics(frames[0])[1]',
		);
		expect(builder).toContain('VERTICAL_SCALE_CORRECTION = 1.0');
		expect(builder).toContain('def validate_regenerated_registration(frames: list[Image.Image])');
		expect(builder).toContain('validate_regenerated_registration(frames)');
		expect(builder).toContain('Mega Coaster regenerated duck drifts in source frame');
		expect(builder).toContain('y_scale = x_scale * VERTICAL_SCALE_CORRECTION');
		expect(builder).toContain(
			'normalize_pose(frame, scale, reference_left, reference_ground) for frame in frames',
		);
		expect(builder).toContain('SICK_TINT_AMOUNTS = (0.0, 0.1, 0.3, 0.55');
		expect(builder).toContain('def apply_sick_tint(poses: list[Image.Image])');
		expect(builder).toContain('dynamic_source_poses = apply_sick_tint(');
		expect(builder).toContain('apply_dynamic_masks(normalized_poses, source_masks)');
		expect(builder).toContain('sick_rgb[:, :, 0] *= 0.65');
		expect(builder).toContain('sick_rgb[:, :, 1] *= 0.95');
		expect(builder).toContain('sick_rgb[:, :, 2] *= 1.05');
		expect(builder).not.toContain('def lock_upper_pose');
		expect(builder).not.toContain('def stabilize_torso');
		expect(builder).not.toContain('STABLE_SHEETS');
		expect(builder).not.toContain('sheet_scales');
		expect(builder).toContain('return empty_cart_pose.copy()');
		expect(builder).not.toContain('seat_opening');
		expect(builder).not.toContain('back_seam');
		expect(builder).not.toContain('np.array([28, 13, 6, 255]');
		expect(builder).toContain('for index in range(SOURCE_FRAME_COUNT):');
		expect(builder).toContain('def remove_stray_components(image: Image.Image)');
		expect(builder).toContain('FRAME_COUNT = 128');
		expect(builder).toContain('ATLAS_MAX_WIDTH = 2048');
		expect(builder).toContain('ATLAS_TRIM_PADDING = 2');
		expect(builder).toContain('ATLAS_REGION_GAP = 2');
		expect(builder).toContain(
			'sorted(regions, key=lambda item: item["crop"].height, reverse=True)',
		);
		expect(builder).toContain('Mega Coaster trimmed atlas changed region');
		expect(builder).toContain('hand_core = remove_small_components_mask(');
		expect(builder).toContain('hand_pixels = alpha & dilate_mask(hand_core, 3) & hand_zone');
		expect(builder).toContain('def motion_interpolate_poses(source_poses: list[Image.Image])');
		expect(builder).toContain('minterpolate=fps=7.9375:mi_mode=mci:mc_mode=aobmc:');
		expect(builder).toContain('subprocess.run(');
		expect(builder).not.toContain('def alpha_interpolate_poses');
		expect(builder).toContain('def build_fixed_cart(');
		expect(builder).toContain('def build_cart_front(');
		expect(builder).toContain('steering_pixels = remove_small_components_mask(');
		expect(builder).toContain('(steering_luma < 115)');
		expect(builder).toContain('(x <= round(FRAME_SIZE * 0.52))');
		expect(builder).toContain('(y < round(FRAME_SIZE * 0.72))');
		expect(builder).not.toContain('current[steering_base] = 0');
		expect(builder).toContain('def dynamic_layer_masks(');
		expect(builder).not.toContain('seat_fade');
		expect(builder).toContain(
			'poses = motion_interpolate_poses([*dynamic_source_poses, dynamic_source_poses[0]])',
		);
		expect(builder).toContain('build_atlas(poses, fixed_cart, cart_front)');
		expect(builder).toContain('ATLAS_IMAGE = "coaster_vomit.png"');
		expect(builder).toContain('transparent RGB zeroed');
		expect(
			fs.existsSync(
				path.join(
					appRoot,
					'source-assets-unused',
					'assets',
					'theme-park',
					'coaster-vomit',
					'regenerated-16.png',
				),
			),
		).toBe(true);
		expect(
			fs.existsSync(
				path.join(
					appRoot,
					'source-assets-unused',
					'assets',
					'theme-park',
					'coaster-vomit',
					'regenerated-empty-cart.png',
				),
			),
		).toBe(true);
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
		expect(presenter).toContain('const DUCK_PLAYBACK_SPEED = 4.5 * SETUP_SPEED_BOOST');
		expect(presenter).toContain('const VOMIT_SOURCE_MS = 4500');
		expect(presenter).toContain(
			'const VOMIT_CLIP_MS = Math.round(VOMIT_SOURCE_MS / DUCK_PLAYBACK_SPEED)',
		);
		expect(presenter).toContain('vomitTimeScale: DUCK_PLAYBACK_SPEED / timing.factor');
		expect(presenter).toContain('cell: Math.round((900 / SEQUENCE_SPEED) * factor)');
		expect(presenter).toContain('stagger: Math.round((940 / SEQUENCE_SPEED) * factor)');
		expect(presenter).toContain('intro: Math.round((260 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('outro: Math.round((380 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('pulseUp: Math.round((220 / SETUP_SPEED_BOOST) * factor)');
		expect(presenter).toContain('pulseDown: Math.round((170 / SETUP_SPEED_BOOST) * factor)');
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
		expect(tile).toContain('width={SYMBOL_W * 0.82}');
		expect(tile).toContain('height={SYMBOL_H * 0.82}');
		expect(tile).toContain('scale={props.contentScale ?? 1}');
		expect(presenter).toContain('contentScale={tileScales[key]?.current ?? 1}');
		expect(persistent).toContain('contentScale={cellPulse(tile.reel, tile.row)}');
		expect(presenter).not.toContain('scale={tileScales[key]?.current ?? 1}');
		expect(persistent).not.toContain('scale={cellPulse(tile.reel, tile.row)}');
		expect(persistent).toContain('BOARD_SIDE_CONTENT_INSET');
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
		expect(background).toContain("import { Graphics } from 'pixi-svelte'");
		expect(background).not.toContain('<Sprite');
		expect(background).not.toContain('isMask');
	});

	it('preserves the single authored grid between adjacent Wilds and pops Wild content on wins', () => {
		const presenter = source('components/CoasterSetupPresenter.svelte');
		const persistent = source('components/PersistentWildBadges.svelte');
		const tile = source('components/CoasterWildTile.svelte');
		const background = source('components/CoasterWildBackground.svelte');
		const game = source('components/Game.svelte');
		const board = source('components/Board.svelte');
		const constants = source('game/constants.ts');

		expect(background).toContain('COASTER_WILD_GRID_INSET');
		expect(background).toContain('const EDGE_LOCAL_INSET = BOARD_SIDE_CONTENT_INSET * 0.5');
		expect(background).toContain('CELL_W - leftInset - rightInset');
		expect(background).toContain('CELL_H - COASTER_WILD_GRID_INSET * 2');
		expect(background).not.toContain('EDGE_OVERLAP');
		expect(background).not.toContain('coverTopEdge');
		expect(background).not.toContain('coverBottomEdge');
		expect(background).toContain('-CELL_W * 0.5');
		expect(tile).not.toContain('coverTopEdge');
		expect(tile).not.toContain('coverBottomEdge');
		expect(presenter).not.toContain('coverTopEdge');
		expect(presenter).not.toContain('coverBottomEdge');
		expect(persistent).not.toContain('coverTopEdge');
		expect(persistent).not.toContain('coverBottomEdge');
		expect(game).not.toContain('BoardGridOverlay');
		expect(board).toContain('const drawBoardContentMask =');
		expect(board).toContain('<Graphics isMask draw={drawBoardContentMask} />');
		expect(board).toContain('reel === 0 ? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE');
		expect(board).toContain('CELL_W - leftInset - rightInset');
		expect(board).toContain('CELL_H - GRID_LINE_CLEARANCE * 2');
		expect(board).toContain('!coasterCellSet.has(`${reelIndex},${symbolIndex - 1}`)');
		expect(constants).toContain('export const BOARD_SIDE_CONTENT_INSET = 1.4');
		expect(constants).toContain('export const COASTER_WILD_GRID_INSET = 2.5');
		expect(constants).toContain('export const getBoardCellCenterX =');
		expect(constants).toContain('CELL_W * (reelIndex + 0.5)');
		expect(constants).not.toContain('? BOARD_SIDE_CONTENT_INSET * 0.5');
		expect(persistent).toContain('for (let reel = 0; reel < BOARD_DIMENSIONS.x; reel += 1)');
		expect(persistent).toContain('for (let row = 0; row < BOARD_DIMENSIONS.y; row += 1)');
		expect(presenter).toContain('for (const row of ROWS)');

		// Normal Wild video, settled full-reel Roller rig, and persistent Coaster Wild content pulse.
		expect(board).toContain("return 'tpWildAnim'");
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

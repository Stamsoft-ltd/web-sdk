import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { stripEmptyCurrencyDecimals } from '../src/game/currency';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(appRoot, 'static', 'assets', 'spines', 'duckTurn');
const skeleton = JSON.parse(fs.readFileSync(path.join(assetRoot, 'duck_turn.json'), 'utf8'));
const buildScript = fs.readFileSync(
	path.join(appRoot, 'scripts', 'build-duck-turn-spine.py'),
	'utf8',
);
const assetProcessScript = fs.readFileSync(
	path.join(appRoot, 'scripts', 'process-duck-handdrawn-assets.py'),
	'utf8',
);
const poseTimes = Array.from({ length: 64 }, (_, pose) =>
	Number(((pose * 0.12639) / 63).toFixed(5)),
);
const readSource = (relativePath: string) =>
	fs.readFileSync(path.join(appRoot, 'src', relativePath), 'utf8');

const animationDuration = (value: unknown): number => {
	if (Array.isArray(value)) {
		return value.reduce((maximum, item) => Math.max(maximum, animationDuration(item)), 0);
	}
	if (!value || typeof value !== 'object') return 0;
	const record = value as Record<string, unknown>;
	const ownTime = typeof record.time === 'number' ? record.time : 0;
	return Object.values(record).reduce(
		(maximum, item) => Math.max(maximum, animationDuration(item)),
		ownTime,
	);
};

describe('Duck Your Luck Spine rig', () => {
	it('removes only empty currency decimals', () => {
		expect(stripEmptyCurrencyDecimals('$5.00')).toBe('$5');
		expect(stripEmptyCurrencyDecimals('5,00 €')).toBe('5 €');
		expect(stripEmptyCurrencyDecimals('$1,000.00')).toBe('$1,000');
		expect(stripEmptyCurrencyDecimals('$5.50')).toBe('$5.50');
	});

	it('exports sixty-four short-side turn frames and separate depth layers for every ring', () => {
		expect(skeleton.skeleton.spine).toBe('4.2.0');
		expect(skeleton.skeleton.hash).toBe('duck-your-luck-turn-v40-front-rear-accessory-fit');
		expect(buildScript).toContain('if pose_index == 0:');
		expect(buildScript).toContain('Duck turn opening frame changed');
		expect(buildScript).toContain('def motion_interpolate_poses(source_poses: list[Image.Image])');
		expect(buildScript).toContain('minterpolate=fps={POSE_COUNT - 1}/{SOURCE_POSE_COUNT - 1}');
		expect(buildScript).toContain('SOURCE_POSE_COUNT = 16');
		expect(buildScript).toContain('POSE_COUNT = 64');
		expect(buildScript).toContain('TURN_SPEED_BOOST = 2.16');
		expect(buildScript).toContain('DUCK_ART_SCALE = 0.95');
		expect(buildScript).toContain('placed = placed.transpose(Image.Transpose.FLIP_LEFT_RIGHT)');
		expect(Object.keys(skeleton.skins[0].attachments.ring_back)).toHaveLength(16);
		expect(Object.keys(skeleton.skins[0].attachments.ring_front)).toHaveLength(16);
		expect(Object.keys(skeleton.skins[0].attachments.duck_pose)).toEqual(
			Array.from({ length: 64 }, (_, pose) => `pose_${pose}`),
		);
		expect(skeleton.slots.map((slot: { name: string }) => slot.name)).toEqual([
			'ring_back',
			'glasses_back',
			'duck_pose',
			'hat',
			'glasses_front',
			'glasses_rear',
			'ring_front',
			'prize',
		]);
		expect(skeleton.bones.map((bone: { name: string }) => bone.name)).toEqual(
			expect.arrayContaining([
				'ring',
				'duck',
				'hat_bone',
				'glasses_bone',
				'glasses_rear_bone',
				'prize',
			]),
		);
		expect(skeleton.bones.find((bone: { name: string }) => bone.name === 'duck')).toMatchObject({
			y: -6,
		});

		for (let variant = 1; variant <= 16; variant += 1) {
			expect(skeleton.animations).toHaveProperty(`idle_${variant}`);
			expect(skeleton.animations).toHaveProperty(`turn_${variant}`);
			expect(skeleton.animations[`turn_batch_${variant}`]).toEqual(
				skeleton.animations[`turn_${variant}`],
			);
			expect(skeleton.animations).toHaveProperty(`back_idle_${variant}`);
		}
	});

	it('turns through every perspective and ends on the rear pose with the rump socket visible', () => {
		for (let variant = 1; variant <= 16; variant += 1) {
			const turn = skeleton.animations[`turn_${variant}`];
			expect(animationDuration(turn)).toBeCloseTo(0.14444);
			expect(turn.slots.ring_back.attachment[0]).toMatchObject({
				name: `ring_back_${variant}`,
			});
			expect(turn.slots.ring_front.attachment[0]).toMatchObject({
				name: `ring_front_${variant}`,
			});
			expect(turn.slots.duck_pose.attachment.map(({ name }: { name: string }) => name)).toEqual(
				Array.from({ length: 64 }, (_, pose) => `pose_${pose}`),
			);
			expect(turn.slots.duck_pose).not.toHaveProperty('alpha');
			expect(turn.slots.duck_pose.attachment.at(-1)).toMatchObject({ name: 'pose_63' });
			expect(turn.slots.prize.attachment.at(-1)).toMatchObject({
				time: 0.12639,
				name: 'prize_socket',
			});
		}
	});

	it('offers standard, sunglasses, party-hat, and combined looks from approved style assets', () => {
		const skin = skeleton.skins[0].attachments;
		expect(Object.keys(skin.hat)).toHaveLength(8);
		expect(Object.keys(skin.glasses_back)).toHaveLength(4);
		expect(Object.keys(skin.glasses_front)).toHaveLength(4);
		expect(Object.keys(skin.glasses_rear)).toHaveLength(4);
		expect(skin.hat.hat_front_0).toMatchObject({
			path: 'party_hat_front_0',
			width: 88,
			height: 149,
		});
		expect(skin.hat.hat_rear_0).toMatchObject({
			path: 'party_hat_rear_0',
			width: 88,
			height: 149,
		});
		expect(skin.glasses_back.glasses_back_3).toMatchObject({
			path: 'sunglasses_3',
			width: 153,
			height: 60,
		});
		expect(skin.glasses_front.glasses_front_3).toMatchObject({
			path: 'sunglasses_front_3',
			width: 153,
			height: 60,
		});
		expect(skin.glasses_rear.glasses_rear_3).toMatchObject({
			path: 'sunglasses_rear_3',
			width: 174,
			height: 42,
		});
		expect(buildScript).toContain('HAT_FRONT_SOURCES = [');
		expect(buildScript).toContain('SOURCE_DIR / f"party_hat_front_combo_{index}.png"');
		expect(buildScript).toContain('HAT_REAR_SOURCES = [');
		expect(buildScript).toContain('SOURCE_DIR / f"party_hat_rear_combo_{index}.png"');
		expect(buildScript).toContain('GLASSES_SOURCES = [');
		expect(buildScript).toContain('sunglasses_combo_{index}.png');
		expect(buildScript).toContain('GLASSES_FRONT_SOURCES = [');
		expect(buildScript).toContain('sunglasses_front_combo_{index}.png');
		expect(buildScript).toContain('GLASSES_REAR_SOURCES = [');
		expect(buildScript).toContain('sunglasses_rear_combo_{index}.png');
		expect(buildScript).not.toContain('LEGACY_ACCESSORY_DIR');
		expect(buildScript).toContain('HAT_BASE_WIDTH = 68');
		expect(buildScript).toContain('HAT_BASE_HEIGHT = 86');
		expect(buildScript).toContain('HAT_SCALE_X = 1.1156');
		expect(buildScript).toContain('HAT_SCALE_Y = 1.1156');
		expect(buildScript).toContain('HAT_Y_OFFSET = 11');
		expect(buildScript).toContain('HAT_FRONT_X_OFFSET = -8');
		expect(buildScript).toContain('HAT_REAR_X_OFFSET = 0');
		expect(buildScript).toContain('HAT_REAR_SHOW_POSE = 44');
		expect(buildScript).toContain('GLASSES_BASE_WIDTH = 145');
		expect(buildScript).toContain('GLASSES_BASE_HEIGHT = 52');
		expect(buildScript).toContain('GLASSES_CENTER_OFFSET_X = 31');
		expect(buildScript).toContain('GLASSES_SCALE_X = 1.05');
		expect(buildScript).toContain('GLASSES_SCALE_Y = 1.05');
		expect(buildScript).toContain('GLASSES_FRONT_X_OFFSET = -29');
		expect(buildScript).toContain('GLASSES_FRONT_Y_OFFSET = 18');
		expect(buildScript).toContain('GLASSES_ROTATION = -8');
		expect(buildScript).toContain('GLASSES_PERSPECTIVE_REDUCTION = 80');
		expect(buildScript).toContain('GLASSES_REAR_BASE_WIDTH = 148');
		expect(buildScript).toContain('GLASSES_REAR_SCALE = 0.875');
		expect(buildScript).toContain('GLASSES_REAR_X_OFFSET = 0');
		expect(buildScript).toContain('GLASSES_REAR_Y_OFFSET = 0');
		expect(buildScript).toContain('GLASSES_REAR_SHOW_POSE = 48');
		expect(buildScript).toContain('center_y = head_top + 73 + GLASSES_REAR_Y_OFFSET');
		expect(assetProcessScript).toContain('decorated.height * 0.60');
		expect(assetProcessScript).toContain('party_hat_{view}_combo_{index}.png');
		expect(assetProcessScript).toContain('sunglasses_rear_combo_{index}.png');
		expect(assetProcessScript).toContain('Expected back frame, front frame, and rear arms');
		expect(assetProcessScript).toContain('"rear": fit_legacy_hat(front)');
		expect(buildScript).not.toMatch(/build_hat_overlay|build_glasses_overlay|accessory_canvas/);

		for (let look = 0; look < 25; look += 1) {
			for (const phase of ['idle', 'turn', 'turn_batch', 'back_idle']) {
				expect(skeleton.animations).toHaveProperty(`look_${phase}_${look}`);
			}
			expect(skeleton.animations[`look_turn_batch_${look}`]).toEqual(
				skeleton.animations[`look_turn_${look}`],
			);
		}

		const named = (timeline: { name?: string }[]) => timeline.filter(({ name }) => name);
		expect(named(skeleton.animations.look_turn_0.slots.hat.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_0.slots.glasses_back.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_0.slots.glasses_front.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_0.slots.glasses_rear.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_1.slots.hat.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_1.slots.glasses_back.attachment)).toHaveLength(1);
		expect(named(skeleton.animations.look_turn_1.slots.glasses_front.attachment)).toHaveLength(1);
		expect(named(skeleton.animations.look_turn_1.slots.glasses_rear.attachment)).toHaveLength(2);
		expect(named(skeleton.animations.look_turn_5.slots.hat.attachment)).toHaveLength(3);
		expect(named(skeleton.animations.look_turn_5.slots.glasses_back.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_5.slots.glasses_front.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_5.slots.glasses_rear.attachment)).toHaveLength(0);
		expect(named(skeleton.animations.look_turn_9.slots.hat.attachment)).toHaveLength(3);
		expect(named(skeleton.animations.look_turn_9.slots.glasses_back.attachment)).toHaveLength(1);
		expect(named(skeleton.animations.look_turn_9.slots.glasses_front.attachment)).toHaveLength(1);
		expect(named(skeleton.animations.look_turn_9.slots.glasses_rear.attachment)).toHaveLength(2);
		expect(skeleton.animations.look_turn_9.bones.hat_bone.translate).toHaveLength(65);
		expect(skeleton.animations.look_turn_9.bones.glasses_bone.scale).toHaveLength(65);
		expect(skeleton.animations.look_turn_9.bones.glasses_rear_bone.scale).toHaveLength(65);

		const slotNames = skeleton.slots.map(({ name }: { name: string }) => name);
		expect(slotNames.indexOf('glasses_back')).toBeLessThan(slotNames.indexOf('duck_pose'));
		expect(slotNames.indexOf('glasses_front')).toBeGreaterThan(slotNames.indexOf('duck_pose'));
		expect(slotNames.indexOf('glasses_rear')).toBeGreaterThan(slotNames.indexOf('duck_pose'));
		expect(named(skeleton.animations.look_back_idle_1.slots.glasses_rear.attachment)).toHaveLength(
			2,
		);
		expect(named(skeleton.animations.look_back_idle_1.slots.glasses_back.attachment)).toHaveLength(
			0,
		);
		expect(named(skeleton.animations.look_back_idle_1.slots.glasses_front.attachment)).toHaveLength(
			0,
		);
	});

	it('keeps one opaque pose visible while the ring moves on independent bones', () => {
		const turn = skeleton.animations.turn_1;
		expect(turn.slots.duck_pose).toEqual({
			attachment: expect.any(Array),
		});
		expect(turn.slots.duck_pose.attachment.map(({ time }: { time: number }) => time)).toEqual(
			poseTimes,
		);
		expect(turn.slots.duck_pose).not.toHaveProperty('alpha');
		expect(turn.slots.duck_pose).not.toHaveProperty('rgba');
		expect(turn.bones.duck).toHaveProperty('translate');
		expect(turn.bones.duck).toHaveProperty('scale');
		expect(Math.max(...turn.bones.float.translate.map(({ y }: { y: number }) => y))).toBe(36);
		expect(turn.bones.ring).toHaveProperty('scale');
		expect(turn.bones.ring).toHaveProperty('rotate');
	});

	it('uses only solid floaties and overlaps both depth arcs without a moving seam', () => {
		expect(buildScript).toMatch(/1: \{"hue": None, "star": True, "striped": False/);
		expect(buildScript).not.toContain('"striped": True');
		expect(buildScript).toContain('RING_NO_STAR_SOURCE = SOURCE_DIR / "ring_no_star.png"');
		expect(buildScript).toContain('depth_overlap = 2');
		expect(buildScript).toContain('if y < boundary + depth_overlap:');
		expect(buildScript).toContain('if y >= boundary - depth_overlap:');
	});

	it('encodes Spine 4.2 bezier controls in absolute time/value space', () => {
		for (const animation of Object.values(skeleton.animations) as any[]) {
			for (const timelines of Object.values(animation.bones ?? {}) as any[]) {
				for (const type of ['translate', 'scale']) {
					const keys = timelines[type] ?? [];
					for (let index = 0; index < keys.length - 1; index += 1) {
						const key = keys[index];
						if (!Array.isArray(key.curve)) continue;
						const next = keys[index + 1];
						expect(key.curve).toHaveLength(8);
						for (const controlTime of [key.curve[0], key.curve[2], key.curve[4], key.curve[6]]) {
							expect(controlTime).toBeGreaterThan(key.time);
							expect(controlTime).toBeLessThan(next.time);
						}
						expect(key.curve[1]).toBeCloseTo(key.x);
						expect(key.curve[3]).toBeCloseTo(next.x);
						expect(key.curve[5]).toBeCloseTo(key.y);
						expect(key.curve[7]).toBeCloseTo(next.y);
					}
				}
				const rotateKeys = timelines.rotate ?? [];
				for (let index = 0; index < rotateKeys.length - 1; index += 1) {
					const key = rotateKeys[index];
					if (!Array.isArray(key.curve)) continue;
					const next = rotateKeys[index + 1];
					expect(key.curve).toHaveLength(4);
					expect(key.curve[0]).toBeGreaterThan(key.time);
					expect(key.curve[0]).toBeLessThan(next.time);
					expect(key.curve[2]).toBeGreaterThan(key.time);
					expect(key.curve[2]).toBeLessThan(next.time);
					expect(key.curve[1]).toBeCloseTo(key.value);
					expect(key.curve[3]).toBeCloseTo(next.value);
				}
			}
		}
	});

	it('packs every attachment in the atlas', () => {
		const atlas = fs.readFileSync(path.join(assetRoot, 'duck_turn.atlas'), 'utf8');
		for (let pose = 0; pose < 64; pose += 1) {
			expect(atlas).toContain(`\npose_${pose}\n`);
		}
		for (let combo = 0; combo < 4; combo += 1) {
			expect(atlas).toContain(`\nparty_hat_front_${combo}\n`);
			expect(atlas).toContain(`\nparty_hat_rear_${combo}\n`);
			expect(atlas).toContain(`\nsunglasses_${combo}\n`);
			expect(atlas).toContain(`\nsunglasses_front_${combo}\n`);
			expect(atlas).toContain(`\nsunglasses_rear_${combo}\n`);
		}
		expect(atlas).not.toMatch(/\nhat_pose_|\nglasses_pose_/);
		for (let variant = 1; variant <= 16; variant += 1) {
			expect(atlas).toContain(`\nring_back_${variant}\n`);
			expect(atlas).toContain(`\nring_front_${variant}\n`);
		}
		expect(atlas).toContain('\nprize_socket\n');
	});

	it('drives pond picks from turn completion and keeps the rear duck in-cell', () => {
		const source = readSource('components/DuckPondBonus.svelte');
		const duck = readSource('components/DuckPondDuck.svelte');
		const collect = readSource('components/DuckCollectPresenter.svelte');
		const currency = readSource('game/currency.ts');
		const visual = readSource('game/duckVisual.ts');
		const handler = readSource('game/bookEventHandlerMap.ts');
		expect(source).toContain('<DuckPondDuck');
		expect(source).toContain('finishDuckReveal(index);');
		expect(source).toContain('finishFinalDuckReveal(index);');
		expect(source).toContain('const fakePrizes = prizePool.slice(totalPicks)');
		expect(source).toContain('finalRevealIndices = hiddenIndices');
		expect(source).toContain('await waitForResolve((resolve) => (resolveFinalReveal = resolve))');
		expect(source).toContain('await waitForTimeout(2000)');
		expect(source).toContain('skipAllowedAt = performance.now() + 140');
		expect(source).toContain('if (performance.now() < skipAllowedAt) return');
		expect(source).toContain('bookEventAmountToCurrencyString(runningTotal)');
		expect(source).not.toContain('bookEventAmountToBetAmountMultiplier');
		expect(duck).not.toContain('{#key animationName}');
		expect(duck).toMatch(/<SpineTrack[\s\S]*?\{animationName\}/);
		expect(duck).toContain('trackIndex={1}');
		expect(duck).toContain('animationName={lookAnimationName}');
		expect(source).toContain('const POND_ACCESSORIES_ENABLED = false');
		expect(source).toContain('POND_ACCESSORIES_ENABLED ? duckLookForIndex(eventId, index) : 0');
		expect(source).toContain('look: pondLook(eventId, index)');
		expect(source).toContain('variant: duckVariantForIndex(eventId, index)');
		expect(source).toContain('ducks = emptyPond(event.seed)');
		expect(source).toContain('look={duck.look}');
		expect(source).not.toContain('Math.random');
		expect(visual).toContain('seededDuckValue');
		expect(visual).toContain('duckLookForIndex = (eventId: number, duckIndex: number)');
		expect(visual).toContain(
			'DUCK_SOLID_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]',
		);
		expect(visual).not.toContain('Math.random');
		expect(handler).toContain('seed: bookEvent.index');
		expect(duck).toContain('bookEventAmountToCurrencyString((props.prize?.value ?? 0) * 100)');
		expect(duck).toContain('`${props.prize.value}x`');
		expect(duck).toContain('stripEmptyCurrencyDecimals(formattedCurrencyLabel)');
		expect(duck).not.toContain('`+${');
		expect(duck).toContain('previousLabelLength');
		expect(duck).toContain('* 1.3');
		expect(source).toMatch(
			/stripEmptyCurrencyDecimals\(bookEventAmountToCurrencyString\(runningTotal\)\)/,
		);
		// The Duck Collect presenter draws nothing at all now — its running-total banner landed on
		// the THEME PARK sign and came out. The collected total is the HUD's WIN field.
		expect(collect).not.toContain('bookEventAmountToCurrencyString');
		expect(collect).not.toContain('NeonPlaque');
		expect(currency).toContain("value.replace(/([.,])00(?=\\D*$)/, '')");
		expect(duck).not.toMatch(/props\.prize\?\.value \?\? 0\}x/);
		expect(source).not.toMatch(/centerPrize|duckPresent|SPIN_PLAYBACK/);
	});

	it('celebrates landed Duck scatters, announces the bonus, then opens the pond', () => {
		const handler = readSource('game/bookEventHandlerMap.ts');
		const types = readSource('game/typesBookEvent.ts');
		const intro = readSource('components/FreeSpinIntro.svelte');
		const start = handler.indexOf('duckPickStart: async');
		const end = handler.indexOf('duckPick: async', start);
		const duckStart = handler.slice(start, end);

		expect(types).toMatch(/type BookEventDuckPickStart[\s\S]*?positions\?: Position\[\]/);
		expect(duckStart).toContain('duckTriggerPositionsFromBoard()');
		expect(duckStart).toContain("type: 'boardWithAnimateSymbols'");
		expect(duckStart).toContain('await waitForTimeout(SECOND * 0.12)');
		expect(duckStart).toContain("type: 'freeSpinIntroShow'");
		expect(duckStart).toContain('count: bookEvent.totalPicks');
		expect(duckStart).toContain("title: 'DUCK YOUR LUCK'");
		expect(duckStart).toContain("countLabel: 'DUCK PICKS'");
		expect(duckStart).toContain("type: 'freeSpinIntroHide'");
		expect(duckStart).toContain("type: 'transition'");
		expect(duckStart.indexOf("type: 'boardWithAnimateSymbols'")).toBeLessThan(
			duckStart.indexOf("type: 'freeSpinIntroShow'"),
		);
		expect(duckStart.indexOf("type: 'freeSpinIntroShow'")).toBeLessThan(
			duckStart.indexOf("type: 'transition'"),
		);
		expect(duckStart.indexOf("type: 'transition'")).toBeLessThan(
			duckStart.indexOf('stateGame.duckPicks ='),
		);
		expect(duckStart.indexOf('stateGame.duckPicks =')).toBeLessThan(
			duckStart.indexOf("type: 'duckPondShow'"),
		);
		expect(intro).toContain("'DUCK YOUR LUCK': {");
		expect(intro).toContain("? 'duckScatter'");
		expect(intro).toContain('stateI18nDerived.translate(countLabel)');
	});

	it('keeps FSPIN1 Duck Collect Board-owned, skippable, and synchronized at fast speeds', () => {
		const board = readSource('components/Board.svelte');
		const presenter = readSource('components/DuckCollectPresenter.svelte');
		const duck = readSource('components/DuckPondDuck.svelte');

		expect(board).toContain("import DuckPondDuck from './DuckPondDuck.svelte'");
		expect(board).toContain("rawSymbol.name === 'DC'");
		expect(board).toContain('<DuckPondDuck');
		expect(board).toContain('duckVariantForPosition');
		expect(board).toContain('rawSymbol.duckVariant ??');
		expect(board).toContain('rawSymbol.duckLook ??');
		expect(board).toContain('look={duckLook(reelSymbol.rawSymbol, position)}');
		expect(board).not.toContain('directPrefix=');
		expect(board).toContain('onrevealcomplete=');
		expect(board).toContain("type: 'duckCollectRevealComplete'");
		expect(board).toContain('duckRevealPositions');
		expect(board).toContain('duckTurnedPositions');
		expect(board).toContain('turned={isDuckCollectTurned');
		expect(board).toContain('batch={context.stateGame.duckRevealBatch}');
		expect(board).not.toMatch(/revealedDuckCollectCellSet|underDuckCollect/);

		expect(presenter).not.toContain('DuckPondDuck');
		expect(presenter).toContain('duckCollectRevealComplete');
		expect(presenter).toContain('await waitForResolve');
		expect(presenter).toContain('startBatchReveal');
		expect(presenter).toContain('stateBet.isTurbo || stateBet.isSuperTurbo');
		expect(presenter).toContain('context.stateGame.duckRevealPositions = positions.filter');
		expect(presenter).toContain('context.stateGame.duckRevealBatch = true');
		expect(presenter).toContain("event.code !== 'Space' || !show || batchStarted");
		expect(presenter).toContain('if (!show || batchStarted) return');
		expect(presenter).toContain('if (batchMode) return;');
		expect(presenter).toContain('skipAllowedAt = performance.now() + 140');
		expect(presenter).toContain('if (performance.now() < skipAllowedAt) return');
		expect(presenter).not.toMatch(/duckPresent|AnimatedSprite|PRESENT_MS/);
		expect(duck).toMatch(/if \(props\.revealing\) \{[\s\S]*?animationName = turnName/);
		expect(duck).toContain('props.prize || props.turned');
		expect(duck).toContain("props.batch ? 'turn_batch' : 'turn'");
	});

	it('keeps collect ducks on Spine and uses the bonus-buy art for Duck scatters', () => {
		const assets = readSource('game/assets.ts');
		const board = readSource('components/Board.svelte');
		const handler = readSource('game/bookEventHandlerMap.ts');
		const constants = readSource('game/constants.ts');
		const utils = readSource('game/utils.ts');
		expect(assets).toContain('duckPondTurn:');
		expect(assets).not.toContain('duckPresentSpine:');
		expect(board).toContain("rawSymbol.name === 'DC'");
		expect(board).toContain(
			"if (name === 'S_DUCK') return getSpecialSymbolKey('duckScatter', layoutType)",
		);
		expect(board).toContain('`duckPondDuck${duckVariant(rawSymbol');
		expect(board).toContain('duckLookForPosition');
		expect(board).not.toContain('LoopingSpineSprite');
		expect(handler).toContain('duckVariant: duckVariantForPosition(position, bookEvent.index)');
		expect(handler).toContain('duckLook: duckLookForPosition(position, bookEvent.index)');
		expect(board).not.toMatch(/revealedDuckCollectCellSet|underDuckCollect/);
		expect(board).not.toContain("assetKey: 'duckPresentSpine'");
		expect(assets).toContain(
			"src: './assets/theme-park/v2/modes/duck-your-luck-desktop-marquee.png'",
		);
		expect(assets).toContain(
			"src: './assets/theme-park/v2/modes/duck-your-luck-mobile-marquee.png'",
		);
		expect(assets).toContain(
			"src: './assets/theme-park/v2/modes/duck-your-luck-mobile-landscape-marquee.png'",
		);
		expect(utils).toMatch(
			/duckScatter: \{[\s\S]*desktop: 'tpDuckScatterDesktop',[\s\S]*portrait: 'tpDuckScatterMobile',[\s\S]*landscape: 'tpDuckScatterLandscape'/,
		);
		expect(constants).toContain("DC: states('tpDuckScatterDesktop', 'tpDuckScatterDesktop')");
		expect(utils.match(/DC: 'tpDuckScatterDesktop'/g)).toHaveLength(2);
	});
});

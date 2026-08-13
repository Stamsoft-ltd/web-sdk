import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modes = ['BASE', 'ANTE', 'FSPIN1', 'FSPIN2', 'DUCK', 'ROLLER', 'COASTER'];

for (const mode of modes) {
	const booksPath = path.join(root, 'library', 'books', `books_${mode}.jsonl`);
	const lookupPath = path.join(root, 'library', 'publish_files', `lookUpTable_${mode}_0.csv`);
	const books = fs.readFileSync(booksPath, 'utf8').trim().split('\n').map(JSON.parse);
	const lookup = fs
		.readFileSync(lookupPath, 'utf8')
		.trim()
		.split('\n')
		.map((line) => {
			const [id, weight, payout] = line.split(',').map(Number);
			return { id, weight, payout };
		});

	assert.deepEqual(
		books.map((book) => book.id),
		lookup.map((row) => row.id),
		`${mode}: ids`,
	);
	assert.equal(
		lookup.reduce((sum, row) => sum + row.weight, 0),
		100_000,
		`${mode}: lookup weight`,
	);
	for (const book of books) {
		assert.ok(book.events.length > 0, `${mode}/${book.id}: empty events`);
		assert.deepEqual(
			book.events.map((event) => event.index),
			book.events.map((_, index) => index),
		);
		assert.equal(book.events.at(-1).type, 'finalWin', `${mode}/${book.id}: final event`);
		for (const event of book.events.filter((event) => event.type === 'reveal')) {
			assert.equal(event.board.length, 5, `${mode}/${book.id}: reel count`);
			assert.ok(
				event.board.every((reel) => reel.length === 7),
				`${mode}/${book.id}: padded rows`,
			);
			if (mode === 'BASE' || mode === 'ANTE') {
				const scatterCount = event.board
					.flatMap((reel) => reel.slice(1, 6))
					.filter((cell) => cell.scatter).length;
				assert.notEqual(scatterCount, 2, `${mode}/${book.id}: terminal two-scatter board`);
			}
		}

		for (const winInfo of book.events.filter((event) => event.type === 'winInfo')) {
			const reveal = book.events
				.slice(0, winInfo.index)
				.reverse()
				.find((event) => event.type === 'reveal');
			assert.ok(reveal, `${mode}/${book.id}: win reveal`);
			// Current math leaves the pre-feature symbols in reveal and applies the full-reel Wild in
			// rollerWildsApply. Legacy published books already contain the five Wild cells in reveal.
			// Validate winnings against the effective board so both encodings stay readable.
			const appliedRollers = new Map(
				book.events
					.slice(reveal.index + 1, winInfo.index)
					.filter((event) => event.type === 'rollerWildsApply')
					.flatMap((event) => event.reels)
					.map((roller) => [roller.reel, roller]),
			);
			for (const win of winInfo.wins) {
				const additiveMultiplier = win.positions.reduce((sum, position) => {
					const cell = reveal.board[position.reel][position.row + 1];
					const roller = appliedRollers.get(position.reel);
					return (
						sum +
						(roller ? Number(roller.multiplier) : cell.wild ? Number(cell.multiplier ?? 0) : 0)
					);
				}, 0);
				assert.equal(
					win.meta.lineMultiplier,
					additiveMultiplier || 1,
					`${mode}/${book.id}: additive line multiplier`,
				);
			}
		}
		if (mode === 'FSPIN1') {
			const start = book.events.find((event) => event.type === 'duckCollectStart');
			assert.ok(
				start && start.positions.length >= 1 && start.positions.length <= 25,
				`${mode}/${book.id}: duck count`,
			);
		}

		for (const duckStart of book.events.filter((event) => event.type === 'duckPickStart')) {
			const reveal = book.events
				.slice(0, duckStart.index)
				.reverse()
				.find((event) => event.type === 'reveal');
			assert.ok(reveal, `${mode}/${book.id}: Duck Your Luck trigger reveal`);
			const visibleTriggers = reveal.board.flatMap((reel, reelIndex) =>
				reel
					.slice(1, 6)
					.flatMap((cell, row) =>
						cell.name === 'S_DUCK' && cell.scatter ? [{ reel: reelIndex, row }] : [],
					),
			);
			assert.ok(visibleTriggers.length >= 3, `${mode}/${book.id}: visible Duck triggers`);
			assert.deepEqual(
				[...duckStart.positions].sort((a, b) => a.reel - b.reel || a.row - b.row),
				visibleTriggers.sort((a, b) => a.reel - b.reel || a.row - b.row),
				`${mode}/${book.id}: Duck trigger positions`,
			);
		}

		for (const rollerEvent of book.events.filter((event) => event.type === 'rollerWildsApply')) {
			const reveal = book.events
				.slice(0, rollerEvent.index)
				.reverse()
				.find((event) => event.type === 'reveal');
			assert.ok(reveal, `${mode}/${book.id}: roller reveal`);
			assert.equal(
				new Set(rollerEvent.reels.map(({ reel }) => reel)).size,
				rollerEvent.reels.length,
				`${mode}/${book.id}: unique roller reels`,
			);
			for (const roller of rollerEvent.reels) {
				assert.ok(
					Number.isInteger(roller.reel) && roller.reel >= 0 && roller.reel < 5,
					`${mode}/${book.id}: roller reel`,
				);
				const isSparseContract = 'triggerRow' in roller || 'multipliers' in roller;
				if (isSparseContract) {
					assert.ok(
						Number.isInteger(roller.triggerRow) && roller.triggerRow >= 0 && roller.triggerRow < 5,
						`${mode}/${book.id}: roller trigger row`,
					);
					assert.ok(Array.isArray(roller.multipliers), `${mode}/${book.id}: sparse multipliers`);
					assert.equal(
						new Set(roller.multipliers.map(({ row }) => row)).size,
						roller.multipliers.length,
						`${mode}/${book.id}: unique multiplier rows`,
					);
					for (const plaque of roller.multipliers) {
						assert.ok(
							Number.isInteger(plaque.row) && plaque.row >= 0 && plaque.row < 5,
							`${mode}/${book.id}: multiplier row`,
						);
						assert.ok(plaque.multiplier > 0, `${mode}/${book.id}: positive multiplier`);
					}
					const summedMultiplier = roller.multipliers.reduce(
						(sum, { multiplier }) => sum + multiplier,
						0,
					);
					assert.equal(
						roller.multiplier,
						Math.max(1, summedMultiplier),
						`${mode}/${book.id}: sparse reel multiplier`,
					);
					const trigger = reveal.board[roller.reel][roller.triggerRow + 1];
					assert.equal(trigger.name, 'W', `${mode}/${book.id}: roller trigger symbol`);
					assert.equal(trigger.wild, true, `${mode}/${book.id}: roller trigger wild`);
					assert.equal(trigger.rollerTrigger, true, `${mode}/${book.id}: roller trigger flag`);
				} else {
					for (let paddedRow = 1; paddedRow <= 5; paddedRow += 1) {
						const cell = reveal.board[roller.reel][paddedRow];
						assert.equal(cell.name, 'W', `${mode}/${book.id}: legacy roller wild cell`);
						assert.equal(
							cell.multiplier,
							roller.multiplier,
							`${mode}/${book.id}: legacy roller multiplier`,
						);
					}
				}
			}
		}

		const coasterSetup = book.events.find((event) => event.type === 'coasterSetup');
		if (coasterSetup) {
			for (const reveal of book.events.filter(
				(event) => event.type === 'reveal' && event.gameType === 'freegame',
			)) {
				for (const tile of coasterSetup.tiles) {
					const cell = reveal.board[tile.reel][tile.row + 1];
					assert.equal(cell.name, 'W', `${mode}/${book.id}: persistent wild cell`);
					assert.equal(cell.persistent, true, `${mode}/${book.id}: persistent flag`);
					assert.equal(
						cell.multiplier,
						tile.multiplier,
						`${mode}/${book.id}: persistent multiplier`,
					);
				}
			}
		}

		if (mode === 'DUCK') {
			const start = book.events.find((event) => event.type === 'duckPickStart');
			const picks = book.events.filter((event) => event.type === 'duckPick');
			assert.ok(start, `${mode}/${book.id}: pick start`);
			assert.equal(start.totalPicks, 10, `${mode}/${book.id}: total picks`);
			assert.equal(start.pool.length, 25, `${mode}/${book.id}: pond size`);
			assert.equal(picks.length, 10, `${mode}/${book.id}: emitted picks`);
			assert.equal(picks[0].kind, 'mult', `${mode}/${book.id}: first pick direct`);
			assert.deepEqual(
				picks.map(({ kind, value }) => ({ kind, value })),
				start.pool.slice(0, 10),
				`${mode}/${book.id}: picked pool prefix`,
			);
			assert.deepEqual(
				picks.map((pick) => pick.pickIndex),
				picks.map((_, index) => index),
				`${mode}/${book.id}: pick order`,
			);
		}
	}
}

for (const relativePath of [
	'assets/spines/anticipation/anticipation.atlas',
	'assets/spines/anticipation/anticipation.json',
	'assets/spines/anticipation/anticipation.webp',
	'assets/spines/duckTurn/duck_turn.atlas',
	'assets/spines/duckTurn/duck_turn.json',
	'assets/spines/duckTurn/duck_turn.png',
	'assets/spines/coasterVomit/coaster_vomit.atlas',
	'assets/spines/coasterVomit/coaster_vomit.json',
	'assets/spines/coasterVomit/coaster_vomit.png',
	'assets/theme-park/v2/features/coaster-rig-happy.png',
	'assets/theme-park/v2/features/coaster-rig-vomit.png',
	'assets/sprites/rollerCar/roller_car.atlas',
	'assets/sprites/rollerCar/roller_car_spine.json',
	'assets/sprites/rollerCar/roller_car_ride.webp',
	'assets/components/frames/magnetic/cell_box.png',
	'assets/components/frames/magnetic/cell_box_win.png',
]) {
	assert.ok(
		fs.existsSync(path.join(root, 'static', relativePath)),
		`missing temporary asset: ${relativePath}`,
	);
}

const duckPondSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'DuckPondBonus.svelte'),
	'utf8',
);
const duckVisualSource = fs.readFileSync(path.join(root, 'src', 'game', 'duckVisual.ts'), 'utf8');
assert.match(duckPondSource, /await waitForResolve/, 'Duck Your Luck must block for a manual pick');
assert.match(
	duckPondSource,
	/onpress=\{\(\) => chooseDuck\(index\)\}/,
	'Duck reel cells must be interactive',
);
assert.match(duckPondSource, /const POND_SIZE = 25/, 'Duck pond must render 25 ducks');
assert.match(duckPondSource, /<DuckPondDuck/, 'Duck picks must use the front-to-rear Spine rig');
assert.match(
	duckPondSource,
	/variant: duckVariantForIndex\(eventId, index\)[\s\S]*look: duckLookForIndex\(eventId, index\)[\s\S]*ducks = emptyPond\(event\.seed\)[\s\S]*look=\{duck\.look\}/,
	'Duck pond must derive and preserve each Duck look from its event seed',
);
assert.doesNotMatch(duckPondSource, /Math\.random/, 'Duck pond styles must not depend on render timing');
assert.match(
	duckVisualSource,
	/seededDuckValue[\s\S]*duckLookForIndex[\s\S]*duckVariantForIndex/,
	'Duck style selection must use the deterministic event-index mixer',
);
assert.doesNotMatch(
	duckVisualSource,
	/Math\.random/,
	'Duck visual helpers must not restyle old symbols on later spins',
);
assert.match(
	duckPondSource,
	/25 interactive ducks occupy the exact 5×5 reel cells/,
	'Duck picker must occupy the reel grid',
);
assert.match(
	duckPondSource,
	/onrevealcomplete=\{\(\) => finishDuckReveal\(index\)\}/,
	'Pond book playback must resume from the Spine completion callback',
);
assert.match(
	duckPondSource,
	/skipAllowedAt = performance\.now\(\) \+ 140/,
	'The native selection click must not instantly skip the duck turn',
);
assert.match(
	duckPondSource,
	/stripEmptyCurrencyDecimals\(bookEventAmountToCurrencyString\(runningTotal\)\)/,
	'Duck Your Luck total must use active currency without empty decimals',
);
assert.doesNotMatch(
	duckPondSource,
	/bookEventAmountToBetAmountMultiplier/,
	'Duck Your Luck total must not render as an x multiplier',
);
assert.doesNotMatch(
	duckPondSource,
	/centerPrize|duckPresent|SPIN_PLAYBACK/,
	'Duck pond must not use the old centre gift reveal',
);

const duckSpineSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'DuckPondDuck.svelte'),
	'utf8',
);
const duckCurrencySource = fs.readFileSync(path.join(root, 'src', 'game', 'currency.ts'), 'utf8');
assert.ok(
	duckCurrencySource.includes("value.replace(/([.,])00(?=\\D*$)/, '')"),
	'Duck currency formatter must strip only an empty two-digit decimal suffix',
);
assert.match(duckSpineSource, /key="duckPondTurn"/, 'Duck reveal must use its Spine asset');
assert.doesNotMatch(
	duckSpineSource,
	/\{#key animationName\}/,
	'Duck phase changes must not remount the Spine track and blink',
);
assert.match(
	duckSpineSource,
	/<SpineTrack[\s\S]*?\{animationName\}/,
	'Duck phase changes must update one persistent Spine track',
);
assert.match(
	duckSpineSource,
	/trackIndex=\{1\}[\s\S]*animationName=\{lookAnimationName\}/,
	'Duck accessories must run on a synchronized second Spine track',
);
assert.match(duckSpineSource, /slotName="prize"/, 'Duck prize must follow the rump slot');
assert.match(duckSpineSource, /`\$\{props\.prize\.value\}x`/, 'Multiply-all ducks need Nx text');
assert.match(
	duckSpineSource,
	/bookEventAmountToCurrencyString\(\(props\.prize\?\.value \?\? 0\) \* 100\)/,
	'Flat Duck prizes must use the active currency',
);
assert.match(
	duckSpineSource,
	/stripEmptyCurrencyDecimals\(formattedCurrencyLabel\)/,
	'Duck butt values must hide empty decimal suffixes',
);
assert.doesNotMatch(duckSpineSource, /`\+\$\{/, 'Duck butt values must not show a plus prefix');
assert.match(
	duckSpineSource,
	/previousLabelLength[\s\S]*Math\.round\(Math\.max\(18, Math\.min\(42, 180 \/ previousLabelLength\)\) \* 1\.3\)/,
	'Duck butt values must render 30 percent larger',
);
assert.doesNotMatch(
	duckSpineSource,
	/props\.prize\?\.value \?\? 0\}x/,
	'Flat Duck additions must never be labelled as multipliers',
);
assert.match(duckSpineSource, /text="ALL"/, 'Multiply-all ducks need an ALL discriminator');

const duckCollectSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'DuckCollectPresenter.svelte'),
	'utf8',
);
assert.match(
	duckCollectSource,
	/stripEmptyCurrencyDecimals\(bookEventAmountToCurrencyString\(runningTotal\)\)/,
	'Duck Collect total must hide empty decimal suffixes',
);
assert.doesNotMatch(
	duckCollectSource,
	/DuckPondDuck/,
	'Duck Collect presenter must not remount Board-owned duck Spine instances',
);
assert.match(
	duckCollectSource,
	/<NeonPlaque key="bonusBannerPlate"/,
	'Duck Collect banner must use the sliced neon plate, not a Forest Gang plaque',
);
assert.match(
	duckCollectSource,
	/duckCollectRevealComplete/,
	'Duck Collect presenter must handle Board Spine completion',
);
assert.match(
	duckCollectSource,
	/await waitForResolve/,
	'Duck Collect playback must block until Board reports Spine completion',
);
assert.match(
	duckCollectSource,
	/skipAllowedAt = performance\.now\(\) \+ 140/,
	'Duck Collect must not skip its turn from the initiating click',
);
assert.match(
	duckCollectSource,
	/stateBet\.isTurbo \|\| stateBet\.isSuperTurbo[\s\S]*?startBatchReveal\(\)/,
	'Fast and turbo Duck Collect must start one synchronized batch',
);
assert.match(
	duckCollectSource,
	/context\.stateGame\.duckRevealPositions = positions\.filter/,
	'Duck Collect skip must turn every unturned landed duck together',
);
assert.match(
	duckCollectSource,
	/event\.code !== 'Space' \|\| !show \|\| batchStarted/,
	'Duck Collect feature spin must accept a Space skip before individual reveals',
);
assert.match(
	duckCollectSource,
	/if \(!show \|\| batchStarted\) return;[\s\S]*?startBatchReveal\(\)/,
	'Duck Collect feature spin must accept click-to-batch skip',
);
assert.doesNotMatch(
	duckCollectSource,
	/duckPresent|AnimatedSprite|PRESENT_MS/,
	'Duck Collect must not use the old gift reveal',
);

const boardSource = fs.readFileSync(path.join(root, 'src', 'components', 'Board.svelte'), 'utf8');
assert.match(
	boardSource,
	/import DuckPondDuck from '\.\/DuckPondDuck\.svelte'/,
	'Board must own Duck Collect Spine instances',
);
assert.match(
	boardSource,
	/rawSymbol\.name === 'DC'/,
	'Board must route Duck Collect symbols through the persistent duck component',
);
assert.match(
	boardSource,
	/<DuckPondDuck/,
	'Board must render persistent Duck Collect duck components',
);
assert.match(
	boardSource,
	/duckVariantForPosition/,
	'Board and Duck Collect must share stable pond variants by reel cell',
);
assert.match(
	boardSource,
	/duckLookForPosition\(position, duckStyleSeed\(reelSymbol\.rawSymbol\)\)/,
	'Board Duck symbols must use the reveal-event seed for stable accessory looks',
);
assert.match(
	boardSource,
	/if \(name === 'S_DUCK'\) return getSpecialSymbolKey\('duckScatter', layoutType\)/,
	'Board must route Duck Your Luck scatters through the bonus-buy symbol art',
);
assert.doesNotMatch(
	boardSource,
	/LoopingSpineSprite/,
	'Duck Your Luck scatter must not be replaced by the collect-duck Spine',
);
assert.doesNotMatch(boardSource, /directPrefix=/, 'Duck labels must own their currency semantics');
assert.match(boardSource, /onrevealcomplete=/, 'Board-owned ducks must report Spine completion');
assert.match(
	boardSource,
	/type: 'duckCollectRevealComplete'/,
	'Board-owned ducks must emit Duck Collect reveal completion',
);
assert.doesNotMatch(
	boardSource,
	/revealedDuckCollectCellSet|underDuckCollect/,
	'Board must not hide and remount Duck Collect ducks during reveal',
);

const duckBookHandlerSource = fs.readFileSync(
	path.join(root, 'src', 'game', 'bookEventHandlerMap.ts'),
	'utf8',
);
const duckStartHandler = duckBookHandlerSource.slice(
	duckBookHandlerSource.indexOf('duckPickStart: async'),
	duckBookHandlerSource.indexOf(
		'duckPick: async',
		duckBookHandlerSource.indexOf('duckPickStart: async'),
	),
);
assert.match(
	duckStartHandler,
	/duckTriggerPositionsFromBoard\(\)/,
	'Legacy Duck books must recover visible trigger positions from Board',
);
assert.match(
	duckStartHandler,
	/type: 'boardWithAnimateSymbols'/,
	'Duck Your Luck must visibly celebrate its landed trigger symbols',
);
assert.match(
	duckStartHandler,
	/title: 'DUCK YOUR LUCK'[\s\S]*countLabel: 'DUCK PICKS'/,
	'Duck Your Luck must use the standard congratulations modal with pick copy',
);
assert.match(
	duckStartHandler,
	/type: 'transition'/,
	'Duck pond must open under the scene transition',
);
assert.ok(
	duckStartHandler.indexOf("type: 'boardWithAnimateSymbols'") <
		duckStartHandler.indexOf("type: 'freeSpinIntroShow'") &&
		duckStartHandler.indexOf("type: 'freeSpinIntroShow'") <
			duckStartHandler.indexOf("type: 'transition'") &&
		duckStartHandler.indexOf("type: 'transition'") <
			duckStartHandler.indexOf('stateGame.duckPicks ='),
	'Duck trigger, modal, transition, and pond must play in order',
);
assert.match(
	boardSource,
	/duckFrontAssetKeyForPosition/,
	'Duck feature fallback must use the matching pond front variant',
);
assert.match(
	boardSource,
	/isInitialRollerTriggerCell[\s\S]*return getSpecialSymbolKey\('megaWild', layoutType\)/,
	'Each landed Roller trigger must remain the Mega Wild symbol',
);
assert.doesNotMatch(
	boardSource,
	/assetKey: 'rollerWildCarSpine'/,
	'Carts belong to the synchronized overlay, not individual landed symbols',
);

const assetsSource = fs.readFileSync(path.join(root, 'src', 'game', 'assets.ts'), 'utf8');
assert.match(assetsSource, /duckPondTurn:/, 'Duck turn Spine must be registered');
assert.doesNotMatch(assetsSource, /duckPresentSpine:/, 'Old duck present Spine must not load');
assert.match(
	assetsSource,
	/duck-your-luck-desktop\.png[\s\S]*duck-your-luck-mobile\.png[\s\S]*duck-your-luck-mobile-landscape\.png/,
	'Duck Your Luck scatter must reuse every responsive bonus-buy asset',
);

const gameUtilsSource = fs.readFileSync(path.join(root, 'src', 'game', 'utils.ts'), 'utf8');
assert.match(
	gameUtilsSource,
	/duckScatter: \{[\s\S]*desktop: 'tpDuckScatterDesktop',[\s\S]*portrait: 'tpDuckScatterMobile',[\s\S]*landscape: 'tpDuckScatterLandscape'/,
	'Duck scatter routing must select the matching bonus-buy art for each layout',
);
assert.match(
	duckBookHandlerSource,
	/\? \{ \.\.\.symbol, duckStyleSeed: bookEvent\.index \}/,
	'Duck reel symbols must retain their reveal event index while rolling out',
);
assert.match(
	duckStartHandler,
	/seed: bookEvent\.index/,
	'Duck pond style selection must use the Duck start event index',
);

const hudSource = fs.readFileSync(path.join(root, 'src', 'components', 'HudHtml.svelte'), 'utf8');
assert.match(
	hudSource,
	/node\.style\.removeProperty\('font-size'\)[\s\S]*node\.style\.fontSize =/,
	'Long HUD values must shrink their real font size so flex layout cannot overflow',
);
assert.doesNotMatch(
	hudSource,
	/node\.style\.transform =/,
	'HUD number fitting must not use paint-only transforms',
);
assert.match(
	hudSource,
	/\.value-pill--balance \{[\s\S]*width: calc\(var\(--hud-u\) \* 130\.333\);[\s\S]*overflow: hidden;/,
	'Balance layout must remain fixed while its digits shrink',
);

const constantsSource = fs.readFileSync(path.join(root, 'src', 'game', 'constants.ts'), 'utf8');
assert.match(
	constantsSource,
	/DC: states\('tpDuckScatterDesktop', 'tpDuckScatterDesktop'\)/,
	'Generic Duck Collect symbol routing must fall back to pond duck art',
);
assert.match(
	constantsSource,
	/BOARD_SIDE_CONTENT_INSET = 18[\s\S]*COASTER_WILD_GRID_INSET = 2\.5[\s\S]*getBoardCellCenterX[\s\S]*BOARD_SIDE_CONTENT_INSET \* 0\.5/,
	'Outer reels must reserve wider side rails and shift inward by half that reserve',
);

const duckSpine = JSON.parse(
	fs.readFileSync(path.join(root, 'static', 'assets', 'spines', 'duckTurn', 'duck_turn.json')),
);
const duckBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'build-duck-turn-spine.py'),
	'utf8',
);
const duckAccessoryBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'build-duck-accessories.py'),
	'utf8',
);
const duckAtlasPng = fs.readFileSync(
	path.join(root, 'static', 'assets', 'spines', 'duckTurn', 'duck_turn.png'),
);
const duckAtlasWidth = duckAtlasPng.readUInt32BE(16);
const duckAtlasHeight = duckAtlasPng.readUInt32BE(20);
const duckPoseTimes = Array.from({ length: 64 }, (_, pose) =>
	Number(((pose * 0.12639) / 63).toFixed(5)),
);
assert.equal(duckSpine.skeleton.spine, '4.2.0', 'Duck rig Spine version');
assert.equal(
	duckSpine.skeleton.hash,
	'duck-your-luck-turn-v18-correct-temple-wide-rear',
	'Duck 2.5D rig version',
);
assert.match(
	duckBuilderSource,
	/SOURCE_POSE_COUNT = 32[\s\S]*POSE_COUNT = 64[\s\S]*minterpolate=fps=2:mi_mode=mci:mc_mode=aobmc:/,
	'Duck turn must motion-interpolate 32 authored poses into 64 smooth frames',
);
assert.match(
	duckBuilderSource,
	/TURN_SPEED_BOOST = 2\.16[\s\S]*TURN_DURATION = turn_time\(0\.312\)/,
	'Duck turn must run at 80 percent of its previous speed without changing its 64-frame pose count',
);
assert.match(
	duckBuilderSource,
	/ACCESSORY_COLOR_COUNT = len\(HAT_SOURCES\)[\s\S]*DUCK_LOOK_COUNT = 1 \+ ACCESSORY_COLOR_COUNT \* 2 \+ ACCESSORY_COLOR_COUNT\*\*2/,
	'Duck looks must cover standard, four approved glasses, four approved hats, and independent combinations',
);
assert.match(
	duckBuilderSource,
	/HAT_SOURCES = \[SOURCE_DIR \/ f"party_hat_combo_\{index\}\.png"[\s\S]*GLASSES_SOURCES = \[SOURCE_DIR \/ f"sunglasses_combo_\{index\}\.png"[\s\S]*GLASSES_FRONT_SOURCES = \[[\s\S]*sunglasses_front_combo_[\s\S]*GLASSES_REAR_SOURCES = \[[\s\S]*sunglasses_rear_combo_[\s\S]*"hat_bone"[\s\S]*"glasses_bone"[\s\S]*"glasses_rear_bone"/,
	'Duck accessories must be authored assets animated by Spine bones',
);
assert.doesNotMatch(
	duckBuilderSource,
	/build_hat_overlay|build_glasses_overlay|accessory_canvas/,
	'Duck accessories must not be raster-drawn per pose',
);
assert.match(
	duckBuilderSource,
	/HAT_BASE_HEIGHT = 86[\s\S]*HAT_SCALE_X = 1\.50[\s\S]*HAT_SCALE_Y = 1\.50[\s\S]*GLASSES_BASE_WIDTH = 145[\s\S]*GLASSES_BASE_HEIGHT = 52[\s\S]*GLASSES_CENTER_OFFSET_X = 31[\s\S]*GLASSES_SCALE_X = 1\.20[\s\S]*GLASSES_SCALE_Y = 1\.20[\s\S]*GLASSES_PERSPECTIVE_REDUCTION = 80[\s\S]*GLASSES_REAR_BASE_WIDTH = 148[\s\S]*GLASSES_REAR_BASE_HEIGHT = 34[\s\S]*GLASSES_REAR_SHOW_POSE = 48/,
	'Duck hats must fit the head and glasses must swap from depth split to rear view',
);
assert.match(
	duckAccessoryBuilderSource,
	/GLASSES_FAR_TEMPLE_POLYGON =[\s\S]*GLASSES_REAR_ARM_SPREAD = 18[\s\S]*ImageDraw\.Draw\(mask\)\.polygon[\s\S]*def spread_rear_arms/,
	'Duck glasses must hide the far front-view temple and spread rear arms outside the head',
);
assert.doesNotMatch(
	duckAccessoryBuilderSource,
	/GLASSES_FRONT_CUT_X/,
	'Duck glasses must not hide the long near-side temple',
);
assert.match(
	duckBuilderSource,
	/1: \{"hue": None, "star": True, "striped": False[\s\S]*2: \{"hue": 77, "star": False, "striped": True[\s\S]*3: \{"hue": 238, "star": True, "striped": True/,
	'Duck rings must include star-only, stripe-only, and combined decoration',
);
assert.match(
	duckBuilderSource,
	/depth_overlap = 2[\s\S]*if y < boundary \+ depth_overlap:[\s\S]*if y >= boundary - depth_overlap:/,
	'Duck ring depth layers must overlap so filtering cannot reveal moving hairlines',
);
assert.ok(duckAtlasWidth <= 2048, 'Duck atlas must fit mobile texture-width limits');
assert.ok(duckAtlasHeight <= 4096, 'Duck atlas must fit mobile texture-height limits');
assert.ok(
	duckAtlasWidth * duckAtlasHeight < 8_000_000,
	'Duck atlas must trim the 64 Duck frames and sixteen Spine accessory layers',
);
assert.match(
	duckBuilderSource,
	/if pose_index == 0:\s+pose = pose\.transpose\(Image\.Transpose\.FLIP_LEFT_RIGHT\)/,
	'Duck turn must preserve its current mirrored opening frame, then follow the short-side direction',
);
assert.equal(
	(duckBuilderSource.match(/pose = pose\.transpose\(Image\.Transpose\.FLIP_LEFT_RIGHT\)/g) ?? [])
		.length,
	1,
	'Duck turn must not mirror the remaining authored perspective frames',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.ring_back).length,
	8,
	'Duck rear ring arcs',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.ring_front).length,
	8,
	'Duck front ring arcs',
);
assert.deepEqual(
	Object.keys(duckSpine.skins[0].attachments.duck_pose),
	Array.from({ length: 64 }, (_, pose) => `pose_${pose}`),
	'Duck perspective frames',
);
assert.deepEqual(
	duckSpine.slots.map(({ name }) => name),
	[
		'ring_back',
		'glasses_back',
		'duck_pose',
		'hat',
		'glasses_front',
		'glasses_rear',
		'ring_front',
		'prize',
	],
	'Duck non-blinking depth slots',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.hat).length,
	4,
	'Four party-hat Spine variants',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.glasses_back).length,
	4,
	'Four behind-head sunglasses variants',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.glasses_front).length,
	4,
	'Four front-frame sunglasses variants',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.glasses_rear).length,
	4,
	'Four rear-view sunglasses variants',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.hat.hat_0,
	{ path: 'party_hat_0', width: 88, height: 149 },
	'Party hats must use approved tall glossy combination assets',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.glasses_back.glasses_back_3,
	{ path: 'sunglasses_3', width: 153, height: 60 },
	'Sunglasses back layer must use the complete approved glossy model',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.glasses_front.glasses_front_3,
	{ path: 'sunglasses_front_3', width: 153, height: 60 },
	'Sunglasses front layer must restore only the face-visible frame',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.glasses_rear.glasses_rear_3,
	{ path: 'sunglasses_rear_3', width: 174, height: 42 },
	'Sunglasses rear layer must remain fitted after the turn',
);

const duckSlotNames = duckSpine.slots.map(({ name }) => name);
assert.ok(
	duckSlotNames.indexOf('glasses_back') < duckSlotNames.indexOf('duck_pose'),
	'Sunglasses temple/back layer must render behind the Duck',
);
assert.ok(
	duckSlotNames.indexOf('glasses_front') > duckSlotNames.indexOf('duck_pose'),
	'Sunglasses lenses must render in front of the Duck',
);
assert.ok(
	duckSlotNames.indexOf('glasses_rear') > duckSlotNames.indexOf('duck_pose'),
	'Rear-view temple arms must remain visible on the turned Duck',
);
assert.equal(
	duckSpine.animations.look_back_idle_1.slots.glasses_rear.attachment[0].name,
	'glasses_rear_0',
	'Sunglasses must remain visible in back idle',
);
for (let variant = 1; variant <= 8; variant += 1) {
	for (const phase of ['idle', 'turn', 'back_idle']) {
		assert.ok(duckSpine.animations[`${phase}_${variant}`], `missing duck ${phase}_${variant}`);
	}
	const turn = duckSpine.animations[`turn_${variant}`];
	assert.deepEqual(
		duckSpine.animations[`turn_batch_${variant}`],
		turn,
		`duck ${variant} synchronized batch restart alias`,
	);
	assert.equal(turn.slots.ring_back.attachment[0].name, `ring_back_${variant}`);
	assert.equal(turn.slots.ring_front.attachment[0].name, `ring_front_${variant}`);
	assert.deepEqual(
		turn.slots.duck_pose.attachment.map(({ name }) => name),
		Array.from({ length: 64 }, (_, pose) => `pose_${pose}`),
		`duck ${variant} frame sequence`,
	);
	assert.deepEqual(
		turn.slots.duck_pose.attachment.map(({ time }) => time),
		duckPoseTimes,
		`duck ${variant} fast frame cadence`,
	);
	assert.equal('alpha' in turn.slots.duck_pose, false, `duck ${variant} has no alpha blink`);
	assert.equal(turn.slots.duck_pose.attachment.at(-1).name, 'pose_63', `duck ${variant} rear pose`);
	assert.deepEqual(
		turn.slots.prize.attachment.at(-1),
		{ time: 0.12639, name: 'prize_socket' },
		`duck ${variant} prize timing`,
	);
	assert.equal(turn.bones.duck.scale.at(-1).time, 0.14444, `duck ${variant} fast turn duration`);
	assert.equal(
		Math.max(...turn.bones.float.translate.map(({ y }) => y)),
		36,
		`duck ${variant} jump height`,
	);
	assert.ok(turn.bones.ring.scale.length > 2, `duck ${variant} independent ring squash`);
	for (const timelines of Object.values(turn.bones)) {
		for (const type of ['translate', 'scale']) {
			const keys = timelines[type] ?? [];
			for (let index = 0; index < keys.length - 1; index += 1) {
				const key = keys[index];
				if (!Array.isArray(key.curve)) continue;
				const next = keys[index + 1];
				assert.equal(key.curve.length, 8, `duck ${variant} ${type} bezier size`);
				for (const controlTime of [key.curve[0], key.curve[2], key.curve[4], key.curve[6]]) {
					assert.ok(
						controlTime > key.time && controlTime < next.time,
						`duck ${variant} ${type} bezier uses absolute time`,
					);
				}
				assert.equal(key.curve[1], key.x, `duck ${variant} ${type} x start`);
				assert.equal(key.curve[3], next.x, `duck ${variant} ${type} x end`);
				assert.equal(key.curve[5], key.y, `duck ${variant} ${type} y start`);
				assert.equal(key.curve[7], next.y, `duck ${variant} ${type} y end`);
			}
		}
		const rotateKeys = timelines.rotate ?? [];
		for (let index = 0; index < rotateKeys.length - 1; index += 1) {
			const key = rotateKeys[index];
			if (!Array.isArray(key.curve)) continue;
			const next = rotateKeys[index + 1];
			assert.equal(key.curve.length, 4, `duck ${variant} rotate bezier size`);
			assert.ok(key.curve[0] > key.time && key.curve[0] < next.time);
			assert.ok(key.curve[2] > key.time && key.curve[2] < next.time);
			assert.equal(key.curve[1], key.value, `duck ${variant} rotate start`);
			assert.equal(key.curve[3], next.value, `duck ${variant} rotate end`);
		}
	}
}
for (let look = 0; look < 25; look += 1) {
	for (const phase of ['idle', 'turn', 'turn_batch', 'back_idle']) {
		assert.ok(duckSpine.animations[`look_${phase}_${look}`], `missing Duck look ${phase}_${look}`);
	}
	assert.deepEqual(
		duckSpine.animations[`look_turn_batch_${look}`],
		duckSpine.animations[`look_turn_${look}`],
		`Duck look ${look} synchronized batch restart alias`,
	);
}

const gameSource = fs.readFileSync(path.join(root, 'src', 'components', 'Game.svelte'), 'utf8');
assert.ok(
	gameSource.indexOf('<DuckPondBonus />') > gameSource.indexOf('<App') &&
		gameSource.indexOf('<DuckPondBonus />') < gameSource.indexOf('</App>'),
	'Duck picker must render inside the Pixi reel stage',
);
assert.doesNotMatch(
	gameSource,
	/COASTER_LOOP_PREVIEW|Temporary QA view|top-left-loop-preview/,
	'Mega Coaster temporary top-left QA duck must not ship',
);

const rollerOverlaySource = fs.readFileSync(
	path.join(root, 'src', 'components', 'RollerWildsOverlay.svelte'),
	'utf8',
);
const rollerMultiplierCellSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'RollerMultiplierCell.svelte'),
	'utf8',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/key="tpCoasterWild"/,
	'Roller overlay must use the Mega Wild feature symbol, not the Coaster Wild',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/key="magneticWildLightning"/,
	'Roller landing must not use the Magnetic lightning animation',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/getSpecialSymbolKey\('megaWild', layoutType\)/,
	'Filled Roller rows must remain multiplier-only after the car passes',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/forestBonusBadge/,
	'Cart-filled Roller cells must use multiplier text without plaques',
);
assert.match(
	rollerOverlaySource,
	/\{#each \[-0\.34, 0\.34\] as railOffset/,
	'Roller animation must draw two rails per reel',
);
assert.match(
	rollerOverlaySource,
	/\{#if phase === 'ready' \|\| phase === 'dropping'\}[\s\S]*key="rollerWildRail"/,
	'Roller rails must disappear as soon as the carts leave',
);
assert.match(
	rollerOverlaySource,
	/<Graphics isMask draw=\{drawBoardContentMask\} \/>/,
	'Roller carts and multiplier symbols must use the bulb-safe board mask',
);
assert.match(
	rollerOverlaySource,
	/for \(let reel = 0; reel < BOARD_DIMENSIONS\.x; reel \+= 1\)[\s\S]*for \(const row of ROWS\)/,
	'Roller board mask must cut content into cells instead of painting a second grid',
);
assert.match(
	rollerOverlaySource,
	/<Graphics isMask draw=\{drawReelMask\(roller\.reel\)\} \/>/,
	'Each Roller cart and rail pair must be clipped to its own reel',
);
assert.match(
	rollerOverlaySource,
	/CELL_W - leftInset - rightInset/,
	'Roller cart masks must preserve the vertical grid-line clearance',
);
assert.match(
	rollerOverlaySource,
	/SYMBOL_H - topInset - bottomInset/,
	'Roller carts must leave every horizontal board divider unobstructed',
);
assert.match(
	rollerOverlaySource,
	/FRAME_LIGHT_CLEARANCE_X = 31[\s\S]*FRAME_LIGHT_CLEARANCE_Y = 16/,
	'Roller carts must reserve the full outer bulb halo on every board edge',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/drawForegroundGrid|stroke\(\{ color: 0xe3a331/,
	'Roller overlay must not paint a secondary grid',
);
assert.match(
	rollerMultiplierCellSource,
	/const GRID_LINE_INSET = 1\.4;/,
	'Roller multiplier masks must preserve every grid line',
);
assert.match(
	rollerMultiplierCellSource,
	/<Graphics[\s\S]*isMask[\s\S]*contentOffsetY/,
	'Roller multiplier motion must remain inside one fixed cell mask',
);
assert.equal(
	(rollerOverlaySource.match(/<CoasterWildBackground/g) ?? []).length,
	2,
	'Passed and final Roller cells must use opaque cell covers',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/coverTopEdge|coverBottomEdge/,
	'Roller cell covers must not paint across authored grid dividers',
);
assert.doesNotMatch(
	gameSource,
	/BoardGridOverlay/,
	'Game must use only the authored BoardFrame grid',
);
assert.match(
	boardSource,
	/const drawBoardContentMask =[\s\S]*reel === 0 \? BOARD_SIDE_CONTENT_INSET : GRID_LINE_CLEARANCE[\s\S]*CELL_W - leftInset - rightInset[\s\S]*<Graphics isMask draw=\{drawBoardContentMask\} \/>/,
	'Board symbols must be clipped away from the authored grid and side edges',
);
assert.match(
	rollerOverlaySource,
	/fallbackKey="rollerWildCarStill"/,
	'Roller Spine fallback must use the matching car frame',
);
assert.match(rollerOverlaySource, /let carYs =/, 'Each Roller car needs an independent Y tween');
assert.match(
	rollerOverlaySource,
	/event\.reels\.map\(\(\{ reel \}\) => \[reel, new Tween\(CAR_START_Y\)\]\)/,
	'Every Roller cart must spawn from the same top position',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/new Tween\(cellY\(triggerRow\)\)|CAR_STATION_Y/,
	'Cart starting positions must not depend on trigger rows',
);
assert.match(
	rollerOverlaySource,
	/const descents = event\.reels\.map\([\s\S]*carYs\[reel\]\.set\(CAR_END_Y/,
	'All Roller carts must begin their synchronized descent together',
);
assert.match(
	rollerOverlaySource,
	/const ROWS = Array\.from\(\{ length: BOARD_DIMENSIONS\.y \}, \(_, row\) => row\)/,
	'Roller animation must cover every transformed row',
);
assert.match(
	rollerOverlaySource,
	/for \(const row of ROWS\)[\s\S]*event\.reels\.map\(\(\{ reel \}\) => `\$\{reel\},\$\{row\}`\)/,
	'Each cart pass must clear the same row on every affected reel',
);
assert.match(
	rollerOverlaySource,
	/contributionFor\(roller, row\)/,
	'Every passed symbol must become a visible multiplier contribution',
);
assert.match(
	rollerOverlaySource,
	/return explicit \?\? 1;/,
	'Empty Roller rows must display neutral 1X values',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/return 0;/,
	'Roller rows must never display destructive 0X values',
);
assert.match(
	rollerOverlaySource,
	/showFinalPresentation\(\)/,
	'Roller skip must fast-forward to a fully covered final presentation',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/totalAlpha\.set\(0/,
	'Combined reel totals must remain visible through the persistent-state handoff',
);
assert.ok(
	(rollerOverlaySource.match(/loop=\{false\}/g) ?? []).length >= 1,
	'The selected Roller ride clip must be non-cyclic',
);
assert.match(
	rollerOverlaySource,
	/const RIDE_CLIP_MS = 480;[\s\S]*const CART_READY_MS = 180;[\s\S]*const CAR_DESCENT_MS = 650;/,
	'The 48-frame Roller ride must complete faster than the previous animation',
);
assert.match(
	rollerOverlaySource,
	/Promise\.all\(\[[\s\S]*combineTweens\[reel\]\.set\(1/,
	'All reel contributions must sum in parallel',
);
assert.match(
	rollerOverlaySource,
	/const SPREAD_ORDER = \[2, 1, 3, 0, 4\][\s\S]*for \(const row of SPREAD_ORDER\)/,
	'Summed reel values must spread from the center across all five rows',
);
assert.match(
	rollerOverlaySource,
	/finalizedRows[\s\S]*text=\{`\$\{roller\.multiplier\}X`\}/,
	'Every final Roller cell must show the summed multiplier',
);
assert.doesNotMatch(
	rollerOverlaySource.slice(rollerOverlaySource.indexOf('<!-- Final state:')),
	/megaWildKey|key=\{megaWildKey\}/,
	'Final Roller cells must not put Mega Wild symbols behind their multipliers',
);

const persistentWildSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'PersistentWildBadges.svelte'),
	'utf8',
);
assert.match(
	persistentWildSource,
	/<CoasterWildTile[\s\S]*multiplier=\{tile\.multiplier\}/,
	'Persistent Coaster Wilds must use the shared exact-size presentation',
);
assert.match(
	boardSource,
	/!coasterCellSet\.has\(`\$\{reelIndex\},\$\{symbolIndex - 1\}`\)/,
	'Persistent Coaster Wild cells must have one render owner during payline dimming',
);
assert.doesNotMatch(
	persistentWildSource,
	/forestBonusBadge/,
	'Persistent Wilds must not use old forest plaques',
);
assert.doesNotMatch(
	persistentWildSource,
	/activeRollerReels|rollerReels|RollerMultiplierText|megaWildKey/,
	'Fixed-screen persistence must not own Roller results',
);
assert.match(
	boardSource,
	/isRollerMultiplierCell[\s\S]*Boolean\(rawSymbol\.reelMultiplier\)[\s\S]*contentScale=\{0\.9 \* \(isWin \? winPulse : 1\)\}[\s\S]*reelMultiplier\}X/,
	'The moving Board symbol must own settled Roller multiplier plaques',
);
assert.doesNotMatch(
	boardSource,
	/isRollerMultiplierCell[\s\S]{0,300}activeRollerReels|isRollerMultiplierCell[\s\S]{0,300}rollerReelSet/,
	'Roller plaques must survive active metadata clearing so they roll out unchanged',
);

const bookHandlerSource = fs.readFileSync(
	path.join(root, 'src', 'game', 'bookEventHandlerMap.ts'),
	'utf8',
);
assert.match(
	bookHandlerSource,
	/Array\.isArray\(entry\.multipliers\)/,
	'Explicit empty Roller multiplier arrays must remain empty',
);
assert.match(
	bookHandlerSource,
	/const triggerPositions = reels\.map[\s\S]*type: 'boardWithAnimateSymbols'[\s\S]*await waitForTimeout\(380\)[\s\S]*symbol\.symbolState = 'static'[\s\S]*type: 'rollerWildsShow'/,
	'Every landed Mega Wild must pop before its synchronized cart animation starts',
);
assert.doesNotMatch(
	bookHandlerSource,
	/reelMultiplier: roller\.multiplier,[\s\S]{0,80}rollerTrigger: true/,
	'Settled full-reel Wilds must not masquerade as five new trigger cars',
);
assert.match(
	bookHandlerSource,
	/await tick\(\);[\s\S]{0,100}rollerWildsHide/,
	'Moving Roller plaque symbols must mount before the animation overlay is removed',
);

const coasterPresenterSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'CoasterSetupPresenter.svelte'),
	'utf8',
);
assert.match(
	coasterPresenterSource,
	/const MIN_CART_GAP_UNITS = 1\.35;[\s\S]*const CART_GAP_VARIANCE_UNITS = 0\.35;[\s\S]*return impacts\.map\(\(impact, lane\) =>[\s\S]*launchDelayUnits \+= MIN_CART_GAP_UNITS \+ Math\.random\(\) \* CART_GAP_VARIANCE_UNITS[\s\S]*return \{ row, launchDelayUnits, impact \}/,
	'Mega Coaster must spawn one duck per puke with a safe randomized minimum gap',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/MIN_CARTS_PER_LINE|groupsByReel|impactGroups|Math\.max\([^\n]*impacts\.length/,
	'Mega Coaster must not merge repeat hits or add empty decorative carts',
);
assert.match(
	coasterPresenterSource,
	/tilesMap = \{ \.\.\.tilesMap, \[key\]: impact\.multiplier \}/,
	'Mega Coaster must reveal exactly one multiplier step per duck impact',
);
assert.match(
	coasterPresenterSource,
	/const impactAt = durationForDistance\(startX, cellX\(route\.impact\.reel\), timing\);[\s\S]*waitForRouteTime\(startedAt, vomitStartAt, run\)[\s\S]*cart\.state = 'vomit';[\s\S]*waitForRouteTime\(startedAt, impactAt, run\)[\s\S]*pulseWild\(route\.impact, run, timing\)[\s\S]*waitForRouteTime\(startedAt, vomitEndAt, run\)[\s\S]*cart\.state = 'happy'/,
	'Mega Coaster ducks must execute one allocation-free vomit sequence',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/impactsByReel|routeEvents|eventOrder|hasVomited|vomitRun|pulseGap/,
	'Mega Coaster one-impact routes must not allocate multi-impact routing state',
);
assert.match(
	coasterPresenterSource,
	/\{#each ROWS as row \(row\)\}[\s\S]*key="coasterTrack"[\s\S]*width=\{trackWidth\}/,
	'Mega Coaster must draw one screen-wide rail per board row',
);
assert.match(
	coasterPresenterSource,
	/key="coasterTrack"[\s\S]*zIndex=\{20\}[\s\S]*zIndex=\{10\}/,
	'Mega Coaster rails must render above the wild multiplier tiles',
);
assert.match(
	coasterPresenterSource,
	/mainLayout\.width[\s\S]*direction === 1 \? trackRight : trackLeft/,
	'Mega Coaster carts must enter and exit beyond the screen edges',
);
assert.match(
	coasterPresenterSource,
	/row % 2 === 0 \? 1 : -1[\s\S]*scale=\{\{ x: cart\.direction, y: 1 \}\}/,
	'Mega Coaster rows must alternate direction and mirror their ducks',
);
assert.match(
	coasterPresenterSource,
	/assetKey="coasterVomitSpine"[\s\S]*animationName=\{cart\.state === 'vomit' \? 'vomit' : 'idle'\}[\s\S]*timeScale=\{cart\.state === 'vomit' \? cart\.vomitTimeScale : 0\}[\s\S]*loop=\{true\}/,
	'Mega Coaster must use one layered Spine rig and freeze static idle timelines',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/key="coasterCartFixed"|coasterDuckVomitSpine/,
	'Mega Coaster must not assemble the cart and duck as separate runtime objects',
);
assert.match(
	coasterPresenterSource,
	/stateBet\.isSuperTurbo \? 0\.2 : stateBet\.isTurbo \? 0\.42 : 1/,
	'Mega Coaster fast and turbo playback must be materially faster than base',
);
assert.match(
	coasterPresenterSource,
	/Initial setup reveal only[\s\S]*Free-spin reel timing is owned elsewhere and remains unchanged[\s\S]*const SETUP_SPEED_BOOST = 1\.69;[\s\S]*const SEQUENCE_SPEED = 0\.9 \* SETUP_SPEED_BOOST;[\s\S]*const DUCK_PLAYBACK_SPEED = 4\.5 \* SETUP_SPEED_BOOST;[\s\S]*const VOMIT_CLIP_MS = Math\.round\(VOMIT_SOURCE_MS \/ DUCK_PLAYBACK_SPEED\);[\s\S]*duration: durationForDistance\(startX, endX, timing\)/,
	'Mega Coaster initial setup must run another 1.3-times faster at every speed level without changing spins',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/x: cellX\(reel\)/,
	'Mega Coaster carts must not brake and restart at each reel',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/decorativeVomitReel/,
	'Mega Coaster ducks must not vomit without an authored symbol impact',
);
assert.match(
	coasterPresenterSource,
	/skipAllowedAt = performance\.now\(\) \+ 140;/,
	'Mega Coaster setup skip must ignore the initiating click',
);
assert.match(
	coasterPresenterSource,
	/Promise\.race\(\[task\.then\(\(\) => true\), skipSignal\.then\(\(\) => false\)\]\)/,
	'Mega Coaster setup must race its animation against click and Space skip',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/followRailBend|trackCells|coasterCarVomitAnim/,
	'Mega Coaster must not use the old serpentine route or WebM vomit',
);

const coasterWildTextSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'CoasterWildTile.svelte'),
	'utf8',
);
assert.match(
	coasterWildTextSource,
	/multiplierFill = new FillGradient[\s\S]*0xfff7a0[\s\S]*0xffe607[\s\S]*0xdf9700[\s\S]*<Text[\s\S]*fontFamily: 'Cinzel'[\s\S]*fill: multiplierFill[\s\S]*stroke: \{ color: 0x4d1d00[\s\S]*color: 0x062900/,
	'Mega Coaster multipliers must match the Wild art gold bevel, brown keyline, and green shadow',
);
assert.doesNotMatch(
	coasterWildTextSource,
	/<BitmapText/,
	'Mega Coaster Wild multiplier outline requires a stroked Text instance',
);

const coasterSpine = JSON.parse(
	fs.readFileSync(
		path.join(root, 'static', 'assets', 'spines', 'coasterVomit', 'coaster_vomit.json'),
	),
);
assert.equal(coasterSpine.skeleton.spine, '4.2.0', 'Mega Coaster Spine version');
assert.equal(
	coasterSpine.skeleton.hash,
	'theme-park-mega-coaster-vomit-v28-trimmed-atlas-128frame',
	'Mega Coaster Spine revision',
);
assert.deepEqual(
	Object.keys(coasterSpine.animations),
	['idle', 'vomit'],
	'Mega Coaster animation names',
);
assert.deepEqual(
	coasterSpine.slots.map(({ name }) => name),
	['cart_back', 'duck_pose', 'cart_front'],
	'Mega Coaster fixed-cart depth slots',
);
assert.deepEqual(
	Object.keys(coasterSpine.skins[0].attachments.cart_back),
	['coaster_cart_back'],
	'Mega Coaster immutable cart back attachment',
);
assert.deepEqual(
	Object.keys(coasterSpine.skins[0].attachments.cart_front),
	['coaster_cart_front'],
	'Mega Coaster immutable cart foreground attachment',
);
const coasterFrames = coasterSpine.animations.vomit.slots.duck_pose.attachment;
assert.equal(coasterFrames.slice(0, -1).length, 128, 'Mega Coaster vomit pose count');
assert.equal(
	new Set(coasterFrames.slice(0, -1).map(({ name }) => name)).size,
	128,
	'Mega Coaster vomit poses must be unique',
);
assert.equal(coasterFrames.at(-1).time, 4.5, 'Mega Coaster vomit duration');
for (const { name } of coasterFrames.slice(0, -1)) {
	assert.deepEqual(
		coasterSpine.skins[0].attachments.duck_pose[name],
		{ width: 256, height: 256 },
		`optimized Mega Coaster attachment ${name}`,
	);
}
assert.doesNotMatch(
	JSON.stringify(coasterSpine.animations.vomit),
	/rgba|handoff/,
	'Mega Coaster vomit must remain opaque without a handoff',
);
const coasterBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'build-coaster-vomit-spine.py'),
	'utf8',
);
assert.ok(
	fs.existsSync(
		path.join(
			root,
			'source-assets-unused',
			'assets',
			'theme-park',
			'coaster-vomit',
			'regenerated-16.png',
		),
	),
	'Mega Coaster regenerated 4x4 source sheet',
);
assert.ok(
	fs.existsSync(
		path.join(
			root,
			'source-assets-unused',
			'assets',
			'theme-park',
			'coaster-vomit',
			'regenerated-empty-cart.png',
		),
	),
	'Mega Coaster clean empty cart source',
);
assert.match(
	coasterBuilderSource,
	/def build_fixed_cart\([\s\S]*def build_cart_front\([\s\S]*motion_interpolate_poses\(\[\*dynamic_source_poses, dynamic_source_poses\[0\]\]\)[\s\S]*build_atlas\(poses, fixed_cart, cart_front\)/,
	'Mega Coaster must layer one immutable cart around an exact-endpoint motion-flow loop',
);
assert.match(
	coasterBuilderSource,
	/hand_core = remove_small_components_mask\([\s\S]*hand_pixels = alpha & dilate_mask\(hand_core, 3\) & hand_zone[\s\S]*def motion_interpolate_poses\([\s\S]*minterpolate=fps=7\.9375:mi_mode=mci:mc_mode=aobmc:[\s\S]*subprocess\.run\(/,
	'Mega Coaster must keep wheel-touching hands opaque and use motion-compensated in-betweens',
);
assert.doesNotMatch(
	coasterBuilderSource,
	/def alpha_interpolate_poses/,
	'Mega Coaster must not alpha-crossfade moving hands',
);
assert.doesNotMatch(
	coasterBuilderSource,
	/seat_fade/,
	'Mega Coaster duck must stay opaque where the fixed cart foreground begins',
);
assert.match(
	coasterBuilderSource,
	/steering_pixels = remove_small_components_mask\([\s\S]*steering_luma < 115[\s\S]*current\[steering_pixels\] = canonical\[steering_pixels\]/,
	'Mega Coaster must restore one fixed complete steering assembly',
);
assert.match(
	coasterBuilderSource,
	/x <= round\(FRAME_SIZE \* 0\.52\)[\s\S]*y < round\(FRAME_SIZE \* 0\.72\)/,
	'Mega Coaster duck body must reach the cockpit rim without a transparent cutout',
);
assert.match(
	coasterBuilderSource,
	/SOURCE_FRAME_COUNT = 16[\s\S]*REGENERATED_SHEET = SOURCE \/ "regenerated-16\.png"[\s\S]*EMPTY_CART_SOURCE = SOURCE \/ "regenerated-empty-cart\.png"[\s\S]*SICK_TINT_AMOUNTS = \(0\.0, 0\.1, 0\.3, 0\.55[\s\S]*def extract_regenerated_frames\(\)[\s\S]*row, col = divmod\(index, 4\)[\s\S]*def regenerated_scale\([\s\S]*def validate_regenerated_registration\([\s\S]*def apply_sick_tint\([\s\S]*sick_rgb\[:, :, 0\] \*= 0\.65[\s\S]*sick_rgb\[:, :, 1\] \*= 0\.95[\s\S]*sick_rgb\[:, :, 2\] \*= 1\.05[\s\S]*validate_regenerated_registration\(frames\)[\s\S]*normalize_pose\(frame, scale, reference_left, reference_ground\) for frame in frames[\s\S]*empty_cart = Image\.open\(EMPTY_CART_SOURCE\)[\s\S]*fixed_cart = build_fixed_cart\(normalized_cart\)[\s\S]*dynamic_source_poses = apply_sick_tint\([\s\S]*apply_dynamic_masks\(normalized_poses, source_masks\)/,
	'Mega Coaster must use one regenerated registered sheet and one global transform',
);
assert.match(
	coasterBuilderSource,
	/VERTICAL_SCALE_CORRECTION = 1\.0[\s\S]*y_scale = x_scale \* VERTICAL_SCALE_CORRECTION/,
	'Mega Coaster regenerated poses must retain their generated aspect ratio',
);
assert.doesNotMatch(
	coasterBuilderSource,
	/lock_upper_pose|stabilize_torso|STABLE_SHEETS|sheet_scales/,
	'Mega Coaster must not repair or reposition the old shaking source frames',
);
assert.match(
	coasterBuilderSource,
	/def build_fixed_cart\(empty_cart_pose: Image\.Image\)[\s\S]*return empty_cart_pose\.copy\(\)/,
	'Mega Coaster must use the clean empty cart directly without cut repairs',
);
assert.doesNotMatch(
	coasterBuilderSource,
	/seat_opening|back_seam|np\.array\(\[28, 13, 6, 255\]/,
	'Mega Coaster must never cut or paint the cockpit/hood behind the duck',
);
assert.match(
	coasterBuilderSource,
	/ATLAS_IMAGE = "coaster_vomit\.png"[\s\S]*transparent RGB zeroed/,
	'Mega Coaster atlas must preserve zeroed transparent RGB without WebP fringes',
);
assert.match(
	coasterBuilderSource,
	/ATLAS_MAX_WIDTH = 2048[\s\S]*ATLAS_TRIM_PADDING = 2[\s\S]*ATLAS_REGION_GAP = 2[\s\S]*sorted\(regions, key=lambda item: item\["crop"\]\.height, reverse=True\)[\s\S]*Mega Coaster trimmed atlas changed region/,
	'Mega Coaster atlas must trim transparent pixels and verify exact reconstruction',
);
const coasterAtlasPng = fs.readFileSync(
	path.join(root, 'static', 'assets', 'spines', 'coasterVomit', 'coaster_vomit.png'),
);
const coasterAtlasWidth = coasterAtlasPng.readUInt32BE(16);
const coasterAtlasHeight = coasterAtlasPng.readUInt32BE(20);
assert.ok(coasterAtlasWidth <= 2048, 'Mega Coaster atlas must fit mobile texture limits');
assert.ok(
	coasterAtlasWidth * coasterAtlasHeight < 3_000_000,
	'Mega Coaster atlas must not retain its former transparent 4096x2304 allocation',
);
const coasterWildTileSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'CoasterWildTile.svelte'),
	'utf8',
);
const coasterWildBackgroundSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'CoasterWildBackground.svelte'),
	'utf8',
);
assert.match(
	coasterPresenterSource,
	/<CoasterWildTile[\s\S]*\{multiplier\}/,
	'Mega Coaster setup must use the shared Wild tile',
);
assert.match(
	persistentWildSource,
	/<CoasterWildTile[\s\S]*multiplier=\{tile\.multiplier\}/,
	'Persistent Mega Coaster Wild must use the same shared tile',
);
assert.match(coasterWildTileSource, /width=\{SYMBOL_W \* 0\.82\}/, 'Mega Coaster Wild width');
assert.match(
	coasterWildTileSource,
	/scale=\{props\.contentScale \?\? 1\}/,
	'Mega Coaster win pulse must scale only the Wild art and multiplier content',
);
assert.match(
	coasterPresenterSource,
	/contentScale=\{tileScales\[key\]\?\.current \?\? 1\}/,
	'Mega Coaster setup pulse must target shared Wild content',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/scale=\{tileScales\[key\]\?\.current \?\? 1\}/,
	'Mega Coaster setup must not pulse its opaque background',
);
assert.match(
	persistentWildSource,
	/contentScale=\{cellPulse\(tile\.reel, tile\.row\)\}/,
	'Persistent Mega Coaster win pulse must target shared Wild content',
);
assert.doesNotMatch(
	persistentWildSource,
	/scale=\{cellPulse\(tile\.reel, tile\.row\)\}/,
	'Persistent Mega Coaster win pulse must not scale its opaque background',
);
assert.match(
	persistentWildSource,
	/const drawWildContentMask =[\s\S]*for \(let reel = 0; reel < BOARD_DIMENSIONS\.x; reel \+= 1\)[\s\S]*for \(let row = 0; row < BOARD_DIMENSIONS\.y; row \+= 1\)[\s\S]*<Graphics isMask draw=\{drawWildContentMask\} \/>/,
	'Persistent Mega Coaster Wilds must use cell-cut masks below the grid and side rails',
);
assert.match(
	coasterPresenterSource,
	/const drawWildContentMask =[\s\S]*for \(let reel = 0; reel < BOARD_DIMENSIONS\.x; reel \+= 1\)[\s\S]*for \(const row of ROWS\)[\s\S]*<Graphics isMask draw=\{drawWildContentMask\} \/>/,
	'Mega Coaster setup Wilds must use the same cell-cut border mask',
);
assert.doesNotMatch(
	coasterWildBackgroundSource,
	/EDGE_OVERLAP|coverTopEdge|coverBottomEdge/,
	'Mega Coaster Wild backgrounds must not cover the authored grid',
);
assert.match(
	coasterWildBackgroundSource,
	/COASTER_WILD_GRID_INSET[\s\S]*EDGE_LOCAL_INSET = BOARD_SIDE_CONTENT_INSET \* 0\.5[\s\S]*CELL_W - leftInset - rightInset[\s\S]*SYMBOL_H - COASTER_WILD_GRID_INSET \* 2/,
	'Mega Coaster Wild backgrounds must leave all grid dividers and side edges visible',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/coverTopEdge|coverBottomEdge|hasTileAt/,
	'Mega Coaster setup must not bridge adjacent Wild cells over the grid',
);
assert.doesNotMatch(
	persistentWildSource,
	/coverTopEdge|coverBottomEdge|hasTileAt/,
	'Persistent Mega Coaster Wilds must not bridge adjacent cells over the grid',
);
assert.match(
	boardSource,
	/return 'tpWildAnim'[\s\S]*width=\{SYMBOL_W \* \(isWin \? winPulse : 1\)\}/,
	'Normal Wilds must pop with other winning symbols',
);
assert.match(
	boardSource,
	/contentScale=\{0\.9 \* \(isWin \? winPulse : 1\)\}/,
	'Settled Roller Wild multiplier cells must pop on wins',
);
assert.match(
	persistentWildSource,
	/isCellWinning\(reel, row\) \? winPulse : 1[\s\S]*alpha=\{hasWinState && !isCellWinning\(tile\.reel, tile\.row\) \? 0\.35 : 1\}/,
	'Persistent Mega Coaster Wilds must pop and dim like board symbols',
);
assert.doesNotMatch(
	coasterWildBackgroundSource,
	/<Sprite|isMask/,
	'Mega Coaster Wild background must not clone and mask the full board texture',
);
const coasterAssetBlock = assetsSource.match(
	/coasterVomitSpine:\s*\{[\s\S]*?\n\t\},\n\trollerWildCarStill:/,
)?.[0];
assert.ok(coasterAssetBlock, 'Mega Coaster vomit Spine must be registered');
assert.doesNotMatch(
	coasterAssetBlock,
	/defer:\s*true/,
	'Mega Coaster vomit Spine must load before first use',
);

const rollerAssetBlock = assetsSource.match(
	/rollerWildCarSpine:\s*\{[\s\S]*?\n\t\},\n\tcoasterCarSickAnim:/,
)?.[0];
assert.ok(rollerAssetBlock, 'Roller car Spine must be registered');
assert.doesNotMatch(
	rollerAssetBlock,
	/defer:\s*true/,
	'Roller car Spine must load at startup so its timeline cannot reset mid-drop',
);
for (const assetKey of [
	'tpMegaWildDesktop',
	'tpMegaWildMobile',
	'tpMegaWildLandscape',
	'rollerWildCarStill',
]) {
	assert.match(assetsSource, new RegExp(`${assetKey}:`), `missing Roller asset key: ${assetKey}`);
}

const rollerSpine = JSON.parse(
	fs.readFileSync(
		path.join(root, 'static', 'assets', 'sprites', 'rollerCar', 'roller_car_spine.json'),
	),
);
assert.equal(rollerSpine.skeleton.spine, '4.2.0', 'Roller rig Spine version');
assert.deepEqual(
	Object.keys(rollerSpine.animations).sort(),
	['idle', 'ride'],
	'Roller rig animation names',
);
assert.equal(
	rollerSpine.skeleton.hash,
	'theme-park-roller-car-v6-frontal-to-vertical-arms-48frame-fast',
	'Roller rig revision',
);
assert.equal(
	rollerSpine.animations.ride.slots.art.attachment.at(-1).time,
	0.48,
	'Roller ride clip duration',
);
const rollerAttachments = new Set(Object.keys(rollerSpine.skins[0].attachments.art));
for (const animation of Object.values(rollerSpine.animations)) {
	for (const timeline of Object.values(animation.slots ?? {})) {
		for (const frame of timeline.attachment ?? []) {
			assert.ok(
				rollerAttachments.has(frame.name),
				`Roller animation references missing skin attachment: ${frame.name}`,
			);
		}
	}
}
const rollerFrames = rollerSpine.animations.ride.slots.art.attachment;
assert.equal(rollerFrames.length, 48, 'Roller ride must contain 48 registered perspective frames');
assert.deepEqual(
	rollerFrames.map(({ time }) => time),
	[...rollerFrames].map(({ time }) => time).sort((a, b) => a - b),
	'Roller ride frames must remain monotonic',
);
assert.equal(
	rollerAttachments.size,
	48,
	'Roller rig must expose every registered perspective frame',
);
assert.equal(
	new Set(rollerFrames.map(({ name }) => name)).size,
	48,
	'Roller ride must never reuse or hide a frame',
);
assert.ok(
	fs.statSync(path.join(root, 'static', 'assets', 'sprites', 'rollerCar', 'roller_car_ride.webp'))
		.size <
		1400 * 1024,
	'Roller 48-frame perspective atlas must stay below 1400 KiB',
);
const rollerBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'generate-feature-spines.py'),
	'utf8',
);
assert.match(
	rollerBuilderSource,
	/mega-wild-cart-front-reference\.png[\s\S]*mega-wild-cart-arms-up\.png[\s\S]*mega-wild-cart-vertical\.png[\s\S]*FRAME_COUNT = 48/,
	'Roller rig builder must use all three approved perspective keys',
);
assert.match(
	rollerBuilderSource,
	/transformed_layer\([\s\S]*warp_vertical\([\s\S]*vertical_flap/,
	'Roller rig builder must animate the released arms and vertical pitch',
);
assert.doesNotMatch(
	JSON.stringify(rollerSpine.animations.ride),
	/rgba|handoff/,
	'Roller ride must stay opaque without a crossfade handoff',
);

const rollerMultiplierTextSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'RollerMultiplierText.svelte'),
	'utf8',
);
assert.match(
	rollerMultiplierTextSource,
	/fontFamily: 'Helvetica'/,
	'Roller multipliers must use the supplied Helvetica style',
);
assert.match(
	rollerMultiplierTextSource,
	/\{ offset: 0\.18, color: 0xf49bff \}/,
	'Roller multipliers must use the Theme Park neon gradient',
);

for (const component of [
	'BoardFrame.svelte',
	'RollerWildsOverlay.svelte',
	'PersistentWildBadges.svelte',
	'DuckCollectPresenter.svelte',
	'FreeSpinAnimation.svelte',
]) {
	const source = fs.readFileSync(path.join(root, 'src', 'components', component), 'utf8');
	assert.doesNotMatch(source, /<Rectangle\b/, `${component}: procedural visual rectangle`);
}

console.log(`theme-park artifacts: ${modes.length} modes valid`);

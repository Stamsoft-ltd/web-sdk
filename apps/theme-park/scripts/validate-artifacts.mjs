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
				assert.ok(roller.multiplier > 0, `${mode}/${book.id}: positive reel multiplier`);
				if ('triggerRow' in roller) {
					assert.ok(
						Number.isInteger(roller.triggerRow) && roller.triggerRow >= 0 && roller.triggerRow < 5,
						`${mode}/${book.id}: roller trigger row`,
					);
					assert.ok(!('multipliers' in roller), `${mode}/${book.id}: one multiplier per reel`);
					if ('fakeMultiplier' in roller) {
						assert.ok(
							roller.fakeMultiplier > 0,
							`${mode}/${book.id}: positive fake plaque multiplier`,
						);
						assert.notEqual(
							roller.fakeMultiplier,
							roller.multiplier,
							`${mode}/${book.id}: fake and real plaque multipliers differ`,
						);
					}
					const trigger = reveal.board[roller.reel][roller.triggerRow + 1];
					assert.equal(trigger.name, 'W', `${mode}/${book.id}: roller trigger symbol`);
					assert.equal(trigger.wild, true, `${mode}/${book.id}: roller trigger wild`);
					assert.equal(trigger.rollerTrigger, true, `${mode}/${book.id}: roller trigger flag`);
				} else {
					// Published legacy fixtures stay playable until math books are regenerated.
					assert.ok(
						reveal.board[roller.reel].slice(1, 6).every((cell) => cell.name === 'W' && cell.wild),
						`${mode}/${book.id}: legacy complete Wild reel`,
					);
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
	'assets/theme-park/v2/board/frame-grid.webp',
	'assets/theme-park/v2/board/frame-rail.webp',
	'assets/theme-park/v2/board/frame-glow.webp',
	'assets/spines/megaWildFullReel/mega_wild_full_reel.atlas',
	'assets/spines/megaWildFullReel/mega_wild_full_reel.json',
	'assets/spines/megaWildFullReel/mega_wild_full_reel.png',
	'assets/spines/megaWildFullReel/mega_wild_full_reel_fallback.png',
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
	/POND_ACCESSORIES_ENABLED \? duckLookForIndex\(eventId, index\) : 0[\s\S]*variant: duckVariantForIndex\(eventId, index\)[\s\S]*look: pondLook\(eventId, index\)[\s\S]*ducks = emptyPond\(event\.seed\)[\s\S]*look=\{duck\.look\}/,
	'Duck pond must derive and preserve each Duck look from its event seed',
);
assert.doesNotMatch(
	duckPondSource,
	/Math\.random/,
	'Duck pond styles must not depend on render timing',
);
assert.match(
	duckVisualSource,
	/DUCK_SOLID_VARIANTS = \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16\][\s\S]*seededDuckValue[\s\S]*duckLookForIndex[\s\S]*duckVariantForIndex/,
	'Duck style selection must use solid floaties and the deterministic event-index mixer',
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
	/onrevealcomplete=\{\(\) => \{[\s\S]*finishDuckReveal\(index\);[\s\S]*finishFinalDuckReveal\(index\);/,
	'Pond book playback must resume from the Spine completion callback',
);
assert.match(
	duckPondSource,
	/const fakePrizes = prizePool\.slice\(totalPicks\)[\s\S]*finalRevealIndices = hiddenIndices[\s\S]*await waitForResolve\(\(resolve\) => \(resolveFinalReveal = resolve\)\)[\s\S]*await waitForTimeout\(2000\)/,
	'Unpicked pond Ducks must reveal fake prizes together, complete their turns, then hold for two seconds',
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
// Was /text="ALL"/ — a literal, until the localization pass turned every user-facing string in this
// component into a message-map lookup. The discriminator still has to be there; it just is not a
// string in the source any more.
assert.match(
	duckSpineSource,
	/text=\{stateI18nDerived\.translate\('ALL'\)\}/,
	'Multiply-all ducks need an ALL discriminator',
);

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
	/rawSymbol\.duckVariant \?\?[\s\S]*rawSymbol\.duckLook \?\?[\s\S]*look=\{duckLook\(reelSymbol\.rawSymbol, position\)\}/,
	'Board Duck symbols must retain their resolved reveal-event style while moving',
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
	/`duckPondDuck\$\{duckVariant\(rawSymbol/,
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
// The three files gained a `-marquee` suffix when the scatter was redrawn as a lockup; this check
// was still naming the pre-redesign ones and had been failing ever since.
assert.match(
	assetsSource,
	/duck-your-luck-desktop-marquee\.png[\s\S]*duck-your-luck-mobile-marquee\.png[\s\S]*duck-your-luck-mobile-landscape-marquee\.png/,
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
	/duckStyleSeed: bookEvent\.index,[\s\S]*duckVariant: duckVariantForPosition\(position, bookEvent\.index\),[\s\S]*duckLook: duckLookForPosition\(position, bookEvent\.index\)/,
	'Duck reel symbols must retain resolved event-seeded art while rolling out',
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
	/BOARD_SIDE_CONTENT_INSET = 1\.4[\s\S]*COASTER_WILD_GRID_INSET = 2\.5[\s\S]*getBoardCellCenterX = \(reelIndex: number\) => CELL_W \* \(reelIndex \+ 0\.5\)/,
	'Every reel must use one equal grid-line-to-grid-line width without edge shifts',
);

const duckSpine = JSON.parse(
	fs.readFileSync(path.join(root, 'static', 'assets', 'spines', 'duckTurn', 'duck_turn.json')),
);
const duckBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'build-duck-turn-spine.py'),
	'utf8',
);
const duckAssetProcessSource = fs.readFileSync(
	path.join(root, 'scripts', 'process-duck-handdrawn-assets.py'),
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
	'duck-your-luck-turn-v40-front-rear-accessory-fit',
	'Duck 2.5D rig version',
);
assert.match(
	duckBuilderSource,
	/SOURCE_POSE_COUNT = 16[\s\S]*POSE_COUNT = 64[\s\S]*minterpolate=fps=\{POSE_COUNT - 1\}\/\{SOURCE_POSE_COUNT - 1\}:mi_mode=mci:mc_mode=aobmc:/,
	'Duck turn must motion-interpolate 16 coherent Mega Coaster-style poses into 64 smooth frames',
);
assert.match(
	duckBuilderSource,
	/TURN_SPEED_BOOST = 2\.16[\s\S]*TURN_DURATION = turn_time\(0\.312\)/,
	'Duck turn must run at 80 percent of its previous speed without changing its 64-frame pose count',
);
assert.match(
	duckBuilderSource,
	/ACCESSORY_COLOR_COUNT = len\(HAT_FRONT_SOURCES\)[\s\S]*DUCK_LOOK_COUNT = 1 \+ ACCESSORY_COLOR_COUNT \* 2 \+ ACCESSORY_COLOR_COUNT\*\*2/,
	'Duck looks must cover standard, four approved glasses, four approved hats, and independent combinations',
);
assert.match(
	duckBuilderSource,
	/SOURCE_DIR[\s\S]*HAT_FRONT_SOURCES = \[[\s\S]*party_hat_front_combo_[\s\S]*HAT_REAR_SOURCES = \[[\s\S]*party_hat_rear_combo_[\s\S]*GLASSES_SOURCES = \[[\s\S]*sunglasses_combo_[\s\S]*GLASSES_FRONT_SOURCES = \[[\s\S]*sunglasses_front_combo_[\s\S]*GLASSES_REAR_SOURCES = \[[\s\S]*sunglasses_rear_combo_[\s\S]*"hat_bone"[\s\S]*"glasses_bone"[\s\S]*"glasses_rear_bone"/,
	'Duck accessories must be authored assets animated by Spine bones',
);
assert.doesNotMatch(
	duckBuilderSource,
	/build_hat_overlay|build_glasses_overlay|accessory_canvas/,
	'Duck accessories must not be raster-drawn per pose',
);
assert.match(
	duckBuilderSource,
	/HAT_BASE_WIDTH = 68[\s\S]*HAT_BASE_HEIGHT = 86[\s\S]*HAT_SCALE_X = 1\.1156[\s\S]*HAT_SCALE_Y = 1\.1156[\s\S]*HAT_Y_OFFSET = 11[\s\S]*HAT_FRONT_X_OFFSET = -8[\s\S]*HAT_REAR_X_OFFSET = 0[\s\S]*HAT_REAR_SHOW_POSE = 44[\s\S]*GLASSES_BASE_WIDTH = 145[\s\S]*GLASSES_BASE_HEIGHT = 52[\s\S]*GLASSES_CENTER_OFFSET_X = 31[\s\S]*GLASSES_SCALE_X = 1\.05[\s\S]*GLASSES_SCALE_Y = 1\.05[\s\S]*GLASSES_FRONT_X_OFFSET = -29[\s\S]*GLASSES_FRONT_Y_OFFSET = 18[\s\S]*GLASSES_ROTATION = -8[\s\S]*GLASSES_PERSPECTIVE_REDUCTION = 80[\s\S]*GLASSES_REAR_BASE_WIDTH = 148[\s\S]*GLASSES_REAR_SCALE = 0\.875[\s\S]*GLASSES_REAR_X_OFFSET = 0[\s\S]*GLASSES_REAR_Y_OFFSET = 0[\s\S]*GLASSES_REAR_SHOW_POSE = 48/,
	'Duck hats and glasses must use the reduced fitted scale and perspective tracks',
);
assert.match(
	duckAssetProcessSource,
	/party_hat_\{view\}_combo_\{index\}[\s\S]*Expected back frame, front frame, and rear arms/,
	'Duck glasses must hide the far front-view temple and spread rear arms outside the head',
);
assert.deepEqual(
	duckSpine.bones.find(({ name }) => name === 'duck'),
	{ name: 'duck', parent: 'float', y: -6 },
	'Duck must sit lower inside the floatie so its tail stays behind the front ring',
);
assert.doesNotMatch(
	duckAssetProcessSource,
	/striped/,
	'Duck glasses must not hide the long near-side temple',
);
assert.match(
	duckBuilderSource,
	/1: \{"hue": None, "star": True, "striped": False[\s\S]*2: \{"hue": None, "star": False, "striped": False[\s\S]*16: \{"hue": 39, "star": False, "striped": False/,
	'Duck rings must keep colour and star variety without stripes',
);
assert.doesNotMatch(duckBuilderSource, /"striped": True/, 'Duck floaties must not use stripes');
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
	/DUCK_ART_SCALE = 0\.95[\s\S]*placed = placed\.transpose\(Image\.Transpose\.FLIP_LEFT_RIGHT\)/,
	'Duck must be five percent smaller and mirror toward its authored accessories',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.ring_back).length,
	16,
	'Duck rear ring arcs',
);
assert.equal(
	Object.keys(duckSpine.skins[0].attachments.ring_front).length,
	16,
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
	8,
	'Four front and four rear party-hat Spine variants',
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
	duckSpine.skins[0].attachments.hat.hat_front_0,
	{ path: 'party_hat_front_0', width: 88, height: 149 },
	'Party hats must use the approved legacy-fit asset',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.hat.hat_rear_0,
	{ path: 'party_hat_rear_0', width: 88, height: 149 },
	'Party hats must preserve the approved fit in rear view',
);
assert.deepEqual(
	duckSpine.skins[0].attachments.glasses_back.glasses_back_3,
	{ path: 'sunglasses_3', width: 153, height: 60 },
	'Sunglasses back layer must restore the approved behind-head shape',
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
for (let variant = 1; variant <= 16; variant += 1) {
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
	/forestBonusBadge|RollerMultiplierCell|CoasterWildBackground|rollerWildRail/,
	'Roller overlay must use one combined rails + duck/plaque rig without old row stacking',
);
assert.match(
	rollerOverlaySource,
	/<Graphics isMask draw=\{drawBoardMask\} \/>/,
	'Roller combined symbols must use the widened board mask',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/drawForegroundGrid|stroke\(\{ color: 0xe3a331/,
	'Roller overlay must not paint a secondary grid',
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
// This used to demand a rect PER CELL, each one held back from the grid lines by
// GRID_LINE_CLEARANCE. The grid is now drawn BEHIND the reel contents rather than over them, and
// clearing a gutter around every cell would cut a symbol at every internal line for nothing. One
// rect for the whole board, inset only where the board's own opening is.
assert.match(
	boardSource,
	/const drawBoardContentMask =[\s\S]*BOARD_SIDE_CONTENT_INSET,[\s\S]*CELL_W \* BOARD_DIMENSIONS\.x - BOARD_SIDE_CONTENT_INSET \* 2[\s\S]*<Graphics isMask draw=\{drawBoardContentMask\} \/>/,
	'Board symbols must be clipped only at the board opening, not at every internal grid line',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/carYs|CAR_START_Y|CAR_END_Y|contributionFor|SPREAD_ORDER/,
	'Old cart descent and contribution-stack state must be removed',
);
assert.match(
	rollerOverlaySource,
	/const ROWS = Array\.from\(\{ length: BOARD_DIMENSIONS\.y \}, \(_, row\) => row\)/,
	'Roller animation must cover every transformed row',
);
assert.match(
	rollerOverlaySource,
	/showFinalPresentation\(\)/,
	'Roller skip must fast-forward to the settled combined symbol',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/totalAlpha\.set\(0/,
	'Combined reel totals must remain visible through the persistent-state handoff',
);
// The wait used to be `waitForTimeout(INTRO_MS)` literally. Super turbo now scales it through
// introWaitMs(), so INTRO_MS is the unscaled length rather than the number passed. What this guards
// is unchanged: one awaited wait between going to 'revealing' and the reveal, so a skip can cut it.
assert.match(
	rollerOverlaySource,
	/const INTRO_MS = 1990;[\s\S]*phase = 'revealing'[\s\S]*waitForTimeout\(introWaitMs\(\)\)/,
	'Combined 64-frame Roller intro must run as one skippable timeline',
);
assert.match(
	rollerOverlaySource,
	/REEL_STAGGER_MS = INTRO_MS[\s\S]*stateBet\.isTurbo \|\| stateBet\.isSuperTurbo[\s\S]*triggerReels\.slice\(0, revealedReelCount\)/,
	'Normal Roller reveals must stagger left-to-right while fast modes reveal as one batch',
);
assert.match(
	duckBookHandlerSource,
	/initialReal: seededEventChoice\(bookEvent\.index, entry\.reel, 17, 2\) === 1/,
	'Roller initial plaque face must be deterministic from event index and reel',
);
assert.match(
	rollerOverlaySource,
	/<MegaWildFullReel[\s\S]*multiplier=\{roller\.multiplier\}[\s\S]*initialReal=\{roller\.initialReal\}/,
	'Each Roller reel must resolve to one rails + duck/plaque multiplier symbol',
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
	rollerOverlaySource,
	/rollerWildsHandoff:[\s\S]*phase = 'settled'[\s\S]*presentationOwner = 'overlay'[\s\S]*await tick\(\)/,
	'The settled full-reel result must remain overlay-owned above the authored grid',
);
assert.ok(
	gameSource.indexOf('<RollerWildsOverlay />') <
		gameSource.indexOf('{#if context.stateGame.paylineWins.length > 0}'),
	'Settled Roller Wild must render above BoardFrame but below paylines',
);

const bookHandlerSource = fs.readFileSync(
	path.join(root, 'src', 'game', 'bookEventHandlerMap.ts'),
	'utf8',
);
const gameStateSource = fs.readFileSync(
	path.join(root, 'src', 'game', 'stateGame.svelte.ts'),
	'utf8',
);
const actorSource = fs.readFileSync(path.join(root, 'src', 'game', 'actor.ts'), 'utf8');
const neonPaylinesSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'NeonPaylines.svelte'),
	'utf8',
);
const revealHandlerSource = bookHandlerSource.slice(
	bookHandlerSource.indexOf('reveal: async'),
	bookHandlerSource.indexOf('winInfo: async'),
);
const finalWinHandlerSource = bookHandlerSource.slice(
	bookHandlerSource.indexOf('finalWin: async'),
	bookHandlerSource.indexOf('freeSpinTrigger: async'),
);
const resetBonusStateSource = gameStateSource.slice(
	gameStateSource.indexOf('const resetBonusState'),
);
assert.doesNotMatch(
	finalWinHandlerSource,
	/stateGame\.paylineWins = \[\]/,
	'finalWin must keep paylines visible through the idle result hold',
);
assert.doesNotMatch(
	resetBonusStateSource,
	/stateGame\.paylineWins = \[\]/,
	'Bonus cleanup must not hide paylines before the next spin',
);
assert.ok(
	revealHandlerSource.indexOf('stateGame.paylineWins = []') > -1 &&
		revealHandlerSource.indexOf('stateGame.paylineWins = []') <
			revealHandlerSource.indexOf('stateGameDerived.enhancedBoard.spin'),
	'Next reveal must clear old paylines immediately before starting reel motion',
);
assert.match(
	actorSource,
	/onNewGameStart:[\s\S]*stateGame\.paylineWins = \[\]/,
	'Physical next-spin initiation must stop and unmount the prior payline cycle',
);
assert.match(
	neonPaylinesSource,
	/time = elapsed \/ 1000[\s\S]*cycleTime = elapsed % cycleMs[\s\S]*lineAlpha = 0[\s\S]*app\.ticker\.add\(tick/,
	'Mounted paylines must draw, fade out, and redraw until next-spin initiation unmounts them',
);
assert.doesNotMatch(
	bookHandlerSource,
	/entry\.multipliers|Array\.isArray\(entry\.multipliers\)/,
	'Roller event playback must use exactly one multiplier per reel',
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
const rollerApplySource = bookHandlerSource.slice(
	bookHandlerSource.indexOf('rollerWildsApply: async'),
	bookHandlerSource.indexOf('coasterSetup: async'),
);
assert.doesNotMatch(
	rollerApplySource,
	/symbol\.rawSymbol\s*=|reelMultiplier: roller\.multiplier/,
	'Roller presentation must preserve the authored reveal symbols under its overlay',
);
assert.doesNotMatch(
	rollerApplySource,
	/rollerWildsHide/,
	'Settled Roller overlay must remain mounted through paylines and result display',
);

const coasterPresenterSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'CoasterSetupPresenter.svelte'),
	'utf8',
);
assert.match(
	coasterPresenterSource,
	/const MIN_CART_GAP_UNITS = 1\.35;[\s\S]*const MIN_CART_COUNT = 15;[\s\S]*const MAX_EXTRA_CARTS = 7;[\s\S]*return impacts\.map\(\(impact, lane\) =>[\s\S]*lane \* \(MIN_CART_GAP_UNITS \+ CART_GAP_VARIANCE_UNITS\)[\s\S]*seededValue\(seed, lane \+ row \* 7, 1\)[\s\S]*const extraCount = Math\.max\([\s\S]*1,[\s\S]*impact: null/,
	'Mega Coaster must spawn at least fifteen deterministic mixed-purpose carts',
);
assert.doesNotMatch(
	coasterPresenterSource,
	/MIN_CARTS_PER_LINE|groupsByReel|impactGroups|Math\.random/,
	'Mega Coaster must not merge hits or use render-time randomness',
);
assert.match(
	coasterPresenterSource,
	/tilesMap = \{ \.\.\.tilesMap, \[key\]: impact\.multiplier \}/,
	'Mega Coaster must reveal exactly one multiplier step per duck impact',
);
assert.match(
	coasterPresenterSource,
	/const impactAt = route\.impact[\s\S]*route\.impact &&[\s\S]*routeTime >= route\.impactAt[\s\S]*pulseWild\(route\.impact, run, timing\)[\s\S]*completeImpact\(route\.impactIndex\)[\s\S]*route\.impact && routeTime >= route\.vomitStartAt[\s\S]*\? 'vomit'[\s\S]*: 'happy'/,
	'Mega Coaster impact carts must vomit once while decorative carts pass happily',
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
	/Initial setup reveal only[\s\S]*Free-spin reel timing is owned elsewhere and remains unchanged[\s\S]*const SETUP_SPEED_BOOST = 1\.69;[\s\S]*const SEQUENCE_SPEED = 0\.9 \* SETUP_SPEED_BOOST \* 0\.85;[\s\S]*const DUCK_PLAYBACK_SPEED = 4\.5 \* SETUP_SPEED_BOOST;[\s\S]*const VOMIT_CLIP_MS = Math\.round\(VOMIT_SOURCE_MS \/ DUCK_PLAYBACK_SPEED\);/,
	'Mega Coaster cart movement must be fifteen percent slower without changing duck playback',
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
	/requestNextVomit[\s\S]*requestedImpactIndexes\.add\(index\)[\s\S]*timelineOffsetMs \+= Math\.max\(0, dueAt - timelineNow\)[\s\S]*finishRequested = true[\s\S]*playTimeline[\s\S]*completeImpact\(route\.impactIndex\)[\s\S]*if \(!finishRequested\) await waitForTimeout\(timing\.outro\)/,
	'Mega Coaster click and Space must advance every cart to the next vomit, then skip the tail',
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
	'theme-park-mega-coaster-vomit-v29-handdrawn-128frame',
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
			'coaster-vomit-handdrawn',
			'empty-cart.png',
		),
	),
	'Mega Coaster hand-drawn empty cart',
);
for (let index = 0; index < 8; index += 1) {
	assert.ok(
		fs.existsSync(
			path.join(
				root,
				'source-assets-unused',
				'assets',
				'theme-park',
				'coaster-vomit-handdrawn',
				`duck-key-${String(index).padStart(2, '0')}.png`,
			),
		),
		`Mega Coaster hand-drawn duck key ${index}`,
	);
}
assert.match(
	coasterBuilderSource,
	/def normalize_cart\([\s\S]*def build_cart_front\([\s\S]*motion_interpolate_poses\(\[\*timeline, duck_keys\[0\]\]\)[\s\S]*build_atlas\(poses, fixed_cart, cart_front\)/,
	'Mega Coaster must layer one immutable cart around an exact-endpoint motion-flow loop',
);
assert.match(
	coasterBuilderSource,
	/def normalize_duck_keys\([\s\S]*DUCK_BASELINE[\s\S]*def motion_interpolate_poses\([\s\S]*minterpolate=fps=7\.9375:mi_mode=mci:mc_mode=aobmc:[\s\S]*subprocess\.run\(/,
	'Mega Coaster must register hand-drawn keys and use motion-compensated in-betweens',
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
for (const authoredSourcePattern of [
	/SOURCE = APP \/ "source-assets-unused\/assets\/theme-park\/coaster-vomit-handdrawn"/,
	/SOURCE_KEY_COUNT = 8/,
	/TIMELINE_KEY_COUNT = 16/,
	/EMPTY_CART_SOURCE = SOURCE \/ "empty-cart\.png"/,
	/DUCK_KEY_PATTERN = "duck-key-\{index:02d\}\.png"/,
	/TIMELINE_KEYS = \(0, 0, 1, 1, 2, 3, 4, 5, 5, 5, 5, 4, 6, 6, 7, 0\)/,
	/def normalize_cart\(/,
	/def normalize_duck_keys\(/,
	/timeline = \[duck_keys\[index\] for index in TIMELINE_KEYS\]/,
]) {
	assert.match(
		coasterBuilderSource,
		authoredSourcePattern,
		'Mega Coaster must use the hand-drawn cart and eight authored duck keys',
	);
}
assert.doesNotMatch(
	coasterBuilderSource,
	/lock_upper_pose|stabilize_torso|STABLE_SHEETS|sheet_scales/,
	'Mega Coaster must not repair or reposition the old shaking source frames',
);
assert.doesNotMatch(
	coasterBuilderSource,
	/seat_opening|back_seam|np\.array\(\[28, 13, 6, 255\]|apply_sick_tint/,
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
	/COASTER_WILD_GRID_INSET[\s\S]*EDGE_LOCAL_INSET = BOARD_SIDE_CONTENT_INSET \* 0\.5[\s\S]*CELL_W - leftInset - rightInset[\s\S]*CELL_H - COASTER_WILD_GRID_INSET \* 2/,
	'Mega Coaster Wild backgrounds must leave every equal grid cell divider visible',
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
// The normal Wild used to win by swapping to 'tpWildAnim' and playing a sheet. It was redrawn as a
// marquee that wins by lighting its bulbs, so what this now checks is that it still resolves to the
// per-layout wild sprite and that the sprite still rides winPulse — the pop is the part that has to
// survive, not the sheet that used to carry it.
assert.match(
	boardSource,
	/return getSpecialSymbolKey\('wild', layoutType\)[\s\S]*width=\{SYMBOL_W \* \(isWin \? winPulse : 1\)\}/,
	'Normal Wilds must pop with other winning symbols',
);
assert.match(
	rollerOverlaySource,
	/reelIsWinning[\s\S]*symbol\.symbolState === 'win'[\s\S]*winning=\{phase === 'settled' && reelIsWinning\(roller\.reel\)\}/,
	'Settled full-reel Mega Wilds must pulse when paylines cross their reel',
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
	/coasterVomitSpine:\s*\{[\s\S]*?\n\t\},\n\tmegaWildFullReelFallback:/,
)?.[0];
assert.ok(coasterAssetBlock, 'Mega Coaster vomit Spine must be registered');
assert.doesNotMatch(
	coasterAssetBlock,
	/defer:\s*true/,
	'Mega Coaster vomit Spine must load before first use',
);

const megaWildAssetBlock = assetsSource.match(
	/megaWildFullReelSpine:\s*\{[\s\S]*?\n\t\},\n\tcoasterCarSickAnim:/,
)?.[0];
assert.ok(megaWildAssetBlock, 'Combined full-reel Mega Wild Spine must be registered');
assert.doesNotMatch(
	megaWildAssetBlock,
	/defer:\s*true/,
	'Combined full-reel rig must load before first use',
);

const megaWildSpine = JSON.parse(
	fs.readFileSync(
		path.join(root, 'static', 'assets', 'spines', 'megaWildFullReel', 'mega_wild_full_reel.json'),
	),
);
assert.equal(megaWildSpine.skeleton.spine, '4.2.0', 'Combined Mega Wild rig Spine version');
assert.deepEqual(
	Object.keys(megaWildSpine.animations).sort(),
	['idle', 'intro', 'intro_real'],
	'Combined Mega Wild rig animation names',
);
assert.equal(
	megaWildSpine.skeleton.hash,
	'theme-park-mega-wild-v33-no-wobble-plaque-roll',
	'Combined Mega Wild rig revision',
);
assert.equal(
	megaWildSpine.animations.intro.bones.ride.translate.length,
	64,
	'Duck pass must contain 64 explicit poses',
);
assert.ok(
	megaWildSpine.animations.intro.bones.ride.translate[23].y > 0 &&
		megaWildSpine.animations.intro.bones.ride.translate[24].y === 0,
	'Duck cart must complete its faster descent on frame 24',
);
const parkedRideBone = megaWildSpine.bones.find(({ name }) => name === 'ride');
const parkedCartBone = megaWildSpine.bones.find(({ name }) => name === 'cart');
assert.equal(parkedRideBone.y, -112, 'Duck cart ride bone must stop on the flat bottom track');
assert.equal(
	parkedCartBone.y,
	-183,
	'Duck cart local position must preserve its authored rail alignment',
);
assert.equal(
	megaWildSpine.animations.intro.bones.cart.scale.length,
	64,
	'Duck cart must grow smoothly with the rail perspective',
);
for (const cartView of ['cart_steep', 'cart_high_mid', 'cart_mid', 'cart_low_mid', 'cart']) {
	assert.equal(
		megaWildSpine.animations.intro.slots[cartView].rgba.length,
		64,
		`${cartView} must crossfade across the full descent`,
	);
}
assert.equal(
	megaWildSpine.animations.intro.bones.ride.translate.at(-1).y,
	0,
	'Duck cart intro must finish exactly at its parked setup pose',
);
assert.ok(
	!megaWildSpine.animations.win,
	'Win pulse must not swap Spine animations during paylines',
);
const fixedPlaqueBone = megaWildSpine.bones.find(({ name }) => name === 'plaque');
assert.equal(fixedPlaqueBone.parent, 'root', 'Multiplier plaque must stay fixed above the rails');
assert.equal(fixedPlaqueBone.y, 0, 'Multiplier plaque must remain at exact reel centre');
assert.ok(
	!megaWildSpine.animations.intro.bones.plaque.translate,
	'Wind may spin the plaque but must never move it from centre',
);
assert.equal(
	megaWildSpine.animations.intro.bones.plaque.rotate.length,
	128,
	'Plaque wind roll must contain 128 centred rotation poses',
);
assert.ok(
	megaWildSpine.animations.intro.bones.plaque.rotate.every(({ value }) => value === 0) &&
		megaWildSpine.animations.intro.bones.plaque_edge.rotate.every(({ value }) => value === 0),
	'Plaque must not bank sideways while flipping around its horizontal centre',
);
assert.equal(
	megaWildSpine.animations.intro.bones.plaque_edge.scale.length,
	128,
	'Plaque side-view rig must contain 128 perspective poses',
);
for (const plaqueView of [
	'plaque_top_35',
	'plaque_top_60',
	'plaque_top_side',
	'plaque_bottom_35',
	'plaque_bottom_60',
	'plaque_bottom_side',
]) {
	assert.equal(
		megaWildSpine.animations.intro.bones[plaqueView].scale.length,
		128,
		`${plaqueView} must correct every crossfade pose to the active projected bounds`,
	);
}
for (const plaqueView of [
	'plaque',
	'plaque_top_35',
	'plaque_top_60',
	'plaque_top_side',
	'plaque_bottom_35',
	'plaque_bottom_60',
	'plaque_bottom_side',
]) {
	assert.equal(
		megaWildSpine.animations.intro.slots[plaqueView].rgba.length,
		128,
		`${plaqueView} must crossfade through all 128 plaque poses`,
	);
}
assert.ok(
	Math.min(...megaWildSpine.animations.intro.bones.plaque.scale.map(({ y }) => y)) >= 0.24,
	'Plaque must retain a visible edge instead of blinking out during its roll',
);
assert.ok(
	!megaWildSpine.animations.intro.bones.multiplier &&
		!megaWildSpine.animations.intro.bones.fake_multiplier,
	'Multiplier text must inherit one plaque transform instead of collapsing under a second scale',
);
assert.ok(
	!megaWildSpine.bones.some(({ name }) => name.includes('hand')) &&
		!megaWildSpine.slots.some(({ name }) => name.includes('hand')),
	'Combined Mega Wild rig must not add detached hand overlays above the complete cart art',
);
for (const attachment of [
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
	'multiplier',
]) {
	assert.ok(
		megaWildSpine.skins[0].attachments[attachment],
		`Combined Mega Wild rig missing ${attachment} attachment`,
	);
}

const rollerMultiplierTextSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'RollerMultiplierText.svelte'),
	'utf8',
);

const boardFrameSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'BoardFrame.svelte'),
	'utf8',
);
const boardArtSource = fs.readFileSync(path.join(root, 'src', 'game', 'boardArt.ts'), 'utf8');
const boardFrameBuilderSource = fs.readFileSync(
	path.join(root, 'scripts', 'board', 'build_board_frame.py'),
	'utf8',
);
assert.match(
	boardFrameSource,
	/key="themeBoardGrid"/,
	'BoardFrame must use the tightly cropped equal-cell grid/backboard layer',
);
assert.match(
	boardFrameSource,
	/key="themeBoardRail"/,
	'BoardFrame must render the frame above reel content',
);
assert.match(
	boardFrameSource,
	/key="themeBoardRailGlow"/,
	'BoardFrame must render the additive neon pulse over the frame',
);
assert.doesNotMatch(
	boardFrameSource,
	/BORDER_EXPAND_X/,
	'BoardFrame border styling must not scale independently from the canonical grid rect',
);
assert.match(
	boardFrameSource,
	/<Graphics/,
	'BoardFrame must mask the exact-grid base to the shared rounded interior',
);
assert.match(
	boardFrameSource,
	/type Props = \{ layer\?: 'base' \| 'border' \}/,
	'BoardFrame must split immutable base geometry from the top border overlay',
);
for (const pattern of [
	/GENERATED by scripts\/board\/build_board_frame\.py/,
	/rail_pixels\[inside\] = 0/,
	/COLUMNS = 5/,
	/ROWS = 5/,
]) {
	assert.match(
		boardFrameBuilderSource,
		pattern,
		'The frame must be cut around its own opening, with the grid drawn at exact fifths of it',
	);
}
assert.match(assetsSource, /board\/frame-grid\.webp/, 'Board grid/backboard must be registered');
assert.match(assetsSource, /board\/frame-rail\.webp/, 'Board frame rail must be registered');
assert.match(assetsSource, /board\/frame-glow\.webp/, 'Board frame pulse must be registered');
assert.match(
	boardArtSource,
	/GENERATED by scripts\/board\/build_board_frame\.py/,
	'Board geometry must come out of the cutting pipeline, not be hand-typed',
);
assert.match(
	boardArtSource,
	/GRID_RADIUS = 0\.0\d+/,
	'The grid clip must be the drawn corner cut, or the park shows through the board corners',
);
assert.doesNotMatch(
	boardFrameSource,
	/drawFrameMask/,
	'BoardFrame must not crop through border lights',
);
assert.doesNotMatch(
	boardFrameSource,
	/borderPoint|key="spark"/,
	'BoardFrame must not restore the old per-spark autoplay path',
);
assert.doesNotMatch(
	boardFrameSource,
	/BOARD_BULBS/,
	'The frame has no painted bulbs to chase; its neon line pulses as one',
);
assert.match(
	boardFrameSource,
	/blendMode="add"[\s\S]*alpha=\{glowAlpha\}/,
	'BoardFrame must add the pulse over the frame rather than tinting the frame itself',
);
assert.match(
	gameSource,
	/<BoardFrame layer="base" \/>/,
	'Game must mount the exact-grid board base below reel content',
);
assert.match(
	gameSource,
	/<BoardFrame layer="border" \/>/,
	'Game must mount the authored border above board feature content',
);
assert.match(
	gameSource,
	/const BOARD_BORDER_Z = 6/,
	'Board border overlay must stay below presentation z-index and above Mega Wild reveal',
);
assert.match(
	rollerOverlaySource,
	/BOARD_CORNER_RADIUS[\s\S]*\.roundRect\(/,
	'Expanded Mega Wild reels must use the shared rounded board-interior mask',
);
assert.match(
	rollerMultiplierTextSource,
	/fontFamily: 'Helvetica'/,
	'Roller multipliers must use the supplied Helvetica style',
);
assert.match(
	rollerMultiplierTextSource,
	/\{ offset: 0\.42, color: 0xffd329 \}/,
	'Roller contribution multipliers must match the final Mega Wild gold gradient',
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

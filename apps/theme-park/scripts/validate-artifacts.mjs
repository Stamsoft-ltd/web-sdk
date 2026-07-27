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
			for (const win of winInfo.wins) {
				const additiveMultiplier = win.positions.reduce((sum, position) => {
					const cell = reveal.board[position.reel][position.row + 1];
					return sum + (cell.wild ? Number(cell.multiplier ?? 0) : 0);
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

		for (const rollerEvent of book.events.filter((event) => event.type === 'rollerWildsApply')) {
			const reveal = book.events
				.slice(0, rollerEvent.index)
				.reverse()
				.find((event) => event.type === 'reveal');
			assert.ok(reveal, `${mode}/${book.id}: roller reveal`);
			for (const roller of rollerEvent.reels) {
				for (let paddedRow = 1; paddedRow <= 5; paddedRow += 1) {
					const cell = reveal.board[roller.reel][paddedRow];
					assert.equal(cell.name, 'W', `${mode}/${book.id}: roller wild cell`);
					assert.equal(cell.multiplier, roller.multiplier, `${mode}/${book.id}: roller multiplier`);
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
	'assets/components/frames/magnetic/cell_box.png',
	'assets/components/frames/magnetic/cell_box_win.png',
	'assets/components/frames/forest/badge_frame.png',
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
assert.match(duckPondSource, /await waitForResolve/, 'Duck Your Luck must block for a manual pick');
assert.match(
	duckPondSource,
	/onpress=\{\(\) => chooseDuck\(index\)\}/,
	'Duck reel cells must be interactive',
);
assert.match(duckPondSource, /const POND_SIZE = 25/, 'Duck pond must render 25 ducks');
assert.match(duckPondSource, /revealUnselected/, 'Unselected ducks must reveal after ten picks');
assert.match(
	duckPondSource,
	/25 interactive ducks occupy the exact 5×5 reel cells/,
	'Duck picker must occupy the reel grid',
);
assert.match(
	duckPondSource,
	/bookEventAmountToCurrencyString\(prize\.value \* 100\)/,
	'Direct duck prizes must display as currency',
);
assert.doesNotMatch(
	duckPondSource,
	/\+\$\{[^}]*value[^}]*\}x/,
	'Direct prizes must not display +Nx',
);

const gameSource = fs.readFileSync(path.join(root, 'src', 'components', 'Game.svelte'), 'utf8');
assert.ok(
	gameSource.indexOf('<DuckPondBonus />') > gameSource.indexOf('<App') &&
		gameSource.indexOf('<DuckPondBonus />') < gameSource.indexOf('</App>'),
	'Duck picker must render inside the Pixi reel stage',
);

const rollerOverlaySource = fs.readFileSync(
	path.join(root, 'src', 'components', 'RollerWildsOverlay.svelte'),
	'utf8',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/key="tpCoasterWild"/,
	'Roller overlay must not redraw settled full-reel Wild symbols',
);
assert.doesNotMatch(
	rollerOverlaySource,
	/key="magneticWildLightning"/,
	'Roller landing must not use the Magnetic lightning animation',
);
assert.match(
	rollerOverlaySource,
	/getSpecialSymbolKey\('megaWild', layoutType\)/,
	'Roller trigger and expanded reel must use the Mega Wild asset',
);
assert.match(
	rollerOverlaySource,
	/\{#each \[-0\.38, 0\.38\] as railOffset/,
	'Roller animation must draw two rails per reel',
);
assert.match(
	rollerOverlaySource,
	/key="rollerWildCar"/,
	'Roller animation must use the supplied cart asset',
);
assert.match(
	rollerOverlaySource,
	/sumExpression\(roller\)/,
	'Roller animation must visualize the additive multiplier sum',
);

const persistentWildSource = fs.readFileSync(
	path.join(root, 'src', 'components', 'PersistentWildBadges.svelte'),
	'utf8',
);
assert.equal(
	(persistentWildSource.match(/key="tpCoasterWild"/g) ?? []).length,
	1,
	'Only the Coaster spinning cover may redraw a Wild symbol',
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

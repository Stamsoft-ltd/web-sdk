import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../apps/mcschmutzo', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const ts = createRequire(
	new URL('../../node_modules/.pnpm/node_modules/.resolve.cjs', import.meta.url),
)('typescript');
const fixture = JSON.parse(
	fs.readFileSync(new URL('../../apps/mcschmutzo/tests/fixtures/base-40672.json', import.meta.url)),
);
function load(file, mocks = {}) {
	const code = ts.transpileModule(
		fs
			.readFileSync(path.join(root, 'src/game', file), 'utf8')
			.replaceAll('import.meta.env.DEV', 'false'),
		{
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
				esModuleInterop: true,
			},
			transformers: {
				before: [
					() => (sf) =>
						ts.factory.updateSourceFile(sf, [
							...sf.statements.filter(ts.isImportDeclaration),
							...sf.statements.filter((s) => !ts.isImportDeclaration(s)),
						]),
				],
			},
		},
	).outputText;
	const mod = { exports: {} };
	new Function('require', 'module', 'exports', '$state', code)(
		(id) => {
			if (id in mocks) return mocks[id];
			throw Error('Unmocked ' + id);
		},
		mod,
		mod.exports,
		(v) => v,
	);
	return mod.exports;
}
const p = load('multiplierPresentation.ts');
function harness() {
	const game = {
		board: [],
		globalMultiplier: 1,
		bonusMode: null,
		gameType: 'basegame',
		lockedPositions: [],
		paylineWins: [],
		roundWin: 0,
		featureMessage: '',
	};
	const bet = { isTurbo: false, winBookEventAmount: 0 };
	const ui = { freeSpinCounterShow: false };
	const derived = {
		enhancedBoard: {
			settle(board) {
				game.restoredBoard = board;
			},
		},
	};
	const pot = load('potState.svelte.ts', {
		'./multiplierPresentation': p,
		'./stateGame.svelte': { stateGame: game },
	});
	const lodash = require('lodash');
	const handlers = load('bookEventHandlerMap.ts', {
		svelte: { tick: async () => {} },
		'./multiplierPresentation': p,
		lodash: lodash,
		'utils-book': {
			recordBookEvent() {},
			checkIsMultipleRevealEvents() {
				return false;
			},
		},
		'state-shared': { stateBet: bet, stateUi: ui },
		'utils-shared/sequence': {
			sequence: async (xs, fn) => {
				for (const x of xs) await fn(x);
			},
		},
		'utils-shared/wait': { waitForTimeout: async () => {} },
		'./eventEmitter': { eventEmitter: { broadcast() {}, broadcastAsync: async () => {} } },
		'./utils': {
			playBookEvent() {
				throw Error('Historical event replayed');
			},
		},
		'./winLevelMap': { winLevelMap: {} },
		'./stateGame.svelte': { stateGame: game, stateGameDerived: derived, beginReelSpin() {} },
		'./constants': { BOARD_DIMENSIONS: { y: 5 }, LOCK_SLAM_MS: 1000 },
		'./potState.svelte': pot,
		'./chefMood.svelte': { setChefMood() {} },
		'./lockRelease.svelte': { releaseLocks() {} },
		'./config': { betModes: { base: { max_win: 25000 } } },
	}).bookEventHandlerMap;
	return { game, bet, ui, pot, handlers };
}
function boardFor(h, board) {
	h.game.board = board.map((column) => ({
		reelState: { symbols: column.map((rawSymbol) => ({ rawSymbol })) },
	}));
	h.pot.beginPotReveal();
}
const settleVolley = async (h, promise) => {
	await new Promise((resolve) => setImmediate(resolve));
	assert.ok(h.pot.potState.volley, 'shot must play before win');
	for (const shot of h.pot.potState.volley.shots) h.pot.potState.mult = shot.after;
	h.pot.potState.volley.done();
	await promise;
};
test('reported book 40672: base soup visibly rises 1→4 before final 10×4=40 presentation', async () => {
	const h = harness(),
		before = JSON.stringify(fixture);
	h.pot.potState.rect = { x: 10, y: 10, w: 100, h: 60 };
	h.game.lockedPositions = fixture.events.find((e) => e.type === 'lockRespinStart').lockedPositions;
	boardFor(h, fixture.events.find((e) => e.type === 'reveal' && e.gameType === 'respin').board);
	const boost = fixture.events.find((e) => e.type === 'updateGlobalMult');
	const promise = h.handlers.updateGlobalMult(boost);
	await settleVolley(h, promise);
	assert.equal(h.pot.potState.mult, 4);
	assert.equal(h.game.roundWin, 0);
	assert.equal(
		p.showBaseMultiplier(h.game.bonusMode, h.game.lockedPositions.length, h.game.globalMultiplier),
		true,
	);
	await h.handlers.lockRespinUpdate(fixture.events.find((e) => e.type === 'lockRespinUpdate'));
	assert.equal(h.pot.potState.volley, null, 'same soup cannot fire twice');
	const win = fixture.events.find((e) => e.type === 'winInfo');
	await h.handlers.winInfo(win, { bookEvents: fixture.events });
	assert.equal(
		p.formatLineCalculation(h.game.paylineWins[0], (v) => `$${(v / 100).toFixed(2)}`),
		'$0.10 × 4 = $0.40',
	);
	assert.equal(h.game.paylineWins[0].lineIndex, 9);
	assert.equal(JSON.stringify(fixture), before);
});
for (const mode of ['base', 'enhancer1', 'featureSpin', 'bonus1', 'bonus2'])
	test(`${mode}: boosts are mode independent and repeated step reports deduplicate`, async () => {
		const h = harness();
		h.game.bonusMode = mode.startsWith('bonus') ? 'freegame' : null;
		h.pot.potState.rect = { x: 0, y: 0, w: 100, h: 80 };
		boardFor(h, fixture.events.find((e) => e.gameType === 'respin').board);
		await settleVolley(
			h,
			h.handlers.updateGlobalMult({
				addedSteps: 3,
				previousGlobalMult: 1,
				globalMult: 4,
				source: 'respin',
			}),
		);
		await h.handlers.lockRespinUpdate({
			addedSteps: 3,
			globalMult: 4,
			newLockedPositions: [],
			collectedScatters: 0,
			multiplierPositions: [{ reel: 2, row: 3 }],
		});
		assert.equal(h.pot.potState.volley, null);
		assert.equal(h.pot.potState.mult, 4);
	});
test('wheel boosts do not fire cell shots', async () => {
	const h = harness();
	await h.handlers.updateGlobalMult({ addedSteps: 3, globalMult: 4, source: 'wheel' });
	assert.equal(h.pot.potState.volley, null);
	assert.equal(h.game.globalMultiplier, 4);
});
test('100x rung exists; real soup values survive unequal multi-soup landings', () => {
	assert.equal(p.climbMultiplier(80, 1), 100);
	assert.equal(p.climbMultiplier(80, 2), 120);
	assert.equal(p.climbMultiplier(1000, 30), 1000);
	assert.deepEqual(p.soupSteps(4, [1, 3]), [1, 3]);
	assert.deepEqual(p.soupSteps(3, [undefined, undefined]), [2, 1]);
});
test('multiple soup animation uses math ladder for intermediate values and book target last', async () => {
	const h = harness();
	h.pot.resetPot(80);
	h.pot.potState.rect = { x: 0, y: 0, w: 80, h: 50 };
	h.game.board = [
		{
			reelState: {
				symbols: [
					{ rawSymbol: { name: 'M' } },
					{ rawSymbol: { name: 'M', multiplier: 1 } },
					{ rawSymbol: { name: 'M', multiplier: 1 } },
				],
			},
		},
	];
	h.pot.queuePotShots(2, [
		{ reel: 0, row: 1 },
		{ reel: 0, row: 2 },
	]);
	const pending = h.pot.flushPot(120);
	assert.deepEqual(
		h.pot.potState.volley.shots.map((s) => s.after),
		[100, 120],
	);
	h.pot.potState.volley.done();
	await pending;
});
test('line presentation preserves authoritative/capped result, never multiplies to replace it', () => {
	const w = structuredClone(fixture.events.find((e) => e.type === 'winInfo').wins[0]);
	w.win = 25;
	assert.equal(p.formatLineCalculation(p.presentLine(w), String), '10 × 4 → 25');
	assert.equal(p.presentLine(w).amount, 25);
});
test('base badge hides for bonus but persists after base settlement until new round', () => {
	assert.equal(p.showBaseMultiplier(null, 3, 1), true);
	assert.equal(p.showBaseMultiplier(null, 0, 4), true);
	assert.equal(p.showBaseMultiplier(null, 0, 1), false);
	assert.equal(p.showBaseMultiplier('freegame', 4, 10), false);
});
test('snapshot restores base multiplier and board without replaying old shots', async () => {
	const h = harness();
	await h.handlers.createBonusSnapshot({ bookEvents: fixture.events.slice(0, 6) });
	assert.equal(h.game.globalMultiplier, 4);
	assert.equal(h.pot.potState.mult, 4);
	assert.equal(h.pot.potState.volley, null);
	assert.equal(h.game.lockedPositions.length, 3);
	assert.equal(h.game.bonusMode, null);
});
test('snapshot restores free-game context so its re-spins do not show the base badge', async () => {
	const h = harness();
	await h.handlers.createBonusSnapshot({
		bookEvents: [
			{ type: 'bonusWheel', scatterEntry: 4, globalMult: 4, freeSpins: 10 },
			{ type: 'updateGlobalMult', globalMult: 8 },
			{ type: 'updateFreeSpin', amount: 2, total: 10 },
		],
	});
	assert.equal(h.game.bonusMode, 'freegame');
	assert.equal(h.game.globalMultiplier, 8);
	assert.equal(h.pot.potState.mult, 8);
	assert.equal(h.ui.freeSpinCounterCurrent, 3);
	assert.equal(h.ui.freeSpinCounterShow, true);
});
test('HTML badge and info consume shared ladder; all changed Svelte compiles', () => {
	const compiler = require('svelte/compiler');
	for (const file of [
		'BaseMultiplierHtml',
		'PaylineOverlay',
		'PotShots',
		'Game',
		'OrderNotesHtml',
		'CustomTutorialModal',
	]) {
		const filename = path.join(root, 'src/components', file + '.svelte');
		assert.doesNotThrow(() =>
			compiler.compile(fs.readFileSync(filename, 'utf8'), { filename, generate: 'client' }),
		);
	}
	const source = fs.readFileSync(
		path.join(root, 'src/components/CustomTutorialModal.svelte'),
		'utf8',
	);
	assert.match(source, /MULTIPLIER_LADDER\.map/);
});
test('stew source callout appears before flight and clears when its shot leaves', () => {
	assert.equal(p.soupSourceCallout(-201, 600).alpha, 0);
	assert.equal(p.soupSourceCallout(0, 600).alpha, 1);
	assert.equal(p.soupSourceCallout(600, 600).alpha, 1);
	assert.equal(p.soupSourceCallout(690, 600).alpha, 0.5);
	assert.equal(p.soupSourceCallout(780, 600).alpha, 0);
	assert.equal(p.soupSourceCallout(3000, 600).alpha, 0);
	// Each cell uses its staggered shot clock, not the first stew's animation.
	assert.equal(p.soupSourceCallout(0 - 300, 600).alpha, 0);
	for (let t = -500; t < 3000; t += 25) {
		const frame = p.soupSourceCallout(t, 600);
		assert.ok(frame.alpha >= 0 && frame.alpha <= 1);
		assert.ok(Number.isFinite(frame.rise) && Number.isFinite(frame.scale));
	}
	const source = fs.readFileSync(path.join(root, 'src/components/PotShots.svelte'), 'utf8');
	assert.match(source, /callout: key && callout.alpha > 0/);
	// Source stew and flying blob both show the same added steps, not the resulting multiplier.
	assert.equal(source.split('text={`+${f.steps}`}').length - 1, 2);
	assert.ok(!source.includes('text={`${f.after}×`}'));
	assert.match(source, /clock = began/);
	assert.doesNotMatch(source, /clock = start;/);
});
test('stew shot lands centered above the HTML multiplier card', () => {
	for (const card of [
		{ left: 8, top: 182, w: 120, h: 54 },
		{ left: 12, top: 110, w: 160, h: 48 },
		{ left: 20, top: 600, w: 180, h: 28 },
	]) {
		const target = p.baseMultiplierLanding(card);
		assert.equal(target.x, card.left + card.w / 2);
		assert.ok(target.y < card.top);
		assert.ok(target.y >= 16);
	}
	const source = fs.readFileSync(path.join(root, 'src/components/PotShots.svelte'), 'utf8');
	assert.match(source, /pot.landing\?\.y \?\? pot.y \+ pot.h \* 0.32/);
});
test('new full replay/paid round clears prior multiplier; resume snapshot retains its context', async () => {
	const h = harness();
	let observed;
	const utils = load('utils.ts', {
		lodash: require('lodash'),
		'state-shared': { stateBet: h.bet },
		'./stateGame.svelte': { stateGame: h.game },
		'./potState.svelte': h.pot,
		'utils-book': {
			createPlayBookUtils: () => ({
				playBookEvents: async () => {
					observed = h.game.globalMultiplier;
				},
				playBookEvent() {},
			}),
		},
		'utils-slots': { createGetEmptyPaddedBoard: () => ({ getEmptyBoard() {} }) },
		'./constants': {},
		'./eventEmitter': { eventEmitter: { broadcast() {} } },
		'./bookEventHandlerMap': { bookEventHandlerMap: h.handlers },
	});
	h.game.globalMultiplier = 80;
	h.game.bonusMode = 'freegame';
	h.pot.potState.mult = 80;
	await utils.playBet({ state: fixture.events });
	assert.equal(observed, 1);
	assert.equal(h.pot.potState.mult, 1);
	assert.equal(h.game.bonusMode, null);
	h.game.globalMultiplier = 4;
	await utils.playBet({ state: [{ type: 'createBonusSnapshot' }] });
	assert.equal(observed, 4);
	const actor = fs.readFileSync(path.join(root, 'src/game/actor.ts'), 'utf8');
	assert.ok(
		actor.indexOf('resetRoundMultiplier();') < actor.indexOf('stateBet.isTurbo &&'),
		'turbo/held space cannot bypass reset',
	);
});
test('base badge remains inside mobile widths and narrow desktop gutter', () => {
	for (const [layout, canvas, frame] of [
		['portrait', { width: 390, height: 844 }, { left: 6, right: 384, top: 170, bottom: 570 }],
		['landscape', { width: 844, height: 390 }, { left: 200, right: 620, top: 20, bottom: 350 }],
		['desktop', { width: 908, height: 853 }, { left: 136, right: 760, top: 100, bottom: 670 }],
	]) {
		const b = p.baseMultiplierPlacement(layout, frame, canvas);
		assert.ok(b.left >= 0 && b.left + b.w <= canvas.width);
		assert.ok(b.top >= 0 && b.top + b.h <= canvas.height);
		if (layout === 'desktop') assert.ok(b.h <= b.w * 0.45);
	}
});
test('desktop order notes remain mounted during locks and multiplier card stays above them', () => {
	for (const [canvas, frame] of [
		[{ width: 908, height: 853 }, { left: 136, right: 760, top: 100, bottom: 670 }],
		[{ width: 1920, height: 1080 }, { left: 450, right: 1330, top: 100, bottom: 900 }],
		[{ width: 1280, height: 720 }, { left: 280, right: 980, top: 65, bottom: 610 }],
	]) {
		const note = p.orderNotesPlacement(frame, canvas);
		assert.ok(note.w > 70);
		for (const layout of ['desktop', 'tablet']) {
			const card = p.baseMultiplierPlacement(layout, frame, canvas);
			assert.ok(card.top + card.h <= note.top - 18);
		}
	}
	const source = fs.readFileSync(path.join(root, 'src/components/OrderNotesHtml.svelte'), 'utf8');
	assert.ok(!source.includes('context.stateGame.lockedPositions.length'));
	assert.ok(!source.includes('context.stateGame.globalMultiplier <= 1'));
});
test('snapshot never carries prior free-spin locks onto a new blank free spin', async () => {
	const h = harness();
	const board = fixture.events.find((e) => e.type === 'reveal').board;
	await h.handlers.createBonusSnapshot({
		bookEvents: [
			{ index: 0, type: 'bonusWheel', freeSpins: 10, globalMult: 4, scatterEntry: 3 },
			{ index: 1, type: 'reveal', gameType: 'freegame', board },
			{
				index: 2,
				type: 'lockRespinStart',
				symbol: 'L1',
				lockedPositions: [{ reel: 0, row: 1 }],
				globalMult: 4,
			},
			{
				index: 3,
				type: 'lockRespinEnd',
				symbol: 'L1',
				lockedPositions: [{ reel: 0, row: 1 }],
				collectedScatters: 0,
				globalMult: 4,
			},
			{ index: 4, type: 'reveal', gameType: 'freegame', board },
		],
	});
	assert.equal(h.game.lockedPositions.length, 0);
	assert.equal(h.game.lockSymbol, undefined);
	assert.equal(h.game.bonusMode, 'freegame');
	assert.equal(h.pot.potState.mult, 4);
});

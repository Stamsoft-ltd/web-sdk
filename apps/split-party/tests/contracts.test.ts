import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	MODES,
	initialState,
	validateEvents,
	parseRound,
	applyEvent,
	winMoney,
} from '../src/lib/model.ts';
import { createTransport, launch } from '../src/lib/transport.ts';
import { formatWalletAmount, formatWinAmount } from '../src/lib/reference/currency.ts';
const fixtures = Object.fromEntries(
	Object.keys(MODES).map((mode) => [
		mode,
		JSON.parse(readFileSync(`public/fixtures/${mode}.json`, 'utf8')).books,
	]),
);
for (const [mode, books] of Object.entries(fixtures))
	test(`all exported ${mode} books replay exact payouts, no input mutation`, () => {
		for (const book of books) {
			const before = JSON.stringify(book);
			validateEvents(book.events);
			const result = book.events.reduce(applyEvent, initialState());
			assert.equal(result.total, book.payoutMultiplier);
			assert.equal(result.finished, true);
			assert.equal(JSON.stringify(book), before);
			assert(result.blades.flat().every((b: number) => b >= 0 && b <= 5));
		}
	});
test('winInfo is metadata, never a second award', () => {
	let s = initialState();
	s = applyEvent(s, { index: 0, type: 'clusterWin', paidAward: 150, wins: [] });
	s = applyEvent(s, { index: 1, type: 'winInfo', totalWin: 150, wins: [] });
	assert.equal(s.total, 150);
	assert.equal(winMoney(2, s.total), 3);
});
test('position splits survive tumble; reveal comes from recorded events', () => {
	let s = initialState();
	s = applyEvent(s, { index: 0, type: 'bladeUpdate', changes: [{ reel: 2, row: 3, to: 5 }] });
	assert.equal(s.blades[2][3], 5);
	const board = initialState().board;
	s = applyEvent(s, { index: 1, type: 'tumble', board, blades: s.blades });
	assert.equal(s.blades[2][3], 5);
	assert.deepEqual(s.board, board);
});
test('unknown / corrupted / truncated events fail closed', () => {
	const original = fixtures.base[0].events;
	for (const edit of [
		(e: any[]) => (e[0].type = 'unknown'),
		(e: any[]) => (e[1].board[0][0] = 'unknown'),
		(e: any[]) => e.at(-1).amount++,
		(e: any[]) => e.pop(),
		(e: any[]) => (e[1].index = 99),
	]) {
		const e = structuredClone(original);
		edit(e);
		assert.throws(() => validateEvents(e));
	}
});
test('mode and RGS amount validation; uppercase launch normalization', () => {
	const round = parseRound(
		{ state: fixtures.base[0].events, mode: 'BASE', amount: 1000000 },
		0,
		'base',
	);
	assert.equal(round.mode, 'base');
	assert.equal(round.amount, 1000000);
	assert.throws(() => parseRound({ ...round, mode: 'chance' }, 0, 'base'));
	assert.throws(() => parseRound({ ...round, amount: -1 }, 0, 'base'));
});
test('wallet vs small win formatting reused from Veggie Salad', () => {
	assert.equal(formatWalletAmount('USD', 999.946), '$999.95');
	assert.equal(formatWinAmount('USD', 0.0016), '$0.0016');
	assert.equal(formatWalletAmount('XGC', 10), '10.00 GC');
});
test('shared RGS functions: authenticate language, micro-unit wager, server balance, end-round', async () => {
	const original = globalThis.fetch;
	const requests: any[] = [];
	globalThis.fetch = async (url, options) => {
		requests.push({ url: String(url), body: JSON.parse(String(options?.body)) });
		return new Response(
			JSON.stringify({
				balance: { amount: 123000000, currency: 'USD' },
				round: { state: fixtures.base[0].events, mode: 'base', amount: 250000 },
			}),
			{ status: 200 },
		);
	};
	try {
		const api = createTransport(launch('?rgs_url=test.invalid&sessionID=unit-test&lang=es'));
		await api.authenticate();
		await api.play('feature', 0.25, 'USD');
		await api.end();
		assert.equal(requests[0].url, 'https://test.invalid/wallet/authenticate');
		assert.equal(requests[0].body.language, 'es');
		assert.equal(requests[1].body.amount, 250000);
		assert.equal(requests[1].body.mode, 'feature');
		assert.equal(requests[1].body.sessionID, 'unit-test');
		assert.equal(requests[2].url, 'https://test.invalid/wallet/end-round');
		assert.deepEqual(requests[2].body, { sessionID: 'unit-test' });
	} finally {
		globalThis.fetch = original;
	}
});
test('replay loads exact events; never permits wallet play or settlement', async () => {
	const original = globalThis.fetch;
	const requests: string[] = [];
	globalThis.fetch = async (url) => {
		requests.push(String(url));
		return new Response(JSON.stringify({ state: fixtures.mystery[0].events }), { status: 200 });
	};
	try {
		const api = createTransport(
			launch(
				'?replay=true&rgs_url=test.invalid&game=split_party&version=1&mode=mystery&event=7&amount=1000000&lang=de',
			),
		);
		const replay = await api.replay();
		assert.equal(replay.mode, 'mystery');
		await assert.rejects(api.play('base', 1, 'USD'), /disabled/);
		await assert.rejects(api.end(), /disabled/);
		assert.deepEqual(requests, [
			'https://test.invalid/bet/replay/split_party/1/mystery/7?language=de',
		]);
	} finally {
		globalThis.fetch = original;
	}
});
test('RGS API errors propagate, no silent preview fallback', async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(JSON.stringify({ error: { message: 'Session expired' } }), { status: 200 });
	try {
		await assert.rejects(
			createTransport(launch('?rgs_url=test.invalid&sessionID=unit-test')).authenticate(),
			/Session expired/,
		);
	} finally {
		globalThis.fetch = original;
	}
});
test('demo fixture cycle is explicit and prevents duplicate pending plays', async () => {
	const original = globalThis.fetch;
	globalThis.fetch = async () =>
		new Response(JSON.stringify({ books: fixtures.base }), { status: 200 });
	try {
		const api = createTransport(launch('?demo=1'));
		const auth = await api.authenticate();
		assert.equal(auth.balance.amount, 10000e6);
		const result = await api.play('base', 1, 'USD');
		assert.equal(result.balance.amount, 9999e6);
		await assert.rejects(api.play('base', 1, 'USD'), /Unfinished/);
		const resumed = await api.authenticate();
		assert.equal(resumed.round?.amount, 1e6);
		const end = await api.end();
		assert.equal(end.balance.amount, (9999 + fixtures.base[0].payoutMultiplier / 100) * 1e6);
	} finally {
		globalThis.fetch = original;
	}
});

// Server-render smoke test: no browser permissions or browser automation involved.
import App from '../src/App.svelte';
import { render } from 'svelte/server';
test('Svelte first render initializes locale before translating', () => {
	Object.assign(globalThis, {
		location: { search: '?demo=1' },
		document: { documentElement: { lang: '', dir: '' } },
	});
	const html = render(App).body;
	assert.match(html, /Blob Split/);
	// The first render is the loading screen (the splash follows once assets are preloaded).
	assert.match(html, /aria-label="Loading"/);
	assert.equal((html.match(/class="cell\b/g) ?? []).length, 49);
	assert.match(html, /Visual preview/);
	assert.match(html, /Balance/);
});
test('Spanish chrome and social English fallback use Veggie catalogs', () => {
	Object.assign(globalThis, {
		location: { search: '?demo=1&lang=es' },
		document: { documentElement: { lang: '', dir: '' } },
	});
	assert.match(render(App).body, /SALDO/i);
	Object.assign(globalThis, { location: { search: '?demo=1&lang=es&social=true' } });
	const html = render(App).body;
	assert.match(html, /Base play|Increase play amount/);
	assert.doesNotMatch(html, /Increase bet/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { replayAmountUnits } from '../../../packages/components-shared/src/replayAmount.ts';
import { normalizeRgsUrl } from '../../../packages/rgs-fetcher/src/rgsUrl.ts';
import { playerErrorKey } from '../src/game/uiErrors.ts';
import { socialEnglish } from '../src/game/platformConfig.ts';
import { rulesCopy } from '../src/i18n/rulesCopy.ts';
import { RULE_CONTROLS } from '../src/game/rulesPages.ts';
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('RGS host normalization preserves schemes/paths and never invents a different host', () => {
	for (const host of ['example.com', 'https://example.com', 'https://example.com/'])
		assert.equal(normalizeRgsUrl(host), 'https://example.com');
	assert.equal(normalizeRgsUrl('example.com/prefix/'), 'https://example.com/prefix');
	assert.equal(normalizeRgsUrl('localhost:3030', true), 'http://localhost:3030');
	assert.equal(normalizeRgsUrl('http://localhost:3030', true), 'http://localhost:3030');
	for (const host of [
		'',
		'ftp://example.com',
		'http://example.com',
		'https://user:secret@example.com',
		'example.com?host=other',
	])
		assert.throws(() => normalizeRgsUrl(host));
});

test('real RGS transport sends one mutation; handles HTTP failures and timeout without retries', async (t) => {
	let code = read('../../../packages/rgs-fetcher/src/rgsFetcher.ts')
		.replace(
			"'utils-fetcher'",
			JSON.stringify(
				new URL('../../../packages/utils-fetcher/src/fetcher.ts', import.meta.url).href,
			),
		)
		.replace(
			"'./rgsUrl'",
			JSON.stringify(new URL('../../../packages/rgs-fetcher/src/rgsUrl.ts', import.meta.url).href),
		);
	const { rgsFetcher } = await import(
		'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(code)).toString('base64')
	);
	const calls = [];
	t.mock.method(globalThis, 'fetch', async (url, options) => {
		calls.push({ url, options });
		return new Response(JSON.stringify({ balance: { amount: 1 } }), { status: 200 });
	});
	await rgsFetcher.post({
		rgsUrl: 'https://example.com',
		url: '/wallet/play',
		variables: { sessionID: 'mock', amount: 1000000, mode: 'BASE' },
	});
	assert.equal(calls[0].url, 'https://example.com/wallet/play');
	assert.equal(JSON.parse(calls[0].options.body).sessionID, 'mock');
	globalThis.fetch.mock.mockImplementation(
		async () => new Response(JSON.stringify({ message: 'raw private data' }), { status: 500 }),
	);
	await assert.rejects(
		rgsFetcher.get({ rgsUrl: 'example.com', url: '/bet/replay/a/b/c/d' }),
		(e) => e.error === 'ERR_GEN',
	);
	t.mock.timers.enable({ apis: ['setTimeout'] });
	globalThis.fetch.mock.mockImplementation(
		(url, options) =>
			new Promise((resolve, reject) =>
				options.signal.addEventListener('abort', () =>
					reject(new DOMException('Timed out', 'AbortError')),
				),
			),
	);
	const pending = assert.rejects(
		rgsFetcher.post({ rgsUrl: 'example.com', url: '/wallet/play', variables: {} }),
		/Timed out/,
	);
	t.mock.timers.tick(20_000);
	await pending;
	assert.equal(globalThis.fetch.mock.calls.length, 3);
});

test('all player error paths use safe catalog keys, never server text or dollar amounts', () => {
	for (const value of [
		new Error('BET $12 secret'),
		'<script>BUY</script>',
		{ error: 'ERR_GEN', message: 'funds $4' },
	])
		assert.equal(playerErrorKey(value), 'ERROR CONNECTION');
	for (const [code, key] of Object.entries({
		ERR_IPB: 'ERROR BALANCE',
		ERR_GLE: 'ERROR LIMIT',
		ERR_ACT: 'ERROR BUSY',
		ERR_VAL: 'ERROR SESSION',
		ERR_REPLAY_AMOUNT: 'ERROR REPLAY AMOUNT',
	}))
		assert.equal(playerErrorKey({ error: code, message: 'raw' }), key);
	const game = read('../src/components/Game.svelte');
	assert.match(game, /t\(playerErrorKey\(stateModal.modal.error\)\)/);
	assert.match(game, /id="balance-explanation"/);
	const primary = read('../../../packages/utils-xstate/src/createPrimaryMachines.ts');
	assert.match(
		primary,
		/catch \(error\) \{\s*stateBet.autoSpinsCounter = 0;\s*stateModal.modal = \{ name: 'error', error \};\s*console.error\(error\);\s*throw error;/,
	);
});

test('rules match published v8 extensions and cover current controls', () => {
	assert.match(rulesCopy['INFO SUPER BONUS COPY'], /1, 2, 3 or 5 spins; Retrigger adds 15/);
	assert.match(rulesCopy['INFO SUPER BONUS COPY'], /substitute.*up to 3/);
	for (const name of ['SOUND', 'MUSIC', 'STOP', 'FULLSCREEN', 'REPLAY'])
		assert.ok(RULE_CONTROLS.some((x) => x.title === name));
	const rules = read('../src/components/Rules.svelte');
	assert.match(rules, /t\('RULES RTP'\)/);
	const i18n = read('../src/i18n/index.ts');
	assert.match(i18n, /RTP: 96.1% in all modes/);
	assert.doesNotMatch(i18n, /Choose a spin count and stop limits/);
	assert.equal(socialEnglish('Applies to every paid spin.'), 'Applies to every play.');
	const social = socialEnglish(
		'Paytable. Paid out. Fund. Credit. Currency. Stake. Buy bonus. Total bet.',
	);
	assert.doesNotMatch(social, /\b(paytable|paid|fund|credit|currency|stake|buy|bet)\b/i);
});

test('Wild reward shows native symbol/count, then one native symbol per actual target', () => {
	const gate = read('../src/components/TempleGate.svelte'),
		flight = read('../src/game/gpuRewardFlight.ts');
	assert.match(gate, /loadRig\('WILD', 'symbols'\)/);
	assert.match(gate, /reward.positions.length/);
	assert.match(gate, /award.addChild\(wild.view\)/);
	assert.match(flight, /deliveryTargets\(delivery\).map/);
	assert.match(flight, /engine.pose\(wildData\)/);
	assert.doesNotMatch(flight, /\? 'WILD' : text/);
});

test('optional/invalid replay amounts fall back safely; boot never counts as a played replay', () => {
	const auth = read('../../../packages/components-shared/src/components/Authenticate.svelte');
	for (const value of [undefined, '', 0, -1, Infinity, NaN, 'invalid', 1.5])
		assert.equal(replayAmountUnits(value), 1_000_000);
	assert.equal(replayAmountUnits(5_000_000), 5_000_000);
	assert.match(auth, /const replayAmount = replayAmountUnits\(stateUrlDerived.amount\(\)\)/);
	assert.match(auth, /amount: replayAmount/);
	assert.match(
		auth,
		/const replayCurrency = stateUrlDerived.currency\(\) \|\| data.balance\?\.currency/,
	);
	assert.match(auth, /!Array.isArray\(data.state\) \|\| !data.state.length/);
	assert.match(auth, /!authenticateData\?\.balance\s*\|\|\s*!authenticateData\?\.config/);
	const state = read('../src/state/gatesStake.svelte.ts');
	assert.match(
		state,
		/!gatesStakeState.replayStartRequested && !gatesStakeState.replayObservedRunning/,
	);
});

test('board accessible text also uses social-safe translation', () => {
	assert.match(read('../src/components/Board.svelte'), /aria-label=\{t\('BOARD DESCRIPTION'\)\}/);
	assert.doesNotMatch(read('../src/components/Board.svelte'), /aria-label="[^"]*Pay/);
});

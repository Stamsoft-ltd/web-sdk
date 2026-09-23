// Regression: 320x568 bonus states previously made the underlying page 3px too tall.
// The short-screen HUD now reserves room for the paid-mode cost line.
/** Production-build presentation and asset checks; mocked RGS only.
 * PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node --experimental-strip-types tests/browser-presentations.mjs
 */
import assert from 'node:assert/strict';
import { previewEvents } from '../src/game/preview.ts';
import { COSTS } from '../src/game/contract.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3022';
const browser = await chromium.launch({ headless: true });
const errors = [],
	assetFailures = [],
	findings = [];
function check(ok, message) {
	if (!ok) findings.push(message);
}
const sizes = [
	[1440, 960],
	[1366, 768],
	[768, 1024],
	[390, 844],
	[320, 568],
	[844, 390],
];
const jurisdiction = {
	socialCasino: false,
	disabledFullscreen: false,
	disabledTurbo: false,
	disabledSuperTurbo: false,
	disabledAutoplay: false,
	disabledSlamstop: false,
	disabledSpacebar: false,
	disabledBuyFeature: false,
	displayNetPosition: false,
	displayRTP: false,
	displaySessionTimer: false,
	minimumRoundDuration: 0,
};
async function pageFor(mode, cap = false) {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 960 },
		reducedMotion: 'reduce',
	});
	page.setDefaultTimeout(20000);
	page.on('pageerror', (e) => errors.push(e.message));
	page.on('response', (r) => {
		if (r.url().startsWith(origin) && r.status() >= 400) assetFailures.push([r.status(), r.url()]);
	});
	const events = previewEvents(mode);
	// A 20x base payout exercises the Sweet Win celebration; small wins no longer open panels.
	if (mode === 'BASE' && !cap)
		for (const e of events)
			if (['spinWin', 'setTotalWin', 'setWin', 'finalWin'].includes(e.type)) e.amount = 2000;
	if (cap) {
		const final = events.at(-1);
		events.splice(events.length - 1, 0, { index: final.index, type: 'maxWin', amount: 2500000 });
		events.at(-1).index++;
		events.at(-1).amount = 2500000;
	}
	await page.route('https://gates-presentation.test/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		let data = {};
		if (path.endsWith('/wallet/authenticate'))
			data = {
				balance: { amount: 10000000000, currency: 'USD' },
				config: {
					minBet: 1000000,
					maxBet: 1000000,
					stepBet: 1000000,
					defaultBetLevel: 1000000,
					betLevels: [1000000],
					jurisdiction,
				},
			};
		if (path.endsWith('/wallet/play'))
			data = {
				balance: { amount: 10000000000 - COSTS[mode] * 1000000, currency: 'USD' },
				round: {
					betID: 456,
					mode,
					active: true,
					amount: 1000000,
					payout: events.at(-1).amount * 10000,
					payoutMultiplier: events.at(-1).amount / 100,
					event: '0',
					state: events,
				},
			};
		if (path.endsWith('/wallet/end-round'))
			data = { balance: { amount: 10000000000, currency: 'USD' } };
		await route.fulfill({ json: data });
	});
	await page.goto(`${origin}/?sessionID=presentations&rgs_url=gates-presentation.test`);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	return page;
}
async function assertDialogFits(page, label) {
	const bounds = await page.getByRole('dialog').evaluate((e) => {
		const r = e.getBoundingClientRect(),
			body =
				e.querySelector('.modal-body') ??
				e.querySelector('.win-stage') ??
				e.querySelector('.bonus-body'),
			button = e.querySelector('.gold-button').getBoundingClientRect();
		return {
			top: r.top,
			bottom: r.bottom,
			scroll: document.documentElement.scrollHeight,
			viewport: innerHeight,
			bodyScroll: e.matches('.win-tier-dialog') ? body.clientHeight : body.scrollHeight,
			bodyHeight: body.clientHeight,
			buttonBottom: button.bottom,
		};
	});
	check(
		bounds.top >= 0 && bounds.bottom <= bounds.viewport,
		`${label} outside viewport: ${JSON.stringify(bounds)}`,
	);
	check(bounds.scroll <= bounds.viewport, `${label} page scroll: ${JSON.stringify(bounds)}`);
	check(
		bounds.bodyScroll <= bounds.bodyHeight + 1,
		`${label} presentation content scroll: ${JSON.stringify(bounds)}`,
	);
	check(bounds.buttonBottom <= bounds.bottom, `${label} Continue clipped`);
}
try {
	for (const [mode, skin, title] of [
		['BONUS', 'normal', 'Normal bonus'],
		['SUPER', 'super', 'Super bonus'],
		['MYSTERY', 'hidden', 'Hidden bonus'],
	]) {
		const page = await pageFor(mode);
		await page.locator('.feature-button').click();
		await page.locator(`[data-mode="${mode}"]`).click();
		await page.getByRole('button', { name: 'Confirm', exact: true }).click();
		await page.getByRole('dialog', { name: title, exact: true }).waitFor();
		await page.locator('.bonus-crest').evaluate((img) => img.decode());
		await page.locator(`[data-spine-rig="bonus-${skin}"].ready`).waitFor();
		assert.match(
			await page.locator('.bonus-crest').getAttribute('src'),
			new RegExp(`${skin}-crest\\.png$`),
		);
		assert.equal((await page.locator('.bonus-stage h2').textContent()).trim(), '');
		assert.equal(await page.locator('.spin-award').textContent(), '15');
		await page.screenshot({ path: `/tmp/gates-${skin}-intro-desktop-v2.png` });
		for (const [width, height] of sizes) {
			await page.setViewportSize({ width, height });
			await assertDialogFits(page, `${skin} intro ${width}x${height}`);
		}
		await page.screenshot({ path: `/tmp/gates-${skin}-intro-landscape.png` });
		await page.setViewportSize({ width: 1440, height: 960 });
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		assert.match(
			await page.locator('.scene-art').getAttribute('src'),
			new RegExp(`scene-${skin}\\.png$`),
		);
		await page.screenshot({ path: `/tmp/gates-${skin}-registered.png` });
		await page.locator('.temple-gate.open .gate-reward').waitFor();
		await page.screenshot({ path: `/tmp/gates-${skin}-open-registered.png` });
		await page.getByRole('dialog', { name: 'Bonus complete', exact: true }).waitFor();
		await page.locator('.bonus-crest').evaluate((img) => img.decode());
		assert.match(await page.locator('.bonus-crest').getAttribute('src'), /complete-crest\.png$/);
		await page.locator('[data-spine-rig="bonus-complete"].ready').waitFor();
		await page.screenshot({ path: `/tmp/gates-${skin}-summary-desktop-v2.png` });
		for (const [width, height] of sizes) {
			await page.setViewportSize({ width, height });
			await assertDialogFits(page, `${skin} summary ${width}x${height}`);
		}
		await page.screenshot({ path: `/tmp/gates-${skin}-summary-landscape.png` });
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await page.getByRole('dialog').waitFor({ state: 'hidden' });
		await page.close();
		console.log(
			`PASS production ${skin}: registered background, open gate, 6 intro + 6 summary sizes audited (findings reported at end).`,
		);
	}
	for (const cap of [false, true]) {
		const page = await pageFor('BASE', cap);
		await page.setViewportSize({ width: 844, height: 390 });
		await page.getByRole('button', { name: 'Spin', exact: true }).click();
		await page.getByRole('dialog').waitFor();
		const start = performance.now();
		await assertDialogFits(page, cap ? 'max win' : 'win');
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await page.getByRole('dialog').waitFor({ state: 'hidden' });
		const elapsed = performance.now() - start;
		assert.ok(elapsed < 900, `early dismissal too slow: ${elapsed}ms`);
		console.log(
			`PASS production ${cap ? 'max-win' : 'win'} early dismissal: ${Math.round(elapsed)}ms after observed overlay.`,
		);
		await page.close();
	}
	assert.deepEqual(errors, []);
	assert.deepEqual(assetFailures, []);
	console.log('PASS: no production page errors or missing assets.');
	console.log('Layout findings:', findings);
	assert.deepEqual(findings, [], 'Presentation layout findings require UI fix');
} finally {
	await browser.close();
}

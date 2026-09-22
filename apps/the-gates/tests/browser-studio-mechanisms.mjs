/** Studio UX regression; fake RGS outcomes, no real bets. */
import assert from 'node:assert/strict';
import { displayBoard } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3022';
const errors = [];
let payout = 0,
	plays = 0;
const jurisdiction = {
	disabledTurbo: false,
	disabledSuperTurbo: false,
	disabledAutoplay: false,
	disabledBuyFeature: false,
	disabledSpacebar: false,
	minimumRoundDuration: 0,
};
try {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 960 },
		reducedMotion: 'no-preference',
	});
	page.on('pageerror', (e) => errors.push(e.message));
	await page.addInitScript(() => {
		window.winPanels = 0;
		let last = null;
		new MutationObserver(() => {
			const win = document.querySelector('dialog[data-win-tier]');
			if (win && win !== last) window.winPanels++;
			last = win;
		}).observe(document, { subtree: true, childList: true });
	});
	await page.route('https://studio-ui.test/**', async (route) => {
		const path = new URL(route.request().url()).pathname;
		let data = {};
		if (path.endsWith('authenticate'))
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
		if (path.endsWith('/play')) {
			plays++;
			const board = displayBoard();
			board[0][0] = { name: 'KEY' };
			const state = [
				{
					type: 'spinStart',
					spinId: 1,
					gameType: 'basegame',
					tier: null,
					freeSpin: 0,
					multiplier: 1,
					multiplierActive: false,
					stickyPositions: [],
				},
				{ type: 'reveal', board, spinId: 1, cascadeIndex: 0, gameType: 'basegame', movements: [] },
				{ type: 'spinWin', spinId: 1, rawAmount: payout, multiplier: 1, amount: payout },
				{ type: 'setTotalWin', amount: payout },
				{ type: 'finalWin', amount: payout },
			].map((e, index) => ({ ...e, index }));
			data = {
				balance: { amount: 9999000000, currency: 'USD' },
				round: {
					betID: plays,
					mode: 'BASE',
					active: true,
					amount: 1000000,
					payout: payout * 10000,
					payoutMultiplier: payout / 100,
					event: '0',
					state,
				},
			};
		}
		if (path.endsWith('end-round')) data = { balance: { amount: 10000000000, currency: 'USD' } };
		await route.fulfill({ json: data });
	});
	await page.goto(`${origin}/?sessionID=studio&rgs_url=studio-ui.test`);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	assert.equal(await page.getByAltText('Press Play').count(), 1);
	const speed = page.locator('.speed');
	assert.equal(await speed.getAttribute('data-speed'), 'normal');
	for (const next of ['fast', 'turbo', 'normal']) {
		await speed.click();
		assert.equal(await speed.getAttribute('data-speed'), next);
		assert.match(await speed.innerText(), new RegExp(next, 'i'));
	}
	await speed.click();
	const before = plays;
	await page.keyboard.press('Space');
	await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	assert.equal(plays, before + 1, 'Space after speed focus spins exactly once');
	assert.equal(await speed.getAttribute('data-speed'), 'fast');
	assert.equal(await page.locator('.cell[data-symbol="KEY"] .symbol-tag').count(), 0);
	for (const amount of [25, 1000]) {
		payout = amount;
		await page.locator('.spin-button').click();
		await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	}
	assert.equal(await page.evaluate(() => window.winPanels), 0, 'wins <=10x never open panels');
	payout = 2000;
	await page.locator('.spin-button').click();
	await page.getByRole('dialog', { name: 'Sweet Win', exact: true }).waitFor();
	const first = await page.locator('.win-amount').innerText();
	assert.notEqual(first, '$20.00', 'amount must count up');
	await page.waitForFunction(() => document.querySelector('.win-amount')?.textContent === '$20.00');
	await page.screenshot({ path: '/tmp/gates-counted-win.png' });
	await page.getByRole('dialog').waitFor({ state: 'hidden' });
	assert.equal(await page.evaluate(() => window.winPanels), 1);
	payout = 2001;
	await page.locator('.spin-button').click();
	await page.getByRole('dialog', { name: 'Sweet Win', exact: true }).waitFor();
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.waitForFunction(() => document.querySelector('.win-amount')?.textContent === '$20.01');
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('dialog').waitFor({ state: 'hidden' });
	for (const [width, height] of [
		[1440, 960],
		[1366, 600],
		[1280, 720],
		[1024, 600],
		[800, 600],
		[390, 844],
		[320, 568],
		[360, 640],
		[375, 667],
		[412, 915],
		[844, 390],
		[667, 375],
		[568, 320],
		[980, 450],
	]) {
		await page.setViewportSize({ width, height });
		await page.waitForFunction(() => {
			const r = document.querySelector('.control-deck').getBoundingClientRect();
			return r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
		});
		const b = await page.locator('.control-deck').boundingBox();
		assert.ok(b.y + b.height <= height);
	}
	await page.screenshot({ path: '/tmp/gates-fitted-hud.png' });
	assert.deepEqual(errors, []);
	console.log(
		'PASS: Press Play, 3 speeds, speed-focus Space spin, no KEY label, 20x+ tier panels, count-up, snap/dismiss, automatic close, 14 HUD viewports.',
	);
} finally {
	await browser.close();
}

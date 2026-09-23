/** Live skip + bonus speed regression. Mock RGS only; real CSS motion (not reduced). */
import assert from 'node:assert/strict';
import { previewEvents } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3022';
const browser = await chromium.launch({ headless: true });
const errors = [];
async function setup(mode, restrictions = {}, symbol = 'PURPLE_GEM') {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 960 },
		reducedMotion: 'no-preference',
	});
	page.setDefaultTimeout(20000);
	page.on('pageerror', (e) => errors.push(e.message));
	const events = previewEvents(mode);
	for (const event of events) {
		if (event.type === 'reveal')
			for (const col of event.board)
				for (const cell of col) if (cell?.name === 'PURPLE_GEM') cell.name = symbol;
		if (event.type === 'cascadeWin') for (const win of event.wins) win.symbol = symbol;
	}
	const trace = { plays: 0, checkpoints: [], ended: 0 };
	await page.route('https://motion.test/**', async (route) => {
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
					jurisdiction: {
						disabledTurbo: false,
						disabledSuperTurbo: false,
						disabledSpacebar: false,
						disabledSlamstop: false,
						disabledBuyFeature: false,
						minimumRoundDuration: 0,
						...restrictions,
					},
				},
			};
		if (path.endsWith('/play')) {
			trace.plays++;
			data = {
				balance: { amount: 9000000000, currency: 'USD' },
				round: {
					betID: 1,
					mode,
					active: true,
					amount: 1000000,
					payout: events.at(-1).amount * 10000,
					payoutMultiplier: events.at(-1).amount / 100,
					event: '0',
					state: events,
				},
			};
		}
		if (path.endsWith('/bet/event'))
			trace.checkpoints.push(Number(route.request().postDataJSON().event));
		if (path.endsWith('end-round')) {
			trace.ended++;
			data = { balance: { amount: 10000000000, currency: 'USD' } };
		}
		await route.fulfill({ json: data });
	});
	await page.goto(`${origin}/?sessionID=motion&rgs_url=motion.test`);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	return { page, events, trace };
}
async function settled(page, events, trace) {
	await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	assert.equal(trace.plays, 1, 'speed and Space never submit extra wagers');
	assert.equal(trace.ended, 1, 'exactly one wallet settlement');
	assert.deepEqual(
		trace.checkpoints,
		events.filter((e) => e.type === 'reveal').map((e) => e.index),
		'all reveals retained in order',
	);
	assert.equal(await page.locator('.win-display strong').innerText(), '$3.75');
}
try {
	for (const mode of ['BONUS', 'SUPER', 'MYSTERY']) {
		const { page, trace } = await setup(mode);
		await page.evaluate(() => {
			window.entryTiming = {};
			const observer = new MutationObserver(() => {
				const phase = document.querySelector('.board')?.dataset.phase;
				if (phase === 'settling' && !window.entryTiming.settling)
					window.entryTiming.settling = performance.now();
				if (document.querySelector('[data-bonus-stage="bonus"]') && !window.entryTiming.intro)
					window.entryTiming.intro = performance.now();
			});
			observer.observe(document.body, { subtree: true, attributes: true, childList: true });
		});
		await page.locator('.feature-button').click();
		await page.locator(`[data-mode="${mode}"]`).click();
		await page.getByRole('button', { name: 'Confirm', exact: true }).click();
		const dialog = page.locator('[data-bonus-stage="bonus"]');
		await dialog.waitFor();
		const timing = await page.evaluate(() => window.entryTiming);
		assert.ok(timing.intro - timing.settling >= 850, `entry grid hold: ${JSON.stringify(timing)}`);
		assert.equal(
			await dialog.getByRole('button', { name: 'Continue', exact: true }).isDisabled(),
			true,
			'entry guard',
		);
		await page.keyboard.press('Space');
		assert.equal(await dialog.isVisible(), true, 'trigger tap cannot dismiss bonus');
		await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
		assert.equal(await dialog.count(), 0);
		assert.equal(trace.plays, 1, 'one purchase only');
		await page.close();
	}
	for (const viewport of [
		{ width: 1440, height: 960 },
		{ width: 390, height: 844 },
	]) {
		const { page } = await setup('BASE');
		await page.setViewportSize(viewport);
		await page.getByRole('button', { name: 'Paytable & rules', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Paytable & rules', exact: true });
		assert.equal(await dialog.locator('[data-info-mode]').count(), 6);
		for (const mode of ['NORMAL', 'SUPER', 'HIDDEN', 'MYSTERY', 'CHANCE', 'FEATURE']) {
			const rule = dialog.locator(`[data-info-mode="${mode}"]`);
			await rule.scrollIntoViewIfNeeded();
			assert.ok((await rule.innerText()).length > 100);
		}
		assert.match(
			await dialog.locator('[data-info-mode="MYSTERY"]').innerText(),
			/65% Normal, 30% Super, or 5% Hidden/,
		);
		assert.match(await dialog.locator('[data-info-mode="HIDDEN"]').innerText(), /two rewards/);
		assert.match(
			await dialog.locator('[data-info-mode="SUPER"]').innerText(),
			/3- or 5-spin retrigger/,
		);
		assert.match(await dialog.locator('[data-info-mode="NORMAL"]').innerText(), /100×/);
		assert.equal(
			await dialog.evaluate((d) => d.scrollWidth <= d.clientWidth + 1),
			true,
			'no horizontal overflow',
		);
		await dialog.locator('[data-info-mode="NORMAL"]').scrollIntoViewIfNeeded();
		await page.screenshot({ path: `/tmp/gates-expanded-info-${viewport.width}.png` });
		await page.getByRole('button', { name: 'Close', exact: true }).click();
		await page.close();
	}
	assert.deepEqual(errors, []);
	console.log(
		'PASS: three bought tiers retain entry-grid hold and guard; all six info descriptions readable desktop/mobile.',
	);
} finally {
	await browser.close();
}

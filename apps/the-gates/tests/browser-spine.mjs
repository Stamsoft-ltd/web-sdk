/** Layered Spine art, architectural pulses and reduced motion. Mocked RGS only. */
import assert from 'node:assert/strict';
import { previewEvents } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3022';
const browser = await chromium.launch({ headless: true });
const errors = [],
	failedAssets = [];
async function setup(mode, restrictions = {}, symbol = 'PURPLE_GEM') {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 960 },
		deviceScaleFactor: 2,
		reducedMotion: 'no-preference',
	});
	page.setDefaultTimeout(20000);
	page.on('response', (r) => {
		if (r.url().startsWith(origin) && r.status() >= 400) failedAssets.push(r.url());
	});
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
async function changed(canvas, label) {
	const a = await canvas.evaluate((c) => c.toDataURL());
	await canvas.page().waitForTimeout(180);
	assert.notEqual(await canvas.evaluate((c) => c.toDataURL()), a, label);
}
try {
	for (const [mode, skin, title] of [
		['BASE', 'base', ''],
		['BONUS', 'normal', 'Normal bonus'],
		['SUPER', 'super', 'Super bonus'],
		['MYSTERY', 'hidden', 'Hidden bonus'],
	]) {
		const { page } = await setup(mode);
		await page.waitForFunction(
			() => document.querySelectorAll('.board [data-spine-rig].ready').length === 30,
		);
		if (mode !== 'BASE') {
			await page.locator('.feature-button').click();
			await page.locator(`[data-mode="${mode}"]`).click();
			await page.getByRole('button', { name: 'Confirm', exact: true }).click();
			await page.getByRole('dialog', { name: title, exact: true }).waitFor();
			const art = page.locator(`[data-spine-rig="bonus-${skin}"].ready`);
			await art.waitFor();
			await changed(art, 'layered bonus entrance moves');
			assert.ok(
				await art.evaluate((c) => c.width >= Math.round(c.clientWidth * 2) - 1),
				'DPR2 canvas is not downsampled',
			);
			await page.waitForTimeout(600);
			await page.screenshot({ path: `/tmp/gates-spine-${skin}-intro.png` });
			await page.getByRole('button', { name: 'Continue', exact: true }).click();
		}
		const bg = page.locator(`.temple-flames.ready[data-ambient="${skin}"]`);
		await bg.waitFor();
		await changed(bg, skin + ' flame/energy tracks move');
		await page.screenshot({ path: `/tmp/gates-spine-${skin}-ambient.png` });
		if (mode === 'BASE') {
			const symbol = page.locator('.board [data-spine-rig="CRYSTAL_ORB"]').first();
			await changed(symbol, 'orb idle moves independently of pedestal');
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.waitForFunction(() => !document.querySelector('.temple-flames'));
			await page.waitForTimeout(100);
			const frozen = await symbol.evaluate((c) => c.toDataURL());
			await page.waitForTimeout(180);
			assert.equal(
				await symbol.evaluate((c) => c.toDataURL()),
				frozen,
				'reduced motion freezes rig, not hides symbol',
			);
			await page.setViewportSize({ width: 390, height: 844 });
			await page.waitForTimeout(100);
			assert.equal(await page.locator('.board canvas.ready').count(), 30);
			await page.screenshot({ path: '/tmp/gates-spine-mobile.png' });
		}
		await page.close();
	}
	assert.deepEqual(errors, []);
	assert.deepEqual(failedAssets, []);
	console.log(
		'PASS: four animated mode backgrounds, three layered bonus entrances, live symbol idle, reduced-motion freeze, mobile resize; no missing assets/page errors.',
	);
} finally {
	await browser.close();
}

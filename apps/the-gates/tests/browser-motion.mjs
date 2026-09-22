/** Live skip + bonus speed regression. Mock RGS only; real CSS motion (not reduced). */
import assert from 'node:assert/strict';
import { previewEvents } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3022';
const browser = await chromium.launch({ headless: true });
const errors = [];
async function setup(mode, restrictions = {}) {
	const page = await browser.newPage({
		viewport: { width: 1440, height: 960 },
		reducedMotion: 'no-preference',
	});
	page.setDefaultTimeout(20000);
	page.on('pageerror', (e) => errors.push(e.message));
	const events = previewEvents(mode);
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
	const { page, events, trace } = await setup('BASE');
	await page.locator('.spin-button').click();
	await page.waitForFunction(() => document.querySelector('.board').dataset.phase === 'dropping');
	const before = await page
		.locator('.drop')
		.first()
		.evaluate((e) => e.style.getPropertyValue('--motion-duration'));
	await page.keyboard.press('Space');
	await page.waitForFunction(() => document.querySelector('.board').dataset.skipped === 'true');
	const after = await page
		.locator('.drop')
		.first()
		.evaluate((e) => e.style.getPropertyValue('--motion-duration'));
	assert.ok(
		parseFloat(after) <= parseFloat(before),
		'active fall shortened, not deferred to next spin',
	);
	await page.waitForFunction(() => document.querySelector('.board').dataset.waveSpeed === 'turbo');
	await page.waitForFunction(() => document.querySelector('.board').dataset.phase === 'gate');
	const opened = Date.now();
	await page.waitForFunction(() => document.querySelector('.board').dataset.phase !== 'gate');
	assert.ok(Date.now() - opened >= 650, 'skip preserves gate/reward presentation');
	await settled(page, events, trace);
	await page.screenshot({ path: '/tmp/gates-motion-settled.png' });
	await page.close();

	const bonus = await setup('BONUS');
	await bonus.page.locator('.feature-button').click();
	await bonus.page.locator('[data-mode="BONUS"]').click();
	await bonus.page.getByRole('button', { name: 'Confirm', exact: true }).click();
	await bonus.page.getByRole('dialog', { name: 'Normal bonus', exact: true }).waitFor();
	await bonus.page.waitForTimeout(150);
	await bonus.page.getByRole('button', { name: 'Continue', exact: true }).click();
	const speed = bonus.page.locator('.speed');
	assert.equal(await speed.isEnabled(), true, 'speed unlocked during bonus playback');
	assert.equal(await bonus.page.locator('.spin-button').isDisabled(), true, 'wager remains locked');
	for (const next of ['fast', 'turbo', 'normal']) {
		await speed.click();
		assert.equal(await speed.getAttribute('data-speed'), next);
	}
	await bonus.page.keyboard.press('Space');
	await bonus.page.waitForFunction(
		() => document.querySelector('.board').dataset.skipped === 'true',
	);
	await bonus.page.waitForFunction(
		() => document.querySelector('.board').dataset.skipped === 'false',
		null,
		{ timeout: 3000 },
	);
	for (const next of ['fast', 'turbo']) {
		await speed.click();
		assert.equal(await speed.getAttribute('data-speed'), next);
	}
	await bonus.page.getByRole('dialog', { name: 'Bonus complete', exact: true }).waitFor();
	await bonus.page.getByRole('dialog').waitFor({ state: 'hidden' });
	await settled(bonus.page, bonus.events, bonus.trace);
	await bonus.page.close();

	const restricted = await setup('BASE', { disabledSlamstop: true, disabledTurbo: true });
	assert.equal(await restricted.page.locator('.speed').isVisible(), false);
	await restricted.page.locator('.spin-button').click();
	await restricted.page.waitForFunction(
		() => document.querySelector('.board').dataset.phase === 'dropping',
	);
	await restricted.page.keyboard.press('Space');
	assert.equal(await restricted.page.locator('.board').getAttribute('data-skipped'), 'false');
	await settled(restricted.page, restricted.events, restricted.trace);
	assert.deepEqual(errors, []);
	console.log(
		'PASS: live Space skip, gravity timing, gate protection, bonus speed cycle, per-spin skip reset, restrictions, unchanged event order/payout and single wager/settlement.',
	);
} finally {
	await browser.close();
}

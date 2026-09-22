/** Local UI/RGS-contract smoke tests. Fixtures are scripted, not certified math.
 * PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node --experimental-strip-types tests/browser.mjs
 */
import assert from 'node:assert/strict';
import { previewEvents } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3020';
const errors = [];
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
function watch(page) {
	page.on('pageerror', (e) => (errors.push(e.message), console.error('PAGE ERROR', e.message)));
	page.setDefaultTimeout(15000);
}
try {
	if (process.env.GATES_PRODUCTION !== '1') {
		const page = await browser.newPage({
			viewport: { width: 1440, height: 960 },
			reducedMotion: 'reduce',
		});
		watch(page);
		await page.goto(`${origin}/?preview=true`);
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		assert.equal(await page.locator('.cell').count(), 30);
		for (const [width, height] of [
			[1440, 960],
			[1366, 768],
			[768, 1024],
			[390, 844],
			[320, 568],
			[844, 390],
		]) {
			await page.setViewportSize({ width, height });
			const bounds = await page.evaluate(() => ({
				w: document.documentElement.scrollWidth,
				h: document.documentElement.scrollHeight,
				bottom: document.querySelector('.spin-button').getBoundingClientRect().bottom,
			}));
			assert.ok(bounds.h <= height, `vertical overflow ${width}x${height}: ${bounds.h}`);
			assert.ok(bounds.w <= width, `horizontal overflow ${width}x${height}`);
			assert.ok(
				bounds.bottom <= height,
				`spin clipped ${width}x${height}: ${JSON.stringify(bounds)}`,
			);
		}

		// One architectural doorway; no painted/floating duplicate.
		assert.equal(await page.locator('.temple-gate').count(), 1);
		assert.equal(await page.locator('.gate-panel').count(), 0);
		assert.equal(await page.locator('.gate-frame, .gate-crown, .gate-steps').count(), 0);
		assert.match(await page.locator('.scene-art').getAttribute('src'), /scene-base\.png$/);
		assert.equal(await page.locator('.temple-gate').getAttribute('data-skin'), 'base');
		await page.setViewportSize({ width: 1440, height: 960 });
		assert.ok((await page.locator('.board-shell').boundingBox()).width > 780);
		await page.getByRole('button', { name: 'Enter the gates' }).click();
		const cards = await page
			.locator('.mode-card')
			.evaluateAll((es) =>
				es.map((e) => ({ y: e.getBoundingClientRect().y, x: e.getBoundingClientRect().x })),
			);
		assert.equal(cards.length, 5);
		assert.ok(
			cards.every((c) => c.y === cards[0].y),
			'feature cards must remain horizontal',
		);
		await page.screenshot({ path: '/tmp/gates-buy-desktop.png' });
		await page.locator('[data-mode="CHANCE"]').click();
		assert.equal(await page.getByRole('dialog').count(), 0, '2x activates without confirmation');
		assert.match(await page.locator('.bet-control').innerText(), /2\.00/);
		await page.locator('.feature-button').click(); // deactivate
		await page.getByRole('button', { name: 'Enter the gates' }).click();
		await page.locator('[data-mode="FEATURE"]').click();
		assert.match(await page.getByRole('dialog').innerText(), /20\.00/);
		await page.getByRole('button', { name: 'Cancel', exact: true }).click();
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: 'Enter the gates' }).click();
		await page.screenshot({ path: '/tmp/gates-buy-mobile.png' });
		await page.getByRole('button', { name: /Mystery bonus/ }).click();
		assert.match(await page.getByRole('dialog').innerText(), /\$400\.00/);
		await page.getByRole('button', { name: 'Confirm', exact: true }).click();
		await page.getByRole('dialog', { name: 'Hidden bonus', exact: true }).waitFor();
		assert.match(await page.getByRole('dialog').innerText(), /15/);
		assert.equal(await page.locator('.temple-gate').getAttribute('data-skin'), 'hidden');
		assert.match(await page.locator('.scene-art').getAttribute('src'), /scene-hidden\.png$/);
		await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
		const overlayBounds = await page.getByRole('dialog').evaluate((e) => ({
			height: e.getBoundingClientRect().height,
			page: document.documentElement.scrollHeight,
			viewport: innerHeight,
		}));
		assert.ok(overlayBounds.height <= overlayBounds.viewport);
		assert.ok(overlayBounds.page <= overlayBounds.viewport);
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await page.locator('.temple-gate.open .gate-reward').waitFor({ timeout: 30000 });
		await page.screenshot({ path: '/tmp/gates-hidden-open.png' });
		await page
			.getByRole('dialog', { name: 'Bonus complete', exact: true })
			.waitFor({ timeout: 30000 });
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await page.getByRole('button', { name: 'Spin', exact: true }).waitFor();
		assert.match(await page.locator('.win-display').innerText(), /7\.50/);
		await page.close();
	}
	// Mock transport, not real RGS. Check scales, no duplicate play, and exact fractional win.
	const live = await browser.newPage({ reducedMotion: 'reduce' });
	watch(live);
	const calls = [];
	let balance = 1000000000;
	const quarter = previewEvents('BASE');
	for (const e of quarter) {
		if (['spinWin', 'setTotalWin', 'setWin', 'finalWin'].includes(e.type)) e.amount = 25;
	}
	const book = {
		betID: 123,
		mode: 'BASE',
		active: true,
		amount: 100000,
		payout: 25000,
		payoutMultiplier: 0.25,
		event: '0',
		state: quarter,
	};
	await live.route('https://gates-ui.test/**', async (route) => {
		const url = route.request().url();
		calls.push({ url, body: route.request().postDataJSON() });
		let data = {};
		if (url.endsWith('/wallet/authenticate'))
			data = {
				balance: { amount: balance, currency: 'USD' },
				config: {
					minBet: 100000,
					maxBet: 1000000,
					stepBet: 100000,
					defaultBetLevel: 100000,
					betLevels: [100000, 200000, 1000000],
					jurisdiction,
				},
			};
		else if (url.endsWith('/wallet/play')) {
			balance -= 100000;
			data = { balance: { amount: balance, currency: 'USD' }, round: book };
		} else if (url.endsWith('/wallet/end-round')) {
			balance += 25000;
			data = { balance: { amount: balance, currency: 'USD' } };
		}
		await route.fulfill({ json: data });
	});
	await live.goto(`${origin}/?sessionID=ui-test&rgs_url=gates-ui.test`);
	await live.getByRole('button', { name: 'Continue', exact: true }).click();
	await live.getByRole('button', { name: 'Spin', exact: true }).click();

	await live.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	assert.equal(await live.getByRole('dialog').count(), 0, 'quarter win must not open a win panel');
	assert.match(await live.locator('.win-display').innerText(), /\$0\.025/);
	const plays = calls.filter((c) => c.url.endsWith('/wallet/play'));
	assert.equal(plays.length, 1);
	assert.equal(plays[0].body.amount, 100000);
	assert.equal(plays[0].body.mode, 'BASE');
	assert.equal(calls.filter((c) => c.url.endsWith('/wallet/end-round')).length, 1);
	await live.close();

	const replay = await browser.newPage({ reducedMotion: 'reduce' });
	watch(replay);
	const replayCalls = [];
	await replay.route('https://gates-ui.test/**', async (route) => {
		replayCalls.push(route.request().url());
		await route.fulfill({ json: { ...book, mode: 'SUPER', payoutMultiplier: 25 } });
	});
	await replay.goto(
		`${origin}/?replay=true&rgs_url=gates-ui.test&game=gates&version=1&mode=SUPER&event=12&amount=100000&currency=USD`,
	);
	await replay.getByRole('dialog', { name: 'Replay', exact: true }).waitFor();
	assert.match(await replay.getByRole('dialog').innerText(), /\$30\.00/);
	assert.match(await replay.getByRole('dialog').innerText(), /\$0\.025/);
	await replay.getByRole('button', { name: 'Play replay', exact: true }).click();
	await replay.getByRole('dialog', { name: 'Replay', exact: true }).waitFor({ timeout: 30000 });
	assert.equal(replayCalls.length, 1);
	assert.ok(replayCalls[0].includes('/bet/replay/'));
	await replay.close();
	assert.deepEqual(errors, []);
	console.log(
		process.env.GATES_PRODUCTION === '1'
			? 'PASS production: fractional win, wallet scales, replay no-wallet contract.'
			: 'PASS: 6 viewport sizes, 15-spin Mystery flow, fractional win, wallet scales, replay no-wallet contract.',
	);
} catch (error) {
	for (const page of browser.contexts().flatMap((c) => c.pages()))
		console.error(page.url(), (await page.locator('body').innerText()).slice(-3500));
	throw error;
} finally {
	await browser.close();
}

/** Live skip + bonus speed regression. Mock RGS only; real CSS motion (not reduced). */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
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
	for (const speed of ['normal', 'fast', 'turbo']) {
		const { page, events, trace } = await setup('BASE');
		for (let i = 0; i < ['normal', 'fast', 'turbo'].indexOf(speed); i++)
			await page.locator('.speed').click();
		await page.evaluate(() => {
			window.ashSamples = [];
			let active = false,
				started = 0;
			function sample() {
				const all = [...document.querySelectorAll('[data-symbol-ash="active"]')];
				if (all.length) {
					if (!active) {
						active = true;
						started = performance.now();
					}
					const c = all[0],
						ctx = c.getContext('2d'),
						pixels = ctx.getImageData(0, 0, c.width, c.height).data;
					let alpha = 0,
						saturation = 0;
					for (let i = 0; i < pixels.length; i += 4) {
						alpha += pixels[i + 3];
						saturation +=
							((Math.max(...pixels.slice(i, i + 3)) - Math.min(...pixels.slice(i, i + 3))) *
								pixels[i + 3]) /
							255;
					}
					window.ashSamples.push({
						elapsed: performance.now() - started,
						count: all.length,
						alpha,
						saturation,
						outside: all.some((c) => !c.closest('.cell.removing') || c.closest('.cell.sticky')),
						wrapper: getComputedStyle(c.closest('.symbol-motion')).animationName,
						image: c.toDataURL(),
					});
				} else if (active) {
					window.ashEnded = performance.now() - started;
					return;
				}
				requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		await page.locator('.spin-button').click();
		await page.waitForFunction(() => window.ashEnded > 0);
		const { samples, elapsed } = await page.evaluate(() => ({
			samples: window.ashSamples,
			elapsed: window.ashEnded,
		}));
		assert.ok(samples.length >= 2, `${speed}: observable ash frames`);
		assert.ok(
			samples.every((s) => s.count === 8 && !s.outside),
			'only server removal positions',
		);
		assert.ok(
			samples.every((s) => s.wrapper === 'none'),
			'no old shrink/fade hides the ash',
		);
		assert.ok(samples.at(-1).alpha < samples[0].alpha * 0.25, 'flakes disappear by removal end');
		assert.ok(
			samples.at(-1).saturation <= Math.max(1, samples[0].saturation * 0.25),
			'symbol chars rather than only moves',
		);
		assert.ok(elapsed < 400, 'no additional playback delay');
		if (speed === 'normal')
			for (const [i, s] of samples.entries())
				writeFileSync(`/tmp/gates-ash-${i}.png`, Buffer.from(s.image.split(',')[1], 'base64'));
		await settled(page, events, trace);
		assert.equal(
			await page.locator('[data-symbol-ash]').count(),
			0,
			'ash cleans up at next reveal',
		);
		console.log(speed, {
			frames: samples.length,
			elapsed,
			initialAlpha: samples[0].alpha,
			finalAlpha: samples.at(-1).alpha,
		});
		await page.close();
	}
	const skipped = await setup('BASE');
	await skipped.page.locator('.spin-button').click();
	await skipped.page.waitForFunction(() => document.querySelector('[data-symbol-ash="active"]'));
	const skipStart = Date.now();
	await skipped.page.keyboard.press('Space');
	await skipped.page.waitForFunction(() => !document.querySelector('[data-symbol-ash="active"]'));
	assert.ok(Date.now() - skipStart < 300, 'Space shortens active ash, no restart');
	await settled(skipped.page, skipped.events, skipped.trace);
	await skipped.page.close();
	const reduced = await setup('BASE');
	await reduced.page.emulateMedia({ reducedMotion: 'reduce' });
	await reduced.page.waitForFunction(() =>
		document.querySelector('.temple').classList.contains('reduced'),
	);
	await reduced.page.evaluate(() => {
		window.sawAsh = false;
		window.ashObserver = new MutationObserver(() => {
			window.sawAsh ||= !!document.querySelector('[data-symbol-ash="active"]');
		});
		window.ashObserver.observe(document.body, { subtree: true, attributes: true });
	});
	await reduced.page.locator('.spin-button').click();
	await settled(reduced.page, reduced.events, reduced.trace);
	assert.equal(
		await reduced.page.evaluate(() => {
			window.ashObserver.disconnect();
			return window.sawAsh;
		}),
		false,
	);
	await reduced.page.close();
	assert.deepEqual(errors, []);
} finally {
	await browser.close();
}

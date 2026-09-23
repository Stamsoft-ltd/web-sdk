/** Exact thresholds, text-only low wins, five tiers, bonus spin wins; mocked RGS only. */
import assert from 'node:assert/strict';
import { displayBoard } from '../src/game/preview.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
const origin = process.env.GATES_ORIGIN || 'http://127.0.0.1:3023';
let amount = 0,
	bonus = false,
	plays = 0,
	settlements = 0;
const errors = [];
try {
	const page = await browser.newPage({
		viewport: { width: 1366, height: 768 },
		reducedMotion: 'no-preference',
	});
	page.setDefaultTimeout(15000);
	page.on('pageerror', (e) => errors.push(e.message));
	await page.route('https://win-tiers.test/**', async (route) => {
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
						minimumRoundDuration: 0,
						disabledTurbo: false,
						disabledSuperTurbo: false,
					},
				},
			};
		if (path.endsWith('/play')) {
			plays++;
			const spin = (id, payout) => [
				{
					type: 'spinStart',
					spinId: id,
					gameType: id ? 'freegame' : 'basegame',
					tier: id ? 'hidden' : null,
					freeSpin: id,
					multiplier: 1,
					multiplierActive: false,
					stickyPositions: [],
				},
				{
					type: 'reveal',
					spinId: id,
					cascadeIndex: 0,
					board: displayBoard(),
					movements: [],
					gameType: id ? 'freegame' : 'basegame',
				},
				{ type: 'spinWin', spinId: id, rawAmount: payout, multiplier: 1, amount: payout },
				{ type: 'setTotalWin', amount: payout },
			];
			const events = bonus
				? [
						...spin(0, 0),
						{ type: 'freeSpinTrigger', tier: 'hidden', totalFs: 15 },
						...spin(1, amount),
						{ type: 'freeSpinEnd', tier: 'hidden', amount, spinsPlayed: 15, totalSpinsAwarded: 15 },
					]
				: spin(0, amount);
			events.push({ type: 'finalWin', amount });
			data = {
				balance: { amount: 9999000000, currency: 'USD' },
				round: {
					betID: plays,
					active: true,
					mode: 'BASE',
					amount: 1000000,
					payout: amount * 10000,
					payoutMultiplier: amount / 100,
					event: '0',
					state: events.map((e, index) => ({ ...e, index })),
				},
			};
		}
		if (path.endsWith('end-round')) {
			settlements++;
			data = { balance: { amount: 10000000000, currency: 'USD' } };
		}
		await route.fulfill({ json: data });
	});
	await page.goto(`${origin}/?sessionID=wins&rgs_url=win-tiers.test`);
	// PNGs may report complete/naturalWidth even when Chromium only decodes a top strip.
	for (const file of [
		'sweet-plaque',
		'wild-plaque',
		'epic-plaque',
		'mythic-plaque',
		'legendary-plaque',
		'coin',
		'sweet-title',
		'wild-title',
		'epic-title',
		'mythic-title',
		'legendary-title',
		'win-title',
		'max-title',
	]) {
		const rows = await page.evaluate(async (file) => {
			const image = new Image();
			image.src = `./assets/the-gates/wins/${file}.png`;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const ctx = canvas.getContext('2d');
			ctx.drawImage(image, 0, 0);
			return [0.4, 0.65].map((fraction) => {
				const pixels = ctx.getImageData(
					0,
					Math.floor(canvas.height * fraction),
					canvas.width,
					1,
				).data;
				return pixels.filter((v, i) => i % 4 === 3 && v > 128).length / canvas.width;
			});
		}, file);
		assert.ok(
			rows.every((coverage) => coverage > 0.2),
			`${file}: truncated browser PNG decode: ${rows}`,
		);
	}
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	for (const value of [
		999, 1000, 1999, 2000, 4999, 5000, 9999, 10000, 19999, 20000, 49999, 50000,
	]) {
		amount = value;
		await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
		await page.locator('.spin-button').click();
		if (value < 1000) {
			await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
			assert.equal(await page.locator('.inline-win, .win-tier-dialog').count(), 0);
		} else if (value < 2000) {
			await page.locator('.inline-win').waitFor();
			assert.equal(await page.getByRole('dialog').count(), 0);
			assert.equal(await page.locator('.win-coins').count(), 0);
			assert.match(await page.locator('.inline-win-art').getAttribute('src'), /win-title\.png$/);
			await page.locator('.inline-win').waitFor({ state: 'hidden' });
		} else {
			const key =
				value >= 50000
					? 'legendary'
					: value >= 20000
						? 'mythic'
						: value >= 10000
							? 'epic'
							: value >= 5000
								? 'wild'
								: 'sweet';
			const dialog = page.locator(`dialog[data-win-tier="${key}"]`);
			await dialog.waitFor();
			assert.equal(await dialog.locator('h2').textContent(), '');
			assert.match(
				await dialog.locator('.lettering').getAttribute('src'),
				new RegExp(`${key}-title\\.png$`),
			);
			await dialog.locator('.lettering').evaluate((img) => img.decode());
			await dialog.locator(`[data-spine-rig="win-${key}"].ready`).waitFor();
			assert.equal(
				await dialog.locator('.win-amount').getAttribute('data-final-amount'),
				String(value),
			);
			await page.waitForFunction(() => {
				const c = document.querySelector('.win-coins');
				if (!c || !c.width) return false;
				return c
					.getContext('2d')
					.getImageData(0, 0, c.width, c.height)
					.data.some((v, i) => i % 4 === 3 && v > 0);
			});
			await page.waitForFunction(() => {
				const img = document.querySelector('.win-tier-title img');
				return img?.complete && img.naturalWidth > 0;
			});
			if ([2000, 5000, 10000, 20000, 50000].includes(value))
				await page.screenshot({ path: `/tmp/gates-original-${key}.png` });
			if (value === 50000) {
				for (const [width, height] of [
					[1366, 768],
					[390, 844],
					[320, 568],
					[844, 390],
				]) {
					await page.setViewportSize({ width, height });
					await page.waitForTimeout(80);
					const box = await dialog.locator('.gold-button').boundingBox();
					assert.ok(box.y >= 0 && box.y + box.height <= height);
					await page.screenshot({ path: `/tmp/gates-legendary-${width}x${height}.png` });
				}
			}
			await dialog.getByRole('button', { name: 'Continue' }).click();
			await page.waitForTimeout(150);
			await dialog.getByRole('button', { name: 'Continue' }).click();
			await dialog.waitFor({ state: 'hidden' });
		}
	}
	await page.emulateMedia({ reducedMotion: 'reduce' });
	bonus = true;
	amount = 50000;
	await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	await page.locator('.spin-button').click();
	await page.getByRole('dialog', { name: 'Hidden bonus', exact: true }).waitFor();
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('dialog', { name: 'Legendary Win', exact: true }).waitFor();
	assert.equal(await page.locator('.win-coins').count(), 0);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await page.getByRole('dialog', { name: 'Bonus complete', exact: true }).waitFor();
	await page.getByRole('dialog').waitFor({ state: 'hidden' });
	await page.waitForFunction(() => !document.querySelector('.spin-button').disabled);
	assert.equal(plays, 13);
	assert.equal(settlements, 13);
	assert.deepEqual(errors, []);
	console.log(
		'PASS: 12 threshold boundaries, inline-only 10x..<20x, five tiers, visible coin fountain, bonus spin tiers, reduced motion, four layouts, single settlement.',
	);
} finally {
	await browser.close();
}

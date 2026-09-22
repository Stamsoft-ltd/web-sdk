/** Board/title layout regression; production app with mocked authentication only. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', (e) => errors.push(e.message));
	await page.route('https://layout.test/**', (route) =>
		route.fulfill({
			json: {
				balance: { amount: 10000000000, currency: 'USD' },
				config: {
					minBet: 1000000,
					maxBet: 1000000,
					stepBet: 1000000,
					defaultBetLevel: 1000000,
					betLevels: [1000000],
					jurisdiction: { minimumRoundDuration: 0 },
				},
			},
		}),
	);
	await page.goto(
		`${process.env.GATES_ORIGIN || 'http://127.0.0.1:3022'}/?sessionID=layout&rgs_url=layout.test`,
	);
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	for (const [width, height] of [
		[2366, 1046],
		[1920, 1080],
		[1440, 960],
		[1366, 768],
		[1280, 720],
		[1024, 600],
		[800, 600],
		[768, 1024],
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
		await page.waitForTimeout(100);
		const bounds = await page.evaluate(() => {
			const rect = (selector) => {
				const r = document.querySelector(selector).getBoundingClientRect();
				return {
					x: r.x,
					y: r.y,
					right: r.right,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
					center: r.x + r.width / 2,
				};
			};
			return {
				logo: rect('.board-heading .wordmark'),
				title: rect('.board-heading h1'),
				board: rect('.board-shell'),
				hud: rect('.control-deck'),
				studio: rect('.studio-mark'),
				left: rect('.left-hud'),
				scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
				baseLabel: [...document.querySelectorAll('p')].some(
					(e) => e.textContent.trim() === 'Base game',
				),
			};
		});
		console.log(`${width}x${height}`, JSON.stringify(bounds));
		assert.equal(bounds.baseLabel, false);
		if (width > 800 || height <= 500) {
			assert.ok(
				Math.abs(bounds.left.x - (bounds.board.x - bounds.left.right)) < 2,
				'left HUD must have equal screen-edge and board gaps',
			);
		}
		assert.ok(
			bounds.board.width >= Math.min(width * 0.5, height * 0.45),
			'board must not collapse into gate column',
		);
		assert.ok(Math.abs(bounds.logo.center - bounds.board.center) < 1, 'logo must center on board');
		assert.ok(bounds.board.y - bounds.title.bottom >= 6, 'title clears extended board frame');
		assert.ok(
			bounds.board.y >= 0 && bounds.board.bottom + 5 <= bounds.hud.y,
			'board/frame stays above HUD',
		);
		assert.ok(bounds.board.x >= 5 && bounds.board.right <= width - 5, 'board frame fits viewport');
		assert.ok(bounds.hud.bottom <= height, 'HUD stays onscreen');
		assert.deepEqual(bounds.scroll, [width, height], 'no page scroll');
		assert.ok(
			bounds.studio.bottom <= bounds.left.y ||
				bounds.studio.right <= bounds.left.x ||
				bounds.left.right <= bounds.studio.x,
			'studio mark clears left HUD',
		);
		if (width > 800 && height > 500)
			assert.ok(
				Math.abs(bounds.logo.center - width / 2) > 20,
				'desktop logo follows offset board, not screen',
			);
		if (width === 1366)
			assert.ok(bounds.board.width > (height - 270) * 1.15, 'board larger than prior height cap');
		if (
			[
				[1440, 960],
				[390, 844],
				[320, 568],
				[844, 390],
			].some(([w, h]) => w === width && h === height)
		)
			await page.screenshot({ path: `/tmp/gates-board-${width}x${height}.png` });
	}
	assert.deepEqual(errors, []);
	console.log(
		'PASS: larger board, board-centered compact logo, no base label, frame/logo/HUD clearance and 17 viewport sizes.',
	);
} finally {
	await browser.close();
}

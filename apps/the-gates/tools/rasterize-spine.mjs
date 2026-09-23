/** Build-only SVG layer rasterization. Uses browser PNG encoder; preserves authored alpha. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dir = fileURLToPath(new URL('../static/assets/the-gates/spine/', import.meta.url));
const browser = await chromium.launch({ headless: true });
try {
	const page = await browser.newPage();
	const png = await page.evaluate(
		async (svg) => {
			const img = new Image();
			img.src = 'data:image/svg+xml;base64,' + btoa(svg);
			await img.decode();
			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.getContext('2d').drawImage(img, 0, 0);
			return canvas.toDataURL('image/png').split(',')[1];
		},
		readFileSync(dir + 'energy.svg', 'utf8'),
	);
	writeFileSync(dir + 'energy.png', Buffer.from(png, 'base64'));
} finally {
	await browser.close();
}

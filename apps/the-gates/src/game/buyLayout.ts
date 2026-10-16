/** Original authored cards stay 355x295. Only row capacity and uniform zoom change. */
export const BUY_CARD = { width: 355, height: 295 };
export const BUY_MENU_PADDING = 24;
export function fitBuyMenu(viewportWidth: number, viewportHeight: number, active = false) {
	const availableWidth = Math.max(0, viewportWidth - 24);
	const availableHeight = Math.max(0, viewportHeight - 24);
	let best = { width: 0, height: 0, scale: -1, columns: 1, rows: 5 };
	for (let columns = 1; columns <= 5; columns++) {
		const rows = Math.ceil(5 / columns);
		const width = columns * BUY_CARD.width + BUY_MENU_PADDING * 2;
		const height = rows * BUY_CARD.height + 44 + 140 + BUY_MENU_PADDING * 2 + (active ? 60 : 0);
		const scale = Math.min(1, availableWidth / width, availableHeight / height);
		const empty = rows * columns - 5;
		const bestEmpty = best.rows * best.columns - 5;
		if (scale > best.scale + 1e-9 || (Math.abs(scale - best.scale) < 1e-9 && empty < bestEmpty))
			best = { width, height, scale, columns, rows };
	}
	return best;
}

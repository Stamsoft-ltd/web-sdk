// Where the "PRESS TO CONTINUE" prompt sits (CSS `bottom`, px). Portrait phones have a full HUD at
// the bottom (control bar + BALANCE/BET/WIN row), so the prompt goes just ABOVE the control bar
// (clearing the round spin disc that bulges above it) instead of over the bet row. Desktop puts it
// just above its bottom bar too (the default low position landed on the bar's lower edge). Landscape
// has no bottom bar and keeps the default low position.
export const continueBottom = (fallback: string) => {
	if (typeof document === 'undefined') return fallback;
	const above = (top: number) => `${Math.round(window.innerHeight - top + 8)}px`;
	const bar = document.querySelector('.pt-controls')?.getBoundingClientRect();
	if (bar && bar.width > 0) {
		const spin = document.querySelector('.pt-spin')?.getBoundingClientRect();
		return above(Math.min(bar.top, spin && spin.width ? spin.top : bar.top));
	}
	const desktopBar = document.querySelector('.hud-bottom')?.getBoundingClientRect();
	if (desktopBar && desktopBar.width > 0 && desktopBar.height > 0) return above(desktopBar.top);
	return fallback;
};

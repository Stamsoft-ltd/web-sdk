// Where the "PRESS TO CONTINUE" prompt sits (CSS `bottom`, px). Portrait phones have a full HUD at
// the bottom (control bar + BALANCE/BET/WIN row), so the prompt goes just ABOVE the control bar
// (clearing the round spin disc that bulges above it) instead of over the bet row. Desktop and
// landscape keep the default low position.
export const continueBottom = (fallback: string) => {
	if (typeof document === 'undefined') return fallback;
	const bar = document.querySelector('.pt-controls')?.getBoundingClientRect();
	if (!bar || bar.width === 0) return fallback;
	const spin = document.querySelector('.pt-spin')?.getBoundingClientRect();
	const top = Math.min(bar.top, spin && spin.width ? spin.top : bar.top);
	return `${Math.round(window.innerHeight - top + 8)}px`;
};

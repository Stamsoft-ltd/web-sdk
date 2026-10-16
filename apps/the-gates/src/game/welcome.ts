/** Entry presentation only; never owns wallet, wagers, or outcomes. */
export const WELCOME_ROTATION_MS = 3000;
export const WELCOME_CARDS = [
	{ value: 'CASCADING WINS', text: 'INTRO CASCADING COPY' },
	{ value: 'MAX WIN 25,000×', text: 'INTRO MAX WIN COPY' },
	{ value: 'THREE BONUS MODES', text: 'INTRO BONUS MODES COPY' },
] as const;

export function welcomeSlide(index: number, direction: number) {
	const count = WELCOME_CARDS.length;
	return (((index + direction) % count) + count) % count;
}

export function welcomeSwipe(dx: number, dy: number) {
	return Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 1 : -1) : 0;
}

export function fitWelcome(width: number, height: number) {
	const portrait = width < height;
	const compact = !portrait && height < 540;
	const frameWidth = portrait ? 360 : compact ? 960 : 1200;
	const frameHeight = portrait ? 600 : compact ? 480 : 680;
	return {
		portrait,
		compact,
		width: frameWidth,
		height: frameHeight,
		scale: Math.max(0.01, Math.min(width / frameWidth, height / frameHeight, 1.6)),
	};
}

export function startWelcomeRotation(
	advance: () => void,
	clock: Pick<typeof globalThis, 'setInterval' | 'clearInterval'> = globalThis,
) {
	const timer = clock.setInterval(advance, WELCOME_ROTATION_MS);
	return () => clock.clearInterval(timer);
}

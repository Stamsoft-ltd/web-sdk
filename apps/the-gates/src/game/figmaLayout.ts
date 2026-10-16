import { PORTRAIT_LAYOUT } from './panelLayout.ts';

/** Native frame opening, measured without editing the source PNG (1494 × 1052). */
export const BOARD_WINDOW = {
	left: 91 / 1494,
	top: 103 / 1052,
	width: 1312 / 1494,
	height: 830 / 1052,
};

/** Desktop source + requested portrait / right-sidebar landscape adaptations. */
export function fitFigmaLayout(
	viewportWidth: number,
	viewportHeight: number,
	mobileDevice = false,
) {
	const portrait = viewportWidth / Math.max(1, viewportHeight) < 1;
	const compact = mobileDevice && !portrait;
	const width = portrait ? 360 : compact ? 800 : 1200;
	const height = portrait ? PORTRAIT_LAYOUT.height : compact ? 360 : 680;
	const scale = Math.max(0, Math.min(viewportWidth / width, (viewportHeight - 14) / height));
	const introHeight = portrait ? 740 : compact ? 340 : height;
	const introScale = Math.max(0, Math.min(scale, (viewportHeight - 14) / introHeight));
	return { portrait, compact, width, height, scale, introScale };
}

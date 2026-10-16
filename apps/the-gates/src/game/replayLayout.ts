/** Fixed-ratio replay card scales as a unit; short windows never clip the action. */
export function fitReplaySummary(width: number, height: number) {
	const portrait = width < height;
	const compact = !portrait && height < 480;
	const w = portrait ? 360 : compact ? 760 : 680,
		h = portrait ? 600 : compact ? 330 : 530;
	return {
		width: w,
		height: h,
		portrait,
		compact,
		scale: Math.min(1, Math.max(1, width - 24) / w, Math.max(1, height - 24) / h),
	};
}
export function formatReplayMultiplier(value: number, locale = 'en') {
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number.isFinite(value) && value >= 0 ? value : 0)}×`;
}

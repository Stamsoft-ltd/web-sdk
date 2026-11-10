/** Presentation only. A circular close; never changes award/event state. */
export const PORTAL_CLOSE_MS = { normal: 500, fast: 260, turbo: 220 } as const;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
export function portalCloseFrame(progress: number, reduced = false) {
	const p = clamp(progress),
		q = p * p * (3 - 2 * p);
	return {
		progress: p,
		scale: reduced
			? 1
			: p < 0.16
				? 1 - (0.06 * p) / 0.16
				: 0.94 - 0.935 * Math.pow((p - 0.16) / 0.84, 1.15),
		alpha: reduced ? 1 - p : 1 - clamp((p - 0.72) / 0.28),
		rotation: reduced ? 0 : q * 1.7,
		pin: reduced || p <= 0.62 || p >= 1 ? 0 : Math.sin((Math.PI * (p - 0.62)) / 0.38),
	};
}
export const gateCloseProgress = (time: number) =>
	clamp((time - (2.18 - (0.33 * 500) / 1300)) / ((0.33 * 500) / 1300));
export const portalPalette = (tier: string | null | undefined) =>
	tier === 'normal'
		? 0xf866df
		: tier === 'super'
			? 0x86e6ff
			: tier === 'hidden'
				? 0xff7e54
				: 0xffd340;

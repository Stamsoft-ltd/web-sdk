// Exit for popups (svelte `out:` transition): a quick swell to 1.1, then a collapse to nothing while
// it fades (1 → 1.1 → 0), so a panel goes with a beat instead of just thinning away. Uses the
// standalone `scale` property, so it composes with the element's own transform / keyframes.
export const popOut = (_node: Element, { duration = 260 }: { duration?: number } = {}) => ({
	duration,
	css: (t: number) => {
		const u = 1 - t; // svelte runs an out transition from t = 1 down to 0
		const s = u < 0.35 ? 1 + 0.1 * Math.sin((u / 0.35) * (Math.PI / 2)) : 1.1 * (1 - ((u - 0.35) / 0.65) ** 2);
		const a = u < 0.35 ? 1 : 1 - ((u - 0.35) / 0.65) ** 2;
		return `scale: ${s}; opacity: ${a};`;
	},
});

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Entrance for popups (svelte `in:`), the mirror of popOut: the panel rises a little from below,
// swells past full size and settles (a damped spring), fading in over the first third. Standalone
// `scale` / `translate`, so it composes with the panel's centring transform and its fit-scale.
export const popIn = (_node: Element, { duration = 460, delay = 40 }: { duration?: number; delay?: number } = {}) =>
	reducedMotion()
		? { duration: 0 }
		: {
				duration,
				delay,
				css: (t: number) => {
					const s = 1 - 0.14 * Math.exp(-6 * t) * Math.cos(t * Math.PI * 2.2);
					const y = 22 * (1 - t) ** 3;
					return `scale: ${s}; translate: 0 ${y}px; opacity: ${Math.min(1, t * 3)};`;
				},
			};

// Small dropdown menus: a quick unfold from their anchor edge (set transform-origin in CSS).
export const menuPop = (_node: Element, { duration = 220 }: { duration?: number } = {}) =>
	reducedMotion()
		? { duration: 0 }
		: {
				duration,
				css: (t: number) => {
					const e = 1 - (1 - t) ** 3;
					return `scale: ${0.9 + 0.1 * e}; opacity: ${e};`;
				},
			};

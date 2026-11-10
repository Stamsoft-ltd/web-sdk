/** Preview palettes mirror payingSymbolGlow. Keys cannot form a Wild-paying cluster. */
export const WILD_CLUSTERS = [
	{ id: 'red-gem', symbol: 'RED_GEM', name: 'Red gem', colour: '#ff233c', accent: '#ff9e83' },
	{ id: 'blue-gem', symbol: 'BLUE_GEM', name: 'Blue gem', colour: '#17cfff', accent: '#0958ff' },
	{ id: 'green-gem', symbol: 'GREEN_GEM', name: 'Green gem', colour: '#58ff14', accent: '#c1ff8c' },
	{
		id: 'purple-gem',
		symbol: 'PURPLE_GEM',
		name: 'Purple gem',
		colour: '#b923ff',
		accent: '#ed9cff',
	},
	{ id: 'gold-gem', symbol: 'AMBER_GEM', name: 'Amber gem', colour: '#ffc51a', accent: '#ff8014' },
	{ id: 'eye', symbol: 'SACRED_EYE', name: 'Sacred Eye', colour: '#14cfff', accent: '#1454ff' },
	{
		id: 'envelope',
		symbol: 'RUNE_CHALICE',
		name: 'Envelope',
		colour: '#ffe4a0',
		accent: '#ff5031',
	},
	{
		id: 'coin',
		symbol: 'SUN_MEDALLION',
		name: 'Sun medallion',
		colour: '#ffa323',
		accent: '#ffd949',
	},
	{ id: 'orb', symbol: 'CRYSTAL_ORB', name: 'Red orb', colour: '#ff7c18', accent: '#ff3318' },
	{ id: 'pharaoh', symbol: 'GUARDIAN_MASK', name: 'Pharaoh', colour: '#ffcf24', accent: '#1564ff' },
];
export const WILD_GLOW_MS = 1800;
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
	x = clamp(x);
	return x * x * (3 - 2 * x);
};
const ramp = (p, a, b) => ease((p - a) / (b - a));
export function wildGlowFrame(ms, { speed = 1, reduced = false } = {}) {
	const p = clamp((Math.max(0, ms) * Math.max(0.1, speed)) / WILD_GLOW_MS);
	const active = reduced ? 0 : ramp(p, 0.05, 0.25) * (1 - ramp(p, 0.78, 0.98));
	return {
		p,
		light: active * (0.9 + 0.1 * Math.sin(p * Math.PI * 6)),
		halo: active * 0.8,
		glints: Array.from({ length: 6 }, (_, i) => {
			const t = (p - (0.13 + i * 0.085)) / 0.19;
			return reduced || t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI) * active;
		}),
	};
}
// Use the live mask so every gallery variant covers the same full pale petals.
export { wildCrystalWeight as crystalMaskWeight } from './live-premium-motion.mjs';

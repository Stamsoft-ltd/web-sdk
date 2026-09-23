/** Deterministic presentation-only PRNG; never outcome RNG. */
export function visualRandom(seed: string) {
	let state = 2166136261;
	for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}
export function gateDustParticles(eventId: string) {
	const random = visualRandom(eventId);
	return Array.from({ length: 32 }, (_, i) => ({
		x: ((i + random()) / 32) * 100,
		y: -1 - random() * 11,
		drift: (random() - 0.5) * 28,
		delay: Math.round(random() * 780),
		duration: Math.round(1050 + random() * 1100),
		distance: 25 + random() * 35,
		size: 1.5 + random() * 4.5,
		rotation: (random() - 0.5) * 540,
		opacity: 0.22 + random() * 0.42,
	}));
}
export const winCoinSize = (tier: number, unitRandom: number, viewportWidth: number) =>
	(54 + unitRandom * 54 + tier * 6) * Math.min(1, Math.max(0.65, viewportWidth / 700));

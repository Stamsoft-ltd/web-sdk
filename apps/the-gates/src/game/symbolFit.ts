import type { SymbolName } from './contract';
/** Native art ink bounds normalized to 84% cell size (gems), 92% (premium symbols), 108% (Eye/Envelope); Key/Wild keep special fit. */
export const SYMBOL_VIEWPORT: Partial<Record<SymbolName, number>> = {
	GUARDIAN_MASK: 135.42857142857144,
	SUN_MEDALLION: 127.28571428571429,
	SACRED_EYE: 171.42857142857144,
	RUNE_CHALICE: 161.14285714285717,
	CRYSTAL_ORB: 124.28571428571429,
	RED_GEM: 171.42857142857144,
	BLUE_GEM: 171.42857142857144,
	GREEN_GEM: 171.42857142857144,
	PURPLE_GEM: 171.42857142857144,
	AMBER_GEM: 171.42857142857144,
};
export const symbolViewport = (name?: SymbolName) => {
	const viewport = (name && SYMBOL_VIEWPORT[name]) || 150;
	if (name === 'SACRED_EYE' || name === 'RUNE_CHALICE') return viewport * (0.84 / 1.08);
	return name && Object.hasOwn(SYMBOL_VIEWPORT, name) && !name.endsWith('_GEM')
		? viewport * (0.84 / 0.92)
		: viewport;
};

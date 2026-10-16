import type { Win, SymbolName } from './contract';
/** Accent colors from native symbol artwork; never changes pay eligibility. */
export const SYMBOL_GLOW: Record<SymbolName, number> = {
	GUARDIAN_MASK: 0xffcf24,
	SUN_MEDALLION: 0xffa323,
	SACRED_EYE: 0x14cfff,
	RUNE_CHALICE: 0xffe4a0,
	CRYSTAL_ORB: 0xff7c18,
	RED_GEM: 0xff233c,
	BLUE_GEM: 0x17cfff,
	GREEN_GEM: 0x58ff14,
	PURPLE_GEM: 0xb923ff,
	AMBER_GEM: 0xffc51a,
	KEY: 0xffd52c,
	WILD: 0xffde47,
};

/** Idle accents only for the five premium symbols; paying highlights remain universal. */
export const PREMIUM_GLOW_SYMBOLS: readonly SymbolName[] = [
	'GUARDIAN_MASK',
	'SUN_MEDALLION',
	'SACRED_EYE',
	'RUNE_CHALICE',
	'CRYSTAL_ORB',
];
export function ambientSymbolGlow(name?: SymbolName) {
	if (!name || !PREMIUM_GLOW_SYMBOLS.includes(name)) return 0x0b192c;
	const color = SYMBOL_GLOW[name];
	const blend = (shift: number) =>
		Math.round(((0x0b192c >> shift) & 255) * 0.72 + ((color >> shift) & 255) * 0.28);
	return (blend(16) << 16) | (blend(8) << 8) | blend(0);
}

/** Wild takes the winning group's accent; never changes its authoritative substitution. */
export function payingSymbolGlow(name: SymbolName, key: string, wins: readonly Win[] = []) {
	const matched =
		name === 'WILD'
			? wins.find((win) => win.positions.some((p) => `${p.reel}:${p.row}` === key))
			: undefined;
	return SYMBOL_GLOW[matched?.symbol ?? name];
}

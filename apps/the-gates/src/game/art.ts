/** Native Figma art. Runtime values remain supplied by the verified event stream. */
import type { SymbolName } from './contract';
export const ART_ROOT = './assets/the-gates/art/';
export const UI_ART_ROOT = './assets/the-gates/ui/';
export const MOTION_ROOT = `${ART_ROOT}animations/`;
export type ArtTier = 'normal' | 'super' | 'hidden';
export const artTier = (tier: string | null | undefined): ArtTier =>
	tier === 'super' || tier === 'hidden' ? tier : 'normal';
export const SYMBOL_ART: Partial<Record<SymbolName, string>> = {
	GUARDIAN_MASK: 'pharaoh',
	SUN_MEDALLION: 'coin',
	SACRED_EYE: 'eye',
	RUNE_CHALICE: 'envelope',
	CRYSTAL_ORB: 'orb',
	RED_GEM: 'red-gem',
	BLUE_GEM: 'blue-gem',
	GREEN_GEM: 'green-gem',
	PURPLE_GEM: 'purple-gem',
	AMBER_GEM: 'gold-gem',
	KEY: 'key',
};

export const PORTRAIT_ART_ROOT = './assets/the-gates/portrait/';

export const BASE_GATE_ROOT = './assets/the-gates/gates-base/';

/** Base/Chance/Feature share blue-gold portals; bonus tiers retain their own palettes. */
export const portalTier = (tier: string | null | undefined): 'base' | ArtTier =>
	tier == null ? 'base' : artTier(tier);

/** Complete supplied-layer rest compositions for static menu / landing icons. */
export const STATIC_SYMBOL_FILES: Partial<Record<SymbolName, string>> = {
	GUARDIAN_MASK: './assets/the-gates/symbol-parts/pharaoh/rest.svg',
	KEY: './assets/the-gates/symbol-parts/key/rest.svg',
};

/** Native Figma art. Runtime values remain supplied by the verified event stream. */
import type { SymbolName } from './contract';
export const ART_ROOT = './assets/the-gates/figma-20261012/';
export const UI_ART_ROOT = './assets/the-gates/figma-20261013/';
export const MOTION_ROOT = `${ART_ROOT}motion/`;
export type ArtTier = 'normal' | 'super' | 'hidden';
export const artTier = (tier: string | null | undefined): ArtTier =>
	tier === 'super' || tier === 'hidden' ? tier : 'normal';
export const SYMBOL_ART: Partial<Record<SymbolName, string>> = {
	GUARDIAN_MASK: 'pharaoh',
	SUN_MEDALLION: 'coin',
	SACRED_EYE: 'eye',
	RUNE_CHALICE: 'letter',
	CRYSTAL_ORB: 'orb',
	RED_GEM: 'red-gem',
	BLUE_GEM: 'blue-gem',
	GREEN_GEM: 'green-gem',
	PURPLE_GEM: 'purple-gem',
	AMBER_GEM: 'gold-gem',
	KEY: 'key-original',
};

export const PORTRAIT_ART_ROOT = './assets/the-gates/portrait-20261015/';

export const BASE_GATE_ROOT = './assets/the-gates/base-gate-20261016/';

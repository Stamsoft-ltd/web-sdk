import { SECOND } from 'constants-shared/time';

// Big wins count up for exactly as long as their win track builds, so the amount lands on the
// track's final hit (bgm_bigwin: SWEET / EPIC / WILD) or as its sustain ends (bgm_bigwin_top:
// LEGENDARY / MYTHIC) — measured from audio-src (scripts/build-sounds.mjs).
const BIG_WIN_HIT_MS = 9.3 * SECOND;
const TOP_WIN_END_MS = 12 * SECOND;
// …then the screen holds for the rest of the track (its ring-out) before it closes.
const BIG_WIN_TAIL_MS = 11.0 * SECOND - BIG_WIN_HIT_MS;
const TOP_WIN_TAIL_MS = 12.95 * SECOND - TOP_WIN_END_MS;

export const winLevelMap = {
	1: {
		level: 1,
		alias: 'zero',
		type: 'small',
		text: null,
		presentDuration: 0,
		holdDuration: 300,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
		pad: undefined,
	},
	2: {
		level: 2,
		alias: 'standard',
		type: 'small',
		text: null,
		presentDuration: 0.6 * SECOND,
		holdDuration: 300,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
		pad: undefined,
	},
	3: {
		level: 3,
		alias: 'small',
		type: 'small',
		text: null,
		presentDuration: 1 * SECOND,
		holdDuration: 300,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
		pad: undefined,
	},
	4: {
		level: 4,
		alias: 'nice',
		type: 'medium',
		text: null,
		presentDuration: 1.5 * SECOND,
		holdDuration: 300,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
		pad: undefined,
	},
	5: {
		level: 5,
		alias: 'substantial',
		type: 'medium',
		text: null,
		presentDuration: 2.0 * SECOND,
		holdDuration: 300,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
		pad: undefined,
	},
	6: {
		level: 6,
		alias: 'big',
		type: 'big',
		text: 'SWEET WIN',
		presentDuration: BIG_WIN_HIT_MS,
		holdDuration: BIG_WIN_TAIL_MS,
		sound: { sfx: undefined, bgm: 'bgm_bigwin' },
		animation: { intro: 'big_win_intro', idle: 'big_win_idle', outro: 'big_win_exit' },
		pad: 'winPadSweet',
	},
	7: {
		level: 7,
		alias: 'superwin',
		type: 'big',
		text: 'LEGENDARY WIN',
		presentDuration: TOP_WIN_END_MS,
		holdDuration: TOP_WIN_TAIL_MS,
		sound: { sfx: undefined, bgm: 'bgm_bigwin_top' },
		animation: { intro: 'super_win_intro', idle: 'super_win_idle', outro: 'super_win_exit' },
		pad: 'winPadLegendary',
	},
	8: {
		level: 8,
		alias: 'mega',
		type: 'big',
		text: 'EPIC WIN',
		presentDuration: BIG_WIN_HIT_MS,
		holdDuration: BIG_WIN_TAIL_MS,
		sound: { sfx: undefined, bgm: 'bgm_bigwin' },
		animation: { intro: 'mega_win_intro', idle: 'mega_win_idle', outro: 'mega_win_exit' },
		pad: 'winPadEpic',
	},
	9: {
		level: 9,
		alias: 'epic',
		type: 'big',
		text: 'WILD WIN',
		presentDuration: BIG_WIN_HIT_MS,
		holdDuration: BIG_WIN_TAIL_MS,
		sound: { sfx: undefined, bgm: 'bgm_bigwin' },
		animation: { intro: 'epic_win_intro', idle: 'epic_win_idle', outro: 'epic_win_exit' },
		pad: 'winPadWild',
	},
	10: {
		level: 10,
		alias: 'max',
		type: 'big',
		text: 'MYTHIC WIN',
		presentDuration: TOP_WIN_END_MS,
		holdDuration: TOP_WIN_TAIL_MS,
		sound: { sfx: undefined, bgm: 'bgm_bigwin_top' },
		animation: { intro: 'max_win_intro', idle: 'max_win_idle', outro: 'max_win_exit' },
		pad: 'winPadMythic',
	},
} as const;

export type WinLevelMap = typeof winLevelMap;
export type WinLevel = keyof typeof winLevelMap;
export type WinLevelData = WinLevelMap[WinLevel];
export type WinLevelAlias = WinLevelData['alias'];

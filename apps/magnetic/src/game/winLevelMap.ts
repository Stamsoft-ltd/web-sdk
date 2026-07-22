import { SECOND } from 'constants-shared/time';

export const winLevelMap = {
	1: {
		level: 1,
		alias: 'zero',
		type: 'small',
		text: null,
		presentDuration: 0,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	2: {
		level: 2,
		alias: 'standard',
		type: 'small',
		text: null,
		presentDuration: 1.2 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	3: {
		level: 3,
		alias: 'small',
		type: 'small',
		text: null,
		presentDuration: 1.8 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	4: {
		level: 4,
		alias: 'nice',
		type: 'medium',
		text: null,
		presentDuration: 2.5 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	5: {
		level: 5,
		alias: 'substantial',
		type: 'medium',
		text: null,
		presentDuration: 3.5 * SECOND,
		sound: { sfx: undefined, bgm: undefined },
		animation: undefined,
	},
	// Big win boards:
	// 20x-<50x  => SWEET WIN
	// 50x-<100x => WILD WIN
	// 100x-<200x => EPIC WIN
	// 200x-<500x => MYTHIC WIN
	// 500x+ => LEGENDARY WIN
	6: {
		level: 6,
		alias: 'big',
		type: 'big',
		text: 'SWEET WIN',
		presentDuration: 10 * SECOND,
		sound: { sfx: 'mag_win_003', bgm: 'mag_mus_005' },
		animation: { intro: 'big_win_intro', idle: 'big_win_idle', outro: 'big_win_exit' },
	},
	7: {
		level: 7,
		alias: 'superwin',
		type: 'big',
		text: 'WILD WIN',
		presentDuration: 22 * SECOND,
		sound: { sfx: 'mag_win_004', bgm: 'mag_mus_005' },
		animation: { intro: 'super_win_intro', idle: 'super_win_idle', outro: 'super_win_exit' },
	},
	8: {
		level: 8,
		alias: 'mega',
		type: 'big',
		text: 'EPIC WIN',
		presentDuration: 28 * SECOND,
		sound: { sfx: 'mag_win_004', bgm: 'mag_mus_005' },
		animation: { intro: 'mega_win_intro', idle: 'mega_win_idle', outro: 'mega_win_exit' },
	},
	9: {
		level: 9,
		alias: 'epic',
		type: 'big',
		text: 'MYTHIC WIN',
		presentDuration: 35 * SECOND,
		sound: { sfx: 'mag_win_005', bgm: 'mag_mus_005' },
		animation: { intro: 'epic_win_intro', idle: 'epic_win_idle', outro: 'epic_win_exit' },
	},
	10: {
		level: 10,
		alias: 'max',
		type: 'big',
		text: 'LEGENDARY WIN',
		presentDuration: 45 * SECOND,
		sound: { sfx: 'mag_win_006', bgm: 'mag_mus_005' },
		animation: { intro: 'max_win_intro', idle: 'max_win_idle', outro: 'max_win_exit' },
	},
} as const;

export type WinLevelMap = typeof winLevelMap;
export type WinLevel = keyof typeof winLevelMap;
export type WinLevelData = WinLevelMap[WinLevel];
export type WinLevelAlias = WinLevelData['alias'];

// Asset debt that exists on this branch, recorded so the validations in assets.test.ts can be
// GREEN as a ratchet instead of permanently red (a permanently-red check gets skipped, and then
// the coverage is worse than none). Every list is enforced in BOTH directions: a new violation
// fails, and an entry that is no longer violating also fails, so the lists cannot rot.
//
// None of this is "accepted". Each entry is a real defect with an owner elsewhere:
//   - SHEET_META_MISMATCH: the three atlases whose JSON was written against a larger image than
//     the one now on disk. Their frame rects also run past the real image bounds, so the fix is
//     re-packing the sheet, NOT editing meta.size (that would only silence the check).
//   - UNREFERENCED_ASSET_KEYS: 47.8 MiB of assets.ts keys no component names. Plan 03 deletes
//     these; when it lands, this list must shrink or the staleness check fails.
//   - STATIC_SOURCE_FILES: generator scripts shipped inside four apps' static/ trees. Deleting
//     them touches three apps outside this branch's scope.

export const SHEET_META_MISMATCH: Record<string, { declared: [number, number]; actual: [number, number] }> = {
	'assets/sprites/freeSpins/freeSpins.json': { declared: [932, 981], actual: [928, 979] },
	'assets/sprites/pressToContinueText/MM_pressanywhere.json': { declared: [1748, 960], actual: [1744, 918] },
	'assets/sprites/winSmall/MM_Localisation_winsmall.json': { declared: [512, 520], actual: [510, 516] },
};

// Sorted. Sizes in the comment are decoded (w*h*4) at the time of writing; total 47.802 MiB.
export const UNREFERENCED_ASSET_KEYS = [
	'bearBonusTile', // 1.013 MiB
	'bearWinTile', // 1.013 MiB
	'buyBonusLs', // 0.200 MiB
	'expandedFrame', // 6.000 MiB
	'foxBonusTile', // 1.003 MiB
	'foxWinTile', // 1.003 MiB
	'goldFont', // 1.210 MiB
	'logoFrame', // 0.534 MiB
	'navBarLs', // 0.951 MiB
	'portraitShadow', // 0.125 MiB
	'progressBar', // 0.257 MiB
	'rabbitBonusTile', // 1.003 MiB
	'rabbitWinTile', // 1.003 MiB
	'reelFrameLs', // 13.253 MiB
	'scatterPanelImage', // 0.685 MiB
	'silverFont', // 13.510 MiB
	'slotPadMobile', // 0.411 MiB
	'squirrelBonusTile', // 1.013 MiB
	'squirrelWinTile', // 1.013 MiB
	'stepperPadLs', // 0.595 MiB
	'wolfBonusTile', // 1.003 MiB
	'wolfWinTile', // 1.003 MiB
];

// Repo-relative. 40 files across four apps.
export const STATIC_SOURCE_FILES = [
	'apps/forest-gang/static/assets/components/backgrounds/make_splash.py',
	'apps/forest-gang/static/assets/components/frames/patch_scatter_leaves.py',
	'apps/forest-gang/static/assets/spines/fsIntro/generate_board.py',
	'apps/forest-gang/static/assets/spines/fsIntro/patch_frame_counter_leaves.py',
	'apps/forest-gang/static/assets/spines/globalMultiplier/patch_multiplier.py',
	'apps/forest-gang/static/assets/spines/transition/generate_coin.py',
	'apps/forest-gang/static/assets/sprites/coin/generate_coin.py',
	'apps/forest-gang/static/assets/sprites/coinRain/generate_coin_rain.py',
	'apps/forest-gang/static/assets/sprites/generate_emblem_anim.py',
	'apps/forest-gang/static/assets/sprites/pressToContinueText/make_gold.py',
	'apps/forest-gang/static/assets/sprites/progressBar/generate_progressbar.py',
	'apps/forest-gang/static/assets/sprites/rabbitMoney/generate_expand_anim.py',
	'apps/forest-gang/static/assets/sprites/rabbitMoney/generate_win_anim.py',
	'apps/magnetic-megachain/static/assets/components/backgrounds/make_splash.py',
	'apps/magnetic-megachain/static/assets/components/frames/patch_scatter_leaves.py',
	'apps/magnetic-megachain/static/assets/spines/fsIntro/generate_board.py',
	'apps/magnetic-megachain/static/assets/spines/fsIntro/patch_frame_counter_leaves.py',
	'apps/magnetic-megachain/static/assets/spines/globalMultiplier/patch_multiplier.py',
	'apps/magnetic-megachain/static/assets/spines/transition/generate_coin.py',
	'apps/magnetic-megachain/static/assets/sprites/coin/generate_coin.py',
	'apps/magnetic-megachain/static/assets/sprites/pressToContinueText/make_gold.py',
	'apps/magnetic-megachain/static/assets/sprites/progressBar/generate_progressbar.py',
	'apps/magnetic/static/assets/components/backgrounds/make_splash.py',
	'apps/magnetic/static/assets/components/frames/patch_scatter_leaves.py',
	'apps/magnetic/static/assets/spines/fsIntro/generate_board.py',
	'apps/magnetic/static/assets/spines/fsIntro/patch_frame_counter_leaves.py',
	'apps/magnetic/static/assets/spines/globalMultiplier/patch_multiplier.py',
	'apps/magnetic/static/assets/spines/transition/generate_coin.py',
	'apps/magnetic/static/assets/sprites/coin/generate_coin.py',
	'apps/magnetic/static/assets/sprites/pressToContinueText/make_gold.py',
	'apps/magnetic/static/assets/sprites/progressBar/generate_progressbar.py',
	'apps/press_play_template/static/assets/components/backgrounds/make_splash.py',
	'apps/press_play_template/static/assets/components/frames/patch_scatter_leaves.py',
	'apps/press_play_template/static/assets/spines/fsIntro/generate_board.py',
	'apps/press_play_template/static/assets/spines/fsIntro/patch_frame_counter_leaves.py',
	'apps/press_play_template/static/assets/spines/globalMultiplier/patch_multiplier.py',
	'apps/press_play_template/static/assets/spines/transition/generate_coin.py',
	'apps/press_play_template/static/assets/sprites/coin/generate_coin.py',
	'apps/press_play_template/static/assets/sprites/pressToContinueText/make_gold.py',
	'apps/press_play_template/static/assets/sprites/progressBar/generate_progressbar.py',
];

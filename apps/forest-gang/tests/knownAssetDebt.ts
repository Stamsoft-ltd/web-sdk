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
	// freeSpins.json was deleted by plan 03 (dead sheet) — its entry ratcheted out with it.
	'assets/sprites/pressToContinueText/MM_pressanywhere.json': { declared: [1748, 960], actual: [1744, 918] },
	'assets/sprites/winSmall/MM_Localisation_winsmall.json': { declared: [512, 520], actual: [510, 516] },
};

// Sorted. Sizes in the comment are decoded (w*h*4) at the time of writing; total 24.221 MiB.
export const UNREFERENCED_ASSET_KEYS = [
	'buyBonusLs', // 0.200 MiB
	// 'coins' and 'progressBar' were deleted by plan 03 — ratcheted out.
	// The five '*BonusTile' keys and 'reelFrameLs' are gone from assets.ts entirely, and the five
	// '*WinTile' keys are now named by src/game/utils.ts — 23.323 MiB ratcheted out in both
	// directions at once (dead art deleted, live art wired up).
	'expandedFrame', // 6.000 MiB
	'goldFont', // 1.210 MiB
	'logoFrame', // 0.534 MiB
	'navBarLs', // 0.951 MiB
	'portraitShadow', // 0.125 MiB
	'scatterPanelImage', // 0.685 MiB
	'silverFont', // 13.510 MiB
	'slotPadMobile', // 0.411 MiB
	'stepperPadLs', // 0.595 MiB
];

// Repo-relative. 27 files across three sibling apps — forest-gang's 13 were moved to tools/
// (plan 12) or deleted with their dead sheets (plan 03). The siblings are outside this
// branch's scope; plan 12 records them for a repo-wide follow-up.
export const STATIC_SOURCE_FILES = [
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

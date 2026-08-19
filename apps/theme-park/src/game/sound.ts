import { createSound } from 'utils-sound';

// Background music beds — one plays at a time (the music player pauses the rest).
// bgm_bigwin_* are the per-tier big-win beds; they replace the active bed for the
// duration of the win presentation and it resumes when they stop (see Sound.svelte).
export type MusicName =
	| 'bgm_main'
	| 'bgm_freespin'
	| 'bgm_coaster_setup'
	| 'bgm_duck_bonus'
	| 'bgm_roller_wilds'
	| 'bgm_bigwin_sweet'
	| 'bgm_bigwin_wild'
	| 'bgm_bigwin_epic'
	| 'bgm_bigwin_legendary'
	| 'bgm_bigwin_mythic';

export type SoundEffectName =
	| 'sfx_btn_general'
	| 'sfx_btn_spin'
	| 'sfx_reel_spin_loop'
	| 'sfx_reel_stop'
	| 'sfx_regular_win'
	| 'sfx_win_count_loop'
	| 'sfx_megawild_drop'
	| 'sfx_megawild_expand'
	| 'sfx_duck_land'
	| 'sfx_duck_click'
	| 'sfx_coaster_scatter_land'
	| 'sfx_duck_scatter_land'
	| 'sfx_roller_scatter_land'
	| 'sfx_coaster_bonus_end'
	| 'sfx_duck_bonus_end'
	| 'sfx_roller_bonus_end'
	| 'sfx_coaster_duck_splash';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();
export { sound };

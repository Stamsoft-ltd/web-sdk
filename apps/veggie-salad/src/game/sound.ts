import { createSound } from 'utils-sound';

/* The ten sounds delivered 2026-09-18 ("Sounds Gorgo") plus the two cluster chimes of 2026-09-21,
   as the sprite names audio-src/README.txt maps them to. Every name here is a segment of static/assets/veggie-salad/audio/sounds.json,
   rebuilt by scripts/build-sounds.mjs; a name without a source file plays silence. */
export type MusicName = 'bgm_base' | 'bgm_bonus' | 'bgm_bigwin';

export type SoundEffectName =
	| 'jng_bonus_intro'
	| 'jng_bonus_outro'
	| 'sfx_win_loop'
	| 'sfx_reels_fall'
	| 'sfx_reels_land'
	| 'sfx_scatter_land'
	| 'sfx_cluster'
	| 'sfx_cluster_multi'
	| 'sfx_button';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

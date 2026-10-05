import { createSound } from 'utils-sound';

// The McSchmutzo sound set (one Howler sprite built from audio-src/ by scripts/build-sounds.mjs —
// every name here needs a source file there).
export type MusicName =
	| 'bgm_main' // base game bed (loops)
	| 'bgm_freespin' // bonus / free games bed (loops)
	| 'bgm_bigwin' // big win: SWEET / EPIC / WILD (one-shot, ~11 s)
	| 'bgm_bigwin_top'; // big win: LEGENDARY / MYTHIC (one-shot, ~13 s)

export type SoundEffectName =
	| 'sfx_btn_general' // UI click
	| 'sfx_btn_spin' // spin start
	| 'sfx_reel_stop' // ~455 ms of ticks, then the thud — started early so the thud lands on the stop
	| 'sfx_reel_stop_hit' // just the thud (stops that come too soon for the full clip)
	| 'sfx_scatter_land'
	| 'sfx_win_normal' // line wins under the big-win threshold (< 20×)
	| 'sfx_lock_grow' // Lock & Re-Spin: cells lock
	| 'sfx_soup_boost' // a soup shoots its multiplier step into the pot
	| 'sfx_wheel_spin' // bonus wheel spin (~9 s — the wheel lands on its final hit)
	| 'sfx_bonus_screen'; // bonus screen waiting for the click to start (wheel / free-games intro)

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

import { createSound } from 'utils-sound';

// Background music tracks (looped). Names describe WHERE the track plays.
export type MusicName =
	| 'bgm_base_game' //        base game
	| 'bgm_dealit_bonus' //     Deal It free spins (and feature spins)
	| 'bgm_allin_bonus' //      All In free spins
	// Big-win celebration music, per win tier (currently silent placeholders):
	| 'bgm_win_sweet' //        SWEET WIN     (20x–<50x)
	| 'bgm_win_wild' //         WILD WIN      (50x–<100x)
	| 'bgm_win_epic' //         EPIC WIN      (100x–<200x)
	| 'bgm_win_mythic' //       MYTHIC WIN    (200x–<500x)
	| 'bgm_win_legendary'; //   LEGENDARY WIN (500x+)

// Sound effects (one-shot unless noted). Names describe WHEN the effect plays.
export type SoundEffectName =
	// --- UI buttons ---
	| 'sfx_spin_button' //      spin button pressed
	| 'sfx_button_click' //     generic UI button pressed
	// --- reels / symbols ---
	| 'sfx_reel_stop' //        a reel stops (every spin)
	| 'sfx_reel_stop_alt_1' //  spare per-reel stop variants (unused)
	| 'sfx_reel_stop_alt_2'
	| 'sfx_reel_stop_alt_3'
	| 'sfx_reel_stop_alt_4'
	| 'sfx_symbol_land' //      a normal symbol lands (unused)
	| 'sfx_royal_symbol_land' //a royal (A/K/Q/J/10) lands (unused)
	| 'sfx_wild_land' //        a WILD symbol lands
	| 'sfx_symbol_expand' //    expanding symbol fills its reels (bonus)
	// --- scatters / bonus trigger ---
	| 'sfx_scatter_land_1' //   scatter lands — pitch rises with the counter (1st..5th)
	| 'sfx_scatter_land_2'
	| 'sfx_scatter_land_3'
	| 'sfx_scatter_land_4'
	| 'sfx_scatter_land_5'
	| 'sfx_scatter_appear' //   scatter reveal (unused)
	| 'sfx_scatter_win_alt' //  alt scatter win (unused)
	| 'sfx_scatter_anticipation_loop' // reels teasing for more scatters (looped)
	| 'sfx_scatter_anticipation_start' // anticipation start hit (unused)
	| 'sfx_bonus_trigger' //    scatters trigger the bonus
	| 'sfx_bonus_intro' //      bonus intro whoosh (before CONGRATULATIONS)
	| 'sfx_bonus_jingle' //     bonus intro jingle (unused)
	| 'sfx_freespins_retrigger' // extra free spins awarded (unused)
	// --- multiplier hand (Deal It / All In) ---
	| 'sfx_multiplier_hand_up' //   hand lands on a higher multiplier (positive)
	| 'sfx_multiplier_hand_reset' //hand drops back to 1x (negative)
	| 'sfx_multiplier_count_up' //  multiplier counting up (unused)
	| 'sfx_multiplier_apply' //     multiplier applied to a win (unused)
	| 'sfx_multiplier_combine_1' // multiplier combine steps (unused)
	| 'sfx_multiplier_combine_2'
	| 'sfx_multiplier_explode_1' // multiplier explosion steps (unused)
	| 'sfx_multiplier_explode_2'
	| 'sfx_multiplier_explode_3'
	// --- deer presenter ---
	| 'sfx_deer_reveal' //      deer presenter reveals the chosen expanding symbol (looped while on screen)
	// --- wins ---
	| 'sfx_payline_win' //      winning payline animation (looped while the animation runs)
	| 'sfx_win_coins_loop' //   coins counting up on the win screen (looped)
	| 'sfx_win_count_end' //    win amount count-up finishes
	| 'sfx_win_popup_small' //  SWEET / WILD / EPIC win popup
	| 'sfx_win_popup_big' //    MYTHIC / LEGENDARY win popup
	| 'sfx_win_popup_max' //    MAX WIN popup (25000x)
	| 'sfx_congratulations' //  CONGRATULATIONS panel (free-spins intro & bonus end)
	| 'sfx_win_small' //        small win tick (provided, currently unused)
	| 'sfx_win_nice' //         medium "nice" win (unused)
	| 'sfx_win_standard' //     medium "standard" win (unused)
	| 'sfx_win_substantial' //  medium "substantial" win (unused)
	| 'sfx_win_panel_legacy' // old you-won panel sting (provided, unused)
	| 'sfx_tumble_win_1' //     per-tumble win steps (unused)
	| 'sfx_tumble_win_2'
	| 'sfx_tumble_win_3'
	| 'sfx_tumble_win_4';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

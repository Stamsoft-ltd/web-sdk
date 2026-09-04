import { createSound } from 'utils-sound';

// Sound names map 1:1 to the keys of the Magnetic audio sprite (static/assets/audio/sounds.json),
// which is rebuilt from the individual cues in audio-src/ (see scripts/build-sounds.mjs) — so a
// name here, a file in audio-src/, and a sprite key are always the same string.
//
// These used to be the audio Event Map's raw asset_ids (mag_ui_003, mag_win_004, …), which said
// nothing about what a cue was for; they are now named after the moment they play. The mapping is
// recorded in git history if you need to cross-reference the original Magnetic_Audio_Event_Map.json
// (that file was never vendored into this repo).
//
// A `*_NNN` suffix means the cue is UNREFERENCED by any code — its feature area is known from the
// original asset_id prefix, but nothing in src/ plays it, so there is no behaviour to name it
// after. Give it a real name when it gets wired up.

// Music — routed through Sound.svelte's playMusic().
// base/bonus/super are NOT played from the sprite: they resolve to the standalone, gaplessly
// looping music_*.{ogg,mp3} Howls. Only the two short layers below come out of the sprite.
export type MusicName =
	| 'music_base' // base game ambience
	| 'music_bonus' // Gravity Breach / free spins
	| 'music_super' // Core Overload (super spin)
	| 'music_scatter_tease' // scatter anticipation bed — declared, not yet wired
	| 'music_bigwin'; // bed under the big-win board count-up

// Everything else: one-shots plus the four sprite loops (`*_loop`).
export type SoundEffectName =
	// ── UI ──
	| 'sfx_ui_button_press' // any other HUD button, INCLUDING bet up/down (soundPressGeneral)
	| 'sfx_spin_press' // spin button / Space / autoplay start (the `soundPressBet` event)
	| 'sfx_spin_start' // every spin that shows a spin presentation
	| 'sfx_reel_stop' // a reel stops, and a dropped symbol lands
	| 'sfx_ui_001'
	| 'sfx_ui_004'
	| 'sfx_ui_005'
	| 'sfx_ui_006'
	| 'sfx_ui_008'
	| 'sfx_ui_009'
	| 'sfx_ui_010'
	| 'sfx_ui_011'
	| 'sfx_ui_012'
	// ── clusters ──
	| 'sfx_cluster_win' // a cluster pays (winInfo)
	| 'sfx_cluster_001'
	| 'sfx_cluster_003'
	| 'sfx_cluster_004'
	| 'sfx_cluster_005'
	| 'sfx_cluster_006'
	// ── wilds / multipliers ──
	| 'sfx_multiplier_hit' // a multiplier > 1 lands or a magnet activates with one
	| 'sfx_wild_001'
	| 'sfx_wild_003'
	| 'sfx_wild_004'
	| 'sfx_wild_005'
	| 'sfx_wild_006'
	| 'sfx_wild_007'
	// ── magnet ──
	| 'sfx_wild_land' // a WILD/MAGNET lands on the board
	| 'sfx_magnet_pull' // the magnet starts pulling symbols in to stack around it
	| 'sfx_chain_grow' // new symbols join the stacked chain
	| 'sfx_magnet_roulette_loop' // magnet symbol-pick spin
	| 'sfx_magnet_002'
	| 'sfx_magnet_003'
	| 'sfx_magnet_004'
	| 'sfx_magnet_005'
	| 'sfx_magnet_006'
	| 'sfx_magnet_007'
	// ── scatters ──
	| 'sfx_scatter_land_first' // 1st scatter of the spin
	| 'sfx_scatter_land_more' // 2nd..5th scatter, rising tension
	| 'sfx_scatter_tease_loop' // anticipation bed while scatters are pending
	| 'sfx_scatter_trigger' // enough scatters — bonus is won
	| 'sfx_bonus_transition' // wipe into the bonus
	| 'sfx_scatter_004'
	// ── bonus intro / outro (Gravity Breach) ──
	| 'sfx_bonus_intro' // free-spin intro panel
	| 'sfx_bonus_outro' // free-spin outro panel
	| 'sfx_dropomagnet_002'
	| 'sfx_dropomagnet_003'
	// ── Core Overload ──
	| 'sfx_megachain_idle_loop' // idle hum during the chain
	| 'sfx_megachain_001'
	| 'sfx_megachain_002'
	| 'sfx_megachain_003'
	| 'sfx_megachain_004'
	| 'sfx_megachain_005'
	| 'sfx_megachain_007'
	// ── single feature spin ──
	| 'sfx_feature_001'
	| 'sfx_feature_002'
	// ── big win ──
	| 'sfx_win_countup_loop' // ticks under EVERY rolling win amount, not just the big-win boards
	| 'sfx_bet_mode_super' // SUPER bet mode selected
	| 'sfx_bigwin_sweet' // level 6 — a LOOPING bed, held for the whole board presentation
	| 'sfx_bigwin_wild' // level 7 — LOOPING bed
	| 'sfx_bigwin_epic' // level 8 — LOOPING bed
	| 'sfx_bigwin_mythic' // level 9 — LOOPING bed
	| 'sfx_bigwin_legendary'; // level 10 — LOOPING bed

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

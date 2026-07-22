import { createSound } from 'utils-sound';

// Sound names map 1:1 to the Magnetic audio sprite (static/assets/audio/sounds.json), generated from
// the individual cues in audio-src/ (see scripts/build-sounds.mjs). Names are the audio Event Map's
// asset_ids, lowercased (MAG_UI_003 -> mag_ui_003); see Magnetic_Audio_Event_Map.json for each cue.

// Music tracks — played through the dedicated (looping, crossfading) music player.
// mus_001 base game, mus_002 Drop-O-Magnet, mus_003 Mega Chain, mus_004 scatter tease, mus_005 win count.
export type MusicName =
	| 'mag_mus_001'
	| 'mag_mus_002'
	| 'mag_mus_003'
	| 'mag_mus_004'
	| 'mag_mus_005';

// Every other cue: one-shots + SFX loops (mag_mag_001 roulette, mag_sct_003 tease, mag_mmc_006 idle
// hum, mag_win_001 win-counter are looped).
export type SoundEffectName =
	| 'mag_ui_001'
	| 'mag_ui_002'
	| 'mag_ui_003'
	| 'mag_ui_004'
	| 'mag_ui_005'
	| 'mag_ui_006'
	| 'mag_ui_007'
	| 'mag_ui_008'
	| 'mag_ui_009'
	| 'mag_ui_010'
	| 'mag_ui_011'
	| 'mag_ui_012'
	| 'mag_clu_001'
	| 'mag_clu_002'
	| 'mag_clu_003'
	| 'mag_clu_004'
	| 'mag_clu_005'
	| 'mag_clu_006'
	| 'mag_wld_001'
	| 'mag_wld_002'
	| 'mag_wld_003'
	| 'mag_wld_004'
	| 'mag_wld_005'
	| 'mag_wld_006'
	| 'mag_wld_007'
	| 'mag_mag_001'
	| 'mag_mag_002'
	| 'mag_mag_003'
	| 'mag_mag_004'
	| 'mag_mag_005'
	| 'mag_mag_006'
	| 'mag_mag_007'
	| 'mag_sct_001'
	| 'mag_sct_002'
	| 'mag_sct_003'
	| 'mag_sct_004'
	| 'mag_sct_005'
	| 'mag_sct_006'
	| 'mag_dom_001'
	| 'mag_dom_002'
	| 'mag_dom_003'
	| 'mag_dom_004'
	| 'mag_mmc_001'
	| 'mag_mmc_002'
	| 'mag_mmc_003'
	| 'mag_mmc_004'
	| 'mag_mmc_005'
	| 'mag_mmc_006'
	| 'mag_mmc_007'
	| 'mag_ftr_001'
	| 'mag_ftr_002'
	| 'mag_win_001'
	| 'mag_win_002'
	| 'mag_win_003'
	| 'mag_win_004'
	| 'mag_win_005'
	| 'mag_win_006';

export type SoundName = MusicName | SoundEffectName;

const sound = createSound<SoundName>();

export { sound };

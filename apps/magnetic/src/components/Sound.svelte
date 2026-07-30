<script lang="ts" module>
	import { sound, type MusicName, type SoundEffectName, type SoundName } from '../game/sound';

	export type EmitterEventSound =
		| { type: 'soundMusic'; name: MusicName }
		| { type: 'soundMusicDuck' }
		| { type: 'soundOnce'; name: SoundEffectName; forcePlay?: boolean }
		| { type: 'soundLoop'; name: SoundEffectName }
		| { type: 'soundStop'; name: SoundName }
		| { type: 'soundFade'; name: SoundName; from: number; to: number; duration: number }
		| { type: 'soundScatterCounterIncrease' }
		| { type: 'soundScatterCounterClear' };
</script>

<script lang="ts">
	import { Howl } from 'howler';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	import { waitForTimeout } from 'utils-shared/wait';
	import { SECOND } from 'constants-shared/time';
	import { stateBet, stateSound } from 'state-shared';

	import { getContext } from '../game/context';

	const context = getContext();

	// ── Background music ──────────────────────────────────────────────────────────
	// Looped through dedicated (non-sprite) Howls: Web Audio loops a full decoded buffer
	// sample-accurately, so the loop is truly seamless. Looping a region inside the SFX sprite (or an
	// HTMLAudio element) restarts via a JS timer and leaves an audible gap. OGG is listed first so
	// Chrome/Firefox get the gapless path; MP3 is the Safari fallback.
	type MusicTrack = 'base' | 'bonus' | 'super';
	const MUSIC_TRACKS: MusicTrack[] = ['base', 'bonus', 'super'];
	const MUSIC_SRC: Record<MusicTrack, string[]> = {
		base: ['./assets/audio/music_base.ogg?v=20260730', './assets/audio/music_base.mp3?v=20260730'],
		bonus: ['./assets/audio/music_bonus.ogg?v=20260730', './assets/audio/music_bonus.mp3?v=20260730'],
		super: ['./assets/audio/music_super.ogg?v=20260730', './assets/audio/music_super.mp3?v=20260730'],
	};
	// Per-track mix level (tune to taste). Master + music-channel mutes are honoured separately.
	// bonus/super deviate from the old shared 0.36 because the new stems are mastered at very
	// different levels from the ones they replace, so a shared number no longer balances them:
	//   bonus  -21.7 LUFS (3.4 LU QUIETER than before) -> 0.53
	//   super  -11.9 LUFS (7.0 LU LOUDER  than before) -> 0.16
	// Both figures are chosen to reproduce the previously tuned perceived level (effective
	// -27.2 and -27.8 LUFS), so the balance between tracks is unchanged from the old soundtrack.
	// Compensating here keeps the delivered stems untouched.
	const MUSIC_VOL: Record<MusicTrack, number> = { base: 0.3, bonus: 0.53, super: 0.16 };
	let musicHowls: Record<MusicTrack, Howl> | null = null;
	let currentTrack: MusicTrack = 'base';
	let musicUnlocked = false;

	// Which track a fresh page load should open on, from the bet mode restored into state:
	// SUPER buys Mega Chain, BONUS buys Drop-O-Magnet, anything else is the base game.
	const trackForBetMode = (): MusicTrack =>
		stateBet.activeBetModeKey === 'SUPER' ? 'super'
		: stateBet.activeBetModeKey === 'BONUS' ? 'bonus'
		: 'base';

	const musicAudible = () =>
		stateSound.volumeValueMaster !== 0 && stateSound.volumeValueMusic !== 0;

	const stopMusicTracks = () => {
		if (!musicHowls) return;
		for (const t of MUSIC_TRACKS) musicHowls[t].stop();
	};

	const playTrack = (track: MusicTrack) => {
		currentTrack = track;
		if (!browser || !musicHowls) return;
		if (!musicAudible()) {
			stopMusicTracks();
			return;
		}
		for (const t of MUSIC_TRACKS) {
			const h = musicHowls[t];
			if (t === track) {
				h.volume(MUSIC_VOL[t]);
				if (!h.playing()) {
					try {
						h.play();
						musicUnlocked = true;
					} catch {
						/* autoplay-blocked until first gesture */
					}
				}
			} else if (h.playing()) {
				h.stop();
			}
		}
	};

	// Win-level count music (music_bigwin) is a short sprite loop; stop it when returning to ambience.
	const stopWinLevelMusic = () => sound.stop({ name: 'music_bigwin' });

	// Duck (not stop) the ambience for the duration of a big-win presentation, so the tier bed and
	// the count-up own the mix. PAUSE rather than STOP because these are 3-6s loops: stopping would
	// restart the bar from zero afterwards, which is audible as a stumble. Howler's play() on a
	// paused sound resumes from its position, and playTrack() already calls play() only when the
	// track is not playing — so the ordinary `soundMusic` broadcast at the end of the presentation
	// resumes it with no extra event. Switching to a DIFFERENT track (bonus ending -> base) still
	// stops the paused one and starts the new one from the top, which is what you want there.
	const duckMusic = () => {
		if (!musicHowls) return;
		for (const track of MUSIC_TRACKS) {
			if (musicHowls[track].playing()) musicHowls[track].pause();
		}
	};

	const playMusic = ({ name }: { name: MusicName }) => {
		if (!musicAudible()) {
			stopMusicTracks();
			return;
		}
		if (name === 'music_base') {
			stopWinLevelMusic();
			return playTrack('base');
		}
		if (name === 'music_bonus') {
			stopWinLevelMusic();
			return playTrack('bonus');
		}
		if (name === 'music_super') {
			stopWinLevelMusic();
			return playTrack('super');
		}
		// music_scatter_tease (scatter tease) / music_bigwin (win count) are short layers — sprite loop is fine.
		sound.players.music.play({ name });
	};

	context.eventEmitter.subscribeOnMount({
		// ui
		soundBetMode: async ({ betModeKey }) => {
			if (betModeKey === 'SUPER') {
				sound.players.once.play({ name: 'sfx_bet_mode_super' });
				await waitForTimeout(SECOND);
				// SUPER buys Magnetic Mega Chain, so preview THAT theme (this used to start the
				// Drop-O-Magnet track, which is what BONUS buys).
				playTrack('super');
			} else {
				playTrack('base');
			}
		},
		soundPressGeneral: () => sound.players.once.play({ name: 'sfx_ui_button_press' }),
		soundPressBet: () => sound.players.once.play({ name: 'sfx_spin_press' }),
		// scatterCounter
		soundScatterCounterIncrease: () => (context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1), // prettier-ignore
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),
		// game
		soundMusic: ({ name }) => playMusic({ name }),
		soundMusicDuck: () => duckMusic(),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => {
			if (name === 'music_base' || name === 'music_bonus' || name === 'music_super') stopMusicTracks();
			sound.stop({ name });
		},
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	// Follow BOTH the master mute and the menu's MUSIC channel: silenced when either is off, and
	// RESUMED (same flavour) when both come back on. Hidden-tab muting is handled by Howler globally.
	$effect(() => {
		if (musicAudible()) {
			if (musicUnlocked) playTrack(currentTrack);
		} else {
			stopMusicTracks();
			// Also stop any looping win-level track so it doesn't resume audible on top after unmute.
			stopWinLevelMusic();
		}
	});

	onMount(() => {
		if (browser) {
			musicHowls = {
				base: new Howl({ src: MUSIC_SRC.base, loop: true, html5: false, preload: true, volume: MUSIC_VOL.base }), // prettier-ignore
				bonus: new Howl({ src: MUSIC_SRC.bonus, loop: true, html5: false, preload: true, volume: MUSIC_VOL.bonus }), // prettier-ignore
				super: new Howl({ src: MUSIC_SRC.super, loop: true, html5: false, preload: true, volume: MUSIC_VOL.super }), // prettier-ignore
			};
		}
		// Browsers block audio until the first gesture — start music on the first pointer/key.
		const unlock = () => {
			if (musicUnlocked || !musicAudible()) return;
			playTrack(trackForBetMode());
		};
		window.addEventListener('pointerdown', unlock, { once: true });
		window.addEventListener('keydown', unlock, { once: true });

		if (musicAudible()) {
			playTrack(trackForBetMode());
		}

		return () => {
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
			stopMusicTracks();
			if (musicHowls) for (const t of MUSIC_TRACKS) musicHowls[t].unload();
		};
	});
</script>

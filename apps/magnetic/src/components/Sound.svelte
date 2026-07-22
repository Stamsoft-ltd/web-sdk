<script lang="ts" module>
	import { sound, type MusicName, type SoundEffectName, type SoundName } from '../game/sound';

	export type EmitterEventSound =
		| { type: 'soundMusic'; name: MusicName }
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
		base: ['./assets/audio/music_base.ogg?v=20260722', './assets/audio/music_base.mp3?v=20260722'],
		bonus: ['./assets/audio/music_bonus.ogg?v=20260722', './assets/audio/music_bonus.mp3?v=20260722'],
		super: ['./assets/audio/music_super.ogg?v=20260722', './assets/audio/music_super.mp3?v=20260722'],
	};
	// Per-track mix level (tune to taste). Master + music-channel mutes are honoured separately.
	const MUSIC_VOL: Record<MusicTrack, number> = { base: 0.3, bonus: 0.36, super: 0.36 };
	let musicHowls: Record<MusicTrack, Howl> | null = null;
	let currentTrack: MusicTrack = 'base';
	let musicUnlocked = false;

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

	// Win-level count music (mag_mus_005) is a short sprite loop; stop it when returning to ambience.
	const stopWinLevelMusic = () => sound.stop({ name: 'mag_mus_005' });

	const playMusic = ({ name }: { name: MusicName }) => {
		if (!musicAudible()) {
			stopMusicTracks();
			return;
		}
		if (name === 'mag_mus_001') {
			stopWinLevelMusic();
			return playTrack('base');
		}
		if (name === 'mag_mus_002') {
			stopWinLevelMusic();
			return playTrack('bonus');
		}
		if (name === 'mag_mus_003') {
			stopWinLevelMusic();
			return playTrack('super');
		}
		// mag_mus_004 (scatter tease) / mag_mus_005 (win count) are short layers — sprite loop is fine.
		sound.players.music.play({ name });
	};

	context.eventEmitter.subscribeOnMount({
		// ui
		soundBetMode: async ({ betModeKey }) => {
			if (betModeKey === 'SUPER') {
				sound.players.once.play({ name: 'mag_win_002' });
				await waitForTimeout(SECOND);
				playTrack('bonus');
			} else {
				playTrack('base');
			}
		},
		soundPressGeneral: () => sound.players.once.play({ name: 'mag_ui_002' }),
		soundPressBet: () => sound.players.once.play({ name: 'mag_ui_003' }),
		// scatterCounter
		soundScatterCounterIncrease: () => (context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1), // prettier-ignore
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),
		// game
		soundMusic: ({ name }) => playMusic({ name }),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => {
			if (name === 'mag_mus_001' || name === 'mag_mus_002' || name === 'mag_mus_003') stopMusicTracks();
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
			playTrack(stateBet.activeBetModeKey === 'SUPER' ? 'bonus' : 'base');
		};
		window.addEventListener('pointerdown', unlock, { once: true });
		window.addEventListener('keydown', unlock, { once: true });

		if (musicAudible()) {
			playTrack(stateBet.activeBetModeKey === 'SUPER' ? 'bonus' : 'base');
		}

		return () => {
			window.removeEventListener('pointerdown', unlock);
			window.removeEventListener('keydown', unlock);
			stopMusicTracks();
			if (musicHowls) for (const t of MUSIC_TRACKS) musicHowls[t].unload();
		};
	});
</script>

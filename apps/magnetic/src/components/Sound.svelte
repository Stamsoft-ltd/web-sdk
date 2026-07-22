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
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	import { waitForTimeout } from 'utils-shared/wait';
	import { SECOND } from 'constants-shared/time';
	import { stateBet, stateSound } from 'state-shared';

	import { getContext } from '../game/context';

	const context = getContext();
	// Bonus keeps the full-energy track; the base game plays a processed CALM copy of it
	// (low-passed, 8% slower, slightly quieter) so the base loop is easier on the ears.
	const ambientTrackUrl = './assets/audio/background_music.mp3?v=20260713b';
	const ambientCalmTrackUrl = './assets/audio/background_music_calm.mp3?v=20260717';
	let ambientAudio: HTMLAudioElement | null = null;
	let ambientUnlocked = false;
	// Which ambient flavour is current — remembered so muting (master OR music channel) can
	// resume the right track when sound comes back.
	let ambientMode: 'base' | 'bonus' = 'base';

	const playAmbient = async (mode: 'base' | 'bonus') => {
		ambientMode = mode;
		if (!browser || !ambientAudio) return;
		if (stateSound.volumeValueMaster === 0 || stateSound.volumeValueMusic === 0) {
			stopAmbient();
			return;
		}
		// Swap the source when the mode's track differs from what is loaded.
		const wantedUrl = mode === 'bonus' ? ambientTrackUrl : ambientCalmTrackUrl;
		if (!ambientAudio.src.includes(wantedUrl.replace('./', '/'))) {
			ambientAudio.src = wantedUrl;
			ambientAudio.load();
		}
		ambientAudio.loop = true;
		ambientAudio.volume = mode === 'bonus' ? 0.32 : 0.22;
		try {
			await ambientAudio.play();
			ambientUnlocked = true;
		} catch {
			// ignore autoplay block until first gesture
		}
	};

	const stopAmbient = () => {
		if (!ambientAudio) return;
		ambientAudio.pause();
		ambientAudio.currentTime = 0;
	};

	// Win-level tracks are loop-flagged; when the game returns to ambient music (or music is
	// muted) they must be stopped explicitly or they keep playing under the ambience forever.
	const stopWinLevelMusic = () =>
		(['mag_mus_005', 'mag_mus_005', 'mag_mus_005', 'mag_mus_005', 'mag_mus_005'] as const)
			.forEach((n) => sound.stop({ name: n }));

	const playMusic = ({ name }: { name: MusicName }) => {
		if (stateSound.volumeValueMaster === 0) {
			stopAmbient();
			sound.stop({ name: 'mag_mus_001' });
			sound.stop({ name: 'mag_mus_002' });
			return;
		}

		if (name === 'mag_mus_001') {
			sound.stop({ name: 'mag_mus_002' });
			stopWinLevelMusic();
			return playAmbient('base');
		}

		if (name === 'mag_mus_002') {
			sound.stop({ name: 'mag_mus_001' });
			stopWinLevelMusic();
			return playAmbient('bonus');
		}

		stopAmbient();
		sound.players.music.play({ name });
	};

	context.eventEmitter.subscribeOnMount({
		// ui
		soundBetMode: async ({ betModeKey }) => {
			if (betModeKey === 'SUPER') {
				// check if SUPERSPIN, when changing the bet mode.
				sound.players.once.play({ name: 'mag_win_002' });
				await waitForTimeout(SECOND);
				sound.players.music.play({ name: 'mag_mus_002' });
			} else {
				sound.players.music.play({ name: 'mag_mus_001' });
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
		soundStop: ({ name }) => { if (name === 'mag_mus_001' || name === 'mag_mus_002') stopAmbient(); sound.stop({ name }); },
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	// Background music follows BOTH the master mute and the menu's MUSIC channel: silenced when
	// either is off, and RESUMED (same flavour) when both come back on.
	$effect(() => {
		const musicAudible =
			stateSound.volumeValueMaster !== 0 && stateSound.volumeValueMusic !== 0;
		if (musicAudible) {
			if (ambientUnlocked) void playAmbient(ambientMode);
		} else {
			stopAmbient();
			sound.stop({ name: 'mag_mus_001' });
			sound.stop({ name: 'mag_mus_002' });
			// Also stop any looping win-level track — otherwise it keeps "playing" muted
			// and becomes audible on top of the resumed ambience after unmute.
			stopWinLevelMusic();
		}
	});

	// The ambient loop is a raw HTMLAudioElement outside Howler, so the framework's
	// hidden-tab mute (Howler.mute on visibilitychange) never reaches it — pause and
	// resume it here ourselves.
	let ambientPausedByVisibility = false;
	const onVisibilityChange = () => {
		if (!ambientAudio) return;
		if (document.visibilityState !== 'visible') {
			ambientPausedByVisibility = !ambientAudio.paused;
			ambientAudio.pause();
		} else if (ambientPausedByVisibility) {
			ambientPausedByVisibility = false;
			const musicAudible =
				stateSound.volumeValueMaster !== 0 && stateSound.volumeValueMusic !== 0;
			if (musicAudible) void ambientAudio.play().catch(() => {});
		}
	};

	onMount(() => {
		ambientAudio = browser ? new Audio(ambientTrackUrl) : null;
		const unlockAmbient = async () => {
			if (ambientUnlocked) return;
			await playAmbient(stateBet.activeBetModeKey === 'SUPER' ? 'bonus' : 'base');
		};

		window.addEventListener('pointerdown', unlockAmbient, { once: true });
		window.addEventListener('keydown', unlockAmbient, { once: true });
		document.addEventListener('visibilitychange', onVisibilityChange);

		if (stateSound.volumeValueMaster !== 0 && stateBet.activeBetModeKey === 'SUPER') {
			playAmbient('bonus');
		} else if (stateSound.volumeValueMaster !== 0) {
			playAmbient('base');
		}

		return () => {
			window.removeEventListener('pointerdown', unlockAmbient);
			window.removeEventListener('keydown', unlockAmbient);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			stopAmbient();
		};
	});
</script>

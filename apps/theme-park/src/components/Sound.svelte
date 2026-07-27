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

	import { stateSound } from 'state-shared';

	import { getContext } from '../game/context';

	const context = getContext();
	const ambientTrackUrls = {
		base: './assets/audio/audio-idea.mp3',
		bonus: './assets/audio/audio-bonus.mp3',
	} as const;
	let ambientAudio: Record<'base' | 'bonus', HTMLAudioElement> | null = null;
	let activeAmbient: 'base' | 'bonus' = 'base';
	let ambientUnlocked = false;

	const playAmbient = async (mode: 'base' | 'bonus') => {
		if (!browser || !ambientAudio) return;
		if (stateSound.volumeValueMaster === 0) {
			stopAmbient();
			return;
		}
		const target = ambientAudio[mode];
		const other = ambientAudio[mode === 'base' ? 'bonus' : 'base'];
		other.pause();
		activeAmbient = mode;
		target.loop = true;
		target.volume = (stateSound.volumeValueMaster / 100) * (mode === 'bonus' ? 0.32 : 0.22);
		try {
			await target.play();
			ambientUnlocked = true;
		} catch {
			// ignore autoplay block until first gesture
		}
	};

	const stopAmbient = () => {
		if (!ambientAudio) return;
		for (const track of Object.values(ambientAudio)) {
			track.pause();
			track.currentTime = 0;
		}
	};

	const playMusic = ({ name }: { name: MusicName }) => {
		if (stateSound.volumeValueMaster === 0) {
			stopAmbient();
			return;
		}

		if (name === 'bgm_main') {
			sound.stop({ name: 'bgm_freespin' });
			return playAmbient('base');
		}

		if (name === 'bgm_freespin') {
			sound.stop({ name: 'bgm_main' });
			return playAmbient('bonus');
		}

		stopAmbient();
		sound.players.music.play({ name });
	};

	context.eventEmitter.subscribeOnMount({
		// ui
		soundPressGeneral: () => sound.players.once.play({ name: 'sfx_btn_general' }),
		soundPressBet: () => sound.players.once.play({ name: 'sfx_btn_spin' }),
		// scatterCounter
		soundScatterCounterIncrease: () => (context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1), // prettier-ignore
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),
		// game
		soundMusic: ({ name }) => playMusic({ name }),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => { if (name === 'bgm_main' || name === 'bgm_freespin') stopAmbient(); sound.stop({ name }); },
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	$effect(() => {
		if (stateSound.volumeValueMaster === 0) {
			stopAmbient();
			sound.stop({ name: 'bgm_main' });
			sound.stop({ name: 'bgm_freespin' });
		} else if (ambientAudio) {
			ambientAudio[activeAmbient].volume = (stateSound.volumeValueMaster / 100) * (activeAmbient === 'bonus' ? 0.32 : 0.22);
		}
	});

	onMount(() => {
		ambientAudio = browser
			? { base: new Audio(ambientTrackUrls.base), bonus: new Audio(ambientTrackUrls.bonus) }
			: null;
		const unlockAmbient = async () => {
			if (ambientUnlocked) return;
			await playAmbient('base');
		};

		window.addEventListener('pointerdown', unlockAmbient, { once: true });
		window.addEventListener('keydown', unlockAmbient, { once: true });

		if (stateSound.volumeValueMaster !== 0) {
			playAmbient('base');
		}

		return () => {
			window.removeEventListener('pointerdown', unlockAmbient);
			window.removeEventListener('keydown', unlockAmbient);
			stopAmbient();
		};
	});
</script>

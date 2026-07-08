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

	import { stateSound } from 'state-shared';

	import { getContext } from '../game/context';

	const context = getContext();
	let wasMuted = false;

	// Background track for the current game state: All In bonus → superspin loop, Deal It / feature
	// bonus → free-spin loop, otherwise the base-game loop.
	const currentMusic = (): MusicName => {
		const gameType = context.stateGame.gameType;
		if (gameType === 'superspin') return 'bgm_allin_bonus';
		if (gameType === 'freegame' || gameType === 'feature') return 'bgm_dealit_bonus';
		return 'bgm_base_game';
	};

	// Long-form background loops — only one should ever be audible at a time. `bgm_win_animation`
	// is included so switching back to the base/bonus track (at win end) stops the win-celebration loop.
	const BGM_LOOPS: MusicName[] = ['bgm_base_game', 'bgm_dealit_bonus', 'bgm_allin_bonus', 'bgm_win_animation'];

	// All music plays through the sprite player (single track). Stop the other loops before starting
	// the requested one so a bonus loop never lingers after switching back to the base game.
	const playMusic = ({ name }: { name: MusicName }) => {
		if (stateSound.volumeValueMaster === 0) {
			BGM_LOOPS.forEach((n) => sound.stop({ name: n }));
			return;
		}
		BGM_LOOPS.forEach((n) => n !== name && sound.stop({ name: n }));
		sound.players.music.play({ name });
	};

	context.eventEmitter.subscribeOnMount({
		// ui
		soundBetMode: ({ betModeKey }) => {
			// Music preview when switching bet mode; the actual bonus track is set by freeSpinTrigger.
			if (betModeKey === 'SUPER') {
				sound.players.music.play({ name: 'bgm_dealit_bonus' });
			} else {
				sound.players.music.play({ name: 'bgm_base_game' });
			}
		},
		soundPressGeneral: () => sound.players.once.play({ name: 'sfx_button_click' }),
		soundPressBet: () => sound.players.once.play({ name: 'sfx_spin_button' }),
		// scatterCounter
		soundScatterCounterIncrease: () => (context.stateGame.scatterCounter = context.stateGame.scatterCounter + 1), // prettier-ignore
		soundScatterCounterClear: () => (context.stateGame.scatterCounter = 0),
		// game
		soundMusic: ({ name }) => playMusic({ name }),
		soundLoop: ({ name }) => sound.players.loop.play({ name }),
		soundOnce: ({ name, forcePlay }) => sound.players.once.play({ name, forcePlay }),
		soundStop: ({ name }) => sound.stop({ name }),
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	$effect(() => {
		const muted = stateSound.volumeValueMaster === 0;
		if (muted) {
			BGM_LOOPS.forEach((n) => sound.stop({ name: n }));
		} else if (wasMuted) {
			// Just unmuted — restart the current mode's track (it was stopped while muted).
			playMusic({ name: currentMusic() });
		}
		wasMuted = muted;
	});

	onMount(() => {
		if (stateSound.volumeValueMaster !== 0) playMusic({ name: currentMusic() });
	});
</script>

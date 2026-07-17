<script lang="ts">
	import { onMount } from 'svelte';

	import type { LoadedAudio } from 'pixi-svelte';
	import { stateSound } from 'state-shared';
	import { Howler } from 'utils-sound';

	import { getContext } from '../game/context';
	import { sound, type SoundName } from '../game/sound';

	const context = getContext();

	sound.enableEffect();

	// Directly wire volumeValueMaster → Howler global volume.
	// Bypasses the per-player chain whose guard prevented reactive tracking.
	$effect(() => {
		Howler.volume(stateSound.volumeValueMaster / 100);
		Howler.mute(stateSound.volumeValueMaster === 0);
	});

	// Per-channel volumes, wired DIRECTLY like the master above — $state changes don't track
	// through the utils-sound package boundary, so sound.volumeEffect() never re-fires there.
	// MUSIC drives the background-music player; SOUND drives both effect players (loops + once).
	$effect(() => {
		const vol = stateSound.volumeValueMusic / 100;
		if (sound.players) sound.players.music.volume(vol);
	});
	$effect(() => {
		const vol = stateSound.volumeValueSoundEffect / 100;
		if (sound.players) {
			sound.players.loop.volume(vol);
			sound.players.once.volume(vol);
		}
	});

	onMount(() => {
		const loadedAudio = $state.snapshot(
			context.stateApp.loadedAssets['sound'],
		) as LoadedAudio<SoundName>;
		const { destroy } = sound.load(loadedAudio);

		// The volume $effects above first ran BEFORE this load created the players, and
		// `sound.players` is not reactive so they never re-run on creation — apply the
		// initial channel volumes here or everything plays at the Howl default (100%)
		// until the user first touches a slider.
		sound.players.music.volume(stateSound.volumeValueMusic / 100);
		sound.players.loop.volume(stateSound.volumeValueSoundEffect / 100);
		sound.players.once.volume(stateSound.volumeValueSoundEffect / 100);

		return () => {
			// Equivalent to onDestroy(); Leave this comment for searching.
			destroy();
		};
	});
</script>

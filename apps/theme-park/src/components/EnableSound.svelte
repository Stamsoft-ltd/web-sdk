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

	onMount(() => {
		let destroy: (() => void) | undefined;
		let cancelled = false;
		const initialise = async () => {
			const fromLoader = $state.snapshot(
				context.stateApp.loadedAssets['sound'],
			) as LoadedAudio<SoundName> | undefined;
			const loadedAudio = fromLoader ?? await fetch('./assets/audio/sounds.json').then(
				(response) => response.json() as Promise<LoadedAudio<SoundName>>,
			);
			if (cancelled) return;
			destroy = sound.load(loadedAudio).destroy;
		};
		void initialise().catch((error) => console.error('[theme-park] sound_init_failed', error));

		return () => {
			cancelled = true;
			destroy?.();
		};
	});
</script>

<script lang="ts">
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

	// The audio sprite is in the gating (counted) asset tier rather than `preload`, so it is NOT in
	// loadedAssets at mount — reading it there produced `new Howl({ src: undefined })` and left
	// `sound.players` undefined, which every soundPress*/soundOnce handler then threw on. Wait for
	// the key instead, and load exactly once.
	let audioLoaded = false;
	let destroyAudio: (() => void) | undefined;
	$effect(() => {
		const raw = context.stateApp.loadedAssets?.['sound'];
		if (!raw || audioLoaded) return;
		audioLoaded = true;

		const loadedAudio = $state.snapshot(raw) as LoadedAudio<SoundName>;
		destroyAudio = sound.load(loadedAudio).destroy;

		// The volume $effects above first ran BEFORE this load created the players, and
		// `sound.players` is not reactive so they never re-run on creation — apply the
		// initial channel volumes here or everything plays at the Howl default (100%)
		// until the user first touches a slider.
		sound.players.music.volume(stateSound.volumeValueMusic / 100);
		sound.players.loop.volume(stateSound.volumeValueSoundEffect / 100);
		sound.players.once.volume(stateSound.volumeValueSoundEffect / 100);
	});

	// Teardown ONLY — deliberately a separate effect with no reactive reads.
	// `loadedAssets` is REPLACED (not mutated) by every AssetsLoader merge: the preload pass, the
	// gating pass, each deferred wave, and every demand load. So the effect above re-runs several
	// times per session. When its cleanup lived inside it, Svelte ran that cleanup before each
	// re-run — unloading the sprite Howl — while `audioLoaded` made the body early-return, so
	// nothing ever recreated it. Howl.unload() clears _sprite and sets _state to 'unloaded', and
	// Howler queues plays on an unloaded Howl instead of throwing, so every SFX went silent with no
	// error. Background music survived because Sound.svelte loops it through its own standalone
	// Howls; only the sprite died. Registering the teardown here means it fires on unmount only.
	$effect(() => () => destroyAudio?.());
</script>

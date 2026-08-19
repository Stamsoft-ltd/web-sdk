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

	import { getContext } from '../game/context';

	const context = getContext();

	// The five background beds. Exactly one plays at a time — the music player pauses whatever else is
	// on its channel — so switching bed just plays (or resumes) the new name. The big-win beds
	// (bgm_bigwin_*) are NOT here: they temporarily REPLACE the bed and the bed resumes when they stop.
	const BEDS: MusicName[] = [
		'bgm_main',
		'bgm_freespin',
		'bgm_coaster_setup',
		'bgm_duck_bonus',
		'bgm_roller_wilds',
	];
	const isBed = (name: MusicName): boolean => BEDS.includes(name);

	// Last background bed asked for. A big-win bed pauses it; when the big-win bed stops we resume this.
	let currentBed: MusicName = 'bgm_main';

	const playMusic = ({ name }: { name: MusicName }) => {
		if (isBed(name)) currentBed = name;
		// A 'new' name starts fresh (pausing the current bed); a 'paused' name resumes where it left off.
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
		soundStop: ({ name }) => {
			sound.stop({ name });
			// A big-win bed had replaced the background music; bring the background bed back when it ends.
			if (name.startsWith('bgm_bigwin')) playMusic({ name: currentBed });
		},
		soundFade: async ({ name, duration, from, to }) => await sound.fade({ name, duration, from, to }), // prettier-ignore
	});

	onMount(() => {
		// This component mounts the instant the splash is dismissed — and that press both unlocked
		// WebAudio and revealed the game, so the base bed should start NOW rather than waiting for a
		// further click. If the sprite Howl is still loading, retry on a short poll; a first-gesture
		// listener is a final fallback for any browser that hasn't resumed the context yet.
		let started = false;
		let poll = 0;
		const cleanup = () => {
			clearInterval(poll);
			window.removeEventListener('pointerdown', tryStart);
			window.removeEventListener('keydown', tryStart);
		};
		const tryStart = () => {
			if (started || !sound.players) return; // Howl not loaded yet — try again shortly
			started = true;
			playMusic({ name: currentBed });
			cleanup();
		};
		tryStart();
		if (!started) {
			poll = setInterval(tryStart, 120) as unknown as number;
			window.addEventListener('pointerdown', tryStart);
			window.addEventListener('keydown', tryStart);
		}
		return cleanup;
	});
</script>

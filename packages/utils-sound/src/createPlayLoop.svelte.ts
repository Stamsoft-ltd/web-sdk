import type { Howl } from 'howler';

import type { PlayOptions, GetSound, GetSoundMap } from './types';

export function createPlayLoop<TSoundName extends string>(options: {
	howl: Howl;
	newSound: (value: TSoundName) => GetSound<TSoundName>;
	getSoundMap: () => GetSoundMap<TSoundName>;
	initSoundVolume: (soundName: TSoundName) => void;
}) {
	type Sound = GetSound<TSoundName>;

	const playLoop = (sound: Sound) => {
		const soundId = options.howl.play(sound.soundName);
		// Force this instance to loop. Relying on the sprite's loop flag alone is unreliable in Howler —
		// it isn't always reapplied on replays (after a stop), so the sound would play once and not
		// repeat on the 2nd/3rd trigger. Setting loop explicitly per soundId guarantees it repeats.
		options.howl.loop(true, soundId);
		options.getSoundMap()[sound.soundName] = {
			...sound,
			soundId,
			soundState: 'playing',
		};

		options.initSoundVolume(sound.soundName);
	};

	const soundPlayMap = {
		new: (sound: Sound) => playLoop(sound),
		paused: (sound: Sound) => playLoop(sound),
		playing: (_: Sound) => {
			// Do nothing
		},
	};

	const play = (playOptions: PlayOptions<TSoundName>) => {
		const existingSound = options.getSoundMap()[playOptions.name];
		const sound = existingSound ?? options.newSound(playOptions.name);
		soundPlayMap[sound.soundState](sound);
	};

	return {
		play,
	};
}

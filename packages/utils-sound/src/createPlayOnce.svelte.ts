import type { Howl } from 'howler';

import type { PlayOptions, GetSound, GetSoundMap } from './types';

export function createPlayOnce<TSoundName extends string>(options: {
	howl: Howl;
	newSound: (value: TSoundName) => GetSound<TSoundName>;
	getSoundMap: () => GetSoundMap<TSoundName>;
	initSoundVolume: (soundName: TSoundName) => void;
}) {
	type Sound = GetSound<TSoundName>;

	const playOnce = (sound: Sound) => {
		const soundId = options.howl.play(sound.soundName);
		options.getSoundMap()[sound.soundName] = {
			...sound,
			soundId,
			soundState: 'playing',
		};

		options.initSoundVolume(sound.soundName);

		// Scope the handler to this soundId and let Howler drop it after firing — a plain
		// on('end') accumulates one closure per play on the shared Howl forever.
		options.howl.once(
			'end',
			() => {
				options.howl.stop(soundId);
				// A forcePlay replay may have re-pointed the map entry at a newer,
				// still-playing instance — only clear the entry if it is still ours,
				// or that instance escapes volume/stop control.
				const entry = options.getSoundMap()[sound.soundName];
				if (entry?.soundId === soundId) delete options.getSoundMap()[sound.soundName];
			},
			soundId,
		);
	};

	const soundPlayMap = {
		new: (sound: Sound) => playOnce(sound),
		paused: (sound: Sound) => playOnce(sound),
		playing: (sound: Sound, options: { forcePlay?: boolean }) => {
			if (options.forcePlay) playOnce(sound);
		},
	};

	const play = (playOptions: PlayOptions<TSoundName> & { forcePlay?: boolean }) => {
		const existingSound = options.getSoundMap()[playOptions.name];
		const sound = existingSound ?? options.newSound(playOptions.name);
		soundPlayMap[sound.soundState](sound, { forcePlay: playOptions.forcePlay });
	};

	return {
		play,
	};
}

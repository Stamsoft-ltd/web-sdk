/** Approved eight-bar loops, independent of SFX mute and spin speed. */
export const MUSIC_FILES = {
	base: 'base-music-preview',
	bonus: 'bonus-music-preview',
	super: 'super-music-preview',
	hidden: 'hidden-music-preview',
} as const;
export type MusicScene = keyof typeof MUSIC_FILES;
export const MUSIC_LOOP_SECONDS = { base: 20, bonus: 16, super: 15, hidden: 19.2 } as const;
/** Use visible scenery, not selected buy mode; doors own the actual scene switch. */
export function musicForScene(
	entered: boolean,
	tier: string | null | undefined,
): MusicScene | null {
	if (!entered) return null;
	return tier === 'super' || tier === 'hidden' ? tier : tier ? 'bonus' : 'base';
}
export function createMusicBus(
	context: AudioContext,
	destination: AudioNode,
	volume: () => number,
	visible: () => boolean,
) {
	const buffers = new Map<MusicScene, AudioBuffer>();
	const tracks = new Map<
		MusicScene,
		{ source: AudioBufferSourceNode; gain: GainNode; target: number }
	>();
	let scene: MusicScene | null = null,
		ducked = false,
		dead = false;
	function sync() {
		if (dead) return;
		const level = visible() ? Math.max(0, Math.min(1, volume() / 100)) : 0;
		for (const key of Object.keys(MUSIC_FILES) as MusicScene[]) {
			let track = tracks.get(key);
			const buffer = buffers.get(key);
			if (!track && buffer && scene === key && level > 0 && context.state === 'running') {
				const source = context.createBufferSource(),
					gain = context.createGain();
				source.buffer = buffer;
				source.loop = true;
				source.loopStart = 0;
				source.loopEnd = Math.min(MUSIC_LOOP_SECONDS[key], buffer.duration);
				gain.gain.setValueAtTime(0, context.currentTime);
				source.connect(gain);
				gain.connect(destination);
				track = { source, gain, target: 0 };
				tracks.set(key, track);
				source.start();
			}
			if (!track) continue;
			const target = scene === key ? level * (ducked ? 0.28 : 1) : 0;
			if (target === track.target) continue;
			const now = context.currentTime,
				param = track.gain.gain;
			param.cancelScheduledValues(now);
			param.setValueAtTime(param.value, now);
			// Immediate mute; gentle scene fades, quick duck and slower recovery.
			if (level === 0) param.setValueAtTime(0, now);
			else param.linearRampToValueAtTime(target, now + (ducked ? 0.12 : 0.65));
			track.target = target;
		}
	}
	return {
		load(key: MusicScene, buffer: AudioBuffer) {
			if (!dead) {
				buffers.set(key, buffer);
				sync();
			}
		},
		scene(value: MusicScene | null) {
			scene = value;
			sync();
		},
		duck(value: boolean) {
			ducked = value;
			sync();
		},
		sync,
		destroy() {
			dead = true;
			for (const { source, gain } of tracks.values()) {
				try {
					source.stop();
				} catch {}
				source.disconnect();
				gain.disconnect();
			}
			tracks.clear();
			buffers.clear();
		},
	};
}

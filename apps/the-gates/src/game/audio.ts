import { createMusicBus, MUSIC_FILES, type MusicScene } from './music.ts';
/** Approved audition cues. No outcome logic, timers or sound synthesis. Licensing is a release gate. */
export const AUDIO_FILES = {
	click: '05-ui-click',
	spin: '06-spin-start',
	cascade: '02-cascade',
	'gate-close': '15-gate-close',
	portal: '03-gate-portal',
	retract: '16-portal-retract',
	'wisp-arrive': '07-wisp-arrival',
	addMultiplier: '08-multiplier-add',
	multiplyMultiplier: '09-multiplier-boost',
	stickyWild: '10-wild-reward',
	extraSpin: '11-extra-spin',
	retrigger: '12-retrigger',
	bonus: '13-bonus-entry',
	summary: '14-bonus-summary',
	key: '17-key-land',
	sweet: '18-win-sweet',
	wild: '04-win-fanfare',
	epic: '19-win-epic',
	mythic: '20-win-mythic',
	legendary: '21-win-legendary',
	'reel-1': 'reel-land-1',
	'reel-2': 'reel-land-2',
	'reel-3': 'reel-land-3',
	'reel-4': 'reel-land-4',
	'reel-5': 'reel-land-5',
	'reel-6': 'reel-land-6',
} as const;
export type SoundCue = keyof typeof AUDIO_FILES;
type SoundOptions = {
	group?: 'reel' | 'cue' | 'win';
	speed?: 'normal' | 'fast' | 'turbo';
	gain?: number;
};
const ROOT = './assets/the-gates/audio/';
let installed: ReturnType<typeof createAudio> | undefined;
let musicScene: MusicScene | null = null;
export function setGameMusic(scene: MusicScene | null) {
	musicScene = scene;
	installed?.musicScene(scene);
}
export function playGameSound(cue: SoundCue, options: SoundOptions = {}) {
	installed?.play(cue, options);
}
export function stopGameSounds(group?: SoundOptions['group']) {
	installed?.stop(group);
}
export function syncGameAudio() {
	installed?.sync();
}
export function installGameAudio(volume: () => number, musicVolume: () => number = () => 0) {
	installed?.destroy();
	const audio = createAudio(volume, musicVolume);
	audio.musicScene(musicScene);
	installed = audio;
	return () => {
		audio.destroy();
		if (installed === audio) installed = undefined;
	};
}
function createAudio(volume: () => number, musicVolume: () => number) {
	let context: AudioContext | undefined,
		master: GainNode | undefined,
		dead = false;
	let music: ReturnType<typeof createMusicBus> | undefined;
	const buffers = new Map<SoundCue, AudioBuffer>();
	const voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode; group: string }>();
	const requests = new AbortController();
	const visible = () => document.visibilityState !== 'hidden';
	const level = () => Math.max(0, Math.min(1, volume() / 100));
	function updateDuck() {
		music?.duck([...voices].some((v) => v.group === 'win'));
	}
	function stop(group?: string) {
		for (const voice of [...voices])
			if (!group || voice.group === group) {
				voices.delete(voice);
				try {
					voice.source.stop();
				} catch {}
				voice.source.disconnect();
				voice.gain.disconnect();
			}
		updateDuck();
	}
	function sync() {
		if (master && context) master.gain.setValueAtTime(visible() ? level() : 0, context.currentTime);
		if (!level() || !visible()) stop();
		music?.sync();
	}
	async function unlock() {
		if (dead || !visible()) return;
		try {
			if (!context) {
				context = new AudioContext({ latencyHint: 'interactive' });
				master = context.createGain();
				const limiter = context.createDynamicsCompressor();
				limiter.threshold.value = -6;
				limiter.knee.value = 6;
				limiter.ratio.value = 12;
				limiter.attack.value = 0.003;
				limiter.release.value = 0.12;
				master.connect(limiter);
				limiter.connect(context.destination);
				music = createMusicBus(context, limiter, musicVolume, visible);
				music.scene(musicScene);
				for (const [key, file] of Object.entries(MUSIC_FILES)) {
					void fetch(`${ROOT}${file}.mp3`, { signal: requests.signal })
						.then((r) => {
							if (!r.ok) throw Error('music unavailable');
							return r.arrayBuffer();
						})
						.then((b) => context!.decodeAudioData(b))
						.then((b) => {
							if (!dead) music?.load(key as MusicScene, b);
						})
						.catch(() => {});
				}
				sync();
				// Decode once. Missed cues never queue/replay after loading or unmuting.
				for (const [cue, file] of Object.entries(AUDIO_FILES)) {
					void fetch(`${ROOT}${file}.mp3`, { signal: requests.signal })
						.then((r) => {
							if (!r.ok) throw Error('audio unavailable');
							return r.arrayBuffer();
						})
						.then((b) => context!.decodeAudioData(b))
						.then((b) => {
							if (!dead) buffers.set(cue as SoundCue, b);
						})
						.catch(() => {});
				}
			}
			if (context.state === 'suspended') await context.resume();
			sync();
		} catch {} // Unsupported/blocked audio must never interrupt RGS or presentation.
	}
	function play(cue: SoundCue, options: SoundOptions = {}) {
		if (dead || !context || !master || context.state !== 'running' || !visible() || !level())
			return;
		const buffer = buffers.get(cue);
		if (!buffer) return;
		sync();
		const group = options.group ?? 'cue',
			limit = group === 'reel' ? 6 : group === 'win' ? 1 : 3;
		if (group === 'win') {
			stop('win');
			stop('reel');
			stop('cue');
		}
		while ([...voices].filter((v) => v.group === group).length >= limit || voices.size >= 10) {
			const oldest = [...voices].find((v) => v.group === group) ?? [...voices][0];
			if (!oldest) break;
			voices.delete(oldest);
			try {
				oldest.source.stop();
			} catch {}
			oldest.source.disconnect();
			oldest.gain.disconnect();
		}
		try {
			const source = context.createBufferSource(),
				gain = context.createGain();
			source.buffer = buffer;
			source.connect(gain);
			gain.connect(master);
			const trim =
				group === 'reel'
					? options.speed === 'turbo'
						? 0.16
						: options.speed === 'fast'
							? 0.28
							: buffer.duration
					: buffer.duration;
			const offset =
				cue === 'wisp-arrive' ? 0.23 : cue === 'portal' ? 0.3 : cue === 'bonus' ? 0.7 : 0;
			const duration = Math.min(trim, buffer.duration - offset),
				now = context.currentTime;
			const amplitude =
				Math.max(0, Math.min(1, options.gain ?? 1)) *
				(group === 'reel' && options.speed === 'turbo' ? 0.65 : 1);
			gain.gain.setValueAtTime(amplitude, now);
			gain.gain.setValueAtTime(amplitude, now + Math.max(0, duration - 0.035));
			gain.gain.linearRampToValueAtTime(0, now + duration);
			const voice = { source, gain, group };
			voices.add(voice);
			updateDuck();
			source.onended = () => {
				voices.delete(voice);
				updateDuck();
				source.disconnect();
				gain.disconnect();
			};
			source.start(now, offset, duration);
		} catch {}
	}
	function gesture(event: Event) {
		if (event.isTrusted) void unlock();
	}
	function click(event: MouseEvent) {
		const button = (event.target as Element)?.closest?.('button');
		if (button && !button.disabled) play('click', { gain: 0.65 });
	}
	function visibility() {
		sync();
		if (!visible()) void context?.suspend().catch(() => {});
		else if (context?.state === 'suspended')
			void context
				.resume()
				.then(sync)
				.catch(() => {});
	}
	document.addEventListener('pointerdown', gesture, true);
	document.addEventListener('keydown', gesture, true);
	document.addEventListener('click', click, true);
	document.addEventListener('visibilitychange', visibility);
	return {
		play,
		stop,
		sync,
		musicScene(scene: MusicScene | null) {
			music?.scene(scene);
		},
		destroy() {
			dead = true;
			requests.abort();
			music?.destroy();
			stop();
			buffers.clear();
			document.removeEventListener('pointerdown', gesture, true);
			document.removeEventListener('keydown', gesture, true);
			document.removeEventListener('click', click, true);
			document.removeEventListener('visibilitychange', visibility);
			void context?.close().catch(() => {});
		},
	};
}

// The game's audio on Web Audio (public/audio, from "Sounds Gorgo Blob Split_slot"): short
// effects, a looping bed (base or bonus music, crossfaded) and one-shot music stings (win
// music, bonus completed) that duck the bed while they play. Sound and Music are the menu's
// two toggles. Everything loads in the background: until a clip has decoded, playing it is
// a no-op, so audio can never hold up the game.

export type Sfx =
	| 'click'
	| 'spin'
	| 'land'
	| 'scatter'
	| 'crack'
	| 'split'
	| 'connect'
	| 'pop'
	| 'winSmall'
	| 'plop'
	| 'tick'
	| 'thud'
	| 'heart';
export type Bed = 'base' | 'bonus';
export type Sting = 'win' | 'bigWin' | 'bonusEnd';

const FILES: Record<Exclude<Sfx, keyof typeof ALIAS> | Bed | Sting, string> = {
	click: 'ui-click',
	spin: 'spin-start',
	land: 'blob-land',
	scatter: 'scatter-land',
	crack: 'egg-crack',
	split: 'tile-split',
	connect: 'win-connect',
	pop: 'blobs-pop',
	winSmall: 'win-small',
	base: 'music-base',
	bonus: 'music-bonus',
	win: 'music-win',
	bigWin: 'music-big-win',
	bonusEnd: 'bonus-completed',
};
// Per-clip levels: the delivered files are mastered unevenly (blobs-pop sits ~12dB over the
// landing; scatter-land was raised 8dB offline to match it), so these even them out under the
// two master gains.
const LEVEL: Partial<Record<Sfx | Bed | Sting, number>> = {
	click: 0.9,
	spin: 0.6,
	plop: 0.9,
	land: 0.8,
	scatter: 1.1,
	pop: 0.35,
	split: 0.8,
	tick: 0.3,
	thud: 1.1,
	heart: 0.9,
	base: 0.45,
	bonus: 0.45,
	win: 0.85,
	bigWin: 0.95,
	bonusEnd: 0.85,
};
// Effects made from another clip: a dialog's plop is the blob landing pitched up, a win
// count-up ticks on the smallest win's chime, its landing thuds on the landing pitched down,
// and the scatter tease's heartbeat is the landing slowed further.
const ALIAS = {
	plop: ['land', 1.7],
	tick: ['winSmall', 1.6],
	thud: ['land', 0.7],
	heart: ['land', 0.5],
} as const satisfies Record<string, [clip: Sfx, rate: number]>;
// Seconds each pass of a bed overlaps the next: music-base fades out over its last ~0.45s, so
// a plain loop dipped to silence once per pass; music-bonus (v2, 20.8s) ends on the beat.
const BED_XF: Record<Bed, number> = { base: 0.5, bonus: 0.03 };
const BED_DUCK = 0.2;
const FADE_S = 0.4;
// The same effect fired again within this window (a column's blobs, several eggs) is dropped.
const RETRIGGER_MS = 45;

let ctx: AudioContext | undefined;
let sfxBus: GainNode;
let musicBus: GainNode;
let bedBus: GainNode;
let master: DynamicsCompressorNode;
const buffers = new Map<string, AudioBuffer>();
let sfxOn = false;
let musicOn = false;
let bedWant: Bed | null = null;
let bed: { name: Bed; gain: GainNode; srcs: Set<AudioBufferSourceNode>; timer: number } | null = null;
let stings = 0;
const lastAt = new Map<Sfx, number>();
// Effects queued ahead (landings timed to a wave); a slam stop cancels them.
const pending = new Set<AudioBufferSourceNode>();

/** Creates the context (suspended until a gesture) and fetches and decodes every clip. */
export function loadSound() {
	if (ctx || typeof AudioContext === 'undefined') return;
	ctx = new AudioContext();
	sfxBus = ctx.createGain();
	musicBus = ctx.createGain();
	bedBus = ctx.createGain();
	sfxBus.gain.value = sfxOn ? 1 : 0;
	musicBus.gain.value = musicOn ? 1 : 0;
	// A limiter over everything: a big cascade stacks pops, landings and the win music.
	master = ctx.createDynamicsCompressor();
	master.threshold.value = -6;
	master.knee.value = 6;
	master.ratio.value = 12;
	master.attack.value = 0.003;
	master.release.value = 0.25;
	master.connect(ctx.destination);
	bedBus.connect(musicBus);
	sfxBus.connect(master);
	musicBus.connect(master);
	// A browser only lets audio start from a gesture; any press in the game unlocks it. Safari
	// takes only the release (pointerup / touchend / click) as one, not pointerdown, and iOS
	// wants a sound started inside that gesture, hence the silent one-sample buffer.
	const unlock = () => {
		if (!ctx || ctx.state === 'running') return;
		void ctx.resume();
		const src = ctx.createBufferSource();
		src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
		src.connect(ctx.destination);
		src.start();
	};
	for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
		addEventListener(type, unlock, { capture: true });
	// iOS mutes Web Audio under the ring/silent switch unless the page plays as media.
	const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
	if (session) session.type = 'playback';
	// Hidden tab: nothing plays (the bed would keep going behind other tabs otherwise).
	document.addEventListener('visibilitychange', () => {
		if (!ctx) return;
		if (document.hidden) void ctx.suspend();
		else void ctx.resume();
	});
	for (const [key, file] of Object.entries(FILES))
		fetch(`./audio/${file}.mp3`)
			.then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
			.then((data) => ctx!.decodeAudioData(data))
			.then((buf) => {
				buffers.set(key, buf);
				if (key === bedWant && !bed) setBed(bedWant);
			})
			.catch((e) => console.warn(`sound: ${file} not loaded`, e));
}

const ramp = (g: GainNode, to: number, s = FADE_S) => {
	const t = ctx!.currentTime;
	g.gain.cancelScheduledValues(t);
	g.gain.setValueAtTime(g.gain.value, t);
	g.gain.linearRampToValueAtTime(to, t + s);
};

export function setSfx(on: boolean) {
	sfxOn = on;
	if (ctx) ramp(sfxBus, on ? 1 : 0, 0.05);
}
export function setMusic(on: boolean) {
	musicOn = on;
	if (ctx) ramp(musicBus, on ? 1 : 0, 0.25);
}

/** Plays an effect now, or `delayMs` from now (queued: stopPending() drops it). `pitch`
 *  multiplies its playback rate; `always` skips the retrigger window (eggs cracking in turn).
 *  Returns a stop for it, or nothing when it didn't play. */
export function play(name: Sfx, delayMs = 0, level = 1, pitch = 1, always = false): (() => void) | undefined {
	const [clip, rate] = (ALIAS as Partial<Record<Sfx, readonly [Sfx, number]>>)[name] ?? [name, 1];
	const buf = buffers.get(clip);
	if (!ctx || !buf || !sfxOn || ctx.state !== 'running') return;
	const now = performance.now() + delayMs;
	if (!always && now - (lastAt.get(name) ?? -1e9) < RETRIGGER_MS) return;
	lastAt.set(name, now);
	const src = ctx.createBufferSource();
	const g = ctx.createGain();
	src.buffer = buf;
	src.playbackRate.value = rate * pitch;
	g.gain.value = (LEVEL[name] ?? LEVEL[clip] ?? 1) * level;
	src.connect(g).connect(sfxBus);
	src.start(ctx.currentTime + Math.max(0, delayMs) / 1000);
	if (delayMs > 0) {
		pending.add(src);
		src.onended = () => pending.delete(src);
	}
	return () => {
		try {
			src.stop();
		} catch {}
	};
}

/** Drops every effect still queued ahead (a slam stop lands everything at once). */
export function stopPending() {
	if (!ctx) return;
	const t = ctx.currentTime;
	for (const src of pending)
		try {
			src.stop(t);
		} catch {}
	pending.clear();
}

/** The looping bed: base or bonus music, crossfaded; null fades it out. */
export function setBed(name: Bed | null) {
	bedWant = name;
	if (!ctx || bed?.name === name) return;
	if (bed) {
		const old = bed;
		clearTimeout(old.timer);
		ramp(old.gain, 0);
		for (const src of old.srcs) src.stop(ctx.currentTime + FADE_S + 0.05);
		bed = null;
	}
	const buf = name && buffers.get(name);
	if (!name || !buf) return;
	const gain = ctx.createGain();
	gain.gain.value = 0;
	gain.connect(bedBus);
	ramp(gain, LEVEL[name] ?? 1, 0.8);
	bed = { name, gain, srcs: new Set(), timer: 0 };
	bedPass(bed, buf, ctx.currentTime);
}

// One pass of the bed from `at`, crossfading into the next pass, which it schedules ahead.
function bedPass(b: NonNullable<typeof bed>, buf: AudioBuffer, at: number) {
	if (!ctx || bed !== b) return;
	const xf = BED_XF[b.name];
	const end = at + buf.duration;
	const src = ctx.createBufferSource();
	const g = ctx.createGain();
	src.buffer = buf;
	g.gain.setValueAtTime(0, at);
	g.gain.linearRampToValueAtTime(1, at + xf);
	g.gain.setValueAtTime(1, end - xf);
	g.gain.linearRampToValueAtTime(0, end);
	src.connect(g).connect(b.gain);
	src.start(at);
	b.srcs.add(src);
	src.onended = () => b.srcs.delete(src);
	// The next pass is queued ~2s ahead of its start. A suspended context (hidden tab) stops the
	// clock, so the wait re-checks rather than piling passes up ahead of it.
	const next = end - xf;
	const queue = () => {
		if (!ctx || bed !== b) return;
		const lead = next - ctx.currentTime;
		if (ctx.state === 'running' && lead <= 2.5) bedPass(b, buf, Math.max(next, ctx.currentTime));
		else b.timer = window.setTimeout(queue, Math.max(250, (lead - 2) * 1000));
	};
	b.timer = window.setTimeout(queue, Math.max(250, (next - ctx.currentTime - 2) * 1000));
}

/** A one-shot music sting over a ducked bed. Returns a stop that fades it out early. */
export function sting(name: Sting): () => void {
	const buf = buffers.get(name);
	if (!ctx || !buf) return () => {};
	const src = ctx.createBufferSource();
	const gain = ctx.createGain();
	src.buffer = buf;
	gain.gain.value = LEVEL[name] ?? 1;
	src.connect(gain).connect(musicBus);
	src.start();
	if (stings++ === 0) ramp(bedBus, BED_DUCK, 0.3);
	let done = false;
	const end = () => {
		if (done) return;
		done = true;
		if (--stings === 0 && ctx) ramp(bedBus, 1, 0.8);
	};
	src.onended = end;
	return () => {
		if (done || !ctx) return;
		ramp(gain, 0);
		src.stop(ctx.currentTime + FADE_S + 0.05);
		end();
	};
}

export function closeSound() {
	void ctx?.close();
	ctx = undefined;
}

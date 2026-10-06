// The chef narrates the game: the book-event flow sets a mood (bookEventHandlerMap, onSymbolLand),
// and both chefs — the base-game bottle chef (Background) and the free-games salting chef
// (SpecialMascot) — read the same body language from `chefPose`:
//   spin    — leans in and watches the reels
//   dead    — a small shrug: shoulders up, brows up, a glance away
//   win     — a satisfied double nod, smiling eyes
//   wild    — a quick lunge at the board and a smack down on the counter
//   bigWin  — a laughing bounce, eyes squeezed shut; the prop fires (squirt / salt frenzy)
//   hugeWin — a full celebration: a jump, then the laugh; the prop fires twice
//   snicker — now and then while nothing happens: a sly wheezing snicker in three "heh-heh-heh"
//             bursts — eyes squeezed, chin tucked, head cocked, shoulders popping up on each heh (idleSnicker)
// The art is a body with separate eyes, lids, brows and prop (the bottle chef also has a separate
// head that tilts and nods on its neck), so emotion is carried by the body (lean, hop, squash), the
// head, the gaze, the lids and the brows — the grin itself never changes.

export type ChefMood = 'idle' | 'spin' | 'dead' | 'win' | 'wild' | 'bigWin' | 'hugeWin' | 'snicker';

export const chefMood = $state({
	mood: 'idle' as ChefMood,
	at: -1e9,
	/** The mood it took over from (its pose blends out over BLEND_MS). */
	prev: 'idle' as ChefMood,
	prevAt: -1e9,
});

export const setChefMood = (mood: ChefMood) => {
	const t = performance.now();
	// the same reaction again within a beat (two WILDs landing together) doesn't restart it
	if (mood === chefMood.mood && t - chefMood.at < 450) return;
	chefMood.prev = chefMood.mood;
	chefMood.prevAt = chefMood.at;
	chefMood.mood = mood;
	chefMood.at = t;
};

/**
 * Offsets on top of the idle pose. dx / dy / brow are fractions of the figure's width / height
 * (dy, brow: + = down); sx / sy scale about the feet; look* are pupil offsets in figure fractions
 * (− x = toward the board, which is on the chef's left in both scenes) with `look` its weight over
 * the idle glance; squint 0..1 closes the lids (happy / laughing eyes); propRot turns the held prop
 * (the bottle's smack and waggle; half of it on the salt arm); headTilt (radians, + = clockwise,
 * − = the crown toward the board) and headNod (fraction of the height, + = down) move the head on its
 * neck where the art has one. Squirts and salt frenzies are fired
 * by the scenes themselves off the mood (MOOD_MS / moodAge).
 */
export type ChefPose = {
	dx: number;
	dy: number;
	sx: number;
	sy: number;
	lookX: number;
	lookY: number;
	look: number;
	squint: number;
	brow: number;
	propRot: number;
	headTilt: number;
	headNod: number;
};

export const REST_POSE: ChefPose = {
	dx: 0,
	dy: 0,
	sx: 1,
	sy: 1,
	lookX: 0,
	lookY: 0,
	look: 0,
	squint: 0,
	brow: 0,
	propRot: 0,
	headTilt: 0,
	headNod: 0,
};

type Key = [ms: number, v: number];
const smooth = (x: number) => x * x * (3 - 2 * x);
const keyed = (keys: Key[], ms: number) => {
	if (ms <= keys[0][0]) return keys[0][1];
	for (let i = 1; i < keys.length; i += 1) {
		const [t1, v1] = keys[i];
		const [t0, v0] = keys[i - 1];
		if (ms <= t1) return v0 + (v1 - v0) * smooth((ms - t0) / (t1 - t0));
	}
	return keys[keys.length - 1][1];
};
/** 1 while a reaction lasts, easing to 0 over its last `tail` ms. */
const envelope = (ms: number, dur: number, tail = 250) => (ms < 0 || ms > dur ? 0 : ms < dur - tail ? 1 : smooth((dur - ms) / tail));

// How long each reaction lasts (spin holds until the next mood).
export const MOOD_MS: Record<ChefMood, number> = {
	idle: 0,
	spin: Infinity,
	dead: 900,
	win: 700,
	wild: 650,
	bigWin: 1700,
	hugeWin: 2600,
	snicker: 1500,
};

// The idle snicker: once the last reaction has been over for a while (and no spin is running), the
// chef snickers to himself every SNICKER_MIN_MS..SNICKER_MAX_MS. Called from the scene's frame loop.
const SNICKER_MIN_MS = 9000;
const SNICKER_MAX_MS = 16000;
let nextSnickerIn = SNICKER_MIN_MS;
export const idleSnicker = (now: number) => {
	const m = chefMood.mood;
	if (m === 'spin') return;
	const quietFor = now - chefMood.at - (m === 'idle' ? 0 : MOOD_MS[m]);
	if (quietFor < nextSnickerIn) return;
	nextSnickerIn = SNICKER_MIN_MS + Math.random() * (SNICKER_MAX_MS - SNICKER_MIN_MS);
	setChefMood('snicker');
};

// The snicker's "heh"s (ms into the mood, strength): three bursts ~6 per second, a breath between.
const SNICKER_HEHS: [number, number][] = [
	[60, 0.8], [225, 1], [390, 0.9], [555, 0.7],
	[760, 0.9], [925, 1], [1090, 0.75],
	[1260, 0.55], [1400, 0.35],
];
const HEH_RISE_MS = 50;
/** 0..1: each heh rises to its peak in HEH_RISE_MS and settles over ~3× that (t·e^(1−t)). */
const snickerPulse = (ms: number) => {
	let v = 0;
	for (const [at, k] of SNICKER_HEHS) {
		const u = (ms - at) / HEH_RISE_MS;
		if (u > 0 && u < 8) v += k * u * Math.exp(1 - u);
	}
	return Math.min(1, v);
};

const LOOK_BOARD = { x: -0.0048, y: 0.0022 };

const moodPose = (mood: ChefMood, ms: number): ChefPose => {
	const p = { ...REST_POSE };
	if (ms < 0) return p;
	switch (mood) {
		case 'spin': {
			const k = smooth(Math.min(1, ms / 260));
			p.dx = -0.008 * k;
			p.dy = 0.004 * k;
			p.lookX = LOOK_BOARD.x;
			p.lookY = LOOK_BOARD.y;
			p.look = k;
			// head cocked toward the reels and dipped a touch: watching them
			p.headTilt = -0.035 * k;
			p.headNod = 0.0025 * k;
			break;
		}
		case 'dead': {
			const e = envelope(ms, MOOD_MS.dead, 300);
			// shoulders up (body rises, a hair taller) … and drop
			p.dy = keyed([[0, 0], [160, -0.01], [420, -0.008], [650, 0.002], [900, 0]], ms);
			p.sy = 1 + keyed([[0, 0], [160, 0.008], [420, 0.006], [650, 0]], ms);
			p.brow = -0.006 * e;
			p.lookX = 0.004;
			p.lookY = -0.0025;
			p.look = keyed([[0, 0], [140, 1], [600, 1], [900, 0]], ms);
			// "meh": the head cocks away and back, sinking a touch as the shoulders drop
			p.headTilt = keyed([[0, 0], [180, 0.05], [520, 0.042], [900, 0]], ms);
			p.headNod = keyed([[0, 0], [160, -0.0015], [650, 0.0025], [900, 0]], ms);
			break;
		}
		case 'win': {
			const e = envelope(ms, MOOD_MS.win);
			p.dy = keyed([[0, 0], [110, 0.007], [240, -0.002], [370, 0.006], [520, 0]], ms);
			p.brow = -0.005 * e;
			p.squint = 0.3 * e;
			p.lookX = LOOK_BOARD.x;
			p.lookY = LOOK_BOARD.y;
			p.look = e;
			// a real double nod (the head leads the body's dip), turned toward the board
			p.headNod = keyed([[0, 0], [90, 0.0045], [210, -0.0012], [330, 0.004], [470, -0.0006], [620, 0]], ms);
			p.headTilt = -0.018 * e;
			break;
		}
		case 'wild': {
			const e = envelope(ms, MOOD_MS.wild);
			// lunge toward the board, smack down (squash on the hit at ~200ms), recover
			p.dx = keyed([[0, 0], [150, -0.022], [330, -0.018], [650, 0]], ms);
			p.dy = keyed([[0, 0], [130, -0.006], [200, 0.012], [300, 0.004], [650, 0]], ms);
			p.sy = keyed([[0, 1], [130, 1.012], [200, 0.975], [300, 1.004], [420, 1]], ms);
			p.sx = 1 / Math.sqrt(p.sy);
			p.brow = 0.004 * e; // brows down: intent
			p.lookX = LOOK_BOARD.x * 1.1;
			p.lookY = LOOK_BOARD.y;
			p.look = e;
			p.propRot = keyed([[0, 0], [130, 0.12], [200, -0.16], [330, 0.04], [500, 0]], ms);
			// the head snaps toward the board with the lunge and jolts down on the smack
			p.headTilt = keyed([[0, 0], [140, -0.06], [200, -0.035], [330, -0.045], [650, 0]], ms);
			p.headNod = keyed([[0, 0], [130, -0.002], [200, 0.005], [300, 0.0015], [650, 0]], ms);
			break;
		}
		case 'snicker': {
			const e = envelope(ms, MOOD_MS.snicker, 300);
			// Each "heh" is one pop: the shoulders jerk up and settle (a fast-rise, slow-fall pulse,
			// not a sine buzz), the head bobbing a beat behind them. Three bursts, the last one weaker.
			const heh = snickerPulse(ms) * e;
			const lag = snickerPulse(ms - 45) * e;
			p.dy = -0.002 * e - 0.0045 * heh; // shoulders hunched, popping up with each heh
			p.sy = 1 + 0.0025 * heh; // a hair of stretch on the pop, no buzz
			p.sx = 1 / Math.sqrt(p.sy);
			p.squint = 0.9 * keyed([[0, 0], [120, 1], [MOOD_MS.snicker - 250, 1], [MOOD_MS.snicker, 0]], ms);
			p.brow = -0.004 * e;
			p.headTilt = 0.03 * e + 0.012 * lag; // cocked, rocking a touch further on each heh
			p.headNod = 0.0016 * e - 0.0016 * lag; // chin tucked, tipping up as he wheezes
			p.propRot = 0.012 * lag;
			break;
		}
		case 'bigWin':
		case 'hugeWin': {
			const huge = mood === 'hugeWin';
			const dur = MOOD_MS[mood];
			const e = envelope(ms, dur, 400);
			let lift = 0;
			let squash = 1;
			let t = ms;
			if (huge) {
				// crouch → jump → land, then laugh
				lift = keyed([[0, 0], [140, 0.012], [260, -0.06], [420, -0.06], [560, 0.01], [680, 0]], ms);
				squash = keyed([[0, 1], [140, 0.95], [220, 1.05], [420, 1.02], [560, 0.94], [700, 1]], ms);
				t = ms - 650;
			}
			if (t >= 0) {
				// laughing bounce: quick hops that shrink as it winds down
				const hop = Math.abs(Math.sin(t / 105)) * 0.013 * e;
				lift += -hop;
				squash *= 1 + (Math.cos(t / 52.5) * 0.012 - 0.004) * e;
			}
			p.dy = lift;
			p.sy = squash;
			p.sx = 1 / Math.sqrt(squash);
			p.squint = keyed([[0, 0], [200, 0.85], [dur - 400, 0.85], [dur, 0]], ms);
			p.brow = -0.008 * e;
			p.propRot = huge ? 0.05 * Math.sin(ms / 80) * e : 0.03 * Math.sin(ms / 90) * e;
			// laughing: the head thrown back, rocking side to side, bobbing with each "ha"
			const laugh = t >= 0 ? e : 0;
			p.headNod = -0.0015 * laugh + (t >= 0 ? Math.sin(t / 52.5) * 0.001 * e : 0);
			p.headTilt = 0.045 * Math.sin(Math.max(0, t) / 230) * laugh;
			if (huge) p.headNod += keyed([[0, 0], [140, 0.003], [260, -0.0015], [420, -0.0015], [560, 0.004], [700, 0]], ms); // lags the jump
			break;
		}
	}
	return p;
};

const BLEND_MS = 220;
const mix = (a: ChefPose, b: ChefPose, k: number): ChefPose => {
	const out = { ...a };
	for (const key of Object.keys(a) as (keyof ChefPose)[]) out[key] = a[key] + (b[key] - a[key]) * k;
	return out;
};

/** The chef's reaction pose at time `now` (performance.now / rAF timebase). */
export const chefPose = (now: number): ChefPose => {
	const ms = now - chefMood.at;
	const cur = moodPose(chefMood.mood, ms);
	if (ms >= BLEND_MS) return cur;
	const from = moodPose(chefMood.prev, chefMood.at - chefMood.prevAt);
	return mix(from, cur, smooth(Math.max(0, ms / BLEND_MS)));
};

/** ms since the current reaction started, if it is `mood` (else -1) — for prop one-shots. */
export const moodAge = (mood: ChefMood, now: number) => (chefMood.mood === mood ? now - chefMood.at : -1);

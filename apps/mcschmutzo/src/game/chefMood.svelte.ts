// The chef narrates the game: the book-event flow sets a mood (bookEventHandlerMap, onSymbolLand),
// and both chefs — the base-game bottle chef (Background) and the free-games salting chef
// (SpecialMascot) — read the same body language from `chefPose`:
//   spin    — leans in and watches the reels
//   dead    — a small "meh": brows up, the head cocked away, a glance away
//   win     — a satisfied double nod, smiling eyes
//   wild    — a quick lunge at the board, the head snapping toward it
//   bigWin  — a laugh, head thrown back, his eyes ROLLING round like a cartoon's; the prop fires
//             (squirt / salt frenzy)
//   hugeWin — the same laugh, bigger; the prop fires twice
//   snicker — now and then while nothing happens: a sly wheezing snicker in three "heh-heh-heh"
//             bursts — eyes squeezed, chin tucked, head cocked and rocking on each heh (idleSnicker)
// The body never moves up or down (dy 0, no squash): the user read every dip, hop, shrug and
// laughing bounce as the chef "jumping up and down". Only the head, eyes, lean and prop carry it.
// The art is a body with separate eyes, lids, brows and prop (the bottle chef also has a separate
// head that tilts and nods on its neck), so emotion is carried by the body's lean, the
// head, the gaze, the lids and the brows — the grin itself never changes.

export type ChefMood = 'idle' | 'spin' | 'dead' | 'win' | 'wild' | 'bigWin' | 'hugeWin' | 'snicker';

export const chefMood = $state({
	mood: 'idle' as ChefMood,
	at: -1e9,
	/** The mood it took over from (its pose blends out over BLEND_MS). */
	prev: 'idle' as ChefMood,
	prevAt: -1e9,
});

// The chef keeps his own pace, not the reels': turbo / super turbo (and Space-hold) only hurry the
// board. A new spin doesn't cut a reaction short — the spin pose waits for it to finish — a reaction
// never cuts off one that matters as much or more, and the small ones (win, wild, shrug) share a rest
// of SMALL_REST_MS, so quick rounds don't fire a hurried reaction on every spin. Big wins always play.
const SMALL_REST_MS = 2500;
const PRIORITY: Partial<Record<ChefMood, number>> = { snicker: 0, dead: 1, win: 2, wild: 2, bigWin: 3, hugeWin: 4 };
let lastSmallAt = -1e9;
let pendingSpin: ReturnType<typeof setTimeout> | undefined;
// A round that ended with nothing for him lets him stop watching the reels only after a beat — if
// the next spin comes first (turbo, autoplay) he just keeps watching instead of flicking away and back.
const SETTLE_MS = 1200;
let pendingIdle: ReturnType<typeof setTimeout> | undefined;
const reactionLeft = (t: number) => {
	const dur = MOOD_MS[chefMood.mood];
	return Number.isFinite(dur) && dur > 0 ? Math.max(0, chefMood.at + dur - t) : 0;
};

export const setChefMood = (mood: ChefMood) => {
	const t = performance.now();
	// the same reaction again within a beat (two WILDs landing together) doesn't restart it
	if (mood === chefMood.mood && t - chefMood.at < 450) return;
	const left = reactionLeft(t);
	clearTimeout(pendingIdle);
	pendingIdle = undefined;
	if (mood === 'spin') {
		clearTimeout(pendingSpin);
		pendingSpin = undefined;
		if (left > 0) {
			pendingSpin = setTimeout(() => {
				pendingSpin = undefined;
				applyChefMood('spin', performance.now());
			}, left);
			return;
		}
		applyChefMood('spin', t);
		return;
	}
	const p = PRIORITY[mood];
	if (p !== undefined) {
		const running = left > 0 ? PRIORITY[chefMood.mood] : undefined;
		const tooSoon = p <= 2 && t - lastSmallAt < SMALL_REST_MS;
		if ((running !== undefined && running >= p) || tooSoon) {
			// skipped: a round that ended with nothing for him just stops him watching the reels
			if (tooSoon && chefMood.mood === 'spin' && (mood === 'dead' || mood === 'win'))
				pendingIdle = setTimeout(() => {
					pendingIdle = undefined;
					if (chefMood.mood === 'spin') applyChefMood('idle', performance.now());
				}, SETTLE_MS);
			return;
		}
		if (p <= 2) lastSmallAt = t;
	}
	clearTimeout(pendingSpin);
	pendingSpin = undefined;
	applyChefMood(mood, t);
};

const applyChefMood = (mood: ChefMood, t: number) => {
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

// The snicker's "heh"s (ms into the mood, strength): three slow chuckles, ~2.5 a second, the last one
// weaker. (Nine quick pops at ~6 a second read as the chef trembling.)
const SNICKER_HEHS: [number, number][] = [
	[80, 0.9], [470, 1], [860, 0.6],
];
const HEH_RISE_MS = 110;
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
			p.brow = -0.006 * e;
			p.lookX = 0.004;
			p.lookY = -0.0025;
			p.look = keyed([[0, 0], [140, 1], [600, 1], [900, 0]], ms);
			// "meh": the head cocks away and back
			p.headTilt = keyed([[0, 0], [180, 0.05], [520, 0.042], [900, 0]], ms);
			p.headNod = keyed([[0, 0], [160, -0.0015], [650, 0.0025], [900, 0]], ms);
			break;
		}
		case 'win': {
			const e = envelope(ms, MOOD_MS.win);
			p.brow = -0.005 * e;
			p.squint = 0.3 * e;
			p.lookX = LOOK_BOARD.x;
			p.lookY = LOOK_BOARD.y;
			p.look = e;
			// a real double nod of the head, turned toward the board
			p.headNod = keyed([[0, 0], [90, 0.0045], [210, -0.0012], [330, 0.004], [470, -0.0006], [620, 0]], ms);
			p.headTilt = -0.018 * e;
			break;
		}
		case 'wild': {
			const e = envelope(ms, MOOD_MS.wild);
			// lunge toward the board and recover
			p.dx = keyed([[0, 0], [150, -0.022], [330, -0.018], [650, 0]], ms);
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
			// Each "heh" rocks the head (a fast-rise, slow-fall pulse, not a sine buzz). Three bursts,
			// the last one weaker.
			const lag = snickerPulse(ms - 90) * e;
			// a brief squeeze of the eyes on the first heh, not a held squint: held for the whole snicker the
			// lids sat 90% shut while the pupils kept glancing under them (it read as broken). The pupils
			// settle front and centre while the lids are down.
			const squeeze = keyed([[0, 0], [100, 1], [330, 1], [540, 0]], ms);
			p.squint = 0.7 * squeeze;
			p.lookX = 0;
			p.lookY = 0;
			p.look = squeeze;
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
			// eyes wide open (the user found them shut too much; even a light squint's lid crease read as a
			// second brow) and rolling round in their sockets, cartoon style: the pupils circle (~1.5 turns
			// a second), easing in and out with the reaction
			p.squint = 0;
			const roll = (ms / 650) * Math.PI * 2;
			p.lookX = 0.0042 * Math.cos(roll);
			p.lookY = 0.0026 * Math.sin(roll);
			p.look = e;
			p.brow = -0.008 * e;
			// the prop raised in a slow wave, the head thrown back and rocking slowly side to side
			p.propRot = (huge ? 0.04 : 0.03) * Math.sin(ms / 420) * e;
			p.headNod = -0.002 * e;
			p.headTilt = 0.045 * Math.sin(ms / 420) * e;
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

// Where the body used to hop, the bow tie shakes instead: a small damped wiggle on its knot (radians)
// when he reacts, repeating through a big-win laugh. Added to each rig's bow sway.
const BOW_SHAKE: Partial<Record<ChefMood, { amp: number; repeat?: number }>> = {
	win: { amp: 0.045 },
	wild: { amp: 0.055 },
	dead: { amp: 0.03 },
	snicker: { amp: 0.03, repeat: 390 },
	bigWin: { amp: 0.05, repeat: 840 },
	hugeWin: { amp: 0.055, repeat: 840 },
};
const BOW_SHAKE_MS = 650; // 2.5 swings, dying out
export const bowShake = (now: number) => {
	const cfg = BOW_SHAKE[chefMood.mood];
	const ms = now - chefMood.at;
	if (!cfg || ms < 0 || ms > MOOD_MS[chefMood.mood]) return 0;
	const u = (cfg.repeat ? ms % cfg.repeat : ms) / BOW_SHAKE_MS;
	if (u > 1) return 0;
	return cfg.amp * Math.exp(-3 * u) * Math.sin(u * Math.PI * 2 * 2.5);
};

<script lang="ts">
	import { POT_DRIPS, POT_IMG, dripPose, paintDrop } from '../game/potDrips';
	import { Container, Graphics, PIXI, Sprite, Text } from 'pixi-svelte';
	import { potState } from '../game/potState.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	import { squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import { breathAt, flexAt, type BodyFlex } from '../game/bodyFlex';
	import { bowShake, chefMood, chefPose, type ChefMood } from '../game/chefMood.svelte';
	import AnimatedGuy, { GUY_CROPS, cropPivot, cropRect } from './AnimatedGuy.svelte';

	type Props = {
		/**
		 * Placement override for the phone layouts (canvas px): the chef frame's centre x / centre y /
		 * width, and the pot's centre / width. Omitted: the desktop layout below.
		 */
		place?: { cx: number; guyY: number; guyWidth: number; potX: number; potY: number; potWidth: number };
		/** Only the pot (boiling, with its multiplier) — while a congrats card is up on the phones. */
		potOnly?: boolean;
		/** The chef mirrored about his centre line (phone landscape: he stands left of the board). */
		mirror?: boolean;
		/** The group's zIndex: behind the board by default (desktop / portrait). */
		zIndex?: number;
	};
	const props: Props = $props();

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());


	// Composition sits on the right, BEHIND the board. The real art is laid out on a shared 358x425
	// frame (guy on the right, the salt-arm overlay on the left) so both sprites line up; sized +
	// placed so the head and raised shaker read at the right spot.
	// Fit the frame between the board and the screen's right edge so his arm (at the frame's right
	// edge) is never cut: at 0.72·H tall and cx 0.88·W the frame ran ~80px off-screen on 16:9.
	// The frame may tuck 7% of its width behind the board (just the shaker's tail), and shrinks only
	// when that space is short; his feet stay at the same height (bottom = 0.96·H).
	const boardRight = $derived.by(() => {
		const main = context.stateLayoutDerived.mainLayout();
		const b = context.stateGameDerived.boardLayout();
		return main.x - (main.width * main.scale) / 2 + (b.x + b.width / 2) * main.scale;
	});
	const EDGE = 8; // px kept clear of the screen edge
	const fullWidth = $derived(canvas.height * 0.72 * (358 / 425));
	// Never shrink below 80% (narrow 4:3 screens): there he tucks further behind the board instead.
	const autoGuyWidth = $derived(
		Math.max(fullWidth * 0.8, Math.min(fullWidth, (canvas.width - EDGE - boardRight) / 0.93)),
	);
	const guyWidth = $derived(props.place?.guyWidth ?? autoGuyWidth);
	const guyHeight = $derived(guyWidth * (425 / 358));
	const cx = $derived(props.place?.cx ?? canvas.width - EDGE - guyWidth / 2);
	// Stand him so the pot's rim sits ≈80% down the frame: anchored to the screen bottom instead, the
	// rim covered his nametag.
	// The soup pot is the multiplier display, so it's bigger than before (0.98 of the frame, was 0.82)
	// and stands with its BASE (and the multiplier plaque on it) just above the desktop nav bar — the
	// bar's top is H − 166.7·u (HudHtml: 77 design px of bar + 36u margin, u = min(93vw, 1860)/1860).
	const potWidth = $derived(props.place?.potWidth ?? guyWidth * 0.98);
	const potHeight = $derived(potWidth * (914 / 1271)); // special-pot-v3 (label-free pot, surface left bare to boil live)
	const navTop = $derived(canvas.height - 166.7 * (Math.min(canvas.width * 0.93, 1860) / 1860));
	// He stands anchored to 0.82·H; the pot's rim sits just under his pointing hand (the hand's bottom
	// is 80.4% down his frame), so the hand reads clearly while the pot covers his lower body.
	const guyY0 = $derived(canvas.height * 0.82 - (guyWidth * 0.82 * (848 / 1180)) / 2 + 0.02 * guyHeight - 0.3 * guyHeight);
	const potY0 = $derived(guyY0 - guyHeight / 2 + 0.804 * guyHeight - potHeight * 0.3 + potHeight / 2);
	// Design (8274:11059): the WHOLE pot stands clear above the nav bar (its painted base ends 97% down
	// the sprite), so the multiplier on its front is fully visible. Where that pot would tuck behind the
	// bar, the pot AND the chef are lifted together — the hand stays resting on the rim.
	const lift = $derived(Math.max(0, potY0 + potHeight * 0.47 + potHeight * 0.04 - navTop));
	const potY = $derived(props.place?.potY ?? potY0 - lift);
	const potX = $derived(props.place?.potX ?? cx - guyWidth * 0.02);
	// (the chef only as far as his hat — ≈3% above his frame — stays on screen, on short windows)
	const guyY = $derived(props.place?.guyY ?? guyY0 - Math.min(lift, Math.max(0, guyY0 - 0.53 * guyHeight - 6)));

	// Eyes (base v10): the eye region was rebuilt from a fresh render of the real SVG — pupils erased
	// inside the eye opening only (outline band, skin and brows protected, so no white bleeds into the
	// brows). This face is the SAME design as the board chef's (Figma), at 4.5× with the body at
	// x=513, so the pupils + lids are the board chef's, rescaled: pupils a touch smaller than the art
	// (the right one nudged up to clear its lower-lid line), lids sized to each eye opening. The brows
	// are their own layer (extras) drawn above the lids, so a blink closes UNDER the brow.
	// Look (2026-10): wide round eyes with big pupils at different spots in each socket read goofy /
	// cross-eyed. Now the lids rest a third of the way down (LID_REST, a sly heavy-lidded look under
	// his scheming brows), the pupils are smaller, and both sit at the SAME spot in their sockets
	// (a touch down and toward his left — on the player), so the gaze is one deliberate look.
	const specialLids = [
		{ cx: 0.4336, cy: 0.278, w: 0.0627, h: 0.056 },
		{ cx: 0.5453, cy: 0.2667, w: 0.0701, h: 0.069 },
	];
	const LID_REST = 0.32;
	const GAZE = { x: -0.06, y: 0.16 }; // pupil offset, fractions of each socket's w/h
	const PUPIL = 0.6; // pupil size, fraction of the socket's smaller side (÷ AnimatedGuy's 0.7)
	const specialPupils = specialLids.map((l) => {
		const d = (Math.min(l.w * (358 / 425), l.h) * PUPIL) / 0.7; // frame is 358 wide per 425 tall
		return { nx: l.cx + GAZE.x * l.w, ny: l.cy + GAZE.y * l.h, nw: d * (425 / 358), nh: d };
	});

	// Clock: drives the salt flicks / puffs and the chef's idle breathe (elapsed).
	let elapsed = $state(0);
	let now = $state(0); // rAF timestamp (same timebase as performance.now — the pot impacts)
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			now = ts;
			elapsed = ts - start;
			scheduleFlicks(ts);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Subtle idle breathe/bob for the chef (he's mid-salt, so no big lean — just a living breath). The
	// pot stays planted on the ground; only the guy + his salt origin drift.
	const idlePose = $derived(
		// (the breath is the torso's own — SALT_FLEX bends the body instead of scaling it whole)
		mascotIdle(elapsed, cx, guyY, guyWidth, guyHeight, { sway: 0.012, breathe: 0, bob: 0 }),
	);
	// His torso as soft tissue (game/bodyFlex), as on the base-game chef: the chest fills and the
	// shoulders rise on each breath and give to the head's tilt; head, bow, nametag and the salt arm
	// (its shoulder pivot) ride along.
	const SALT_FLEX: BodyFlex = {
		neckY: 0.4719, // = HEAD_PIVOT.py
		baseY: 1,
		chest: { x: 0.6, y: 0.63, r: 0.09 }, // the shirt front below the bow
		lift: 0.008,
		swell: 0.035,
		lean: 0.25,
	};
	// The chef reacts to the game (game/chefMood) — offsets on the idle pose, scaled about his feet.
	const react = $derived(chefPose(now));
	const guyPose = $derived({
		x: idlePose.x + react.dx * idlePose.width,
		y: idlePose.y + react.dy * idlePose.height - ((react.sy - 1) * idlePose.height) / 2,
		width: idlePose.width * react.sx,
		height: idlePose.height * react.sy,
	});

	// The salt-shaker forearm is overlaid on the base and turns about the shoulder. The pivot sits ON
	// the joint strip that's baked into the base, so the connection region never diverges from the
	// painted joint (seamless), while the shaker end — far from the pivot — does the visible moving.
	// Frame fractions off the shared frame. (+ rotation = cap up: the cap sits left of the shoulder.)
	//
	// He salts the soup the way a hand does it: the shaker is held tipped over the pot, steady (a slow
	// drift), and every couple of seconds the wrist gives it a short burst of taps — each a quick drop
	// of the cap (fast down, slower back up) with a puff of salt out of the holes at its bottom — then
	// it rests again. The hotter the pot, the sooner the next burst. On a win (or a multiplier landing)
	// he lifts the shaker a little and taps it firmly for as long as the cheer lasts, the salt pouring;
	// his hat hops off his head and the soup boils up meanwhile. Nothing fast anywhere: a sine shake,
	// or taps quicker than ~3 a second, read as trembling, not a hand.
	type Puff = { t: number; a: number; n: number; spread: number }; // a puff of salt leaving the cap
	const PUFF_MS = 900; // a puff's grains are gone after this
	const BURST_EVERY_BY_HEAT = [3000, 2600, 2200, 1800]; // ms from one burst of taps to the next
	const TAPS_BY_HEAT = [2, 2, 3, 3];
	const TAP_MS = 380; // unhurried: quicker taps (~5 a second) read as the hand trembling
	const TAP_DOWN = 0.3; // of a tap: the cap's drop; the rest is the return
	const TAP_AMP = 0.045; // − = cap down
	const RAISE = 0.12; // + = up: a cheer lifts the shaker this much
	const CHEER_TAP_MS = 340;
	const CHEER_TAP_AMP = 0.055;
	let puffs: Puff[] = []; // plain array: read through `now`, which changes every frame
	let beat = 0; // bursts so far (fractional), advanced by the clock at the heat's tempo
	let lastTs = 0;
	// The latest celebration: [start, duration]. A win's cheer is latched when the mood starts, so the
	// next spin's mood can't snap the raised arm down mid-cheer.
	const CHEER_MS: Partial<Record<ChefMood, number>> = { win: 1300, bigWin: 2000, hugeWin: 2800 };
	let winCheer = $state<[number, number, ChefMood]>([-1e9, 0, 'win']);
	$effect(() => {
		const dur = CHEER_MS[chefMood.mood];
		if (dur) winCheer = [chefMood.at, dur, chefMood.mood];
	});
	const cheer = (ts: number): [number, number] =>
		ts - stampAt >= 0 && stampAt > winCheer[0] ? [stampAt, 1100] : [winCheer[0], winCheer[1]];
	const raiseAt = (ms: number, dur: number) =>
		ms < 0 || ms > dur ? 0 : keyed([[0, 0], [260, 1], [dur - 420, 1], [dur, 0]], ms);
	/** one tap, u 0..1 → 0..1..0: a quick drop, an eased return */
	const tapShape = (u: number) => {
		if (u < 0 || u >= 1) return 0;
		if (u < TAP_DOWN) return smooth(u / TAP_DOWN);
		const v = (u - TAP_DOWN) / (1 - TAP_DOWN);
		return 1 - v * v * (3 - 2 * v);
	};
	const smooth = (x: number) => x * x * (3 - 2 * x);
	/** the idle burst at this beat: 0..1 tap depth and an envelope (the shaker tips in for the burst) */
	const burstAt = (b: number) => {
		const ms = (((b % 1) + 1) % 1) * BURST_EVERY_BY_HEAT[heat];
		const taps = TAPS_BY_HEAT[heat];
		const len = taps * TAP_MS;
		const env = ms < len + 200 ? smooth(Math.min(1, ms / 120)) * smooth(Math.min(1, (len + 200 - ms) / 200)) : 0;
		return { tap: ms < len ? tapShape((ms % TAP_MS) / TAP_MS) : 0, env };
	};
	const cheerTapAt = (ms: number, dur: number) =>
		ms < 300 || ms > dur - 420 ? 0 : tapShape(((ms - 300) % CHEER_TAP_MS) / CHEER_TAP_MS);
	/** 0..1 while a cheer runs (eased in and out) — drives the boil, the laugh and the grin */
	const cheerLevel = (ts: number) => {
		const [c0, dur] = cheer(ts);
		const ms = ts - c0;
		if (ms < 0 || ms > dur + 900) return 0;
		const k = Math.min(1, ms / 600) * (ms < dur ? 1 : 1 - (ms - dur) / 900);
		return k * k * (3 - 2 * k);
	};
	const angleAt = (ts: number, b: number) => {
		const [c0, dur] = cheer(ts);
		const ms = ts - c0;
		const up = raiseAt(ms, dur);
		const idle = burstAt(b);
		const hold = 0.02 * Math.sin(ts / 1300) - 0.025 * idle.env - TAP_AMP * idle.tap;
		return (1 - up) * hold + up * (RAISE - CHEER_TAP_AMP * cheerTapAt(ms, dur)) + react.propRot * 0.25;
	};
	const scheduleFlicks = (ts: number) => {
		const dt = lastTs ? Math.min(100, ts - lastTs) : 0;
		lastTs = ts;
		const prev = beat;
		beat += dt / BURST_EVERY_BY_HEAT[heat];
		const [c0, dur] = cheer(ts);
		const ms = ts - c0;
		if (ms >= 0 && ms <= dur) {
			// cheering: a pour at the bottom of every firm tap
			const k = Math.floor((ms - 300 - TAP_DOWN * CHEER_TAP_MS) / CHEER_TAP_MS);
			const tk = c0 + 300 + TAP_DOWN * CHEER_TAP_MS + k * CHEER_TAP_MS;
			if (k >= 0 && tk <= c0 + dur - 420 && !puffs.some((p) => Math.abs(p.t - tk) < 1))
				puffs = [...puffs, { t: tk, a: angleAt(tk, beat), n: 40, spread: 1.4 }];
		} else {
			// idle: a light puff at the bottom of each tap of the burst
			const P = BURST_EVERY_BY_HEAT[heat];
			const a0 = (((prev % 1) + 1) % 1) * P;
			const a1 = (((beat % 1) + 1) % 1) * P;
			for (let i = 0; i < TAPS_BY_HEAT[heat]; i += 1) {
				const bottom = i * TAP_MS + TAP_DOWN * TAP_MS;
				const crossed = a1 >= a0 ? bottom > a0 && bottom <= a1 : bottom > a0 || bottom <= a1;
				if (crossed) puffs = [...puffs, { t: ts, a: angleAt(ts, beat), n: 14, spread: 1 }];
			}
		}
		puffs = puffs.filter((p) => ts - p.t < PUFF_MS);
	};
	const armAngle = $derived(angleAt(now, beat));

	// Head on its neck (scripts/build-special-head.py): a slow side-to-side bob plus the mood's tilt /
	// nod; laughing, he tips his head back a little and holds it. Nothing on the head follows the
	// shaker's taps (a nod per tap read as trembling).
	const HEAD_PIVOT = { px: 0.6244, py: 0.4719 };
	const headMove = $derived.by(() => {
		const ts = now;
		const laugh = cheerLevel(ts);
		// slow, but big enough to read: a side-to-side bob, a nod on its own slower beat, and he
		// leans into each salting burst (looking down at the soup)
		const bob = 0.03 * Math.sin(ts / 1100) * (1 - laugh);
		const nod = (0.003 * Math.sin(ts / 1700 + 0.6) + 0.004 * burstAt(beat).env) * (1 - laugh);
		return {
			tilt: bob - laugh * 0.03 + react.headTilt,
			nod: nod - laugh * 0.006 + react.headNod,
		};
	});
	const saltFlexState = $derived({ breath: breathAt(elapsed), tilt: headMove.tilt });
	// The grin (scripts/build-special-bow-mouth.py): it widens and lifts at its right corner — the left
	// one meets his jaw line, so it is the pivot and never moves — the way a smile spreads, and his eyes
	// narrow with it (a real smile reaches the eyes). Now and then a slow, pleased smile on his own;
	// on a win a full grin for the whole cheer.
	const MOUTH_PIVOT = cropPivot(GUY_CROPS.specialMouth, 0.4121, 0.3618);
	// The spiky tuft behind his ear sways slightly on its root (pivot printed in sprite fractions by
	// scripts/build-special-hair.py): a slow ~5 s sway, flicked along with the bow when he reacts.
	const HAIR_ROOT = { px: 0.1714, py: 0.5265 };
	const SMILE_EVERY = 5600;
	const grin = $derived.by(() => {
		const laugh = cheerLevel(now);
		const u = (now + 2400) % SMILE_EVERY;
		const idle = u < 450 ? smooth(u / 450) : u < 1350 ? 1 : u < 2000 ? 1 - smooth((u - 1350) / 650) : 0;
		return Math.max(0.45 * idle, laugh);
	});
	const mouth = $derived({ sx: 1 + 0.05 * grin, sy: 1 + 0.03 * grin, rot: -0.035 * grin });
	// The bow tie sways on its knot: a slow sway, the head's tilt passed down and a small shake when
	// he reacts (game/chefMood bowShake; it no longer follows the arm's taps — that made it jitter). Drawn 4% large about the knot, so the bow
	// painted on the body under it stays covered within ±0.05.
	const BOW_KNOT = cropPivot(GUY_CROPS.specialBow, 0.5529, 0.5328);
	const bowTilt = $derived(
		Math.max(
			-0.05,
			Math.min(
				0.05,
				0.03 * Math.sin(now / 1150 + 0.8) + 0.3 * headMove.tilt + bowShake(now),
			),
		),
	);
	// The hat hops off his head as a cheer starts (twice on a huge win): up, tipping, a squash as it
	// lands back on the hair.
	const HAT_PIVOT = { px: 0.6439, py: 0.1639 };
	const hatPose = $derived.by(() => {
		const [c0] = cheer(now);
		const ms = now - c0;
		const hops = winCheer[0] === c0 && winCheer[2] === 'hugeWin' ? [0, 700] : [0];
		let dy = 0;
		let rot = 0;
		let sy = 1;
		for (const h0 of hops) {
			const t = ms - h0 - 60;
			const u = t / 520;
			if (u >= 0 && u < 1) {
				const arc = Math.sin(Math.PI * u);
				dy -= 0.075 * arc;
				rot += -0.32 * Math.sin(Math.PI * 2 * u) * (1 - u);
			}
			const land = t - 520;
			if (land >= 0 && land < 260) sy *= 1 - 0.14 * Math.sin((land / 260) * Math.PI) * (1 - land / 260);
			if (t < 0 && t > -60) sy *= 1 - 0.08 * Math.sin((-t / 60) * Math.PI); // a little crouch first
		}
		return { dy, rot, sy };
	});
	const chefL = $derived(guyPose.x - guyPose.width / 2);
	const chefT = $derived(guyPose.y - guyPose.height / 2);
	const PIVX = 0.452; // middle of the baked joint strip (frame fractions)
	const PIVY = 0.5;
	// (riding the torso field at the shoulder, like the layers on the body)
	const armFlex = $derived(flexAt(SALT_FLEX, saltFlexState, PIVX, PIVY, guyPose.width, guyPose.height));
	const pivotX = $derived(chefL + PIVX * guyPose.width + armFlex.dx);
	const pivotY = $derived(chefT + PIVY * guyPose.height + armFlex.dy);
	// The arm layer is cropped to its opaque box: same shoulder pivot, expressed inside the crop.
	const ARM_RECT = cropRect(GUY_CROPS.specialArm);
	const ARM_ANCHOR = cropPivot(GUY_CROPS.specialArm, PIVX, PIVY);
	// The cap's holes face sits at frame (0.352, 0.466) — salt exits right there.
	const CAP_DX = 0.352 - PIVX;
	const CAP_DY = 0.466 - PIVY;
	const capAt = (a: number) => ({
		x: pivotX + CAP_DX * guyPose.width * Math.cos(a) - CAP_DY * guyPose.height * Math.sin(a),
		y: pivotY + CAP_DX * guyPose.width * Math.sin(a) + CAP_DY * guyPose.height * Math.cos(a),
	});
	const saltBotX = $derived(cx - guyWidth * 0.12);
	const saltBotY = $derived(potY - potHeight * 0.18);
	const grain = $derived(Math.max(2, canvas.height * 0.0045));
	// Each tip / shake downstroke throws a puff: grains leave the cap together, accelerate
	// down (p² gravity) and fan out into a narrow cone on the way to the pot; a little dust cloud
	// bursts at the holes.
	const grains = $derived.by(() => {
		// `puffs` is a plain array: read the clock first so this re-runs every frame even when it
		// was empty last time
		const ts = now;
		const out: { x: number; y: number; size: number; alpha: number }[] = [];
		for (const [k, f] of puffs.entries()) {
			const age = ts - f.t;
			if (age < 0 || age > PUFF_MS) continue;
			const cap = capAt(f.a);
			const seed = Math.floor(f.t) % 997;
			for (let i = 0; i < f.n; i += 1) {
				const life = 620 + ((i * 37 + seed) % 7) * 35;
				const p = (age - (i % 4) * 14) / life; // a short stagger: the puff leaves as a clump
				if (p < 0 || p > 1) continue;
				const ease = p * p * 0.82 + p * 0.18;
				const dir = Math.sin((i + seed) * 2.3999);
				const wob = Math.sin((i + seed) * 12.9898 + p * 9);
				const spread = grain * (0.5 + ease * 6) * f.spread;
				out.push({
					x: cap.x + (saltBotX - cap.x) * ease + dir * spread + wob * grain * 0.35 * ease,
					y: cap.y + (saltBotY - cap.y) * ease,
					size: grain * (0.55 + ((i * 7 + k) % 5) * 0.17),
					alpha: Math.min(1, p / 0.05) * (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * (0.7 + (i % 3) * 0.1),
				});
			}
			// dust cloud at the holes
			if (age < 260) {
				const q = age / 260;
				for (let j = 0; j < 6; j += 1) {
					const a = j * 1.047 + seed;
					out.push({
						x: cap.x + Math.cos(a) * grain * 4 * q,
						y: cap.y + Math.sin(a) * grain * 2.5 * q + grain * 2 * q,
						size: grain * (1.4 + q),
						alpha: 0.28 * (1 - q),
					});
				}
			}
		}
		return out;
	});

	const drawSalt = (gfx: SquirtGraphics) => {
		for (const g of grains) {
			const r = g.size / 2;
			gfx.circle(g.x + r, g.y + r, r).fill({ color: 0xfffdf5, alpha: g.alpha });
		}
	};
	// Publish where the pot is, so the soup shots (PotShots) know where to fly; cleared when it goes.
	$effect(() => {
		potState.rect = { x: potLeft, y: potTop, w: potWidth, h: potHeight };
	});
	$effect(() => () => {
		potState.rect = null;
	});
	// Multiplier on the pot's front (design 8798:10296 / 8798:10297, at a 438 px-wide pot): the label
	// "MULTIPLIER" (Bowlby One SC 18 px, #C10C01) is printed straight on the pot, and under it a box
	// (#BCB7AF fill, 1 px #C10C01 border, 10 × 13 px padding, radius 20) holds ONLY the value (48 px).
	// Both are centred on the pot body's front (the sprite's body axis is at 49.8%); each line is centred
	// on its measured ink box (the font's ascent/descent would otherwise sit it high).
	const dk = $derived(potWidth / 438); // design px → canvas px
	// The value changes as a soup's blob hits the pot (PotShots): the OLD value squashes for a beat,
	// then the new one pops in large, holds big, and settles (stamp below).
	let shownBefore = $state(potState.mult);
	let stampAt = $state(-1e9); // when the multiplier last rose (performance.now)
	const COMPRESS_MS = 90;
	const sinceHit = $derived(now - stampAt);
	const multText = $derived(`×${sinceHit >= 0 && sinceHit < COMPRESS_MS ? shownBefore : potState.mult}`);
	const labelText = $derived(i18nDerived.translate('POT MULTIPLIER'));
	const labelFont = $derived(Math.round(18 * dk));
	const multFont = $derived(Math.round(48 * dk));
	const measureInk = (text: string, size: number) => {
		if (typeof document === 'undefined') return { w: size * text.length * 0.7, asc: size * 0.72, desc: 0, dx: 0, fontAsc: size };
		const font = `${size}px 'Bowlby One SC'`;
		const c = document.createElement('canvas').getContext('2d')!;
		c.font = font;
		const m = c.measureText(text);
		return {
			w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
			asc: m.actualBoundingBoxAscent,
			desc: m.actualBoundingBoxDescent,
			// ink centre vs the advance-box centre (what anchor.x = 0.5 centres)
			dx: (m.width - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft)) / 2,
			// where pixi puts the baseline below the top of its text box
			fontAsc: PIXI.CanvasTextMetrics.measureFont(font).ascent,
		};
	};
	const labelInk = $derived(measureInk(labelText, labelFont));
	const ink = $derived(measureInk(multText, multFont));
	const padY = $derived(10 * dk);
	const padX = $derived(13 * dk);
	const gap = $derived(8 * dk); // label ink → box top
	// the box keeps the design's width for short values (×2) and grows with longer ones
	const boxW = $derived(Math.max(128 * dk - 2 * padX, ink.w) + 2 * padX);
	const boxH = $derived(ink.asc + ink.desc + 2 * padY);
	const labelH = $derived(labelInk.asc + labelInk.desc);
	// the label + box block, centred on the pot body's front (body runs 54% → 97% of the sprite)
	const frontX = $derived(potX + potWidth * (0.498 - 0.5));
	const blockTop = $derived(potY - potHeight / 2 + potHeight * 0.755 - (labelH + gap + boxH) / 2);
	const labelBase = $derived(blockTop + labelInk.asc); // canvas y
	const boxY = $derived(blockTop + labelH + gap + boxH / 2); // box centre, canvas y
	const multBase = $derived(-boxH / 2 + padY + ink.asc); // relative to the box centre
	let lastMult = potState.mult;
	$effect(() => {
		const m = potState.mult;
		if (m !== lastMult) {
			// only a rise is an impact (a new bonus resets the pot quietly)
			if (m > lastMult) {
				shownBefore = lastMult;
				stampAt = performance.now();
			}
			lastMult = m;
		}
	});
	// a nudge (the final spin's build-up) gives the same pulse, jolt and chef hop on the same value
	let lastNudge = potState.nudge;
	$effect(() => {
		const n = potState.nudge;
		if (n === lastNudge) return;
		lastNudge = n;
		shownBefore = potState.mult;
		stampAt = performance.now();
	});
	const keyed = (keys: [number, number][], ms: number) => {
		for (let i = 1; i < keys.length; i += 1) {
			const [ta, va] = keys[i - 1];
			const [tb, vb] = keys[i];
			if (ms <= tb) {
				const x = Math.max(0, Math.min(1, (ms - ta) / (tb - ta)));
				return va + (vb - va) * x * x * (3 - 2 * x);
			}
		}
		return keys[keys.length - 1][1];
	};
	// old value compresses (wide + flat) → new value pops to 150%, holds large ~300 ms → settles
	const stamp = $derived.by(() => {
		const ms = sinceHit;
		if (ms < 0 || ms > 760) return { x: 1, y: 1 };
		if (ms < COMPRESS_MS) return { x: 1 + 0.15 * (ms / COMPRESS_MS), y: 1 - 0.4 * (ms / COMPRESS_MS) };
		const k = keyed([[COMPRESS_MS, 0.7], [190, 1.5], [460, 1.32], [760, 1]], ms);
		return { x: k, y: k };
	});
	// Heat: the pot shows how strong the bonus has got. low → normal simmer; medium (×5+) → faster,
	// brighter bubbling; high (×20+) → + more steam and a slight tremble; huge (×100+) → the chef
	// visibly struggles with a rattling pot.
	const heat = $derived(potState.mult >= 100 ? 3 : potState.mult >= 20 ? 2 : potState.mult >= 5 ? 1 : 0);
	// impact surge (0..1): the soup boils up and steam bursts for a moment after each hit
	const surge = $derived(sinceHit < 0 || sinceHit > 900 ? 0 : Math.exp(-sinceHit / 260));
	// Pot offset: each impact knocks it down once and it springs back — one soft bounce. (The old
	// four-way judder, the constant tremble once hot and a screen shake on every rise all read as
	// the chef trembling; the hotter pot shows in its boil and steam instead.)
	const potShake = $derived.by(() => {
		const v = sinceHit / 360;
		return { x: 0, y: v >= 0 && v < 1 ? potHeight * 0.012 * Math.sin(Math.PI * v) * (1 - v) : 0 };
	});
	// Chef: hops as the multiplier lands. (The huge-heat strain judder is gone: it read as shaking.)
	const chefReact = $derived.by(() => {
		const v = (sinceHit - 60) / 380;
		return { x: 0, y: v >= 0 && v < 1 ? -guyHeight * 0.022 * Math.sin(Math.PI * v) : 0 };
	});
	const drawPlaque = (g: any) => {
		const w = boxW;
		const h = boxH;
		const b = Math.max(1, dk);
		g.roundRect(-w / 2, -h / 2, w, h, Math.min(20 * dk, h / 2)).fill({ color: 0xbcb7af }).stroke({ width: b, color: 0xc10c01, alignment: 1 });
	};

	// The soup BOILS (the pot art has its painted bubbles removed — special-pot-v3 — so nothing on the
	// surface is frozen): bubbles push up out of the liquid as outlined domes in the art's own style,
	// swell, then burst — the dome vanishes, a ripple ring runs outward and a few droplets hop up and
	// fall back. Every cycle a bubble comes up at a new spot, sizes vary, and the hotter the pot the
	// more of them and the faster they go (an impact surge boils it up for a moment).
	const BUBBLE_N_BY_HEAT = [7, 9, 12, 15];
	const BUBBLE_PERIOD_BY_HEAT = [1900, 1450, 1100, 800]; // ms per rise → burst → rest
	const SOUP_CX = 0.47;
	const SOUP_CY = 0.33;
	const SOUP_RX = 0.29;
	const SOUP_RY = 0.075; // steam / boil-over origin ellipse (pot fractions)
	// the liquid's surface (measured on special-pot-v3: 537,291 ± 360×62 of 1080×777), kept in from
	// the rim, and clear of the spoon on the right
	const SURF = { cx: 0.49, cy: 0.37, rx: 0.235, ry: 0.048 };
	const SPOON_X = 0.56;
	const RISE = 0.55; // of the cycle: the dome grows
	const BURST = 0.62; // … pops here
	const AFTER = 0.85; // … ring + droplets are gone
	const potLeft = $derived(potX - potWidth / 2);
	const potTop = $derived(potY - potHeight / 2);

	// The pot's drips (game/potDrips): each finger layer stretched down from its top edge, plus the
	// beads / falling drops, mapped from pot-image px onto the pot sprite.
	const potK = $derived(potWidth / POT_IMG.w);
	const dripPoses = $derived(POT_DRIPS.map((d) => ({ d, pose: dripPose(d, now) })));
	const drips = $derived(
		dripPoses.map(({ d, pose }) => ({
			key: d.key,
			x: potLeft + d.x * potK,
			y: potTop + d.y * potK,
			w: d.w * potK,
			h: d.h * potK * pose.stretch,
		})),
	);
	const drawDrops = (g: SquirtGraphics) => {
		const X = (v: number) => potLeft + v * potK;
		const Y = (v: number) => potTop + v * potK;
		const painter = {
			ellipse: (x: number, y: number, rx: number, ry: number, color: number, alpha: number) =>
				g.ellipse(X(x), Y(y), rx * potK, ry * potK).fill({ color, alpha }),
		};
		for (const { pose } of dripPoses) {
			if (pose.bead) paintDrop(painter, pose.bead.x, pose.bead.y, pose.bead.r, pose.bead.r * 1.05, 1, 1);
			if (pose.drop) paintDrop(painter, pose.drop.x, pose.drop.y, pose.drop.rx, pose.drop.ry, pose.drop.alpha, 1);
		}
	};
	const bubbles = $derived.by(() => {
		// a win swells the bubbles that are already rising (count and timing stay put: changing them
		// mid-cycle made bubbles pop in or jump to another point of their rise)
		const boil = cheerLevel(now);
		const n = BUBBLE_N_BY_HEAT[heat];
		const period = BUBBLE_PERIOD_BY_HEAT[heat];
		const out: { x: number; y: number; r: number; p: number; seed: number }[] = [];
		for (let i = 0; i < n; i++) {
			const own = period * (0.8 + 0.4 * squirtHash(i * 3.3)); // each bubble on its own beat
			const tt = elapsed + squirtHash(i * 9.1) * own;
			const k = Math.floor(tt / own);
			const p = (tt % own) / own;
			if (p > AFTER) continue;
			const seed = i * 31.7 + k * 7.3;
			// a fresh spot on the surface each cycle (uniform in the ellipse), off the spoon
			const ang = squirtHash(seed) * Math.PI * 2;
			const rad = Math.sqrt(squirtHash(seed + 1.1));
			let bx = SURF.cx + Math.cos(ang) * SURF.rx * rad;
			if (bx > SPOON_X) bx = SURF.cx - (bx - SURF.cx);
			const by = SURF.cy + Math.sin(ang) * SURF.ry * rad;
			const big = squirtHash(seed + 2.7);
			const r = potWidth * (0.016 + 0.03 * big * big) * (1 + 0.35 * surge + 0.55 * boil) * (0.85 + 0.3 * (by - SURF.cy + SURF.ry) / (2 * SURF.ry));
			out.push({ x: potLeft + bx * potWidth, y: potTop + by * potHeight, r, p, seed });
		}
		return out.sort((a, b) => a.y - b.y); // far ones first
	});
	// Steam rises from the soup only (it used to drift up across the whole screen): soft puffs leave
	// the surface ellipse, swell, sway and fade as they climb over the chef.
	const STEAM_N_BY_HEAT = [7, 7, 11, 14];
	const drawSteam = (gfx: SquirtGraphics) => {
		const STEAM_N = STEAM_N_BY_HEAT[heat];
		const boiling = potState.overflowAt >= 0 && now - potState.overflowAt < 2600 ? 1.8 : 1;
		const steamBoost = (heat >= 2 ? 1.5 : 1) * (1 + 1.8 * surge + 1.2 * cheerLevel(now)) * boiling;
		for (let i = 0; i < STEAM_N; i++) {
			const life = 3200 + 1800 * squirtHash(i * 3.1);
			const tt = elapsed + squirtHash(i * 8.7) * life;
			const k = Math.floor(tt / life);
			const p = (tt % life) / life;
			const sx = SOUP_CX + SOUP_RX * 0.8 * (2 * squirtHash(i * 1.9 + k * 4.3) - 1);
			const x0 = potLeft + sx * potWidth;
			const y0 = potTop + SOUP_CY * potHeight;
			const x = x0 + Math.sin(p * 4 + i * 1.7) * potWidth * 0.035 * p;
			// rises less high (it is gone before his chest) and every wisp is a soft stack of rings,
			// faint at the rim — hard-edged see-through discs over the chef read as a glitch (they
			// washed his suspenders out in patches)
			const y = y0 - p * potHeight * (0.7 + 0.35 * squirtHash(i * 5.3 + k));
			const r = potWidth * (0.035 + 0.075 * p) * (0.8 + 0.4 * squirtHash(i * 2.2));
			const a = Math.min(0.6, Math.min(1, p / 0.15) * (1 - p) ** 2 * 0.2 * steamBoost);
			for (let j = 0; j < 3; j++) {
				const ox = (j - 1) * r * 0.55;
				const oy = Math.sin(j * 2.1 + p * 3) * r * 0.2;
				for (let q = 0; q < 4; q++) gfx.circle(x + ox, y + oy, r * (0.75 + 0.2 * j) * (1 - q * 0.22)).fill({ color: 0xf2efe8, alpha: a * 0.3 });
			}
		}
	};
	// Boil-over (the bonus ending, potState.overflowAt): blobs of soup heave up off the surface in
	// waves, arc out over the rim and drop past the pot, shrinking and fading as they fall.
	const OVERFLOW_BLOBS = 34;
	const OVERFLOW_EMIT_MS = 1300;
	const drawOverflow = (gfx: SquirtGraphics) => {
		const t = now - potState.overflowAt;
		if (potState.overflowAt < 0 || t < 0 || t > OVERFLOW_EMIT_MS + 1400) return;
		const body = BUBBLE_COLOR_BY_HEAT[Math.max(1, heat)];
		const g = potHeight * 3.4; // px/s²
		for (let i = 0; i < OVERFLOW_BLOBS; i += 1) {
			const launch = (i / OVERFLOW_BLOBS) * OVERFLOW_EMIT_MS * (0.6 + 0.4 * squirtHash(i * 3.7));
			const a = (t - launch) / 1000;
			if (a < 0) continue;
			// from a spot on the surface ellipse, outward on its own side
			const side = squirtHash(i * 1.3) < 0.5 ? -1 : 1;
			const along = 0.35 + 0.65 * squirtHash(i * 7.1);
			const x0 = potLeft + (SOUP_CX + side * SOUP_RX * along) * potWidth;
			const y0 = potTop + SOUP_CY * potHeight;
			const vx = side * potWidth * (0.25 + 0.55 * squirtHash(i * 5.9));
			const vy = -potHeight * (0.9 + 0.8 * squirtHash(i * 2.3));
			const x = x0 + vx * a;
			const y = y0 + vy * a + 0.5 * g * a * a;
			const floor = potTop + potHeight * 1.05;
			if (y > floor) continue;
			const r = potWidth * (0.016 + 0.022 * squirtHash(i * 4.4)) * Math.max(0.3, 1 - a * 0.5);
			const fade = Math.min(1, (floor - y) / (potHeight * 0.25));
			gfx.circle(x, y, r * 1.18).fill({ color: 0x4f7d12, alpha: 0.9 * fade });
			gfx.circle(x, y, r).fill({ color: body, alpha: fade });
			gfx.circle(x - r * 0.3, y - r * 0.35, r * 0.32).fill({ color: 0xe7f5b8, alpha: 0.75 * fade });
		}
	};
	const BUBBLE_COLOR_BY_HEAT = [0x8fc22a, 0x9fd431, 0xb0e43b, 0xc2f04a]; // brighter as it heats up
	type BoilGraphics = SquirtGraphics & {
		poly: (points: number[]) => { fill: (style: object) => { stroke: (style: object) => unknown } };
	};
	const SOUP_LINE = 0x3f5a08; // the art's olive outline
	const SOUP_RING = 0x6f8f12;
	const easeOutBack = (u: number) => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
	const drawBubbles = (g: SquirtGraphics) => {
		const gfx = g as BoilGraphics;
		const body = BUBBLE_COLOR_BY_HEAT[heat];
		for (const b of bubbles) {
			const { x, y, r, p } = b;
			const line = Math.max(1, r * 0.13);
			if (p < BURST) {
				// rising: the dimple ring first, then the dome pushes up (overshooting a touch) and swells
				const u = Math.min(1, p / RISE);
				const grow = easeOutBack(Math.min(1, u * 1.15));
				const wob = p > RISE ? Math.sin((p - RISE) * 90) * 0.04 : 0; // straining just before it goes
				const rr = r * (0.35 + 0.65 * grow) * (1 + wob);
				const hh = rr * (0.15 + 0.75 * grow) * (1 - wob);
				const flat = 0.3; // the waterline, seen from above
				gfx.ellipse(x, y + rr * 0.08, rr * 1.4, rr * 1.4 * flat).stroke({ width: line * 0.8, color: SOUP_RING, alpha: 0.75 * Math.min(1, p / 0.1) });
				if (u > 0.08) {
					const pts: number[] = [];
					const N = 14;
					for (let j = 0; j <= N; j++) {
						const a = (j / N) * Math.PI; // the dome, right → left over the top
						pts.push(x + rr * Math.cos(a), y - hh * Math.sin(a));
					}
					for (let j = 1; j < N; j++) {
						const a = Math.PI + (j / N) * Math.PI; // the waterline's front edge, left → right
						pts.push(x + rr * Math.cos(a), y - rr * flat * Math.sin(a));
					}
					gfx.poly(pts).fill({ color: body }).stroke({ width: line, color: SOUP_LINE, alignment: 0.5 });
					// glossy highlight + a smaller glint, upper left
					gfx.ellipse(x - rr * 0.38, y - hh * 0.55, rr * 0.26, hh * 0.18 + 0.5).fill({ color: 0xf4ffd0, alpha: 0.85 });
					gfx.circle(x - rr * 0.05, y - hh * 0.78, Math.max(0.6, rr * 0.07)).fill({ color: 0xf4ffd0, alpha: 0.7 });
				}
			} else {
				// burst: a ripple ring runs out and fades, droplets hop up and fall back in
				const v = (p - BURST) / (AFTER - BURST);
				const ring = r * (1.3 + 1.6 * v);
				gfx.ellipse(x, y, ring, ring * 0.3).stroke({ width: line * (1 - 0.6 * v), color: SOUP_RING, alpha: 0.8 * (1 - v) });
				if (v < 0.5) gfx.ellipse(x, y, ring * 0.55, ring * 0.16).stroke({ width: line * 0.7, color: SOUP_RING, alpha: 0.6 * (1 - 2 * v) });
				for (let d = 0; d < 4; d++) {
					const dir = (d / 3 - 0.5) * 1.8 + (squirtHash(b.seed + d * 5.1) - 0.5) * 0.5;
					const up = r * (1.1 + 0.9 * squirtHash(b.seed + d * 2.3)); // low: they fall back in, never fly off
					const dx = Math.sin(dir) * r * 1.6 * v;
					const dy = -up * 4 * v * (1 - v); // a hop: up and back down by the end
					const dr = Math.max(0.8, r * (0.16 + 0.1 * squirtHash(b.seed + d))) * (1 - 0.4 * v);
					gfx.circle(x + dx, y + dy, dr * 1.25).fill({ color: SOUP_LINE, alpha: 1 - v * v });
					gfx.circle(x + dx, y + dy, dr).fill({ color: body, alpha: 1 - v * v });
				}
			}
		}
	};
</script>

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. The whole group
     sits BEHIND the board (negative zIndex) but in front of the background. -->
<Container zIndex={props.zIndex ?? -0.5}>
	<!-- Real chef base (no salting arm). Baked pupils are kept, so no fresh discs (pupils empty) — he
	     just BLINKS via skin lids. The nametag jiggles as an overlay (a touch larger than the baked
	     one so it stays covered). No tooth sparkle any more: its flash read as a flicker. -->
	{#if !props.potOnly}
	<Container x={props.mirror ? cx * 2 : 0} scale={{ x: props.mirror ? -1 : 1, y: 1 }} zIndex={0}>
	<Container x={chefReact.x} y={chefReact.y} zIndex={0}>
	<AnimatedGuy
		baseKey="specialBody"
		baseRect={cropRect(GUY_CROPS.specialBase)}
		flex={SALT_FLEX}
		flexState={saltFlexState}
		head={{
			key: 'specialHead',
			rect: cropRect(GUY_CROPS.specialHead),
			...HEAD_PIVOT,
			tilt: headMove.tilt,
			nod: headMove.nod,
			// past these the head's under-jaw skirt (head v4) no longer covers the neck: clockwise lifts
			// the left corner of his jaw, so that way is tight
			tiltRange: [-0.05, 0.015],
			maxLift: 0.0006,
		}}
		hat={{ key: 'specialHat', rect: cropRect(GUY_CROPS.specialHat), ...HAT_PIVOT, ...hatPose }}
		x={guyPose.x}
		y={guyPose.y}
		width={guyPose.width}
		height={guyPose.height}
		zIndex={0}
		pupils={specialPupils}
		lids={specialLids}
		lidRest={LID_REST}
		skin={0xef9650}
		look={{ x: react.lookX, y: react.lookY, weight: react.look }}
		squint={Math.max(react.squint, 0.2 * grin)}
		brow={react.brow}
		browKey="specialBrows"
		phase={2000}
		headExtras={[
			{ key: 'specialMouth', ...cropRect(GUY_CROPS.specialMouth), ...MOUTH_PIVOT, amp: 0, bias: mouth.rot, sx: mouth.sx, sy: mouth.sy },
			{ key: 'specialHair', ...cropRect(GUY_CROPS.specialHair), ...HAIR_ROOT, amp: 0.022, period: 760, bias: 0.6 * bowShake(now) },
		]}
		extras={[
			{ key: 'specialBow', ...cropRect(GUY_CROPS.specialBow), ...BOW_KNOT, amp: 0, bias: bowTilt, sx: 1.04, sy: 1.04 },
			{ key: 'specialLabel', nx: 0.5643, ny: 0.5737, nw: 0.1984, nh: 0.1119, px: 0.5, py: 0.13, amp: 0.035, period: 320, phase: 900, bias: 1.4 * bowShake(now), flipX: props.mirror },
			{ key: 'specialBrows', ...cropRect(GUY_CROPS.specialBrows), amp: 0 },
		]}
	/>
	<!-- Salt-shaker forearm overlay: flicks about the shoulder (above the base, below the salt). -->
	<Sprite
		key="specialArm"
		x={pivotX}
		y={pivotY}
		anchor={{ x: ARM_ANCHOR.px, y: ARM_ANCHOR.py }}
		width={guyPose.width * ARM_RECT.nw}
		height={guyPose.height * ARM_RECT.nh}
		rotation={armAngle}
		zIndex={0.5}
	/>
	<!-- Salt pour: ONE Graphics for all grains (was 90 Rectangle components = 90 objects re-synced +
	     re-tessellated every frame). Same round grains, same positions (the old rects were top-left
	     anchored, so the centre is +size/2). -->
	<Graphics zIndex={1} draw={drawSalt} />
	</Container>
	</Container>
	{/if}
	<Container x={potShake.x} y={potShake.y} zIndex={2}>
	<Sprite
		key="specialPot"
		x={potX}
		y={potY}
		anchor={0.5}
		width={potWidth}
		height={potHeight}
		zIndex={2}
	/>
	<!-- The painted drips ooze and let drops go (game/potDrips); under the multiplier's label. -->
	{#each drips as d (d.key)}
		<Sprite key={d.key} x={d.x} y={d.y} width={d.w} height={d.h} zIndex={2.1} />
	{/each}
	<Graphics zIndex={2.15} draw={drawDrops} />
	<!-- The multiplier on the pot's front: the label printed on the pot, the value in its box. -->
	<Text
		anchor={{ x: 0.5, y: 0 }}
		x={frontX + labelInk.dx}
		y={labelBase - labelInk.fontAsc}
		zIndex={2.5}
		text={labelText}
		style={{ fontFamily: 'Bowlby One SC', fontSize: labelFont, fill: 0xc10c01 }}
	/>
	<Container x={frontX} y={boxY} scale={stamp} zIndex={2.5}>
		<Graphics draw={drawPlaque} />
		<Text
			anchor={{ x: 0.5, y: 0 }}
			x={ink.dx}
			y={multBase - ink.fontAsc}
			text={multText}
			style={{ fontFamily: 'Bowlby One SC', fontSize: multFont, fill: 0xc10c01 }}
		/>
	</Container>
	<!-- The boil on the soup surface: domes rising and bursting into rings + droplets. Above the pot so
	     they read as sitting on the liquid. -->
	<Graphics zIndex={2.5} draw={drawBubbles} />
	<Graphics zIndex={2.6} draw={drawOverflow} />
	</Container>
	<!-- Steam off the soup, over the pot and the chef. -->
	<Graphics zIndex={3} draw={drawSteam} />
</Container>

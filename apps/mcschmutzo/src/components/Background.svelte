<script lang="ts">
	import { Container, Graphics, Rectangle, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import { breathAt, flexAt, type BodyFlex } from '../game/bodyFlex';
	import { SQUIRT_EMIT, SQUIRT_LIFE, drawSauceSquirt, squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';
	import { MOOD_MS, bowShake, chefMood, chefPose, idleSnicker, setChefMood } from '../game/chefMood.svelte';
	import { panoramaRect, PANORAMA_BASE_X } from '../game/panorama';
	import AnimatedGuy, { GUY_CROPS, cropPivot, cropRect } from './AnimatedGuy.svelte';
	import SpecialMascot from './SpecialMascot.svelte';
	import PortraitLamp from './PortraitLamp.svelte';
	import { landscapeLayout } from '../game/landscapeLayout';

	type Props = {
		/** False while the loading screen / splash is up: only the dark backdrop renders. */
		showArt?: boolean;
		/** the board's drop-in has landed (the phone chef waits for it — he'd show under the falling board) */
		boardLanded?: boolean;
	};
	const { showArt = true, boardLanded = true }: Props = $props();

	const context = getContext();

	// Depth: once the splash's camera pan has handed over and the board has dropped in and landed
	// (Game: +120ms, 950ms), the diner panorama softly defocuses — the pre-blurred copy fades in over
	// it — so the board reads in front. Once per session; it stays blurred for the base game after.
	const panoBlur = new Tween(0);
	let panoBlurDone = false;
	$effect(() => {
		if (context.stateLayout.showLoadingScreen || panoBlurDone) return;
		panoBlurDone = true;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		setTimeout(() => panoBlur.set(1, { duration: reduced ? 0 : 900, easing: cubicInOut }), reduced ? 0 : 1100);
	});
	const aspect = 1678 / 937;
	// Portrait diner background (mobile-bg): its own 9:16-ish raster, cover-scaled to the phone.
	const portraitAspect = 941 / 1672;
	// Landscape SPECIAL (free-games) grey kitchen — its own wide crop (special-bg-landscape.webp).
	const specialLandscapeAspect = 1590 / 716;
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscape = $derived(layoutType === 'landscape');
	// Free games swap to the special (grey kitchen) background. Keyed off the free-spin counter
	// (shown for the whole bonus) — the per-spin gameType flips to 'respin'/'basegame' mid-bonus.
	const isFreegame = $derived(
		context.stateGame.gameType === 'freegame' || stateUi.freeSpinCounterShow,
	);
	// The board chef (bottle + ketchup) and the salting chef with his boiling pot: desktop beside the
	// board; phone PORTRAIT peeking over the board's top-right corner (behind it — his lower body and
	// the pot's base tuck under the board frame), the same rigs as desktop. Phone landscape: the same rigs
	// again, mirrored into the bottom-left corner (the design's bust spot).
	const portraitChefOn = $derived(isPortrait && boardLanded && !context.stateGame.freeSpinPopupShowing);
	// phone landscape: the same desktop rig, mirrored into the bottom-left corner (LANDSCAPE_CHEF)
	const landscapeChefOn = $derived(isLandscape && boardLanded && !context.stateGame.freeSpinPopupShowing);
	const showMascot = $derived(!isFreegame && (layoutType === 'desktop' || portraitChefOn || landscapeChefOn));
	const showSpecialMascot = $derived(isFreegame && layoutType === 'desktop');
	// The board frame on screen (BoardFrame's sprite: 1.043 × 1.0473 of the board, inset
	// 0.0206 / 0.0224), canvas px — the portrait chefs are placed in fractions of it.
	const boardFrame = $derived.by(() => {
		const main = context.stateLayoutDerived.mainLayout();
		const b = context.stateGameDerived.boardLayout();
		const sc = main.scale;
		const left = main.x + (b.x - b.width / 2 - main.width / 2) * sc;
		const top = main.y + (b.y - b.height / 2 - main.height / 2) * sc;
		return { x: left - b.width * 0.0206 * sc, y: top - b.height * 0.0224 * sc, w: b.width * 1.043 * sc, h: b.height * 1.0473 * sc };
	});
	// Portrait board chef: his frame 0.456 of the board frame tall (0.6 crowded the top of a phone),
	// hat top 0.37 of it above the board (his lower body still tucked behind it), his face at 0.77 of
	// its width so the bottle hand stays on screen.
	const PORTRAIT_CHEF = { h: 0.456, top: -0.37, face: 0.77 };
	// desktop: tied with the board containers (insertion order keeps him behind the reels); portrait:
	// explicitly behind the board, which hides his lower body
	const chefZ = $derived(isPortrait ? -0.2 : 0);
	// Phone landscape: the desktop chef MIRRORED (facing the board from the bottom-left corner, as the
	// design's bust does), sized off landscapeLayout's design unit; his bottle ends just short of the
	// bet box, sliding left (never past his face) on squarer screens.
	const LANDSCAPE_CHEF = { h: 240, sink: 28, bottle: 0.42, face: 0.06 };
	const landChef = $derived.by(() => {
		if (!isLandscape) return null;
		const { chef, bet, u, k } = landscapeLayout(context, false);
		const h = LANDSCAPE_CHEF.h * u * k;
		const w = h * (1304 / 1699);
		const cx = Math.max(w * (0.12 - LANDSCAPE_CHEF.face), bet.right - bet.w - 4 * u - LANDSCAPE_CHEF.bottle * w);
		return { h, cx, cy: canvas.height + LANDSCAPE_CHEF.sink * chef.unit - h / 2 };
	});
	const mirrorChef = $derived(landChef !== null);
	const mascotHeight = $derived(landChef ? landChef.h : isPortrait ? boardFrame.h * PORTRAIT_CHEF.h : canvas.height * 0.6);
	const mascotWidth = $derived(mascotHeight * (1304 / 1699));
	const mascotCx = $derived(
		landChef
			? landChef.cx
			: isPortrait
				? boardFrame.x + boardFrame.w * PORTRAIT_CHEF.face + (0.5 - 0.44) * mascotWidth
				: canvas.width * 0.86,
	);
	const mascotCy = $derived(
		landChef
			? landChef.cy
			: isPortrait
				? boardFrame.y + boardFrame.h * PORTRAIT_CHEF.top + mascotHeight / 2
				: canvas.height * 0.59,
	);
	// Portrait free games: the salting chef in the same spot, his pot standing on the board's top edge
	// (its base just tucked behind the frame) so MULTIPLIER ×n reads above the reels.
	const portraitSpecial = $derived.by(() => {
		const f = boardFrame;
		const guyWidth = f.h * 0.5 * (358 / 425); // (0.62 crowded the top of a phone; see PORTRAIT_CHEF)
		const potWidth = f.w * 0.26;
		const potHeight = potWidth * (914 / 1271);
		return {
			// his face over the board's right quarter, high enough that the pot stays under his chin
			cx: f.x + f.w * 0.76,
			guyY: f.y - f.h * 0.4 + (guyWidth * 425) / 358 / 2,
			guyWidth,
			potX: f.x + f.w * 0.78,
			potY: f.y + f.h * 0.03 - potHeight / 2,
			potWidth,
		};
	});
	// Landscape free games: the boiling pot where game/landscapeLayout puts it, the (mirrored) salting
	// chef behind it as SpecialMascot stands him on desktop: frame 0.98 of the pot, his hand on its rim
	// (guyY = potY - 0.2·potH - 0.304·guyH).
	const landscapePot = $derived.by(() => {
		const { pot } = landscapeLayout(context, true);
		const potHeight = (pot.w * 914) / 1271;
		const guyWidth = pot.w / 0.98;
		const guyHeight = (guyWidth * 425) / 358;
		return {
			cx: pot.cx + guyWidth * 0.02,
			guyY: pot.cy - 0.2 * potHeight - 0.304 * guyHeight,
			guyWidth,
			potX: pot.cx,
			potY: pot.cy,
			potWidth: pot.w,
		};
	});
	// Subtle idle so the chef isn't a frozen cut-out: a slow breathe (no lean — his eyes carry the
	// life, and a rotation would drag the pupils/label out of place).
	let clock = $state(0);
	$effect(() => {
		// Runs for the base-game chef + sparks (any layout) AND the special-bg (its hanging lamps blink).
		if (!showSparks && !showKitchenAir && !showMascot && !showSpecialMascot) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			// (the salting chef in free games doesn't snicker: without a head of its own the body's
			// shoulder pops read as a tick)
			if (!isFreegame) idleSnicker(ts);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Sparks: a few tiny warm glints drifting up behind the board on the regular (base-game) bg, so it
	// feels alive without competing with the reels. Deterministic off the clock: each spark has its
	// own column, speed, sway and size; it fades in, rises one lifetime and fades out, twinkling.
	const showSparks = false; // design ask: no floating dots on the regular bg
	// Free-games kitchen air (the grey-kitchen special bg): the base game's glints, re-imagined for a
	// working kitchen — soft STEAM puffs rising from below (swelling, swaying, fading), and FLOUR/SALT
	// dust swirling on a slow, never-repeating current, catching the light as it drifts under the
	// hanging lamps. Every ~8s a DRAFT (a door swinging) sweeps the dust sideways and bends the steam,
	// then the air settles. Deterministic off the clock; drawn behind the board.
	// (off: the steam now rises from the chef's soup only — SpecialMascot drawSteam)
	const showKitchenAir = false;
	const MOTES = 72;
	const PUFFS = 9;
	const drawKitchenAir = (g: SquirtGraphics) => {
		const W = canvas.width;
		const H = canvas.height;
		const t = clock;
		// Draft: a smooth gust envelope (0 → 1 → 0 over ~2.4s) once per 8s, alternating direction.
		const DRAFT = 8000;
		const dk = Math.floor(t / DRAFT);
		const dp = (t % DRAFT) / 2400;
		const gust = dp < 1 ? Math.sin(Math.PI * dp) ** 2 : 0;
		const gustDir = dk % 2 ? -1 : 1;
		// Lamp light pools (desktop: the pendant lamps; else a soft high-left key light).
		const lights = lamps
			? lamps.list.map((l) => ({ x: l.x, y: lamps.haloYPx + lamps.lampH * 0.6, r: lamps.lampW * 2.2, on: l.on }))
			: [{ x: W * 0.18, y: H * 0.15, r: H * 0.35, on: 1 }];
		// Steam: big soft puffs, each a few overlapping discs, rising from the bottom band.
		for (let i = 0; i < PUFFS; i++) {
			const life = 7000 + 4000 * squirtHash(i * 3.1);
			const tt = t + squirtHash(i * 8.7) * life;
			const k = Math.floor(tt / life);
			const p = (tt % life) / life;
			const x0 = W * (0.05 + 0.9 * squirtHash(i * 1.9 + k * 4.3));
			const bend = gust * gustDir * W * 0.06 * p;
			const x = x0 + Math.sin(p * 5 + i) * W * 0.02 + bend;
			const y = H * (1.02 - 0.75 * p);
			const r = H * (0.05 + 0.1 * p) * (0.8 + 0.4 * squirtHash(i * 2.2));
			const a = Math.sin(Math.PI * p) * 0.08;
			for (let j = 0; j < 3; j++) {
				const ox = (j - 1) * r * 0.55;
				const oy = Math.sin(j * 2.1 + p * 3) * r * 0.2;
				g.circle(x + ox, y + oy, r * (0.75 + 0.2 * j)).fill({ color: 0xf2efe8, alpha: a });
			}
		}
		// (flour/salt dust motes removed — design ask: no dots; the steam stays)
	};
	const SPARKS = 26;
	const drawSparks = (g: SquirtGraphics) => {
		const W = canvas.width;
		const H = canvas.height;
		for (let i = 0; i < SPARKS; i++) {
			const life = 6000 + 5000 * squirtHash(i * 4.1); // ms per rise
			const t = clock + squirtHash(i * 7.3) * life;
			const cycle = Math.floor(t / life);
			const p = (t % life) / life; // 0..1 through this rise
			// New column + start height every cycle so the pattern never repeats visibly.
			const hx = squirtHash(i * 13.7 + cycle * 3.3);
			const x0 = hx * W;
			const y0 = H * (0.55 + 0.45 * squirtHash(i * 5.9 + cycle * 1.7));
			const x = x0 + Math.sin(p * Math.PI * 2 * (0.6 + hx) + i) * W * 0.012;
			const y = y0 - p * H * (0.3 + 0.25 * squirtHash(i * 2.2));
			const twinkle = 0.65 + 0.35 * Math.sin(clock / (180 + 140 * squirtHash(i)) + i * 2.1);
			const a = Math.sin(Math.PI * p) * twinkle * 0.55; // fade in / out
			const r = H * (0.0016 + 0.0022 * squirtHash(i * 9.4));
			g.circle(x, y, r * 3.2).fill({ color: 0xffb347, alpha: a * 0.18 }); // soft glow
			g.circle(x, y, r).fill({ color: 0xfff1c8, alpha: a }); // hot core
		}
	};
	const idlePose = $derived(
		mascotIdle(clock, mascotCx, mascotCy, mascotWidth, mascotHeight, {
			sway: 0,
			// (the breath is the torso's own now — CHEF_FLEX bends the body instead of scaling it whole)
			breathe: 0,
			bob: 0,
		}),
	);
	// His torso as soft tissue (game/bodyFlex): the chest fills and the shoulders rise on each breath
	// and give a little to the head's tilt; head, arms, bow, nametag and the held bottle ride along.
	const CHEF_FLEX: BodyFlex = {
		neckY: 0.507, // = the head's neck pivot
		baseY: 1, // the frame's bottom edge (the board cuts him off there)
		chest: { x: 0.52, y: 0.66, r: 0.1 }, // the shirt front below the bow, between the straps
		lift: 0.006,
		swell: 0.035,
		lean: 0.25,
	};
	// The chef reacts to the game (game/chefMood: leans in on a spin, shrugs at a dead spin, nods at a
	// win, lunges + smacks at a WILD, laughs / celebrates big wins). Offsets ride on the idle pose,
	// scaled about his feet.
	const react = $derived(chefPose(clock));
	const chefFlexState = $derived({ breath: breathAt(clock), tilt: react.headTilt });
	// Entrance (he used to just snap in): whenever he comes on — the splash handing over, back from
	// free games — he pops up from behind the bottom edge with an overshoot, squashes as he lands,
	// then gives a "hello" nod. Starts just after the splash's 350 ms fade, alongside the board drop.
	const ENTER_DELAY = 300;
	const ENTER_MS = 750;
	let enterAt = $state(-1);
	$effect(() => {
		if (!(showArt && showMascot)) return;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		enterAt = reduced ? -1 : performance.now() + ENTER_DELAY;
		if (reduced) return;
		const id = setTimeout(() => chefMood.mood === 'idle' && setChefMood('win'), ENTER_DELAY + ENTER_MS * 0.7);
		return () => clearTimeout(id);
	});
	const enter = $derived.by(() => {
		if (enterAt < 0) return { dy: 0, sy: 1 };
		const t = clock - enterAt;
		if (t >= ENTER_MS + 260) return { dy: 0, sy: 1 };
		// fully below the screen's bottom edge (portrait: down behind the board) until his start, then a
		// back-out rise
		const hidden = isPortrait
			? idlePose.height * 0.5
			: canvas.height - (idlePose.y - idlePose.height / 2) + idlePose.height * 0.02;
		const u = Math.max(0, Math.min(1, t / ENTER_MS));
		const back = 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2; // overshoots ~6% then settles
		const land = t - ENTER_MS * 0.55; // the squash as he tops out and drops back
		const sy = land > 0 && land < 420 ? 1 - 0.035 * Math.exp(-land / 120) * Math.sin((land / 420) * Math.PI * 2.5) : 1;
		return { dy: hidden * (1 - back), sy };
	});
	const mascotPose = $derived({
		x: idlePose.x + react.dx * idlePose.width,
		y:
			idlePose.y +
			react.dy * idlePose.height -
			((react.sy * enter.sy - 1) * idlePose.height) / 2 +
			enter.dy,
		width: idlePose.width * (react.sx / Math.sqrt(enter.sy)),
		height: idlePose.height * react.sy * enter.sy,
	});
	// The Figma chef (McShmutzo file, "Frame 427321577"), exported at 4× (1304×1699) and keyed off
	// the flat canvas grey — the same art as the free-games salting chef; since 2026-10 the base is the
	// relaxed-arm body (node 8779:1769) instead of the pointing hand. Layers: base (pupils erased), the bottle hand (drawn BEHIND the body, as in Figma, so it can shake),
	// and the nametag plate (jiggles over its baked copy). Pupils are redrawn a touch smaller than the
	// art and nudged up so the right one clears its lower-lid line while glancing. All fractions of
	// the frame. Skin sampled beside the eyes so the blink lid blends in.
	const mascotPupils = [
		{ nx: 0.3804, ny: 0.2866, nw: 0.0559, nh: 0.0429 },
		{ nx: 0.4962, ny: 0.2719, nw: 0.0701, nh: 0.0538 },
	];
	const mascotLids = [
		{ cx: 0.3658, cy: 0.2778, w: 0.069, h: 0.056 },
		{ cx: 0.4885, cy: 0.2666, w: 0.0767, h: 0.0689 },
	];
	// The held ketchup bottle — the whole raised arm, sleeve included — swings from where the sleeve
	// runs in under the apron strap (scripts/build-chef-bottle.py SEAM), tucked behind the body. It
	// used to turn about the thumb, which slid the sleeve's cut edge out beside the strap buckle.
	const BOTTLE_PIVX = 0.3758;
	const BOTTLE_PIVY = 0.618;
	// The bottle sits ~1.4x farther from this pivot than from the old wrist one: angles are scaled by
	// this so it travels as far as before. Positive turns are capped (past ~0.1 the sleeve's lower end
	// lifts off the apron).
	const ARM_GAIN = 0.72;
	const ARM_MAX_IN = 0.1;
	// The bottle layer is cropped to its opaque box: same pivot, expressed inside the crop.
	const BOTTLE_RECT = cropRect(GUY_CROPS.mascotBottle);
	const BOTTLE_ANCHOR = cropPivot(GUY_CROPS.mascotBottle, BOTTLE_PIVX, BOTTLE_PIVY);
	const mascotLeft = $derived(mascotPose.x - mascotPose.width / 2);
	const mascotTop = $derived(mascotPose.y - mascotPose.height / 2);
	// (riding the torso field where the sleeve runs in under the strap, like the layers on the body)
	const bottleFlex = $derived(flexAt(CHEF_FLEX, chefFlexState, BOTTLE_PIVX, BOTTLE_PIVY, mascotPose.width, mascotPose.height));
	const bottlePivotX = $derived(mascotLeft + BOTTLE_PIVX * mascotPose.width + bottleFlex.dx);
	const bottlePivotY = $derived(mascotTop + BOTTLE_PIVY * mascotPose.height + bottleFlex.dy);
	// An unhurried damped waggle now and then (a quick 2.6-wiggle shake read as trembling).
	const BOTTLE_PERIOD = 2800; // ms between shakes
	const SHAKE_DUR = 1100; // ms the waggle lasts
	const shakeAt = (t: number) => {
		const u = (t % BOTTLE_PERIOD) / SHAKE_DUR; // 0..1 across the shake
		if (u > 1) return 0;
		return 0.058 * Math.exp(-2.7 * u) * Math.sin(u * 2 * Math.PI * 1.5); // ~3.3° damped, 1.5 swings
	};

	// Ketchup squirt: now and then he squeezes the bottle and a real-looking shot of ketchup leaves the
	// nozzle (physics + drawing in ketchupSquirt.ts, shared with the sauce symbols). The bottle kicks
	// back a touch while squeezed.
	const SQ_PERIOD = 6500; // a squirt slot every 6.5s …
	const SQ_OFFSET = 1700; // … starting this far into the slot (clear of the shake)
	const NOZZLE = { x: 0.1438, y: 0.3773 }; // nozzle tip (frame fractions)
	const NOZZLE_DIR = Math.atan2(-0.979, -0.204); // bottle axis: up, leaning ~12° toward the board
	// Big wins fire the bottle on cue (a huge win twice) instead of the idle squirt.
	const CELEBRATE_SHOTS: Partial<Record<string, number[]>> = { bigWin: [300], hugeWin: [250, 1250] };
	/** When each squeeze that can still show at time t began (absolute ms). */
	const squeezeStarts = (t: number) => {
		const shots = CELEBRATE_SHOTS[chefMood.mood];
		if (shots && t < chefMood.at + MOOD_MS[chefMood.mood] + SQUIRT_LIFE) return shots.map((s) => chefMood.at + s);
		const k = Math.floor(t / SQ_PERIOD);
		if (squirtHash(k) < 0.35) return []; // skip ~1 in 3 slots → irregular, "from time to time"
		return [k * SQ_PERIOD + SQ_OFFSET];
	};
	/** ms into the latest squeeze already begun (or about to, within 200ms) at t; -1 if none. */
	const squirtLocal = (t: number) => {
		const live = squeezeStarts(t).filter((s) => t - s >= -200);
		return live.length ? t - live[live.length - 1] : -1;
	};
	const recoilAt = (t: number) => {
		const u = squirtLocal(t);
		if (u < 0 || u > SQUIRT_EMIT + 400) return 0;
		// Kick back (clockwise, away from the stream) as he squeezes, then settle with a small overshoot.
		const k = u / (SQUIRT_EMIT + 400);
		return 0.05 * Math.sin(Math.PI * Math.min(1, u / SQUIRT_EMIT)) * (1 - k) + 0.012 * Math.sin(k * Math.PI * 3) * (1 - k);
	};
	const bottleRotAt = (t: number) => {
		const u = squirtLocal(t);
		const squirting = u >= -200 && u <= SQUIRT_EMIT + 700;
		return (squirting ? 0 : shakeAt(t)) + recoilAt(t);
	};
	const armTurn = (rot: number) => Math.max(-0.16, Math.min(ARM_MAX_IN, rot * ARM_GAIN));
	const bottleShake = $derived(armTurn(bottleRotAt(clock) + react.propRot));
	// The hanging forearm swings a little from the elbow: a slow pendulum, plus a jolt when he smacks
	// or waggles the bottle (WILD, laughs). Inward only (0..ARM_MAX, + = the hand toward his apron):
	// swinging out would uncover what the hand hides on the body layer.
	const ARM_MAX = 0.04;
	const ARM_ELBOW = cropPivot(GUY_CROPS.mascotArm, 0.8728, 0.7779); // build-chef-head.py ARM_PIVOT
	const armSwing = $derived(
		Math.min(
			ARM_MAX,
			Math.max(0, 0.014 + 0.012 * Math.sin(clock / 1270 + 0.6) + 0.004 * Math.sin(clock / 610) + Math.abs(react.propRot) * 0.35),
		),
	);
	// The bow tie wobbles on its knot: a slow sway, the head's tilt passed down, and a follow-through
	// of the arm's shake ~80 ms late (it's tied to the same shoulders). Small: past ~0.06 its shadowed
	// footprint on the body shows round the lobes.
	const BOW_KNOT = cropPivot(GUY_CROPS.mascotBow, 0.4985, 0.5327); // build-chef-bow.py KNOT
	const bowTilt = $derived(
		Math.max(
			-0.06,
			Math.min(
				0.06,
				0.014 * Math.sin(clock / 1150 + 0.8) +
					0.006 * Math.sin(clock / 530) +
					0.35 * armTurn(bottleRotAt(clock - 80)) +
					0.3 * react.headTilt +
					bowShake(clock),
			),
		),
	);
	// the celebration squirts are heard (the idle ones stay silent: short reactions, not constant noise)
	$effect(() => {
		const shots = CELEBRATE_SHOTS[chefMood.mood];
		if (!shots) return;
		const wait = chefMood.at - performance.now();
		const timers = shots.map((s) =>
			setTimeout(
				() => context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_chef_squirt', forcePlay: true }),
				Math.max(0, wait + s),
			),
		);
		return () => timers.forEach(clearTimeout);
	});

	const drawSquirt = (g: SquirtGraphics) => {
		const w = mascotPose.width;
		const h = mascotPose.height;
		const dx = mascotLeft + NOZZLE.x * w - bottlePivotX;
		const dy = mascotTop + NOZZLE.y * h - bottlePivotY;
		for (const [i, t0] of squeezeStarts(clock).entries()) {
			drawSauceSquirt(g, {
				u: clock - t0,
				unit: canvas.height,
				color: 0xb3160d,
				dark: 0x5e0704,
				floorY: isPortrait ? boardFrame.y + boardFrame.h : canvas.height * 0.8, // gone behind the HUD band / board
				seed: i,
				// The nozzle rides the arm's rotation about the strap seam.
				nozzleAt: (ms) => {
					const th = armTurn(bottleRotAt(t0 + ms));
					const c = Math.cos(th);
					const sn = Math.sin(th);
					return { x: bottlePivotX + dx * c - dy * sn, y: bottlePivotY + dx * sn + dy * c, dir: NOZZLE_DIR + th };
				},
			});
		}
	};
	// Free games (desktop) keep the grey-kitchen special bg; the base game uses the panorama (below).
	const key = 'backgroundWideBonus';
	const portraitKey = $derived(isFreegame ? 'backgroundPortraitBonus' : 'backgroundPortrait');
	// Base game (desktop + mobile landscape): the right-hand view of the connected diner panorama,
	// framed exactly like the splash frames it at the end of its camera pan (see SplashIntro).
	const pano = $derived(panoramaRect(canvas.width, canvas.height, PANORAMA_BASE_X));
	const cover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > aspect
			? { width: canvas.width, height: canvas.width / aspect }
			: { width: canvas.height * aspect, height: canvas.height };
	});
	// Cover for the wide landscape special crop (free games only).
	const specialLandscapeCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > specialLandscapeAspect
			? { width: canvas.width, height: canvas.width / specialLandscapeAspect }
			: { width: canvas.height * specialLandscapeAspect, height: canvas.height };
	});
	// Cover-scale the portrait bg: the phone is usually narrower than the art, so height fills the
	// screen and the sides overhang (lamp + shelf stay in view).
	const portraitCover = $derived.by(() => {
		const canvasAspect = canvas.width / canvas.height;
		return canvasAspect > portraitAspect
			? { width: canvas.width, height: canvas.width / portraitAspect }
			: { width: canvas.height * portraitAspect, height: canvas.height };
	});
	// A slow, subtle diagonal light-sweep across the diner so it reads as freshly polished / super
	// clean. Sweeps every ~10s and fades in/out; only on the desktop base-game bg (uses the same clock).
	const shine = $derived.by(() => {
		const period = 10000;
		const dur = 2800;
		const t = clock % period;
		if (t > dur) return null;
		const p = t / dur;
		return { x: (-0.2 + 1.4 * p) * canvas.width, a: 0.11 * Math.sin(Math.PI * p) };
	});
	// Two hanging pendant lamps in the special (free-games) kitchen bg's top-left. They hang from the
	// ceiling (bg top) and their bulbs blink on/off smoothly from time to time.
	const lamps = $derived.by(() => {
		if (!showSpecialMascot) return null;
		const bgLeft = canvas.width / 2 - cover.width / 2;
		const bgTop = canvas.height / 2 - cover.height / 2;
		// Small lamps that sit in the clear ceiling strip ABOVE the top-left readout (so the
		// multiplier plaque never covers them). Keep the bulb above the readout's top edge.
		const lampH = Math.min(canvas.height * 0.16, cover.height * 0.2);
		const lampW = lampH * (700 / 1077);
		// On most of the time, with a frequent double-flicker (two quick dips back to back) — a
		// stuttery neon-sign feel. Both lamps share the same phase so they blink in sync.
		const blink = (phase: number) => {
			const period = 1300;
			const t = (((clock + phase) % period) + period) % period;
			const dip = (lo: number, hi: number) => {
				if (t < lo * period || t > hi * period) return 0;
				const u = (t - lo * period) / ((hi - lo) * period); // 0..1 across the dip
				const tri = 1 - Math.abs(u * 2 - 1); // 0 → 1 → 0
				return tri * tri * (3 - 2 * tri); // smoothstep the dip
			};
			return 1 - Math.max(dip(0.6, 0.72), dip(0.78, 0.9)); // 1 (on) → 0 (off) → 1, twice
		};
		return {
			lampW,
			lampH,
			y: bgTop,
			bulbYPx: bgTop + lampH * 0.95, // the bulb sits at the shade's bottom opening
			haloYPx: bgTop + lampH * 1.0, // halo centred on the bulb (light escaping under the rim)
			list: [
				{ x: bgLeft + cover.width * 0.1, on: blink(0) },
				{ x: bgLeft + cover.width * 0.2, on: blink(0) },
			],
		};
	});
</script>

<Rectangle {...canvas} backgroundColor={0x170905} zIndex={-3} />
{#if !showArt}
	<!-- Loading / splash: nothing but the backdrop (the art below would show through). -->
{:else if isLandscape}
	<!-- Mobile-landscape: the real full diner (cover-scaled) for the base game, swapping to the
	     dedicated wide grey-kitchen crop for free games. The chef stands bottom-left (Figma
	     8295:22703 / 8302:23371). -->
	{#if isFreegame}
		<Sprite
			key="backgroundLandscapeBonus"
			x={canvas.width * 0.5}
			y={canvas.height * 0.5}
			anchor={0.5}
			width={specialLandscapeCover.width}
			height={specialLandscapeCover.height}
			zIndex={-2}
		/>
	{:else}
		<Sprite key="backgroundPanorama" x={pano.x} y={pano.y} width={pano.width} height={pano.height} zIndex={-2} />
		{#if panoBlur.current > 0}
			<Sprite key="backgroundPanoramaBlur" x={pano.x} y={pano.y} width={pano.width} height={pano.height} alpha={panoBlur.current} zIndex={-1.95} />
		{/if}
	{/if}
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
	{#if isFreegame}
		<!-- the desktop's salting chef, mirrored, behind his boiling pot (only the pot stays through a
		     CONGRATS card: its soups fly into it) -->
		<SpecialMascot place={landscapePot} mirror potOnly={!boardLanded || context.stateGame.freeSpinPopupShowing} zIndex={-0.1} />
	{/if}
{:else if isPortrait}
	<!-- Mobile portrait: the dedicated diner background, no darkening overlay (matches the splash).
	     Swaps to the special grey-kitchen background during free games. -->
	<Sprite
		key={portraitKey}
		x={canvas.width * 0.5}
		y={canvas.height * 0.5}
		anchor={0.5}
		width={portraitCover.width}
		height={portraitCover.height}
		zIndex={-2}
	/>
	{#if !isFreegame}
		<!-- the painted pendant lamp, lit for real -->
		<PortraitLamp cx={canvas.width * 0.5} cy={canvas.height * 0.5} width={portraitCover.width} height={portraitCover.height} />
	{/if}
	<!-- Free games: the salting chef and his boiling pot over the board's top-right corner, behind the
	     board (the base game's board chef is drawn below with the desktop's). During the CONGRATS card
	     only the pot stays (its soups fly into it). -->
	{#if isFreegame && boardLanded}
		<SpecialMascot place={portraitSpecial} potOnly={context.stateGame.freeSpinPopupShowing} />
	{/if}
{:else}
	{#if isFreegame}
		<Sprite
			{key}
			x={canvas.width * 0.5}
			y={canvas.height * 0.5}
			anchor={0.5}
			width={cover.width}
			height={cover.height}
			zIndex={-2}
		/>
	{:else}
		<Sprite key="backgroundPanorama" x={pano.x} y={pano.y} width={pano.width} height={pano.height} zIndex={-2} />
		{#if panoBlur.current > 0}
			<Sprite key="backgroundPanoramaBlur" x={pano.x} y={pano.y} width={pano.width} height={pano.height} alpha={panoBlur.current} zIndex={-1.95} />
		{/if}
	{/if}
	<Rectangle {...canvas} backgroundColor={0x180903} alpha={0.16} zIndex={-1} />
	{#if showMascot && shine}
		<!-- Clean gleam: a soft light band (wide dim + narrow bright core) sweeping across the diner. -->
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.11} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a} zIndex={-0.6} />
		<Rectangle x={shine.x} y={canvas.height * 0.5} anchor={0.5} width={canvas.width * 0.04} height={canvas.height * 1.7} rotation={0.32} backgroundColor={0xffffff} alpha={shine.a * 1.3} zIndex={-0.6} />
	{/if}
	{#if lamps}
		<!-- Two small hanging pendant lamps in the top-left ceiling strip; bulbs blink on/off in sync.
		     The glow is a soft radial texture (baked warm gradient, transparent edge) blended
		     additively BEHIND the shade — a smooth natural falloff with no hard circle edge, biased
		     slightly DOWN so it reads as light spilling from under the shade. When the lamp switches
		     off the bulb itself dims: the SAME soft glow texture, tinted near-black, fades in over the
		     bulb (a soft radial, so it reads as the bulb going dark — not a hard shadow disc). -->
		{#each lamps.list as l, i (i)}
			<Sprite key="lampGlow" x={l.x} y={lamps.haloYPx + lamps.lampH * 0.08} anchor={0.5} width={lamps.lampW * 2.5} height={lamps.lampW * 2.85} alpha={l.on * 0.5} zIndex={-0.93} blendMode="add" />
			<Sprite key="specialLamp" x={l.x} y={lamps.y} anchor={{ x: 0.5, y: 0 }} width={lamps.lampW} height={lamps.lampH} zIndex={-0.92} />
			<Sprite key="lampGlow" x={l.x} y={lamps.bulbYPx} anchor={0.5} width={lamps.lampW * 0.82} height={lamps.lampW * 0.82} tint={0x181005} alpha={(1 - l.on) * 0.72} zIndex={-0.9} />
		{/each}
	{/if}
{/if}
{#if showKitchenAir}
	<!-- Free-games kitchen air: rising steam + flour dust in the lamp light, with the odd draft. -->
	<Graphics zIndex={-0.5} draw={drawKitchenAir} />
{/if}
{#if showSparks}
	<!-- Subtle rising sparks between the bg and the board (additive, so they glow on the warm art). -->
	<Graphics zIndex={-0.5} blendMode="add" draw={drawSparks} />
{/if}
{#if showArt && showMascot}
	<!-- (phone landscape: the whole rig mirrored about his centre line) -->
	<Container
		x={mirrorChef ? mascotCx * 2 : 0}
		scale={{ x: mirrorChef ? -1 : 1, y: 1 }}
		zIndex={chefZ}
	>
		<!-- The chef breathes, his eyes glance + blink, and his nametag jiggles (layered art). -->
		<AnimatedGuy
			baseKey="mascotBody"
			baseRect={cropRect(GUY_CROPS.mascotBody)}
			flex={CHEF_FLEX}
			flexState={chefFlexState}
			head={{
				key: 'mascotHead',
				rect: cropRect(GUY_CROPS.mascotHead),
				// the neck's base (scripts/build-chef-head.py PIVOT, in frame fractions)
				px: 0.5075,
				py: 0.507,
				tilt: react.headTilt,
				nod: react.headNod,
				// past these the neck seam shows (a second chin line under the jaw)
				tiltRange: [-0.035, 0.035],
				maxLift: 0.0004,
			}}
			x={mascotPose.x}
			y={mascotPose.y}
			width={mascotPose.width}
			height={mascotPose.height}
			zIndex={chefZ}
			pupils={mascotPupils}
			lids={mascotLids}
			skin={0xee9c58}
			look={{ x: react.lookX, y: react.lookY, weight: react.look }}
			squint={react.squint}
			brow={react.brow}
			browKey="mascotBrows"
			extras={[
				{
					// The collar's edge, over the head's lower edge (static).
					key: 'mascotCollar',
					...cropRect(GUY_CROPS.mascotCollar),
					amp: 0,
				},
				{
					// The relaxed forearm + hand, swinging from the elbow (amp 0: Background drives it).
					key: 'mascotArm',
					...cropRect(GUY_CROPS.mascotArm),
					...ARM_ELBOW,
					amp: 0,
					bias: armSwing,
				},
				{
					key: 'mascotBow',
					...cropRect(GUY_CROPS.mascotBow),
					...BOW_KNOT,
					amp: 0,
					bias: bowTilt,
				},
				{
					// Full-frame layer (the exact plate pixels), tilting about its pin.
					key: 'mascotLabel',
					...cropRect(GUY_CROPS.mascotLabel),
					...cropPivot(GUY_CROPS.mascotLabel, 0.6196, 0.6027),
					// swinging on its pin (a 2 s sway), kicked along with the bow when he reacts
					amp: 0.035,
					period: 320,
					bias: 1.4 * bowShake(clock),
					flipX: mirrorChef,
				},
				{
					// Brows above the blink lids (static full-frame layer).
					key: 'mascotBrows',
					...cropRect(GUY_CROPS.mascotBrows),
					amp: 0,
				},
			]}
			sparkle={{ nx: 0.46, ny: 0.376, size: 0.075, period: 3400 }}
		/>
		<!-- The held ketchup bottle — behind the body (as in the Figma layer order), shaking about the wrist. -->
		<Sprite
			key="mascotBottle"
			x={bottlePivotX}
			y={bottlePivotY}
			anchor={{ x: BOTTLE_ANCHOR.px, y: BOTTLE_ANCHOR.py }}
			width={mascotPose.width * BOTTLE_RECT.nw}
			height={mascotPose.height * BOTTLE_RECT.nh}
			rotation={bottleShake}
			zIndex={chefZ - 0.1}
		/>
		<!-- The ketchup squirt: zIndex 0 ties with the chef and the board containers, so insertion order
	     puts it in front of the chef but BEHIND the reels (drops never cover symbols). -->
		<Graphics zIndex={chefZ} draw={drawSquirt} />
	</Container>
{/if}
{#if showArt && showSpecialMascot}
	<SpecialMascot />
{/if}

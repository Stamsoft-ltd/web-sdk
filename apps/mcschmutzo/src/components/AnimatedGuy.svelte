<script lang="ts" module>
	/**
	 * The chef layers used to be exported as full-frame canvases (1304x1699 / 1611x1912) that were
	 * mostly transparent — a 4% eyebrow strip cost the same GPU memory as the whole figure. Each layer
	 * is now cropped to its opaque box (+2px) and only that box is shipped. `GUY_CROPS` records where
	 * each crop sat on its original frame (source px), so callers can keep placing it in FRAME
	 * fractions exactly as before: `cropRect` gives the frame-fraction rect the crop covers, and
	 * `cropPivot` re-expresses a full-frame pivot inside that rect. Same texels land on the same
	 * screen pixels — the composite is unchanged.
	 */
	export type GuyCrop = { x0: number; y0: number; x1: number; y1: number; fw: number; fh: number };
	const MASCOT = { fw: 1304, fh: 1699 };
	const SPECIAL = { fw: 1611, fh: 1912 };
	export const GUY_CROPS = {
		mascotBody: { x0: 316, y0: 0, x1: 1256, y1: 1800, ...MASCOT }, // runs past the frame: the relaxed hand
		mascotHead: { x0: 316, y0: 0, x1: 1019, y1: 876.2, ...MASCOT }, // scripts/build-chef-head.py prints these
		mascotArm: { x0: 1030.4, y0: 1295.6, x1: 1256, y1: 1796.6, ...MASCOT },
		mascotBottle: { x0: 80, y0: 639, x1: 575, y1: 1330, ...MASCOT },
		mascotBrows: { x0: 399, y0: 328, x1: 728, y1: 469, ...MASCOT },
		mascotCollar: { x0: 584.7, y0: 672.3, x1: 850.0, y1: 867.3, ...MASCOT }, // scripts/build-chef-collar.py
		mascotLabel: { x0: 679, y0: 1022, x1: 937, y1: 1161, ...MASCOT },
		mascotBow: { x0: 514.4, y0: 832.2, x1: 788.8, y1: 976.2, ...MASCOT }, // scripts/build-chef-bow.py
		specialBase: { x0: 511, y0: 0, x1: 1611, y1: 1974.6, ...SPECIAL }, // runs past the frame: v12h's fingertips
		specialHead: { x0: 511, y0: 140.4, x1: 1306.7, y1: 948.7, ...SPECIAL }, // build-special-head.py; v4 skirt: build-special-head-skirt.py
		specialHat: { x0: 762.9, y0: 0, x1: 1284.2, y1: 468.7, ...SPECIAL },
		specialArm: { x0: 108, y0: 480, x1: 735, y1: 1285, ...SPECIAL },
		specialBrows: { x0: 622, y0: 389, x1: 981, y1: 527, ...SPECIAL },
		specialBow: { x0: 745.3, y0: 934.8, x1: 1052.4, y1: 1105.3, ...SPECIAL }, // scripts/build-special-bow-mouth.py
		specialMouth: { x0: 631.3, y0: 592.8, x1: 1043.6, y1: 861.0, ...SPECIAL },
		specialHair: { x0: 1175.2, y0: 429.9, x1: 1306.7, y1: 736.9, ...SPECIAL }, // scripts/build-special-hair.py
	} satisfies Record<string, GuyCrop>;
	export type FrameRect = { nx: number; ny: number; nw: number; nh: number };
	export const FULL_FRAME: FrameRect = { nx: 0, ny: 0, nw: 1, nh: 1 };
	export const cropRect = (c: GuyCrop): FrameRect => ({
		nx: c.x0 / c.fw,
		ny: c.y0 / c.fh,
		nw: (c.x1 - c.x0) / c.fw,
		nh: (c.y1 - c.y0) / c.fh,
	});
	/** A pivot given in full-frame fractions, as an anchor inside the cropped layer. */
	export const cropPivot = (c: GuyCrop, px: number, py: number) => {
		const r = cropRect(c);
		return { px: (px - r.nx) / r.nw, py: (py - r.ny) / r.nh };
	};
</script>

<script lang="ts">
	import { Container, Sprite, Rectangle, Circle } from 'pixi-svelte';
	import BodyMesh from './BodyMesh.svelte';
	import { flexAt, type BodyFlex, type FlexState } from '../game/bodyFlex';
	import { createPointGesture, type HandPose } from '../game/pointGesture';

	// A chef that stands (the parent breathes him via x/y/width/height) while his face is ALIVE: the
	// pupils glance around with occasional quick saccades and he blinks now and then. The base art has
	// the pupils cut out (sclera filled), and the pupils are drawn FRESH as clean dark discs + a glint
	// (like the splash chef) rather than the cut-from-art pupils — those carried a sliver of the eye's
	// black outline, so nudging them merged pupil-into-border and read badly. The discs are a touch
	// smaller than the socket and the glance is small, so they never reach the outline. Each blink is a
	// skin-coloured lid that drops over the eye (overshoot onto surrounding skin is invisible, same
	// colour) with a soft crease. Extra layers (label) can tilt about their own pin via `extras`.
	type Pupil = { nx: number; ny: number; nw: number; nh: number };
	type Lid = { cx: number; cy: number; w: number; h: number };
	type Extra = {
		key: string;
		nx: number;
		ny: number;
		nw: number;
		nh: number;
		/** pivot within the sprite (0..1); the tilt swings about this point. */
		px?: number;
		py?: number;
		/** peak tilt in radians and its period (ms), swinging about `bias` (radians, default 0). */
		amp?: number;
		period?: number;
		phase?: number;
		bias?: number;
		/** scale about the pivot (default 1) — an overlay drawn a touch large covers its painted copy */
		sx?: number;
		sy?: number;
		/** drawn flipped within its own box — a text layer stays readable when the whole rig is mirrored */
		flipX?: boolean;
		/**
		 * Pointing-hand gesture instead of the sine tilt: breathing drift + a random "point-point"
		 * every 3–6 s (see game/pointGesture). `tip` is the fingertip's side of the pivot (-1 = left),
		 * `breath` the figure's current breath (-1..1) so the drift rides the chest.
		 */
		gesture?: { tip: 1 | -1; breath?: number };
	};
	/** A periodic *ding* sparkle on a tooth (nx/ny in figure fractions; size fraction of width). */
	type Sparkle = { nx: number; ny: number; size: number; period?: number; phase?: number };
	type Props = {
		baseKey: string;
		x: number;
		y: number;
		width: number;
		height: number;
		zIndex?: number;
		pupils: Pupil[];
		lids?: Lid[];
		/** How far the lids rest lowered (0..1 of the eye) between blinks — a heavy-lidded, sly look
		 * instead of wide round "bug" eyes; a blink closes from there. */
		lidRest?: number;
		skin?: number;
		extras?: Extra[];
		/** Extra layers ON the head (turning and nodding with it), drawn just over the head sprite. */
		headExtras?: Extra[];
		sparkle?: Sparkle;
		/** ms offset so two instances never blink/glance in lock-step. */
		phase?: number;
		/** Where the (cropped) base texture sits on the figure frame; full frame when omitted. */
		baseRect?: FrameRect;
		/** Reaction overrides (game/chefMood): a gaze target (figure fractions) with its weight over
		 * the idle glance, a squint (0..1, lids lowered — happy / laughing eyes) and a brow offset
		 * (fraction of the height, + = down) applied to the `browKey` extra. */
		look?: { x: number; y: number; weight: number };
		squint?: number;
		brow?: number;
		browKey?: string;
		/**
		 * A separate head layer (the base is then the body without it): the head, the eyes, lids,
		 * brows (`browKey`) and the sparkle turn together about the neck pivot (figure fractions).
		 * On top of its own idle (a slow sway, a breath nod, and following the eyes' glances a beat
		 * late) it takes the reaction's `tilt` (radians, + = clockwise) and `nod` (fraction of the
		 * height, + = down).
		 */
		/** `tiltRange` ([min, max] radians, + = clockwise) and `maxLift` (fraction of the height) cap how
		 *  far the head turns and rises off its rest pose, where moving further uncovers the seam round
		 *  the neck. */
		head?: { key: string; rect: FrameRect; px: number; py: number; tilt?: number; nod?: number; tiltRange?: [number, number]; maxLift?: number };
		/** Soft torso (game/bodyFlex): the body is drawn as a mesh bent by this field, and the head and
		 *  every extra ride the field at their pivot. `flexState` is the parent's (one breath for the
		 *  body and anything it draws outside, like a held bottle). */
		flex?: BodyFlex;
		flexState?: FlexState;
		/** A hat on that head that can hop off it: lifted `dy` (fraction of the height, − = up) and
		 *  tipped `rot` about its brim pivot (px, py, figure fractions), squashed by `sy`. */
		hat?: {
			key: string;
			rect: FrameRect;
			px: number;
			py: number;
			dy: number;
			rot: number;
			sy: number;
		};
	};
	const props: Props = $props();

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			clock = ts - start + (props.phase ?? 0);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Glance (saccades): long holds, quick moves. Offsets are fractions of the figure w/h.
	const GLANCE_PERIOD = 5600;
	const KF = [
		{ t: 0.0, x: 0, y: 0 },
		{ t: 0.4, x: 0, y: 0 },
		{ t: 0.45, x: 0.0045, y: -0.002 }, // quick glance to his left/up (tiny — pupils stay well inside the sclera)
		{ t: 0.66, x: 0.0045, y: -0.002 },
		{ t: 0.71, x: 0.0025, y: 0.003 }, // then down a touch
		{ t: 0.9, x: 0.0025, y: 0.003 },
		{ t: 0.95, x: 0, y: 0 },
		{ t: 1.0, x: 0, y: 0 },
	];
	const glanceAt = (t: number) => {
		const f = (((t % GLANCE_PERIOD) + GLANCE_PERIOD) % GLANCE_PERIOD) / GLANCE_PERIOD;
		for (let i = 0; i < KF.length - 1; i++) {
			if (f >= KF[i].t && f <= KF[i + 1].t) {
				const u = (f - KF[i].t) / (KF[i + 1].t - KF[i].t);
				const s = u * u * (3 - 2 * u); // smoothstep
				return {
					x: KF[i].x + (KF[i + 1].x - KF[i].x) * s,
					y: KF[i].y + (KF[i + 1].y - KF[i].y) * s,
				};
			}
		}
		return { x: 0, y: 0 };
	};
	const glance = $derived(glanceAt(clock));

	// Blink: a quick lid drop (0 → 1 → 0 over ~140ms), with an occasional double blink.
	const BLINK_PERIOD = 4300;
	const blink = $derived.by(() => {
		const t = clock % BLINK_PERIOD;
		const pulse = (start: number, dur: number) => {
			if (t < start || t > start + dur) return 0;
			const u = (t - start) / dur;
			return 1 - Math.abs(u * 2 - 1); // triangle 0 → 1 → 0
		};
		return Math.max(pulse(BLINK_PERIOD - 520, 150), pulse(BLINK_PERIOD - 250, 130));
	});

	const left = $derived(props.x - props.width / 2);
	const top = $derived(props.y - props.height / 2);
	const z = $derived(props.zIndex ?? 0);
	const baseRect = $derived(props.baseRect ?? FULL_FRAME);
	const skin = $derived(props.skin ?? 0xf6ac67);
	const lidRest = $derived(props.lidRest ?? 0);
	const lidDrop = $derived(Math.max(lidRest + (1 - lidRest) * blink, props.squint ?? 0));
	const gaze = $derived.by(() => {
		const l = props.look;
		if (!l || l.weight <= 0) return glance;
		return { x: glance.x + (l.x - glance.x) * l.weight, y: glance.y + (l.y - glance.y) * l.weight };
	});

	// Head on its neck: the eyes lead, the head follows a beat later (HEAD_LAG_MS) and only part of
	// the way; under it a slow two-sine sway and a small nod riding the breath. Reaction tilt / nod add.
	const HEAD_LAG_MS = 170;
	const HEAD_FOLLOW = 4.5; // radians of tilt per figure-width of glance
	// Squash & stretch: the head flattens a touch as the chin drops fast and stretches as it pops up
	// (scaled about the neck, so the jaw edge stays put) — so it reads as flesh, not a rigid cut-out.
	const SQUASH_PER_SPEED = 3; // scale change per (fraction of the height per second) of nod speed
	const SQUASH_MAX = 0.02;
	// nod speed, smoothed (+ = down) — plain lets: per-frame bookkeeping, not reactive state
	let lastNod = 0;
	let lastClock = 0;
	let nodSpeed = 0;
	const headPose = $derived.by(() => {
		const h = props.head;
		if (!h) return null;
		const lagged = glanceAt(clock - HEAD_LAG_MS);
		const l = props.look;
		const eyeX = l && l.weight > 0 ? lagged.x + (l.x - lagged.x) * l.weight : lagged.x;
		const eyeY = l && l.weight > 0 ? lagged.y + (l.y - lagged.y) * l.weight : lagged.y;
		const sway = 0.014 * Math.sin(clock / 1730) + 0.006 * Math.sin(clock / 830 + 1.1);
		const breathNod = 0.0009 * Math.sin(clock / 580);
		const rot = sway + eyeX * HEAD_FOLLOW + (h.tilt ?? 0);
		const nod = breathNod + eyeY * 0.5 + (h.nod ?? 0);
		const [minTilt, maxTilt] = h.tiltRange ?? [-Infinity, Infinity];
		const nodNow = Math.max(-(h.maxLift ?? Infinity), nod);
		const dt = clock - lastClock;
		if (dt > 0 && dt < 250) nodSpeed += (((nodNow - lastNod) * 1000) / dt - nodSpeed) * Math.min(1, dt / 60);
		lastNod = nodNow;
		lastClock = clock;
		return {
			rot: Math.max(minTilt, Math.min(maxTilt, rot)),
			nod: nodNow,
			squash: Math.max(-SQUASH_MAX, Math.min(SQUASH_MAX, nodSpeed * SQUASH_PER_SPEED)),
			px: left + h.px * props.width,
			py: top + h.py * props.height,
		};
	});

	/** The torso field's displacement (px) at a figure point — zero without `flex`. */
	const flexOffset = (nx: number, ny: number) =>
		props.flex && props.flexState ? flexAt(props.flex, props.flexState, nx, ny, props.width, props.height) : { dx: 0, dy: 0 };
	const extraFlex = (e: Extra) => flexOffset(e.nx + e.nw * (e.px ?? 0.5), e.ny + e.nh * (e.py ?? 0.5));
	const neckFlex = $derived(props.head ? flexOffset(props.head.px, props.head.py) : { dx: 0, dy: 0 });

	const extraTilt = (e: Extra) => (e.bias ?? 0) + (e.amp ?? 0) * Math.sin((clock + (e.phase ?? 0)) / (e.period ?? 2600));

	// One scheduler per gesturing extra (plain map — it only holds each hand's next-gesture time).
	const gestures = new Map<string, ReturnType<typeof createPointGesture>>();
	const REST_POSE: HandPose = { angle: 0, along: 0, squash: 1 };
	const extraPoses = $derived(
		(props.extras ?? []).map((e) => {
			if (!e.gesture) return REST_POSE;
			let g = gestures.get(e.key);
			if (!g) gestures.set(e.key, (g = createPointGesture()));
			return g.pose(clock, e.gesture.breath ?? 0);
		}),
	);
	// Gesture angle is "+ = fingertip down"; on screen that's clockwise for a right-pointing hand.
	const extraRotation = (e: Extra, pose: HandPose) =>
		e.gesture ? (e.gesture.tip * pose.angle * Math.PI) / 180 : extraTilt(e);

	// Teeth *ding*: a white 4-point sparkle that flashes on a tooth now and then.
	const sparkle = $derived.by(() => {
		const sp = props.sparkle;
		if (!sp) return null;
		const period = sp.period ?? 3200;
		const p = (((clock + (sp.phase ?? 0)) % period) + period) % period / period;
		const fl = Math.exp(-(((p - 0.12) * 9) ** 2)); // quick flash 0 → 1 → 0 once per period
		return { x: left + sp.nx * props.width, y: top + sp.ny * props.height, s: fl * sp.size * props.width, a: fl };
	});
</script>

{#snippet eyes()}
	{#each props.pupils as p, i (i)}
		{@const d = Math.min(p.nw * props.width, p.nh * props.height) * 0.7}
		{@const cx = left + (p.nx + gaze.x) * props.width}
		{@const cy = top + (p.ny + gaze.y) * props.height}
		<!-- Clean dark disc (no cut-art outline) + a glint, sitting in the filled sclera. -->
		<Circle x={cx} y={cy} diameter={d} anchor={0.5} backgroundColor={0x15100e} zIndex={z} />
		<Circle
			x={cx - d * 0.2}
			y={cy - d * 0.24}
			diameter={d * 0.34}
			anchor={0.5}
			backgroundColor={0xffffff}
			backgroundAlpha={0.9}
			zIndex={z}
		/>
	{/each}
	{#if props.lids}
		{#each props.lids as l, i (i)}
			<!-- Skin lid drops from the eye top; overshoot onto surrounding skin is invisible (same colour). -->
			<Rectangle
				x={left + l.cx * props.width}
				y={top + (l.cy - l.h / 2) * props.height}
				anchor={{ x: 0.5, y: 0 }}
				width={l.w * props.width}
				height={lidDrop * l.h * props.height}
				borderRadius={Math.min(l.w * props.width, l.h * props.height) * 0.5}
				backgroundColor={skin}
				zIndex={z}
			/>
			<!-- Eyelid crease: a soft dark line riding the lid's lower edge so a full blink reads as a
			     closed eye (lids meeting) rather than a flat skin patch. -->
			<Rectangle
				x={left + l.cx * props.width}
				y={top + (l.cy - l.h / 2 + lidDrop * l.h) * props.height}
				anchor={0.5}
				width={l.w * props.width * (lidRest > 0 ? 0.9 : 0.82)}
				height={Math.max(2, l.h * props.height * (lidRest > 0 ? 0.1 : 0.07))}
				borderRadius={l.h * props.height * 0.05}
				backgroundColor={lidRest > 0 ? 0x1a0f0a : 0x3a2416}
				backgroundAlpha={lidRest > 0 ? 0.85 : blink * 0.7}
				zIndex={z}
			/>
		{/each}
	{/if}
{/snippet}

{#snippet extra(e: Extra, onBody = false)}
	{@const fl = onBody ? extraFlex(e) : { dx: 0, dy: 0 }}
	{#if e.flipX}
		<!-- mirrored inside its own box (anchor 1 - px keeps the box and the pivot where they were) -->
		<Container
			x={left + (e.nx + (e.nw * (e.px ?? 0.5))) * props.width + fl.dx}
			y={top + (e.ny + (e.nh * (e.py ?? 0.5))) * props.height + fl.dy}
			scale={{ x: -1, y: 1 }}
			rotation={-extraTilt(e)}
			zIndex={z}
		>
			<Sprite
				key={e.key}
				anchor={{ x: 1 - (e.px ?? 0.5), y: e.py ?? 0.5 }}
				width={e.nw * props.width * (e.sx ?? 1)}
				height={e.nh * props.height * (e.sy ?? 1)}
			/>
		</Container>
	{:else}
		<Sprite
			key={e.key}
			x={left + (e.nx + (e.nw * (e.px ?? 0.5))) * props.width + fl.dx}
			y={top + (e.ny + (e.nh * (e.py ?? 0.5)) + (e.key === props.browKey ? (props.brow ?? 0) : 0)) * props.height + fl.dy}
			anchor={{ x: e.px ?? 0.5, y: e.py ?? 0.5 }}
			width={e.nw * props.width * (e.sx ?? 1)}
			height={e.nh * props.height * (e.sy ?? 1)}
			rotation={extraTilt(e)}
			zIndex={z}
		/>
	{/if}
{/snippet}

{#snippet sparkleRays()}
	{#if sparkle && sparkle.a > 0.02}
		<!-- 4-point sparkle: a vertical + horizontal ray and a bright centre, all flashing together. -->
		<Rectangle x={sparkle.x} y={sparkle.y} anchor={0.5} width={sparkle.s * 0.15} height={sparkle.s} borderRadius={sparkle.s * 0.075} backgroundColor={0xffffff} backgroundAlpha={sparkle.a} zIndex={z} />
		<Rectangle x={sparkle.x} y={sparkle.y} anchor={0.5} width={sparkle.s} height={sparkle.s * 0.15} borderRadius={sparkle.s * 0.075} backgroundColor={0xffffff} backgroundAlpha={sparkle.a} zIndex={z} />
		<Circle x={sparkle.x} y={sparkle.y} diameter={sparkle.s * 0.42} anchor={0.5} backgroundColor={0xffffff} backgroundAlpha={Math.min(1, sparkle.a * 1.4)} zIndex={z} />
	{/if}
{/snippet}

{#if props.flex && props.flexState}
	<BodyMesh
		key={props.baseKey}
		{left}
		{top}
		width={props.width}
		height={props.height}
		rect={baseRect}
		flex={props.flex}
		state={props.flexState}
		zIndex={z}
	/>
{:else}
	<Sprite
		key={props.baseKey}
		x={left + (baseRect.nx + baseRect.nw / 2) * props.width}
		y={top + (baseRect.ny + baseRect.nh / 2) * props.height}
		anchor={0.5}
		width={baseRect.nw * props.width}
		height={baseRect.nh * props.height}
		zIndex={z}
	/>
{/if}
{#if props.head && headPose}
	{@const hr = props.head.rect}
	<!-- The head and everything on the face turn together about the neck (the container's pivot is
	     the neck in the same coordinates the children use, so they keep their usual placement). -->
	<Container
		x={headPose.px + neckFlex.dx}
		y={headPose.py + headPose.nod * props.height + neckFlex.dy}
		pivot={{ x: headPose.px, y: headPose.py }}
		rotation={headPose.rot}
		scale={{ x: 1 + 0.5 * headPose.squash, y: 1 - headPose.squash }}
		zIndex={z}
	>
		<Sprite
			key={props.head.key}
			x={left + (hr.nx + hr.nw / 2) * props.width}
			y={top + (hr.ny + hr.nh / 2) * props.height}
			anchor={0.5}
			width={hr.nw * props.width}
			height={hr.nh * props.height}
			zIndex={z}
		/>
		{#each props.headExtras ?? [] as e (e.key)}
			{@render extra(e)}
		{/each}
		{@render eyes()}
		{#each props.extras ?? [] as e (e.key)}
			{#if e.key === props.browKey}{@render extra(e)}{/if}
		{/each}
		{#if props.hat}
			{@const ht = props.hat}
			{@const hx = left + ht.px * props.width}
			{@const hy = top + ht.py * props.height}
			<Container x={hx} y={hy + ht.dy * props.height} rotation={ht.rot} scale={{ x: 1 / Math.sqrt(ht.sy), y: ht.sy }} zIndex={z}>
				<Sprite
					key={ht.key}
					x={left + (ht.rect.nx + ht.rect.nw / 2) * props.width - hx}
					y={top + (ht.rect.ny + ht.rect.nh / 2) * props.height - hy}
					anchor={0.5}
					width={ht.rect.nw * props.width}
					height={ht.rect.nh * props.height}
				/>
			</Container>
		{/if}
		{@render sparkleRays()}
	</Container>
	{#each props.extras ?? [] as e (e.key)}
		{#if e.key !== props.browKey}{@render extra(e, true)}{/if}
	{/each}
{:else}
	{@render eyes()}
	{#each props.extras ?? [] as e (e.key)}
		{@render extra(e)}
	{/each}
	{@render sparkleRays()}
{/if}

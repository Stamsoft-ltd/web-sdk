<script lang="ts" module>
	export type EmitterEventMysteryReveal =
		| { type: 'mysteryRevealShow' }
		| { type: 'mysteryRevealWon'; mode: 'BONUS' | 'SUPER' | 'HIDDEN'; freeSpins: number }
		| { type: 'mysteryRevealHide' };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';

	import { getContext } from '../game/context';
	import { designFrame } from '../game/designFrame';
	import { drawPadBulbGlow } from '../game/padBulbs';
	import { drawSlimeCluster, drawSlimeDrips } from '../game/slimeDrip';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';

	// The Mystery Bonus draw, in two beats:
	//
	//   1. THE ORB (Figma 9185:18451) — the machine holds a turning "?" while the draw resolves.
	//   2. THE CONGRATULATIONS (9185:14033) — the pad, the badge, and TWO boxes: the bonus that came
	//      out beside how many free spins it pays. This replaced the first cut (9185:18982/19244/
	//      19506), which put the name and its description in one wide well and named no count.
	//
	// The two are one component because they are one moment: the orb dissolves into the pad, and
	// splitting them would mean two copies of the same scrim, the same fit maths and the same clock.
	//
	// EVERYTHING is placed from the design's own 1200x670 frame coordinates through the shared
	// `designFrame` mapping, so the numbers in this file can be read straight off the Figma node
	// list — and WonPanel, which draws the same pad for the other two celebrations, places its own
	// copy the same way.
	const DESIGN_CX = 600;
	const DESIGN_CY = 335;
	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const D = $derived(designFrame(main, canvas));

	let phase = $state<'off' | 'orb' | 'won'>('off');
	let mode = $state<'BONUS' | 'SUPER' | 'HIDDEN'>('BONUS');
	let freeSpins = $state(0);
	const show = $derived(phase !== 'off');

	// One clock per beat: everything below is a pure function of it, so nothing here keeps its own
	// animation state (the WonPanel pattern). It restarts on each phase change, which is exactly
	// what the choreography wants — the congratulations entrance replays from zero.
	let clock = $state(0);
	$effect(() => {
		if (phase === 'off') return;
		// `phase` is read above, so this effect re-runs (and the clock re-zeros) on each beat.
		clock = 0;
		let raf = 0;
		const t0 = performance.now();
		const tick = (now: number) => {
			clock = (now - t0) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// The alien that peeks in is picked ONCE per reveal, not per frame: which of the two it is and
	// which edge it comes from are both random, and re-rolling them every frame would make it
	// flicker between four positions.
	let alienKey = $state<'myAlienA' | 'myAlienB'>('myAlienA');
	let alienFrom = $state<'bottom' | 'top' | 'left' | 'right'>('bottom');

	context.eventEmitter.subscribeOnMount({
		mysteryRevealShow: () => {
			alienKey = Math.random() < 0.5 ? 'myAlienA' : 'myAlienB';
			alienFrom = (['bottom', 'top', 'left', 'right'] as const)[Math.floor(Math.random() * 4)];
			phase = 'orb';
		},
		mysteryRevealWon: (emitterEvent) => {
			mode = emitterEvent.mode;
			freeSpins = emitterEvent.freeSpins;
			phase = 'won';
		},
		mysteryRevealHide: () => (phase = 'off'),
	});

	// ── Beat 1: the orb ────────────────────────────────────────────────────────────────────────
	// 9185:18614 orb 553x575 at 323,47 · 9185:18615 "?" 223x223 at 489,256 · four #9EF2FE 12px dots.
	const ORB = { x: 323, y: 47, w: 553, h: 575 };
	const Q = { x: 489, y: 256, w: 223, h: 223 };
	const DOTS = [
		{ x: 695, y: 262 },
		{ x: 726, y: 403 },
		{ x: 528, y: 273 },
		{ x: 507, y: 426 },
	];
	const DOT_D = 12;
	/** The whole machine is drawn at this fraction of the design's own size — at 1.0 the orb stood
	 *  82% of the frame's height and read as a full-screen takeover rather than a prop. Everything
	 *  in beat 1 scales about the FRAME CENTRE through `orbP`/`orbS`, so the composition holds. */
	const ORB_SCALE = 0.7;
	const orbP = (x: number, y: number) => ({
		x: D.px(DESIGN_CX + (x - DESIGN_CX) * ORB_SCALE),
		y: D.py(DESIGN_CY + (y - DESIGN_CY) * ORB_SCALE),
	});
	const orbS = (v: number) => D.s(v * ORB_SCALE);
	/** The machine drops in and settles. */
	const orbIn = $derived(Math.min(1, clock / 0.42));
	const orbPop = $derived(0.72 + 0.28 * (1 - (1 - orbIn) ** 3));
	// The "?" turns about its VERTICAL axis. A flat sprite scaled by cos(angle) does turn — it goes
	// edge-on and comes out mirrored, which is what the back of a "?" looks like — but it also goes
	// PAPER THIN half way round, because a flat thing has no thickness. So it is extruded: the mark
	// is drawn as a stack of slices through a slab, and each slice is offset by its own depth.
	//
	// For a slab of thickness d turning about Y, orthographically, a slice at depth z lands at
	// x += z*sin(angle) and keeps the face's own foreshortening, scale.x = cos(angle). At angle 0
	// every slice sits exactly on top of the next (no cost, reads as the flat mark); at 90 degrees
	// they fan out into the slab's SIDE, which is what stops it vanishing.
	const Q_SPIN_HZ = 0.3;
	const Q_DEPTH = 34; // design units of thickness
	const Q_SLICES = 11;
	const qTurn = $derived(clock * Q_SPIN_HZ * Math.PI * 2);
	const qFlip = $derived(Math.cos(qTurn));
	/** Back-to-front, so the near face is drawn last. Each entry carries how deep it is (0 = the far
	 *  back of the slab, 1 = the face nearest the viewer), which is also how it is shaded. */
	const qSliceDepths = $derived.by(() => {
		const zs = Array.from({ length: Q_SLICES }, (_, i) => (i / (Q_SLICES - 1) - 0.5) * Q_DEPTH);
		// A slice is nearer the viewer when z * cos(angle) is larger; sort ascending to draw it last.
		return zs.sort((a, b) => a * qFlip - b * qFlip);
	});
	/** It still rocks a little as it turns, so the spin does not read as a mechanical carousel. */
	const qRotation = $derived(Math.sin(clock * 1.3) * 0.09);
	const qScale = $derived(1 + 0.05 * Math.sin(clock * 2.6));

	// ── Beat 2: the congratulations ────────────────────────────────────────────────────────────
	// The design's three outcomes differ ONLY in the badge emblem and the copy, so one layout with a
	// per-mode row is the whole difference. The emblem sizes are the first cut's own measurements
	// scaled by 170.6/186 — the ring shrank when the layout gained its second box.
	const RING_F = 170.6 / 186;
	const WON = {
		BONUS: {
			badge: 'myBadgeGravity',
			badgeW: 172 * RING_F,
			badgeH: 122 * RING_F,
			name: 'SPLASH GRAVITY BREACH',
			desc: 'MYSTERY WON GRAVITY',
		},
		SUPER: {
			badge: 'myBadgeCore',
			badgeW: 145 * RING_F,
			badgeH: 145 * RING_F,
			name: 'SPLASH CORE OVERLOAD',
			desc: 'MYSTERY WON CORE',
		},
		HIDDEN: {
			badge: 'myBadgeZero',
			badgeW: 174 * RING_F,
			badgeH: 148 * RING_F,
			name: 'SPLASH ZERO POINT',
			desc: 'MYSTERY WON ZERO',
		},
	} as const;
	const won = $derived(WON[mode]);

	// Design placements, all of the 1200x670 frame.
	const PAD = { x: 20, y: 98, w: 1160, h: 515 };
	const TITLE = { cx: 600.5, cy: 252.5, size: 48 }; // Audiowide 400, #FFF
	const YOUWON = { cx: 600.5, cy: 319, size: 24 }; // Poppins 700, #FFF
	/** Left box: what you won. #492792 on a 2px #7E58D7 edge. */
	const NAME_BOX = { x: 306, y: 355, w: 378, h: 169, r: 18 };
	const NAME = { cx: 495, cy: 398, size: 36.45 }; // Audiowide 400, #1CB2FD
	const DESC = { cx: 495, cy: 466.5, size: 16, w: 326 }; // Poppins 400, #FFF
	/** Right box: how many spins it pays. Same plate, the lime edge instead. */
	const COUNT_BOX = { x: 699, y: 355, w: 200, h: 169, r: 18 };
	const COUNT = { cx: 799, cy: 428.5, size: 97.52 }; // Audiowide 400, #9FF816
	const COUNT_CAPTION = { cx: 799, cy: 494.5, size: 24 }; // Poppins 700, #9FF816
	const BADGE_RING = { cx: 602.8, cy: 108, d: 170.6 }; // #502DA0 on a 4.59px #B9F80F ring
	const SLIME_A = { cx: 529.6, cy: 62.3, w: 79.1, h: 79.1 };
	const SLIME_B = { cx: 681.1, cy: 136.6, w: 60.8, h: 70 };
	/** Where each blob's LOWEST ink sits in its own box (scanned off my_slime_a/b's alpha) — the
	 *  drips have to leave from there, or they detach out of thin air beside the blob. */
	const SLIME_A_DRIP = { x: 0.477, y: 0.799 };
	const SLIME_B_DRIP = { x: 0.275, y: 0.868 };
	/** Seconds per drip. The two blobs run on different periods so the badge never pulses in time
	 *  with itself; each blob carries two drips half a cycle apart (see game/slimeDrip.ts). */
	// The badge slime, drawn rather than placed. The lobes are FITTED to the sprites the design
	// shipped (my_slime_a / my_slime_b): largest inscribed circle, mask it out, repeat — so the
	// silhouette is the artist's, but it can creep and shed drops like the rest of the slime.
	// x and r are fractions of the box width, y of its height.
	const SLIME_A_LOBES = [
		{ x: -0.01, y: -0.025, r: 0.197 },
		{ x: -0.037, y: 0.153, r: 0.151 },
		{ x: 0.156, y: -0.091, r: 0.135 },
		{ x: -0.18, y: -0.083, r: 0.131 },
	];
	const SLIME_B_LOBES = [
		{ x: 0.043, y: 0.033, r: 0.221 },
		{ x: 0.222, y: -0.266, r: 0.191 },
		{ x: 0.198, y: -0.079, r: 0.191 },
		{ x: -0.031, y: 0.19, r: 0.16 },
		{ x: -0.321, y: 0.231, r: 0.16 },
	];
	const SLIME_A_PERIOD = 6.4;
	const SLIME_B_PERIOD = 7.9;
	const ALIEN = { w: 483.6, h: 461.7 };

	const LIME = 0x9ff816;

	// The choreography the user asked for, in order: the pad is already there, "CONGRATULATIONS!"
	// drops in from above, "YOU WON" pops up from nothing, then the boxes fade in under it, and an
	// alien slides in from a random edge.
	const T_TITLE = 0.0;
	const T_YOUWON = 0.34;
	const T_BOX = 0.62;
	const T_ALIEN = 0.8;
	const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
	const ease = (t: number) => 1 - (1 - clamp01(t)) ** 3;
	/** backOut, so the pop and the drop both overshoot a little before settling. */
	const backOut = (t: number) => {
		const c = 1.70158;
		const u = clamp01(t) - 1;
		return u * u * ((c + 1) * u + c) + 1;
	};

	const padIn = $derived(ease(clock / 0.3));
	const titleT = $derived(backOut((clock - T_TITLE) / 0.5));
	const titleY = $derived(D.py(TITLE.cy) - (1 - titleT) * D.s(320));
	const youWonT = $derived(backOut((clock - T_YOUWON) / 0.42));
	// "pop from almost 0 size" — 0.04, not 0, so the first drawn frame is a real glyph and not a
	// zero-size text object pixi would have nothing to rasterise for.
	const youWonScale = $derived(0.04 + 0.96 * youWonT);
	const boxT = $derived(ease((clock - T_BOX) / 0.4));
	const alienT = $derived(backOut((clock - T_ALIEN) / 0.62));
	/** Off-screen start for the alien, in main-container units, by the edge it was dealt. */
	const alienOff = $derived.by(() => {
		const w = D.s(ALIEN.w);
		const h = D.s(ALIEN.h);
		switch (alienFrom) {
			case 'top':
				return { x: 0, y: -(D.viewH * 0.5 + h) };
			case 'left':
				return { x: -(D.viewW * 0.5 + w), y: 0 };
			case 'right':
				return { x: D.viewW * 0.5 + w, y: 0 };
			default:
				return { x: 0, y: D.viewH * 0.5 + h };
		}
	});
	/** Where it comes to rest: tucked into the corner nearest the edge it flew in from. */
	const alienHome = $derived.by(() => {
		const w = D.s(ALIEN.w);
		const h = D.s(ALIEN.h);
		const x = D.viewW * 0.5 - w * 0.42;
		const y = D.viewH * 0.5 - h * 0.34;
		switch (alienFrom) {
			case 'top':
				return { x, y: -y };
			case 'left':
				return { x: -x, y };
			case 'right':
				return { x, y };
			default:
				return { x: -x, y };
		}
	});
	// The two headings keep breathing once they have landed — the plate waits several seconds before
	// it hands over, and a completely still one reads as a screenshot. Same treatment as WonPanel.
	const pulse = (landedAt: number, amount: number, rate: number) =>
		1 + amount * clamp01((clock - landedAt) / 0.5) * Math.sin((clock - landedAt) * rate);
	const titlePulse = $derived(pulse(T_TITLE + 0.5, 0.035, 2.4));
	const youWonPulse = $derived(pulse(T_YOUWON + 0.42, 0.05, 2.9));

	const alienX = $derived(
		main.width * 0.5 + alienHome.x + (1 - alienT) * (alienOff.x - alienHome.x),
	);
	const alienY = $derived(
		main.height * 0.5 + alienHome.y + (1 - alienT) * (alienOff.y - alienHome.y),
	);

	// The ship never stops flying. Once it has parked it keeps a slow hover — a bob, a roll off the
	// bob's own phase so the two never line up, and a shallow breath — plus the running lights
	// pulsing under its rim. Static art parked in a corner is the single thing that made these
	// screens read as a still frame with animation pasted on.
	const shipIdle = $derived(clamp01((clock - T_ALIEN - 0.5) / 0.9));
	const shipBob = $derived(D.s(11) * shipIdle * Math.sin(clock * 0.85));
	const shipRoll = $derived(0.03 * shipIdle * Math.sin(clock * 0.53 + 1.1));
	const shipBreathe = $derived(1 + 0.016 * shipIdle * Math.sin(clock * 1.35));

	const t = (key: string) => i18nDerived.translate(key);
	const audiowide = (fontSize: number, fill: number) => ({
		fontFamily: 'Audiowide, Chakra Petch, sans-serif',
		fontSize,
		fill,
		align: 'center' as const,
	});
	const poppins = (fontSize: number, fill: number, weight: '400' | '700') => ({
		fontFamily: 'Poppins, Inter, sans-serif',
		fontWeight: weight,
		fontSize,
		fill,
		align: 'center' as const,
	});
	// Localised names run longer than "Gravity Breach" — shrink to the box rather than spill out of
	// it (the same treatment the buy-menu confirm gives its title).
	const nameText = $derived(t(won.name));
	const nameSize = $derived(
		D.s(NAME.size) *
			fitTextScale(nameText, {
				fontSizePx: D.s(NAME.size),
				availablePx: D.s(NAME_BOX.w * 0.88),
				fontFamily: 'Audiowide, Chakra Petch, sans-serif',
				minScale: 0.45,
			}),
	);
	const captionText = $derived(t('FREE SPINS'));
	const captionSize = $derived(
		D.s(COUNT_CAPTION.size) *
			fitTextScale(captionText, {
				fontSizePx: D.s(COUNT_CAPTION.size),
				availablePx: D.s(COUNT_BOX.w * 0.88),
				fontFamily: 'Poppins, Inter, sans-serif',
				minScale: 0.4,
			}),
	);
</script>

<FadeContainer {show}>
	<!-- The design's own scrim (Rectangle 336) at the buy menu's 70% black — measured in-game as a
	     0.29x drop on the room behind it. It is the shared CanvasSizeRectangle rather than a
	     hand-drawn Graphics rect because every other celebration in this game (Win, FreeSpinOutro,
	     BonusHandoffVeil) dims with that one component, and a second way to draw the same rectangle
	     is a second thing to keep in step. -->
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.7} />

	<MainContainer>
		{#if phase === 'orb'}
			<!-- Beat 1 — the machine and its "?" -->
			{@const orbAt = orbP(ORB.x + ORB.w / 2, ORB.y + ORB.h / 2)}
			{@const qAt = orbP(Q.x + Q.w / 2, Q.y + Q.h / 2)}
			<Container x={orbAt.x} y={orbAt.y} scale={orbPop}>
				<Sprite key="myOrb" anchor={0.5} x={0} y={0} width={orbS(ORB.w)} height={orbS(ORB.h)} />
			</Container>
			{#each qSliceDepths as z, i (i)}
				{@const near = Q_SLICES > 1 ? i / (Q_SLICES - 1) : 1}
				<Container
					x={qAt.x + orbS(z) * Math.sin(qTurn)}
					y={qAt.y}
					rotation={qRotation}
					scale={{ x: orbPop * qScale * qFlip, y: orbPop * qScale }}
				>
					<!-- The slab's interior is the same mark in shadow; only the front face is lit, so
					     the extrusion reads as depth rather than as a smeared copy. -->
					<Sprite
						key="myQ"
						anchor={0.5}
						x={0}
						y={0}
						width={orbS(Q.w)}
						height={orbS(Q.h)}
						tint={near === 1 ? 0xffffff : 0x8a2f6a}
						alpha={near === 1 ? 1 : 0.55 + 0.45 * near}
					/>
				</Container>
			{/each}
			<!-- The four cyan motes inside the dome, twinkling out of phase with each other. -->
			{#each DOTS as dot, i (i)}
				<Graphics
					draw={(gr) => {
						gr.clear();
						const at = orbP(dot.x + DOT_D / 2, dot.y + DOT_D / 2);
						gr.circle(at.x, at.y, orbS(DOT_D / 2));
						gr.fill({
							color: 0x9ef2fe,
							alpha: orbIn * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(clock * 3 + i * 1.7))),
						});
					}}
				/>
			{/each}
		{:else if phase === 'won'}
			<!-- Beat 2 — the pad, then the copy, then an alien from a random edge -->
			<Container alpha={padIn}>
				<Sprite
					key="myPad"
					anchor={0.5}
					x={D.px(PAD.x + PAD.w / 2)}
					y={D.py(PAD.y + PAD.h / 2)}
					width={D.s(PAD.w)}
					height={D.s(PAD.h)}
				/>
				<!-- The pad's bulbs are painted flat in the art; this is the light they never had. -->
				<Graphics
					blendMode="add"
					draw={(gr) => {
						gr.clear();
						drawPadBulbGlow(gr, { px: D.px, py: D.py, s: D.s, clock, intensity: padIn });
					}}
				/>
			</Container>

			<!-- The alien sits BEHIND the pad's badge but in front of the pad itself, exactly as the
			     design layers it — half of it is cropped by the screen edge it came from. Once it has
			     landed it keeps hovering: bob, roll and breath on three phases that never line up, so
			     it never parks into a still. -->
			<Container
				x={alienX}
				y={alienY + shipBob}
				rotation={shipRoll}
				scale={shipBreathe}
				alpha={Math.min(1, alienT * 1.4)}
			>
				<Sprite
					key={alienKey}
					anchor={0.5}
					x={0}
					y={0}
					width={D.s(ALIEN.w)}
					height={D.s(ALIEN.h)}
				/>
			</Container>

			<Container x={D.px(TITLE.cx)} y={titleY} scale={titlePulse} alpha={Math.min(1, titleT * 1.6)}>
				<Text
					text={t('CONGRATULATIONS')}
					anchor={0.5}
					x={0}
					y={0}
					style={audiowide(D.s(TITLE.size), 0xffffff)}
				/>
			</Container>
			<Container x={D.px(YOUWON.cx)} y={D.py(YOUWON.cy)} scale={youWonScale * youWonPulse}>
				<Text
					text={t('YOU WON')}
					anchor={0.5}
					x={0}
					y={0}
					style={poppins(D.s(YOUWON.size), 0xffffff, '700')}
				/>
			</Container>

			<Container alpha={boxT}>
				<Graphics
					draw={(gr) => {
						gr.clear();
						gr.roundRect(
							D.px(NAME_BOX.x),
							D.py(NAME_BOX.y),
							D.s(NAME_BOX.w),
							D.s(NAME_BOX.h),
							D.s(NAME_BOX.r),
						);
						gr.fill({ color: 0x492792 });
						gr.stroke({ color: 0x7e58d7, width: Math.max(1, D.s(2)) });
						gr.roundRect(
							D.px(COUNT_BOX.x),
							D.py(COUNT_BOX.y),
							D.s(COUNT_BOX.w),
							D.s(COUNT_BOX.h),
							D.s(COUNT_BOX.r),
						);
						gr.fill({ color: 0x492792 });
						gr.stroke({ color: LIME, width: Math.max(1, D.s(2)) });
					}}
				/>
				<Text
					text={nameText}
					anchor={0.5}
					x={D.px(NAME.cx)}
					y={D.py(NAME.cy)}
					style={audiowide(nameSize, 0x1cb2fd)}
				/>
				<Text
					text={t(won.desc)}
					anchor={0.5}
					x={D.px(DESC.cx)}
					y={D.py(DESC.cy)}
					style={{
						...poppins(D.s(DESC.size), 0xffffff, '400'),
						wordWrap: true,
						wordWrapWidth: D.s(DESC.w),
						lineHeight: D.s(24),
					}}
				/>
				<Text
					text={`${freeSpins}`}
					anchor={0.5}
					x={D.px(COUNT.cx)}
					y={D.py(COUNT.cy)}
					style={audiowide(D.s(COUNT.size), LIME)}
				/>
				<Text
					text={captionText}
					anchor={0.5}
					x={D.px(COUNT_CAPTION.cx)}
					y={D.py(COUNT_CAPTION.cy)}
					style={poppins(captionSize, LIME, '700')}
				/>
			</Container>

			<!-- Badge: the lime ring, its emblem, and the two slime blobs stuck to it. Drawn last so
			     it sits over the pad's top edge the way the design hangs it. -->
			<Container alpha={padIn} scale={0.86 + 0.14 * padIn}>
				<Graphics
					draw={(gr) => {
						gr.clear();
						gr.circle(D.px(BADGE_RING.cx), D.py(BADGE_RING.cy), D.s(BADGE_RING.d / 2));
						gr.fill({ color: 0x502da0 });
						gr.stroke({ color: 0xb9f80f, width: Math.max(1, D.s(4.59)) });
					}}
				/>
				<Sprite
					key={won.badge}
					anchor={0.5}
					x={D.px(BADGE_RING.cx)}
					y={D.py(BADGE_RING.cy)}
					width={D.s(won.badgeW)}
					height={D.s(won.badgeH)}
				/>
				<!-- Slime runs off both blobs, drops first so each drape's outline closes over where its
				     drop leaves it. -->
				<Graphics
					draw={(gr) => {
						gr.clear();
						for (const blob of [
							{ box: SLIME_A, lobes: SLIME_A_LOBES, at: SLIME_A_DRIP, period: SLIME_A_PERIOD },
							{ box: SLIME_B, lobes: SLIME_B_LOBES, at: SLIME_B_DRIP, period: SLIME_B_PERIOD },
						]) {
							drawSlimeDrips(gr, {
								x: D.px(blob.box.cx - blob.box.w / 2 + blob.at.x * blob.box.w),
								y: D.py(blob.box.cy - blob.box.h / 2 + blob.at.y * blob.box.h),
								r: D.s(blob.box.w * 0.13),
								fall: D.s(150),
								edge: Math.max(1, D.s(3)),
								clock,
								period: blob.period,
							});
							drawSlimeCluster(gr, {
								lobes: blob.lobes.map((lobe) => ({
									x: D.px(blob.box.cx + lobe.x * blob.box.w),
									y: D.py(blob.box.cy + lobe.y * blob.box.h),
									r: D.s(lobe.r * blob.box.w),
								})),
								edge: Math.max(1, D.s(3)),
								clock: clock + blob.period,
								sag: 0.55,
								highlights: [
									{ lobe: 0, size: 0.36 },
									{ lobe: 2, size: 0.26 },
								],
							});
						}
					}}
				/>
			</Container>
		{/if}
	</MainContainer>
</FadeContainer>

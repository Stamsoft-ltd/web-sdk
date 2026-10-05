<script lang="ts">
	import { Container, Graphics, PIXI, Sprite, Text } from 'pixi-svelte';
	import { potState } from '../game/potState.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	import { squirtHash, type SquirtGraphics } from '../game/ketchupSquirt';

	import { getContext } from '../game/context';
	import { mascotIdle } from '../game/mascotIdle';
	import AnimatedGuy, { GUY_CROPS, cropPivot, cropRect } from './AnimatedGuy.svelte';

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
	const guyWidth = $derived(
		Math.max(fullWidth * 0.8, Math.min(fullWidth, (canvas.width - EDGE - boardRight) / 0.93)),
	);
	const guyHeight = $derived(guyWidth * (425 / 358));
	const cx = $derived(canvas.width - EDGE - guyWidth / 2);
	// Stand him so the pot's rim sits ≈80% down the frame: anchored to the screen bottom instead, the
	// rim covered his nametag.
	// The soup pot is the multiplier display, so it's bigger than before (0.98 of the frame, was 0.82)
	// and stands with its BASE (and the multiplier plaque on it) just above the desktop nav bar — the
	// bar's top is H − 166.7·u (HudHtml: 77 design px of bar + 36u margin, u = min(93vw, 1860)/1860).
	const potWidth = $derived(guyWidth * 0.98);
	const potHeight = $derived(potWidth * (914 / 1271)); // special-pot-v2 (label-free pot)
	const navTop = $derived(canvas.height - 166.7 * (Math.min(canvas.width * 0.93, 1860) / 1860));
	// He stands anchored to 0.82·H; the pot's rim sits just under his pointing hand (the hand's bottom
	// is 80.4% down his frame), so the hand reads clearly while the pot covers his lower body.
	const guyY0 = $derived(canvas.height * 0.82 - (guyWidth * 0.82 * (848 / 1180)) / 2 + 0.02 * guyHeight - 0.3 * guyHeight);
	const potY0 = $derived(guyY0 - guyHeight / 2 + 0.804 * guyHeight - potHeight * 0.3 + potHeight / 2);
	// Design (8274:11059): the WHOLE pot stands clear above the nav bar (its painted base ends 97% down
	// the sprite), so the multiplier on its front is fully visible. Where that pot would tuck behind the
	// bar, the pot AND the chef are lifted together — the hand stays resting on the rim.
	const lift = $derived(Math.max(0, potY0 + potHeight * 0.47 + potHeight * 0.04 - navTop));
	const potY = $derived(potY0 - lift);
	const potX = $derived(cx - guyWidth * 0.02);
	// (the chef only as far as his hat — ≈3% above his frame — stays on screen, on short windows)
	const guyY = $derived(guyY0 - Math.min(lift, Math.max(0, guyY0 - 0.53 * guyHeight - 6)));

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

	// Clock: drives both the salt fall (phase) and the chef's idle breathe (elapsed).
	const COUNT = 90; // salt grains — a dense, fine pour
	let phase = $state(0);
	let elapsed = $state(0);
	$effect(() => {
		let raf = 0;
		let start = 0;
		const loop = (ts: number) => {
			if (!start) start = ts;
			elapsed = ts - start;
			phase = (((elapsed / 1200) % 1) + 1) % 1;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	// Subtle idle breathe/bob for the chef (he's mid-salt, so no big lean — just a living breath). The
	// pot stays planted on the ground; only the guy + his salt origin drift.
	const guyPose = $derived(
		mascotIdle(elapsed, cx, guyY, guyWidth, guyHeight, { sway: 0, breathe: 0.005, bob: 0.004 }),
	);

	// The salt-shaker forearm is overlaid on the base and flicks gently so it reads as shaking; salt
	// pours from the (moving) cap. The pivot sits ON the joint strip that's baked into the base, so
	// the connection region never diverges from the painted joint (seamless), while the shaker end —
	// far from the pivot — does the visible swinging. Frame fractions off the shared frame.
	const SHAKE_PERIOD = 560; // ms per flick
	const SHAKE_AMP = 0.022; // rad (~1.3°) — gentle, smooth
	const shakeP = $derived((elapsed % SHAKE_PERIOD) / SHAKE_PERIOD);
	const armAngle = $derived(SHAKE_AMP * Math.sin(2 * Math.PI * shakeP));
	const chefL = $derived(guyPose.x - guyPose.width / 2);
	const chefT = $derived(guyPose.y - guyPose.height / 2);
	const PIVX = 0.452; // middle of the baked joint strip (frame fractions)
	const PIVY = 0.5;
	const pivotX = $derived(chefL + PIVX * guyPose.width);
	const pivotY = $derived(chefT + PIVY * guyPose.height);
	// The arm layer is cropped to its opaque box: same shoulder pivot, expressed inside the crop.
	const ARM_RECT = cropRect(GUY_CROPS.specialArm);
	const ARM_ANCHOR = cropPivot(GUY_CROPS.specialArm, PIVX, PIVY);
	// The cap's holes face sits at frame (0.352, 0.466) — salt exits right there.
	const CAP_DX = 0.352 - PIVX;
	const CAP_DY = 0.466 - PIVY;
	const saltTopX = $derived(pivotX + CAP_DX * guyPose.width * Math.cos(armAngle) - CAP_DY * guyPose.height * Math.sin(armAngle));
	const saltTopY = $derived(pivotY + CAP_DX * guyPose.width * Math.sin(armAngle) + CAP_DY * guyPose.height * Math.cos(armAngle));
	const saltBotX = $derived(cx - guyWidth * 0.12);
	const saltBotY = $derived(potY - potHeight * 0.18);
	const grain = $derived(Math.max(2, canvas.height * 0.0045));
	const grains = $derived(
		Array.from({ length: COUNT }, (_, i) => {
			const p = (phase + i / COUNT) % 1;
			// Free fall: grains leave the holes slowly and accelerate down (p² gravity), so they bunch
			// tight near the cap (a dense pour) and string out as they speed up toward the pot.
			const ease = p * p * 0.82 + p * 0.18;
			// Tight at the holes, fanning into a narrow cone on the way down.
			const dir = Math.sin(i * 2.3999); // deterministic spread direction (-1..1)
			const wob = Math.sin(i * 12.9898 + p * 9); // slight per-grain flutter as it falls
			const spread = grain * (0.35 + ease * 5.5);
			const x = saltTopX + (saltBotX - saltTopX) * ease + dir * spread + wob * grain * 0.35 * ease;
			const y = saltTopY + (saltBotY - saltTopY) * ease;
			const size = grain * (0.45 + ((i * 7) % 5) * 0.16); // fine, varied grains
			const fade = Math.min(1, p / 0.06) * (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1);
			// Density pulses with the flick AT THE MOMENT THIS GRAIN LEFT the shaker → salt bursts out on
			// each down-flick instead of an even stream.
			const releaseE = elapsed - p * 1200;
			const rf = 0.5 + 0.5 * Math.sin((2 * Math.PI * (((releaseE % SHAKE_PERIOD) + SHAKE_PERIOD) % SHAKE_PERIOD)) / SHAKE_PERIOD);
			const alpha = fade * (0.3 + 0.7 * rf) * (0.65 + (i % 3) * 0.15);
			return { x, y, size, alpha };
		}),
	);

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
	const multText = $derived(`×${potState.mult}`);
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
	let stampAt = $state(-1e9);
	let lastMult = potState.mult;
	$effect(() => {
		const m = potState.mult;
		if (m !== lastMult) {
			lastMult = m;
			stampAt = performance.now();
		}
	});
	const stamp = $derived.by(() => {
		const u = (performance.now() - stampAt) / 700;
		void elapsed; // re-evaluate each frame while the clock runs
		if (u < 0 || u > 1) return 1;
		return 1 + 0.35 * Math.exp(-5 * u) * Math.cos(u * Math.PI * 3);
	});
	const drawPlaque = (g: any) => {
		const w = boxW;
		const h = boxH;
		const b = Math.max(1, dk);
		g.roundRect(-w / 2, -h / 2, w, h, Math.min(20 * dk, h / 2)).fill({ color: 0xbcb7af }).stroke({ width: b, color: 0xc10c01, alignment: 1 });
	};

	// The soup simmers: a few bubbles swell on the surface and pop, on a loop. Positions are fixed per
	// bubble (spread across the surface ellipse) so they read as spots that keep bubbling, not drifting.
	const BUBBLE_N = 8;
	const BUBBLE_PERIOD = 2400; // ms per swell→pop
	const SOUP_CX = 0.47;
	const SOUP_CY = 0.33;
	const SOUP_RX = 0.29;
	const SOUP_RY = 0.075; // surface ellipse (pot fractions)
	const potLeft = $derived(potX - potWidth / 2);
	const potTop = $derived(potY - potHeight / 2);
	const bubbles = $derived.by(() =>
		Array.from({ length: BUBBLE_N }, (_, i) => {
			const p = (((elapsed / BUBBLE_PERIOD + i / BUBBLE_N) % 1) + 1) % 1;
			// Fixed spot per bubble: golden-angle spread inside the surface ellipse.
			const ang = i * 2.3999;
			const rad = 0.25 + 0.7 * (((i * 0.618) % 1 + 1) % 1);
			const bx = SOUP_CX + Math.cos(ang) * SOUP_RX * rad;
			const by = SOUP_CY + Math.sin(ang) * SOUP_RY * rad;
			const x = potLeft + bx * potWidth;
			const y = potTop + by * potHeight;
			// Swell to full by 55%, then pop (expand + fade) and rest until it swells again.
			const grow = Math.min(1, p / 0.5);
			const pop = p > 0.58 ? Math.min(1, (p - 0.58) / 0.22) : 0;
			const base = Math.max(3, potHeight * 0.03) * (0.55 + 0.45 * ((i * 7) % 3));
			const d = base * (0.35 + 0.65 * grow) * (1 + pop * 0.9);
			const fadeIn = Math.min(1, p / 0.06);
			const alpha = fadeIn * (pop > 0 ? Math.max(0, 1 - pop) : 1);
			return { id: i, x, y, d, alpha };
		}),
	);
	// Bubbles: a lighter-green dome + a soft highlight each, all in ONE Graphics.
	// Steam rises from the soup only (it used to drift up across the whole screen): soft puffs leave
	// the surface ellipse, swell, sway and fade as they climb over the chef.
	const STEAM_N = 7;
	const drawSteam = (gfx: SquirtGraphics) => {
		for (let i = 0; i < STEAM_N; i++) {
			const life = 3200 + 1800 * squirtHash(i * 3.1);
			const tt = elapsed + squirtHash(i * 8.7) * life;
			const k = Math.floor(tt / life);
			const p = (tt % life) / life;
			const sx = SOUP_CX + SOUP_RX * 0.8 * (2 * squirtHash(i * 1.9 + k * 4.3) - 1);
			const x0 = potLeft + sx * potWidth;
			const y0 = potTop + SOUP_CY * potHeight;
			const x = x0 + Math.sin(p * 4 + i * 1.7) * potWidth * 0.035 * p;
			const y = y0 - p * potHeight * (1.1 + 0.5 * squirtHash(i * 5.3 + k));
			const r = potWidth * (0.035 + 0.075 * p) * (0.8 + 0.4 * squirtHash(i * 2.2));
			const a = Math.min(1, p / 0.15) * (1 - p) * 0.2;
			for (let j = 0; j < 3; j++) {
				const ox = (j - 1) * r * 0.55;
				const oy = Math.sin(j * 2.1 + p * 3) * r * 0.2;
				gfx.circle(x + ox, y + oy, r * (0.75 + 0.2 * j)).fill({ color: 0xf2efe8, alpha: a });
			}
		}
	};
	const drawBubbles = (gfx: SquirtGraphics) => {
		for (const b of bubbles) {
			gfx.circle(b.x, b.y, b.d / 2).fill({ color: 0x8fc22a, alpha: b.alpha * 0.85 });
			gfx.circle(b.x - b.d * 0.16, b.y - b.d * 0.2, b.d * 0.17).fill({ color: 0xe7f5b8, alpha: b.alpha * 0.8 });
		}
	};
</script>

<!-- Chef (behind) salting the pot (in front), with a falling stream of salt grains. The whole group
     sits BEHIND the board (negative zIndex) but in front of the background. -->
<Container zIndex={-0.5}>
	<!-- Real chef base (no salting arm). Baked pupils are kept, so no fresh discs (pupils empty) — he
	     just BLINKS via skin lids. The nametag jiggles as an overlay (a touch larger than the baked
	     one so it stays covered), and a tooth *ding* sparkles. -->
	<AnimatedGuy
		baseKey="specialBase"
		baseRect={cropRect(GUY_CROPS.specialBase)}
		x={guyPose.x}
		y={guyPose.y}
		width={guyPose.width}
		height={guyPose.height}
		zIndex={0}
		pupils={specialPupils}
		lids={specialLids}
		lidRest={LID_REST}
		skin={0xef9650}
		phase={2000}
		sparkle={{ nx: 0.5, ny: 0.4, size: 0.06, period: 3800, phase: 1200 }}
		extras={[
			{ key: 'specialLabel', nx: 0.5643, ny: 0.5737, nw: 0.1984, nh: 0.1119, px: 0.5, py: 0.13, amp: 0.045, period: 320, phase: 900 },
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
	<Sprite
		key="specialPot"
		x={potX}
		y={potY}
		anchor={0.5}
		width={potWidth}
		height={potHeight}
		zIndex={2}
	/>
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
	<!-- Simmering bubbles on the soup surface: a lighter-green dome + a soft highlight, swelling and
	     popping. Above the pot so they read as sitting on the liquid. -->
	<Graphics zIndex={2.5} draw={drawBubbles} />
	<!-- Steam off the soup, over the pot and the chef. -->
	<Graphics zIndex={3} draw={drawSteam} />
</Container>

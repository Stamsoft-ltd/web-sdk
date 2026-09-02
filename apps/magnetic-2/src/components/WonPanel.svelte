<script lang="ts">
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import { drawTubeLight } from '../game/tubeLight';

	// The Version2 congratulations panel, shared by BOTH celebration screens:
	//   * FreeSpinIntro  — "YOU WON / 10 / FREE SPINS"      (Figma node 7022-6844)
	//   * FreeSpinOutro  — "YOU WON / [ $1,234.00 ]"        (Figma node 7069-9311)
	// They were two 400-line copies of the same popup and had drifted apart; everything visual now
	// lives here and the two designs differ only by the offsets/sizes selected below.
	//
	// The backdrop is ONE sprite (`fsWonFrame`) — the machine frame straight from the artist's
	// source, without the purple arcs the design mock layers over it (user's call). There is
	// deliberately NO ambient animation either: the lightning storm,
	// border runners, spark burst, entry flash, count pulse and heading glow were all removed on
	// request. The only motion is the design's two entry moves — the heading drops in from above and
	// the big value rises from below.
	type Props = {
		/** Drives the entry animation; the parent still owns the fade and the press handling. */
		show: boolean;
		/** The large value: a free-spin count, or the bonus total. */
		big: string;
		/** Optional line under the value ("FREE SPINS"); the outro has none. */
		caption?: string;
		/** Outro layout: the value sits in the design's black/violet plate instead of standing bare. */
		plate?: boolean;
	};
	const props: Props = $props();

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Visible canvas in main-container coordinates, so the frame is sized against the real screen.
	const viewW = $derived(canvas.width / (main.scale || 1));
	const viewH = $derived(canvas.height / (main.scale || 1));

	// Design: the frame art is 71.1% of the screen width and 72.4% of its height, centred
	// horizontally with its centre 43.2% down. Portrait has no width to spare, so it takes a larger
	// share there and the height cap does the limiting.
	const FRAME_ASPECT = 2048 / 1162;
	const frameW = $derived(
		Math.min(viewW * (isPortrait ? 0.94 : 0.711), viewH * 0.724 * FRAME_ASPECT),
	);
	const frameH = $derived(frameW / FRAME_ASPECT);
	const frameCY = $derived(main.height * 0.5 - viewH * (0.5 - 0.432));

	// Vertical offsets from the frame centre as fractions of the frame HEIGHT, and font sizes as
	// fractions of the frame WIDTH. Every number is a design node's own measurement against the art
	// box (x 171..1024.5, y 47..532 of the 1200x670 design screen).
	const TITLE_Y = $derived(props.plate ? -0.1557 : -0.1371);
	const WON_Y = $derived(props.plate ? -0.0299 : -0.0412);
	const BIG_Y = $derived(props.plate ? 0.1773 : 0.1309);
	const CAPTION_Y = 0.3196;
	// The design parks the press hint at 619.5 — ON TOP of its HUD mock. Ours would be hidden behind
	// the real HUD, so it sits in the gap between the frame's bottom edge and the bar.
	const PRESS_Y = 0.55;

	const TITLE_F = 0.05624; // 48px
	const WON_F = $derived(props.plate ? 0.037493 : 0.02812); // 32px / 24px
	const CAPTION_F = 0.02812; // 24px
	const BIG_F = $derived(props.plate ? 0.064224 : 0.14997); // 54.8px in the plate / 128px bare
	const PRESS_F = 0.02109; // 18px

	// Outro plate (Figma 7069:9370): 368.63 x 111, radius 16.44, 1.37px #D836FC border over a
	// bottom-lit violet-to-black gradient.
	const PLATE_W = 0.43191;
	const PLATE_H = 0.13005; // of the frame WIDTH, like every other size here
	const PLATE_R = 0.019266;

	// The design's value is "10" / "$1,234.00". Longer currency strings shrink to the space they
	// have — the plate's inner width, or the frame's interior when the value stands bare.
	const bigAvail = $derived(frameW * (props.plate ? PLATE_W * 0.86 : 0.6));
	const bigSize = $derived(
		frameW *
			BIG_F *
			fitTextScale(props.big, {
				fontSizePx: frameW * BIG_F,
				availablePx: bigAvail,
				fontFamily: 'Chakra Petch, Inter, sans-serif',
				letterSpacingEm: 0.035,
				minScale: 0.4,
			}),
	);

	// Figma: Chakra Petch Bold, 3% tracking, 0/2.78/2.78 black-25% shadow at a 24px design size.
	const textStyle = (fontSize: number, fill: number) => ({
		fontFamily: 'Chakra Petch, Inter, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
		dropShadow: {
			color: 0x000000,
			alpha: 0.25,
			angle: Math.PI / 2,
			distance: fontSize * 0.1158,
			blur: fontSize * 0.1158,
		},
	});

	// ── Entrance. The heading drops in from above, the value rises from below trailing it slightly
	//    so they read as one choreographed move rather than a single sliding block. Each LANDS with
	//    a stone-hit: the element squashes and springs back while the whole panel takes the knock
	//    (same weight cue as the splash's logo-plate drop). Afterwards the heading breathes. ──
	const ENTRY_MS = 620;
	const BIG_DELAY_MS = 160;
	const titleDrop = new Tween(0, { duration: ENTRY_MS, easing: backOut });
	const bigRise = new Tween(0, { duration: ENTRY_MS, easing: backOut });
	$effect(() => {
		if (!props.show) return;
		titleDrop.set(-viewH * 0.62, { duration: 0 });
		bigRise.set(viewH * 0.62, { duration: 0 });
		titleDrop.set(0);
		const timer = setTimeout(() => bigRise.set(0), BIG_DELAY_MS);
		return () => clearTimeout(timer);
	});

	// One clock for the impacts and the breathing — a single persistent rAF that tears down with the
	// component (the SymbolWinFx pattern). Everything below is a pure function of it.
	let clock = $state(0);
	$effect(() => {
		if (!props.show) return;
		// Reset on SHOW, never on hide. Everything below is a pure function of `clock`, and the parent
		// FADES this panel out rather than dropping it instantly — so zeroing the clock on dismiss
		// snapped `framePop` back to its 0.6 entry scale and the player watched the panel shrink for
		// the length of the fade before it vanished. Leaving the clock at its last value freezes the
		// settled pose under the fade; the next show re-zeros it and the entrance replays.
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

	const TITLE_LAND = ENTRY_MS / 1000;
	const BIG_LAND = (BIG_DELAY_MS + ENTRY_MS) / 1000;
	// Damped spring: full compression on contact, ringing out over ~0.5s.
	const impact = (dt: number) => (dt < 0 || dt > 0.55 ? 0 : Math.exp(-dt * 12) * Math.cos(dt * 34));
	const titleHit = $derived(impact(clock - TITLE_LAND));
	const bigHit = $derived(impact(clock - BIG_LAND));

	// The frame itself used to just appear at full size. It now rushes the camera: it starts small
	// and zooms out to its real size with a backOut overshoot, settling just before the heading lands
	// (user pass 2026-08-10). Only the ART and its lights scale — the heading and value keep their
	// own drop/rise entrances, so the whole thing reads as one choreographed move.
	// Driven off `clock` rather than a Tween: a Tween would need a set-to-start-then-set-to-end pair
	// in the same tick, and the second set reads the value BEFORE the first has committed, so the
	// zoom never played (measured — the frame was already full size 170ms in).
	const FRAME_POP_S = 0.52;
	const FRAME_POP_FROM = 0.6;
	const backOutEase = (t: number) => {
		const s = 1.70158;
		const u = t - 1;
		return u * u * ((s + 1) * u + s) + 1;
	};
	const framePop = $derived(
		FRAME_POP_FROM +
			(1 - FRAME_POP_FROM) * backOutEase(Math.min(1, Math.max(0, clock / FRAME_POP_S))),
	);

	// The heading keeps breathing once it has settled; the amplitude ramps in so there is no step
	// between the landing squash and the loop.
	const breathe = $derived(
		1 +
			0.04 *
				Math.min(1, Math.max(0, (clock - TITLE_LAND) / 0.5)) *
				Math.sin((clock - TITLE_LAND) * 2.4),
	);

	// Both landings knock the whole panel, so the frame itself carries the weight of the hit.
	const joltY = $derived(frameH * 0.016 * (titleHit * 0.55 + bigHit));

	// ── Live frame lights ──
	// The art's four cyan elements — the two pillar tubes and the top/bottom bars — are static in
	// the PNG, so they are lit here: a slow breathing bloom with a bright sparkle running along each
	// one's long axis. Boxes are fractions of the frame, measured off the asset by colour-keying its
	// hot cyan pixels (so they track the art exactly, at any size).
	// The art's four cyan elements (two pillar tubes + the top and bottom bars), as fractions of the
	// frame, found by colour-keying hot cyan in fs_won_frame.webp. Orientation is not stored: the
	// shared tube renderer takes the longer axis of the box as the tube's length.
	const LIGHTS = [
		{ cx: 0.0884, cy: 0.445, w: 0.0518, h: 0.2255, phase: 0 },
		{ cx: 0.9166, cy: 0.4432, w: 0.0459, h: 0.222, phase: 1.7 },
		{ cx: 0.502, cy: 0.1308, w: 0.2071, h: 0.0172, phase: 0.9 },
		{ cx: 0.5005, cy: 0.9501, w: 0.1944, h: 0.0206, phase: 2.6 },
	];

	// While a celebration is up the HTML HUD must not sit brightly on top of it — it is DOM, so the
	// pixi dim underneath cannot reach it. HudHtml dims and disables itself off this flag. The two
	// celebration screens never overlap, so one flag is enough.
	$effect(() => {
		context.stateGame.celebrationActive = props.show;
		return () => (context.stateGame.celebrationActive = false);
	});
</script>

<Container x={main.width / 2} y={frameCY + joltY}>
	<!-- Frame + its lights zoom out together from FRAME_POP_FROM to full size. -->
	<Container scale={framePop}>
		<Sprite key="fsWonFrame" anchor={0.5} width={frameW} height={frameH} />

		<!-- The art's cyan elements are painted flat, so they are lit here. A real tube is a very thin
		     white-hot core inside a wide soft halo that spills onto the metal around it, so the glow is
		     built from stacked layers with a power falloff (a few hard rectangles read as a sticker),
		     the brightness carries an irregular ballast flicker rather than a clean sine, and a soft
		     hotspot drifts back and forth INSIDE the tube instead of marching along it. -->
		<Graphics
			blendMode="add"
			draw={(g) => {
				g.clear();
				for (const l of LIGHTS) {
					drawTubeLight(g, {
						x: (l.cx - 0.5) * frameW,
						y: (l.cy - 0.5) * frameH,
						w: l.w * frameW,
						h: l.h * frameH,
						color: 0x3ce6ff,
						t: clock,
						phase: l.phase,
					});
				}
			}}
		/>
	</Container>

	<!-- The y offset lives on the CONTAINER and the text sits at its origin, so the squash and the
	     breathing scale about the heading's own centre instead of sliding it around. -->
	<Container
		y={frameH * TITLE_Y + titleDrop.current}
		scale={{ x: breathe * (1 + 0.14 * titleHit), y: breathe * (1 - 0.18 * titleHit) }}
	>
		<Text
			anchor={0.5}
			text={i18nDerived.translate('CONGRATULATIONS')}
			style={textStyle(frameW * TITLE_F, 0x2391c1)}
		/>
	</Container>

	<Text
		anchor={0.5}
		y={frameH * WON_Y}
		text={i18nDerived.translate('YOU WON')}
		style={textStyle(frameW * WON_F, 0xffffff)}
	/>

	<Container
		y={frameH * BIG_Y + bigRise.current}
		scale={{ x: 1 + 0.15 * bigHit, y: 1 - 0.2 * bigHit }}
	>
		{#if props.plate}
			<Graphics
				draw={(g) => {
					g.clear();
					const w = frameW * PLATE_W;
					const h = frameW * PLATE_H;
					const r = frameW * PLATE_R;
					// Bottom-lit violet fading to black (design gradient), then the magenta edge.
					const STEPS = 12;
					for (let i = 0; i < STEPS; i++) {
						const f = i / (STEPS - 1); // 0 = top (black) -> 1 = bottom (violet)
						const y0 = -h / 2 + (i * h) / STEPS;
						g.roundRect(-w / 2, y0, w, h / STEPS + 1, i === 0 || i === STEPS - 1 ? r : 0);
						g.fill({ color: (Math.round(26 * f) << 16) | (Math.round(5 * f) << 8) | Math.round(53 * f) });
					}
					g.roundRect(-w / 2, -h / 2, w, h, r);
					g.stroke({ width: Math.max(1, frameW * 0.0016), color: 0xd836fc, alpha: 0.95 });
				}}
			/>
		{/if}
		<!-- Bare value is the design's cyan (7022:6877); inside the plate it is white (7069:9371). -->
		<Text anchor={0.5} text={props.big} style={textStyle(bigSize, props.plate ? 0xffffff : 0x2391c1)} />
	</Container>

	{#if props.caption}
		<Text
			anchor={0.5}
			y={frameH * CAPTION_Y}
			text={props.caption}
			style={textStyle(frameW * CAPTION_F, 0xffffff)}
		/>
	{/if}

	<!-- Press hint: the text is RIGHT-anchored to a seam and the arrow starts just after it, so the
	     design's 7px gap holds however long the translated string runs. -->
	<Container y={frameH * PRESS_Y}>
		<Text
			anchor={{ x: 1, y: 0.5 }}
			x={frameW * 0.162}
			text={i18nDerived.translate('PRESS ANYWHERE')}
			style={textStyle(frameW * PRESS_F, 0xffffff)}
		/>
		<!-- The design's arrow is a plain 17px stroke (node 7022:6880), so it is drawn rather than
		     loaded: the old press_arrow.webp is previous-design art and, being a deferred asset, is
		     not resident on every path that shows these screens. -->
		<Graphics
			draw={(g) => {
				g.clear();
				const f = frameW * PRESS_F;
				const x0 = frameW * 0.1702;
				const x1 = x0 + f * 0.944;
				const head = f * 0.3;
				g.moveTo(x0, 0);
				g.lineTo(x1, 0);
				g.moveTo(x1 - head, -head * 0.72);
				g.lineTo(x1, 0);
				g.lineTo(x1 - head, head * 0.72);
				g.stroke({ width: Math.max(1, f * 0.1), color: 0xffffff, cap: 'round', join: 'round' });
			}}
		/>
	</Container>
</Container>

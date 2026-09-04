<script lang="ts">
	import { Container, Graphics, Sprite, Text, type Sizes } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { designFrame } from '../game/designFrame';
	import { drawPadBulbGlow } from '../game/padBulbs';
	import { drawSlimeBlob, drawSlimeDrips } from '../game/slimeDrip';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';

	// The MOTHERSHIP congratulations panel, shared by BOTH celebration screens:
	//   * FreeSpinIntro  — "CONGRATULATIONS! / YOU WON / 10 FREE SPINS"   (Figma 9185:13916)
	//   * FreeSpinOutro  — "CONGRATULATIONS! / YOU WON / $1,234.00"       (Figma 9185:13975)
	// One layout: the same pad, the same two headings and the same lime-edged value box. The only
	// difference is what goes IN the box — a count beside its caption, or a bare amount.
	//
	// This replaced the Version2 machine frame (7022-6844 / 7069-9311, the `fsWonFrame` sprite with
	// its four cyan tube lights). The new design is the purple pad the whole MOTHERSHIP popup family
	// uses, so the panel now shares `designFrame` with MysteryReveal — whose own congratulations beat
	// (9185:14033) is this same screen with a second box and a badge.
	type Props = {
		/** Drives the entry animation; the parent still owns the fade and the press handling. */
		show: boolean;
		/** The large value: a free-spin count, or the bonus total. */
		big: string;
		/** Present for the COUNT layout ("FREE SPINS" beside the number); absent for the amount. */
		caption?: string;
	};
	const props: Props = $props();

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const D = $derived(designFrame(main, canvas));

	// ── Design placements, all of the 1200x670 frame ───────────────────────────────────────────
	const PAD = { x: 20, y: 98, w: 1160, h: 515 };
	const TITLE = { cx: 600.5, cy: 252.5, size: 48 }; // Audiowide 400, #FFF
	const YOUWON = { cx: 600.5, cy: 319, size: 24 }; // Poppins 700, #FFF
	const BOX = { x: 342, y: 356, w: 520, h: 133, r: 12 }; // #492792 on a 3px #9FF816 edge
	/** Count layout: the number and its caption sit either side of the box's centre seam. */
	const COUNT = { size: 97.52, cy: 422 }; // Audiowide 400, #9FF816
	const COUNT_CAPTION = { size: 24, cy: 440 }; // Poppins 700, #9FF816
	const SEAM = 602; // the design's gap between the two, and the box's own centre
	/** Amount layout: one centred line. */
	const AMOUNT = { cx: 601.5, cy: 426.5, size: 63.52 }; // Audiowide 400, #9FF816
	/**
	 * The slime draped over the value box's top-right corner. Entirely DRAWN — the `my_blob` sprite
	 * (design 9185:13954) is gone, because a still blob sitting on top of animated drops read as two
	 * different materials meeting at a seam. The spine below traces that sprite's own centre-line,
	 * measured off its alpha and mapped back into the design's 1200x670 frame, so the drape lands
	 * where the design put it; the drops leave its last node.
	 */
	const BLOB_SPINE = [
		{ x: 817, y: 349 },
		{ x: 835, y: 362 },
		{ x: 838, y: 381 },
		{ x: 853, y: 395 },
		{ x: 860, y: 417 },
	];
	const BLOB_WIDTHS = [14, 17, 16, 17, 12];
	const DRIP_X = 860;
	const DRIP_Y = 421;
	/** The alien peeking over the top-right corner — mostly off-frame, exactly as the design crops it. */
	const ALIEN = { cx: 1155, cy: 50, w: 482.2, h: 482.2 };
	/** Centred under everything, below the pad entirely (the pad runs 98..613) — the HUD behind it
	 *  is dimmed for the length of the celebration, so this band is free. */
	const PRESS = { cy: 638, size: 18 };

	const LIME = 0x9ff816;

	// ── One clock, restarted on SHOW. Everything below is a pure function of it, so the panel keeps
	//    no animation state of its own (the MysteryReveal / SymbolWinFx pattern). ──────────────
	let clock = $state(0);
	$effect(() => {
		if (!props.show) return;
		// Reset on SHOW, never on hide: the parent FADES this panel out rather than dropping it, so
		// zeroing on dismiss would replay the entrance backwards underneath the fade.
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

	// The choreography the design's family shares: the pad is there first, "CONGRATULATIONS!" drops
	// in from above, "YOU WON" pops up from nothing, the value box fades in under it, and the alien
	// slides in over the top-right corner last.
	const T_TITLE = 0.0;
	const T_YOUWON = 0.34;
	const T_BOX = 0.62;
	const T_ALIEN = 0.8;
	const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
	const ease = (t: number) => 1 - (1 - clamp01(t)) ** 3;
	/** backOut, so the drop and the pop both overshoot a little before settling. */
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
	/** It comes from beyond the top-right corner and settles into the design's placement. */
	const alienX = $derived(D.px(ALIEN.cx) + (1 - alienT) * D.s(ALIEN.w * 0.9));
	const alienY = $derived(D.py(ALIEN.cy) - (1 - alienT) * D.s(ALIEN.h * 0.9));
	// Once it has landed it bobs, so the panel is never completely still while it waits for a press.
	const alienBob = $derived(D.s(11) * alienT * Math.sin((clock - T_ALIEN) * 0.85));
	// The hover, on its own phases so the bob, the roll and the breath never line up — a ship that
	// only bobs on one sine reads as a sprite on a spring.
	const alienRoll = $derived(0.03 * alienT * Math.sin(clock * 0.53 + 1.1));
	const alienBreathe = $derived(1 + 0.016 * alienT * Math.sin(clock * 1.35));
	// Two drips on the same cycle, half a period apart, so the blob is never doing nothing and never
	// doing two identical things at once. Each one swells at the tip, necks out, snaps, and falls.
	const DRIP_PERIOD = 6.4;
	const drips = $derived([0, 0.5].map((offset) => (((clock / DRIP_PERIOD + offset) % 1) + 1) % 1));

	// The two headings keep breathing once they have landed — the panel is waiting for a press, and
	// a completely still one reads as a screenshot. The amplitude ramps in from the landing so
	// neither steps out of its entrance.
	const pulse = (landedAt: number, amount: number, rate: number) =>
		1 + amount * clamp01((clock - landedAt) / 0.5) * Math.sin((clock - landedAt) * rate);
	const titlePulse = $derived(pulse(T_TITLE + 0.5, 0.035, 2.4));
	const youWonPulse = $derived(pulse(T_YOUWON + 0.42, 0.05, 2.9));

	const audiowide = (fontSize: number, fill: number) => ({
		fontFamily: 'Audiowide, Chakra Petch, sans-serif',
		fontSize,
		fill,
		align: 'center' as const,
	});
	const poppins = (fontSize: number, fill: number) => ({
		fontFamily: 'Poppins, Inter, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		fill,
		align: 'center' as const,
	});

	// The design's value is "10" / "$1,234.00". A 3-digit count or a long currency string shrinks to
	// the room it has instead of running out through the box's lime edge.
	const bigDesignSize = $derived(props.caption ? COUNT.size : AMOUNT.size);
	const bigAvail = $derived(BOX.w * (props.caption ? 0.42 : 0.86));
	const bigSize = $derived(
		D.s(bigDesignSize) *
			fitTextScale(props.big, {
				fontSizePx: D.s(bigDesignSize),
				availablePx: D.s(bigAvail),
				fontFamily: 'Audiowide, Chakra Petch, sans-serif',
				minScale: 0.4,
			}),
	);
	const captionText = $derived(props.caption ?? '');
	const captionSize = $derived(
		D.s(COUNT_CAPTION.size) *
			fitTextScale(captionText, {
				fontSizePx: D.s(COUNT_CAPTION.size),
				availablePx: D.s(BOX.w * 0.42),
				fontFamily: 'Poppins, Inter, sans-serif',
				minScale: 0.45,
			}),
	);

	/** Measured width of the press line, so the text and its arrow can be centred as one group. */
	let pressSizes = $state<Sizes>({ width: 0, height: 0 });

	// While a celebration is up the HTML HUD must not sit brightly on top of it — it is DOM, so the
	// pixi dim underneath cannot reach it. HudHtml dims and disables itself off this flag. The two
	// celebration screens never overlap, so one flag is enough.
	$effect(() => {
		context.stateGame.celebrationActive = props.show;
		return () => (context.stateGame.celebrationActive = false);
	});
</script>

<Container alpha={padIn} scale={0.94 + 0.06 * padIn}>
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
		draw={(g) => {
			g.clear();
			drawPadBulbGlow(g, { px: D.px, py: D.py, s: D.s, clock, intensity: padIn });
		}}
	/>
</Container>

<!-- The alien sits over the pad's top-right corner. Drawn before the copy so the headings stay
     legible if a narrow screen ever pushes them together. -->
<Container
	x={alienX}
	y={alienY + alienBob}
	rotation={alienRoll}
	scale={alienBreathe}
	alpha={Math.min(1, alienT * 1.4)}
>
	<Sprite key="myAlienB" anchor={0.5} x={0} y={0} width={D.s(ALIEN.w)} height={D.s(ALIEN.h)} />
</Container>

<!-- The y offset lives on the CONTAINER and the text sits at its origin, so the pulse scales about
     the heading's own centre instead of sliding it sideways. -->
<Container x={D.px(TITLE.cx)} y={titleY} scale={titlePulse} alpha={Math.min(1, titleT * 1.6)}>
	<Text
		text={i18nDerived.translate('CONGRATULATIONS')}
		anchor={0.5}
		x={0}
		y={0}
		style={audiowide(D.s(TITLE.size), 0xffffff)}
	/>
</Container>
<Container x={D.px(YOUWON.cx)} y={D.py(YOUWON.cy)} scale={youWonScale * youWonPulse}>
	<Text
		text={i18nDerived.translate('YOU WON')}
		anchor={0.5}
		x={0}
		y={0}
		style={poppins(D.s(YOUWON.size), 0xffffff)}
	/>
</Container>

<Container alpha={boxT}>
	<Graphics
		draw={(g) => {
			g.clear();
			g.roundRect(D.px(BOX.x), D.py(BOX.y), D.s(BOX.w), D.s(BOX.h), D.s(BOX.r));
			g.fill({ color: 0x492792 });
			g.stroke({ color: LIME, width: Math.max(1, D.s(3)) });
		}}
	/>

	{#if props.caption}
		<!-- Count layout: the number is RIGHT-anchored to the box's centre seam and the caption starts
		     just after it, so the design's gap holds however many digits the count runs to. -->
		<Text
			text={props.big}
			anchor={{ x: 1, y: 0.5 }}
			x={D.px(SEAM - 8)}
			y={D.py(COUNT.cy)}
			style={audiowide(bigSize, LIME)}
		/>
		<Text
			text={captionText}
			anchor={{ x: 0, y: 0.5 }}
			x={D.px(SEAM)}
			y={D.py(COUNT_CAPTION.cy)}
			style={poppins(captionSize, LIME)}
		/>
	{:else}
		<Text
			text={props.big}
			anchor={0.5}
			x={D.px(AMOUNT.cx)}
			y={D.py(AMOUNT.cy)}
			style={audiowide(bigSize, LIME)}
		/>
	{/if}

	<!-- The corner slime and its drops, drawn as ONE piece of material: the drops go down first so
	     the drape's outline closes over where each one leaves it. -->
	<Graphics
		draw={(g) => {
			g.clear();
			const edge = Math.max(1, D.s(3));
			drawSlimeDrips(g, {
				x: D.px(DRIP_X),
				y: D.py(DRIP_Y),
				r: D.s(13),
				fall: D.s(160),
				edge,
				clock,
				period: DRIP_PERIOD,
			});
			drawSlimeBlob(g, {
				spine: BLOB_SPINE.map((pt) => ({ x: D.px(pt.x), y: D.py(pt.y) })),
				widths: BLOB_WIDTHS.map((w) => D.s(w)),
				edge,
				clock,
				sag: D.s(26),
				highlights: [
					{ at: 0.18, size: 0.45 },
					{ at: 0.55, size: 0.36 },
					{ at: 0.85, size: 0.3 },
				],
			});
		}}
	/>
</Container>

<!-- Press hint. The design has no such line — it shows the real HUD there — so this sits at the
     bottom of the pad, above where our HTML bar reaches.
     TEXT AND ARROW ARE ONE CENTRED GROUP. Anchoring the text to a fixed seam with the arrow after it
     centres the SEAM, not the line, so the pair sat visibly left of centre and moved every time the
     translation changed length. The rendered width is measured instead and the group offset by half
     of it, which holds for any string. -->
<Container x={D.px(600.5)} y={D.py(PRESS.cy)} alpha={boxT}>
	{@const gap = D.s(PRESS.size) * 0.5}
	{@const arrow = D.s(PRESS.size) * 0.944}
	{@const total = pressSizes.width + gap + arrow}
	<Text
		anchor={{ x: 0, y: 0.5 }}
		x={-total / 2}
		onresize={(sizes) => (pressSizes = sizes)}
		text={i18nDerived.translate('PRESS ANYWHERE')}
		style={poppins(D.s(PRESS.size), 0xffffff)}
	/>
	<Graphics
		draw={(g) => {
			g.clear();
			const f = D.s(PRESS.size);
			const x0 = -total / 2 + pressSizes.width + gap;
			const x1 = x0 + arrow;
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

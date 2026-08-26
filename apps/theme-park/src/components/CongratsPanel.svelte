<script lang="ts" module>
	import { PAD_ASPECT, PAD_BULB, PAD_BULBS, PAD_FIELD_CENTRE } from '../game/padMarquee';
	import { CONGRATS_MARQUEES, type MarqueeArt } from '../game/congratsPanelParts';

	export type CongratsVariant = 'tall' | 'wide';

	/**
	 * The bonus-complete screen's art is the shared marquee PAD — the same sign the big-win cards
	 * sit on — rather than a second congratulations marquee of its own.
	 */
	const WIDE_ART: MarqueeArt = {
		aspect: PAD_ASPECT,
		bulbColour: PAD_BULB.colour,
		bulb: PAD_BULB.size,
		bulbs: PAD_BULBS,
	};
	const ART: Record<CongratsVariant, MarqueeArt> = {
		tall: CONGRATS_MARQUEES.tall,
		wide: WIDE_ART,
	};

	/** A width-unit offset from the art's centre, as the fraction-of-HEIGHT the layout speaks in. */
	const fromWidth = (offset: number) => 0.5 + offset * PAD_ASPECT;

	// === WHERE THE BONUS-COMPLETE COPY SITS ===
	// Off the pad's field rather than off the design frame's numbers: the pad is a different shape
	// from the marquee the design drew this screen on, so a fraction-of-height measured there lands
	// somewhere else on this sign. What transfers is the RELATIONSHIP the design has — the headline
	// on the field's centre line, YOU WON a fixed distance under it, the well tucked just below the
	// sign's foot — and those are widths, which do transfer.
	/** YOU WON below the headline, in pad widths. Figma 7032:19821: 457.4px under 382.3 on a 532 frame. */
	const WIDE_SUBTITLE_DROP = 0.07313;
	/** Daylight between the sign's foot and the top of the well. Figma: a hair over a pixel per 100. */
	const WIDE_WELL_GAP = 0.01347;
	const WIDE_WELL_HEIGHT = 0.225836;
	const WIDE_PAD_FOOT = 0.5 / PAD_ASPECT;
	const WIDE_WELL_CENTRE = WIDE_PAD_FOOT + WIDE_WELL_GAP + WIDE_WELL_HEIGHT / 2;

	/**
	 * The assembly is the sign PLUS the well hanging below it, and <FreeSpinOutro> has to cap its
	 * height against that — cap against the art alone and the well is what a short window pushes off
	 * the bottom.
	 */
	export const WIDE_ASSEMBLY_ASPECT = 1 / (WIDE_PAD_FOOT + WIDE_WELL_CENTRE + WIDE_WELL_HEIGHT / 2);
	/**
	 * And the assembly's middle is not the sign's, which is the point this component is positioned
	 * by. Lifted a little further still (the design's own nudge, 0.012 of the width) to keep the well
	 * clear of the HUD bar.
	 */
	export const WIDE_CENTRE_Y = -(
		(WIDE_WELL_CENTRE + WIDE_WELL_HEIGHT / 2 - WIDE_PAD_FOOT) / 2 +
		0.012
	);
</script>

<script lang="ts">
	import { Container, FillGradient, Graphics, Sprite, Text, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import WinCardLights from './WinCardLights.svelte';

	// The congratulations marquee, shared by both bonus screens.
	//
	// Two arrangements of one idea (Figma 7033:24761 bonus won, 7032:19821 bonus complete): a circus
	// marquee — purple field, gold rail of painted bulbs, striped tent top — with the copy inside it
	// and the number in a black well. `tall` is the bonus-won board and carries the whole story (the
	// bonus's name, its blurb, its symbol, the spins awarded); `wide` is the bonus-complete cloud and
	// carries only CONGRATS! / YOU WON, with the total in a well that hangs BELOW the marquee.
	//
	// The screen is assembled live so each piece gets its own entrance, the same way <WinCard> rebuilt
	// the win cards: the headline drops in from above, the symbol punches in from nothing, the well
	// swells up under it and the painted bulbs light.
	//
	// Everything is a pure function of `elapsed` off one clock rather than a Tween per element. With
	// this many overlapping delays, having the whole timeline readable in one block is worth more
	// than per-property interpolation.
	//
	// NOT drawn: the design's static confetti, on either screen. <WinConfettiRain> falls the same
	// scraps down the whole canvas instead (design ask, 2026-08-18) — the screens mount it, not this.
	//
	// The two are no longer the same piece of art: `tall` is still the design's own marquee
	// (game/congratsPanelParts.ts), `wide` is the shared PAD the big-win cards sit on
	// (game/padMarquee.ts). Both are flat-rail signs lit the same way, and both are placed by the
	// same fractions, so the component does not care which it is drawing.
	//
	// Sizes: `size` is the marquee's rendered WIDTH. Sizes below are fractions of that width; Y
	// positions are fractions of its HEIGHT, which is not the same number — the old panel was square
	// to within 0.2% and these are 0.87 and 1.83.

	type Props = {
		variant: CongratsVariant;
		/** Marquee width in the parent's units. */
		size: number;
		/** On screen. The dialogs keep this mounted and fade it, so the clock has to be gated. */
		active: boolean;
		/** Bumped by the parent to restart the choreography. */
		runId: number;
		/** The headline. */
		title: string;
		/** The line under it — 'YOU WON'. */
		subtitle?: string;
		/** `tall` only: the bonus's own name, under YOU WON. */
		name?: string;
		/** `tall` only: the feature blurb under the name. */
		desc?: string;
		/** `tall` only: the bonus's scatter symbol, between the blurb and the well. */
		centreKey?: string;
		/** Its width as a fraction of the marquee, and its art's aspect, so it is never stretched. */
		centreWidth?: number;
		centreAspect?: number;
		/** The line in the well: the spins awarded, or the total won. */
		wellText: string;
		/** `tall` only: the caption under the well — 'FREE SPINS'. */
		wellLabel?: string;
	};

	const {
		variant,
		size,
		active,
		runId,
		title,
		subtitle,
		name,
		desc,
		centreKey,
		centreWidth = 0.3,
		centreAspect = 448 / 360,
		wellText,
		wellLabel,
	}: Props = $props();

	const context = getContext();

	const art = $derived(ART[variant]);
	const artKey = $derived(variant === 'tall' ? 'congratsMarqueeTall' : 'congratsMarqueeWide');
	/** The marquees are deferred; until they land the old flat panel holds the place. */
	const artReady = $derived(!!context.stateApp.loadedAssets?.[artKey]);

	// === LAYOUT ===
	// Straight off the two Figma frames. `y` is a fraction of the marquee's height measured from its
	// top; everything else is a fraction of its width. The well's `y` on `wide` is past 1 because the
	// design hangs it below the art.
	const GOLD = 0xffba3e;
	/**
	 * Line spacing for the blurb, as a multiple of its own size. 1.35 when the blurb was two lines
	 * of small type and the leading was what kept it from looking like a solid block; 1.2, then 1.13,
	 * as it grew to three lines of larger type, where the leading is what the type grew out of. See
	 * the `desc` entry below.
	 */
	const DESC_LEAD = 1.1;
	const LAYOUT = {
		tall: {
			// Box 348,1 524x600 in frame 7033:24761 — but re-pinned down the column against the
			// marquee's OWN field, which is not the design frame's.
			//
			// THE SIGN WAS MADE TALLER TO HOLD THIS (2026-08-24). This is the fullest screen in the
			// game — headline, YOU WON, the bonus's name, a three-line blurb, its symbol, the well
			// and a caption, seven things in one column — and on the old 0.873 sign they did not
			// fit: the stack ran long, and the first thing off the end was CONGRATS! itself, drawn
			// across the top rail instead of inside the purple. Trimming gaps had already been
			// tried and there was nothing left to take.
			//
			// So `scripts/congrats/build_congrats.py` now cuts a two-bulb band out of the rail
			// instead of a six-bulb one, which leaves the canvas at 0.742 — a quarter more height
			// for the same width, all of it field. Every size below is still a fraction of the
			// marquee's WIDTH, so nothing grew; the extra height went entirely into the gaps.
			//
			// The stack is laid out against the FULL-WIDTH band of the field — 0.2833..0.8978 of
			// the art's height, i.e. 0.3818..1.2099 in width units, measured off marquee-tall.webp
			// (above 0.2833 the field is the arch's shoulders, which are too narrow for a line of
			// copy). Boxes total 0.686 of a width; the 0.142 left over is a 0.022 top margin, gaps
			// of 0.018-0.020 between the pieces and 0.014 under the well.
			title: { y: 0.33859, size: 0.09958, fill: GOLD, width: 0.74 },
			// YOU WON, +15% (design ask, 2026-08-26). It is the line that says what the screen is
			// and it was set smaller than the bonus's own name under it; the gaps either side of it
			// were the two roomiest above the blurb, and this is drawn from them.
			subtitle: { y: 0.40723, size: 0.048, fill: GOLD },
			// The bonus's name and its blurb are set LARGER than the rest of the column was laid out
			// for (design ask, 2026-08-24): they carry what the player actually needs to read off
			// this screen, and at the design's own ratio the blurb in particular came out as the
			// smallest type in the game. Name +14%.
			//
			// The room for that comes out of the two gaps around them, not out of anything else in
			// the column: the stack between YOU WON and the symbol is re-pinned so the blurb, the
			// name and the two gaps split that band evenly. Nothing above the name or below the
			// blurb moved.
			//
			// AND AGAIN, +12% (design ask, 2026-08-26), together with the blurb below it. The column
			// was already flush — the line BOXES of the stack touch, and the 12-25px of daylight the
			// note below describes is between the glyphs inside them, not between the boxes — so the
			// only place this could come from was the symbol again, and the three y's below are
			// re-pinned to split the band evenly at the new sizes. Nothing outside the band moves.
			name: { y: 0.46692, size: 0.0638, width: 0.78 },
			// THE BLURB (design ask, 2026-08-24, and again 2026-08-26). It is the smallest type on the
			// screen and the only line that says what the bonus actually does, so it is the one
			// worth spending the column's slack on. It has been raised repeatedly; what finally
			// made it read was not the font size at all.
			//
			// `maxHeight` IS WHAT WAS MAKING IT SMALL. It is a HEIGHT, not a line count, and the
			// blurb is scaled DOWN to fit it — so once the copy wrapped to one more line than the
			// box was cut for, every raise to `size` was cancelled by a matching scale-down and the
			// type on screen did not move. Measured on the shipped screen: Mega Coaster's blurb ran
			// to four lines against a box cut for three, so it rendered at 0.75 of its own size,
			// i.e. 0.031 of the marquee width when the value here said 0.041.
			//
			// So the box is now cut for FOUR lines and the size is what it says it is. That is
			// worth about a third on screen for both of the blurbs that have to wrap: Mega Coaster
			// and Roller Wilds each come in at exactly four lines and neither is scaled at all.
			// Duck Your Luck's is shorter and has always fitted.
			//
			// The room came out of the SYMBOL — `BADGE_WIDTH` in <FreeSpinIntro>, 0.24 down to 0.18
			// — and out of the blurb's own leading, DESC_LEAD 1.2 down to 1.1. There was nothing
			// else left: the line boxes of this stack touch, and the 12-25px of daylight between
			// the pieces is between the glyphs inside those boxes, not between the boxes.
			//
			// `width` is 0.78 rather than 0.72 because the field has the room — the bulb rail's
			// inner edges measure 0.808 apart on the render — and a wider measure is what keeps
			// these two blurbs at four lines instead of five.
			desc: { y: 0.57111, size: 0.0421, width: 0.78, maxHeight: 0.18524 },
			centre: { y: 0.69677 },
			well: {
				y: 0.79761,
				height: 0.118321,
				radius: 0.022901,
				text: 0.076336,
				padX: 0.045802,
				minWidth: 0.274714,
				maxWidth: 0.68,
				border: 0xb65df3,
				at: 1080,
			},
			label: { y: 0.87046, size: 0.048, width: 0.72 },
		},
		wide: {
			// Figma 7032:19821, re-pinned to the pad's field — see the module block.
			// GOLD, like the bonus-won board — not the white the first pass took from the design
			// render. The design's own spec for both lines is #FFBA3E; white was legible on the
			// purple field but it made the two congratulations screens look like different games.
			title: { y: fromWidth(PAD_FIELD_CENTRE), size: 0.073649, fill: GOLD, width: 0.7 },
			subtitle: {
				y: fromWidth(PAD_FIELD_CENTRE + WIDE_SUBTITLE_DROP),
				size: 0.041242,
				fill: GOLD,
			},
			name: undefined,
			desc: undefined,
			centre: undefined,
			well: {
				y: fromWidth(WIDE_WELL_CENTRE),
				height: WIDE_WELL_HEIGHT,
				radius: 0.033457,
				text: 0.111524,
				padX: 0.066915,
				minWidth: 0.75,
				maxWidth: 0.98,
				border: 0xd836fc,
				// Far earlier than on the bonus-won board, which has a symbol to punch in first. Here
				// the well IS the screen, and it is also where the total counts up, so a beat of
				// nothing before it appears would be a beat of the count-up nobody sees.
				at: 640,
			},
			label: undefined,
		},
	} as const;
	const L = $derived(LAYOUT[variant]);

	/** Well border, as a fraction of the marquee — the two designs differ by a third of a pixel. */
	const WELL_BORDER = 0.0024;

	// === TIMELINE (ms from the panel appearing) ===
	const PANEL = { at: 0, dur: 420 };
	const LIGHTS = { at: 260, dur: 620 };
	const TITLE = { at: 300, dur: 1000 };
	const SUBTITLE = { at: 460, dur: 950 };
	const NAME = { at: 620, dur: 420 };
	const DESC = { at: 780, dur: 400 };
	const CENTRE = { at: 900, dur: 900 };
	const WELL = $derived({ at: L.well.at, dur: 420 });
	const LABEL = $derived({ at: L.well.at + 180, dur: 380 });

	/** Where the headline starts, in marquee heights above its resting place — clear of the frame. */
	const TITLE_FROM = -0.95;
	const SUBTITLE_FROM = -0.55;

	let elapsed = $state(0);
	let seenRunId = -1;

	// Off the application ticker rather than a private rAF: a private rAF runs out of phase with the
	// frames <SceneAnimationDriver> actually renders, and the panel would judder against everything
	// else on screen.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (active) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	$effect(() => {
		if (runId === seenRunId) return;
		seenRunId = runId;
		elapsed = 0;
	});

	const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	const height = $derived(size / art.aspect);
	/**
	 * A marquee-HEIGHT fraction as an offset from its centre, which is where this component's origin
	 * sits (the art is drawn anchored 0.5). Differences between two fractions do not go through this
	 * — they are already relative.
	 */
	const fromY = (fraction: number) => (fraction - 0.5) * height;
	const at = (stage: { at: number; dur: number }) =>
		clamp01((elapsed * 1000 - stage.at) / stage.dur);
	/** Scale a measured line into the marquee width it was laid out for, never up. */
	const fitTo = (measured: number, width: number) =>
		measured > 0 ? Math.min(1, (width * size) / measured) : 1;

	/** Overshoot ease; `s` sets how far past the target it goes. */
	const backOut = (s: number) => (t: number) => {
		const u = t - 1;
		return 1 + (s + 1) * u ** 3 + s * u ** 2;
	};
	const softBack = backOut(1.6);

	/**
	 * A fall, not an ease-in-out — the same curve the win cards' wordmark drops on. backOut spends
	 * nearly all its travel in the first fifth of its duration, which for something coming in from
	 * off-panel means it has arrived before the eye finds it and the drop reads as a cut. This
	 * accelerates like gravity instead, lands a little past its mark and springs back once.
	 */
	const FALL = 0.66;
	const OVERSHOOT = 0.07;
	const gravityDrop = (t: number) => {
		if (t <= 0) return 0;
		if (t < FALL) return (1 + OVERSHOOT) * (t / FALL) ** 2;
		const u = (t - FALL) / (1 - FALL);
		return 1 + OVERSHOOT * (1 - u) ** 2 * Math.cos(u * Math.PI * 1.5);
	};

	/**
	 * "Zoom from very small to real size", as the win cards' P badge does — so this returns a SCALE,
	 * not a 0-1 ease: it grows from almost nothing to a quarter over, then settles back. Split in two
	 * so the peak stays where it was asked for rather than wherever a big-overshoot backOut put it.
	 */
	const PEAK = 1.24;
	const RISE = 0.45;
	const punchScale = (t: number) => {
		if (t <= 0) return 0.06;
		if (t < RISE) return lerp(0.06, PEAK, 1 - (1 - t / RISE) ** 3);
		return lerp(PEAK, 1, 1 - (1 - (t - RISE) / (1 - RISE)) ** 3);
	};

	// === MARQUEE ===
	const panelIn = $derived(softBack(at(PANEL)));
	const panelScale = $derived(lerp(0.66, 1, panelIn));
	const panelAlpha = $derived(clamp01(at(PANEL) * 3.5));
	/**
	 * A second copy of the marquee drawn additively. Additive blending scales with source brightness,
	 * so it blooms the bulbs and the gold rail and leaves the purple field alone: the whole frame
	 * breathes light for the cost of one sprite, and unlike a per-bulb glow it cannot land in the
	 * wrong place.
	 */
	const panelBloom = $derived(0.09 + 0.085 * Math.sin(elapsed * 3.2) * clamp01(at(LIGHTS)));
	const lightsIn = $derived(clamp01(at(LIGHTS)));
	/**
	 * Once the entrance is over the whole board keeps breathing. Every piece landing and then holding
	 * perfectly still read as a screenshot, however busy the lights underneath were — so the marquee,
	 * the headline and the symbol all keep a slow idle, on offset phases so they never pulse as one
	 * block.
	 */
	const IDLE_RATE = 2.1;
	/**
	 * Chase speed, in laps per second — a bulb flashes `speed * cycles` times a second, so this is
	 * 2.5 Hz. Deliberately under three: eighty bulbs going at once past that stops reading as a
	 * marquee and starts reading as a strobe.
	 */
	const CHASE_SPEED = 0.62;
	const settled = $derived(clamp01(at(WELL) * 2));
	const panelBreathe = $derived(1 + 0.006 * Math.sin(elapsed * IDLE_RATE * 0.7) * settled);

	// === HEADLINE ===
	const titleIn = $derived(gravityDrop(at(TITLE)));
	/** A gentle bob and swell after the drop — "make the congratulations text move a bit". */
	const titleIdle = $derived(Math.sin(elapsed * IDLE_RATE) * settled);
	const titleY = $derived(
		fromY(lerp(L.title.y + TITLE_FROM, L.title.y, titleIn) + titleIdle * 0.008),
	);
	/** Stretched on the way down, squashed on the landing — the impact the drop needs to sell it. */
	const titleSquash = $derived(Math.max(0, titleIn - 1) * 2.2);
	const titleStretch = $derived((1 - at(TITLE)) ** 2 * 0.2);
	const titleSwell = $derived(1 + 0.022 * Math.sin(elapsed * IDLE_RATE + 0.7) * settled);

	const subtitleIn = $derived(gravityDrop(at(SUBTITLE)));
	// Counter-phase to the headline, so the two lines drift apart and together rather than as a pair.
	const subtitleY = $derived(
		fromY(lerp(L.subtitle.y + SUBTITLE_FROM, L.subtitle.y, subtitleIn) - titleIdle * 0.004),
	);

	// === SYMBOL ===
	const centreIn = $derived(at(CENTRE));
	const centreIdle = $derived(1 + 0.03 * Math.sin(elapsed * 2.4) * clamp01(centreIn * 10 - 9));
	const centreScale = $derived(punchScale(centreIn) * centreIdle);

	// === WELL ===
	// Drawn rather than loaded: the design's well is a plain rounded plate whose WIDTH follows its
	// text (auto-layout with 24px padding), so it cannot be a fixed image — a three-digit spin count
	// or a long currency string has to widen it rather than overflow it.
	let wellTextWidth = $state(0);
	let titleWidth = $state(0);
	let nameWidth = $state(0);
	let labelWidth = $state(0);
	let descHeight = $state(0);
	const titleFit = $derived(fitTo(titleWidth, L.title.width));

	const wellIn = $derived(at(WELL));
	const wellHeight = $derived(L.well.height * size);
	const wellWidth = $derived(
		Math.min(
			L.well.maxWidth * size,
			Math.max(L.well.minWidth * size, wellTextWidth + 2 * L.well.padX * size),
		),
	);
	/** A line longer than the plate is allowed to grow to is scaled into it instead of clipped. */
	const wellFit = $derived(
		wellTextWidth > 0 ? Math.min(1, (wellWidth - 2 * L.well.padX * size) / wellTextWidth) : 1,
	);

	/**
	 * Figma: `linear-gradient(0deg, #1a0535 0%, #000 100%)` — 0deg runs bottom to top, so the plate is
	 * black at the top and lifts to a dark violet at the foot.
	 */
	const wellFill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x000000 },
			{ offset: 1, color: 0x1a0535 },
		],
		textureSpace: 'local',
	});

	const drawWell = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		const w = wellWidth;
		const h = wellHeight;
		graphics.roundRect(-w / 2, -h / 2, w, h, L.well.radius * size);
		graphics.fill(wellFill);
		graphics.stroke({
			color: L.well.border,
			width: Math.max(1, WELL_BORDER * size),
			alignment: 0.5,
		});
	};

	// Lilita One at 3% tracking (Figma: 1.5654px on 52.18px and so on down). It only ships one
	// weight, so the boldness is the face itself rather than a weight — asking for 900 would have the
	// browser synthesise a fake bold on canvas.
	const headingStyle = (fontSize: number, fill: number | FillGradient) => ({
		fontFamily: 'Lilita One',
		fontWeight: '400' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.03,
	});
	const shadow = (fontSize: number) => ({
		dropShadow: {
			color: 0x000000,
			alpha: 0.25,
			blur: 2,
			distance: fontSize * 0.053,
			angle: Math.PI / 2,
		},
	});
</script>

<!-- Every layer stays mounted and is driven by alpha: on this stage paint order is MOUNT order, so
     a layer mounted on demand would jump above the ones already there.
     ONLY THE ART is gated on the deferred marquee arriving. The copy is not: gating the whole screen
     meant that on a slow load the player got the fallback panel with nothing written on it, which
     reads as a broken dialog rather than as art still on its way. -->
<Container alpha={artReady ? 0 : 1}>
	<!-- Square art, so it is fitted INSIDE the marquee's box rather than stretched to it. -->
	{@const fallback = Math.min(size, height)}
	<Sprite key="bonusPanel" anchor={0.5} width={fallback} height={fallback} />
</Container>

<!-- `panelBreathe` is on the WHOLE board, text and symbol included, so it pulses as one object
     rather than the frame swelling around pieces that sit still. -->
<Container scale={panelBreathe}>
	<Container scale={panelScale} alpha={artReady ? 1 : 0}>
		<!-- Alpha does not prevent <Sprite> from resolving its key. Keep the deferred art unmounted
		     until AssetsLoader publishes it; otherwise the fallback works visually but Sprite logs a
		     false missing-key error during the deferred-load window. -->
		{#if artReady}
			<Sprite key={artKey} anchor={0.5} width={size} {height} alpha={panelAlpha} />
			<Sprite
				key={artKey}
				anchor={0.5}
				blendMode="add"
				width={size}
				{height}
				alpha={panelBloom * panelAlpha}
			/>
			<WinCardLights
				bulbs={art.bulbs}
				{size}
				colour={art.bulbColour}
				bulb={art.bulb}
				cycles={4}
				speed={CHASE_SPEED}
				intensity={lightsIn}
				{elapsed}
			/>
		{/if}
	</Container>

	{#if L.name && name}
		<Container y={fromY(L.name.y)} scale={fitTo(nameWidth, L.name.width)} alpha={at(NAME)}>
			<Text
				anchor={0.5}
				text={name}
				onresize={({ width }) => (nameWidth = width)}
				style={{
					fontFamily: 'Nunito Sans',
					fontWeight: '700',
					fontSize: Math.round(size * L.name.size),
					fill: 0xffffff,
					align: 'center',
					letterSpacing: size * L.name.size * 0.03,
					...shadow(size * L.name.size),
				}}
			/>
		</Container>
	{/if}

	{#if L.desc && desc}
		<!-- Scaled down rather than allowed to run into the symbol when a translation is longer than
		     the copy this was laid out for. -->
		{@const descMax = size * L.desc.maxHeight}
		<Container
			y={fromY(L.desc.y)}
			scale={descHeight > descMax ? descMax / descHeight : 1}
			alpha={at(DESC)}
		>
			<Text
				anchor={0.5}
				onresize={({ height: h }) => (descHeight = h)}
				text={desc}
				style={{
					fontFamily: 'Nunito Sans',
					fontWeight: '400',
					fontSize: Math.round(size * L.desc.size),
					fill: 0xffffff,
					align: 'center',
					letterSpacing: size * L.desc.size * 0.03,
					lineHeight: size * L.desc.size * DESC_LEAD,
					wordWrap: true,
					wordWrapWidth: size * L.desc.width,
				}}
			/>
		</Container>
	{/if}

	{#if L.centre && centreKey}
		<!-- Punching in from nothing, in the slot between the blurb and the well. -->
		<Container y={fromY(L.centre.y)} scale={centreScale} alpha={clamp01(centreIn * 6)}>
			<Sprite
				key={centreKey}
				anchor={0.5}
				width={centreWidth * size}
				height={(centreWidth * size) / centreAspect}
			/>
		</Container>
	{/if}

	<!-- `titleFit` is what lets the headline keep the design's size: English says CONGRATS!, but the
	     other sixteen locales have no short form and reuse their CONGRATULATIONS! translation, which
	     is up to two thirds longer. It scales the line down rather than letting it run off the rail. -->
	<Container
		y={titleY}
		scale={{
			x: (1 + titleSquash - titleStretch) * titleSwell * titleFit,
			y: (1 - titleSquash + titleStretch) * titleSwell * titleFit,
		}}
	>
		<Text
			anchor={0.5}
			text={title}
			onresize={({ width }) => (titleWidth = width)}
			style={{
				...headingStyle(Math.round(size * L.title.size), L.title.fill),
				stroke: { color: 0x2a0033, width: Math.max(1, size * 0.005) },
				...shadow(size * L.title.size),
			}}
		/>
	</Container>

	{#if subtitle}
		<Container y={subtitleY} alpha={clamp01(at(SUBTITLE) * 3.5)}>
			<Text
				anchor={0.5}
				text={subtitle}
				style={{
					...headingStyle(Math.round(size * L.subtitle.size), L.subtitle.fill),
					stroke: { color: 0x2a0033, width: Math.max(1, size * 0.004) },
					...shadow(size * L.subtitle.size),
				}}
			/>
		</Container>
	{/if}

	<!-- The well and its line swell up together; the plate is redrawn only when the line's measured
	     width changes it, never per frame. -->
	<Container
		y={fromY(L.well.y)}
		scale={lerp(0.86, 1, softBack(wellIn))}
		alpha={clamp01(wellIn * 2)}
	>
		<Graphics draw={drawWell} />
		<Container scale={wellFit}>
			<Text
				anchor={0.5}
				text={wellText}
				onresize={({ width }) => (wellTextWidth = width)}
				style={headingStyle(Math.round(size * L.well.text), GOLD)}
			/>
		</Container>
	</Container>

	{#if L.label && wellLabel}
		<Container
			y={fromY(L.label.y)}
			scale={fitTo(labelWidth, L.label.width)}
			alpha={clamp01(at(LABEL) * 2)}
		>
			<Text
				anchor={0.5}
				text={wellLabel}
				onresize={({ width }) => (labelWidth = width)}
				style={{
					...headingStyle(Math.round(size * L.label.size), GOLD),
					...shadow(size * L.label.size),
				}}
			/>
		</Container>
	{/if}
</Container>

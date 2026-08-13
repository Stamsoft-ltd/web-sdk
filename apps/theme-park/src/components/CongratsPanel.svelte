<script lang="ts">
	import { Container, FillGradient, Sprite, Text, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import {
		CONGRATS_PANEL_ASPECT,
		CONGRATS_PANEL_BULBS,
		CONGRATS_PANEL_BULB_COLOUR,
		CONGRATS_PARTS,
		CONGRATS_RING_BULBS,
		CONGRATS_RING_BULB_COLOUR,
	} from '../game/congratsPanelParts';
	import WinCardLights from './WinCardLights.svelte';

	// The congratulations panel (Figma 6909:9366), shared by both bonus screens.
	//
	// It replaces the flat neon square both of them used to draw. The redesign ships as separate
	// images — the marquee frame with its amount well built in, the medallion ring, and what goes
	// inside the ring — so the screen is assembled live and each piece gets its own entrance, the
	// same way <ThemeWinBoard> rebuilt the win cards: the headline drops in from above, the medallion
	// swings open, the badge inside it punches in from nothing, and the painted bulbs light.
	//
	// Everything is a pure function of `elapsed` off one clock rather than a Tween per element. With
	// this many overlapping delays, having the whole timeline readable in one block is worth more
	// than per-property interpolation.
	//
	// Sizes: `size` is the panel's rendered WIDTH, and every fraction in congratsPanelParts is of the
	// panel's box, which is 566x567 — square to within 0.2% — so one number scales the whole screen.

	type Props = {
		/** Panel width in the parent's units. */
		size: number;
		/** On screen. The dialogs keep this mounted and fade it, so the clock has to be gated. */
		active: boolean;
		/** Bumped by the parent to restart the choreography. */
		runId: number;
		/** The white headline. */
		title: string;
		/** The line under it — 'YOU WON', or the bonus's name. */
		subtitle?: string;
		/** Optional blurb between the subtitle and the medallion. */
		desc?: string;
		/**
		 * Whether to draw the medallion ring around the centre piece. Off for the bonus-won screen:
		 * the bonus's own badge is already a lit gold roundel, and framing one ring of bulbs with
		 * another just made both harder to read.
		 */
		ring?: boolean;
		/** What sits in the medallion's place: the gold P, or the bonus's own scatter symbol. */
		centreKey?: string;
		/** Its width as a fraction of the panel, and its art's aspect, so it is never stretched. */
		centreWidth?: number;
		centreAspect?: number;
		/** Scales the medallion slot down when the panel has a blurb to fit above it. */
		ringScale?: number;
		/** The line in the amount well. */
		wellText: string;
	};

	const {
		size,
		active,
		runId,
		title,
		subtitle,
		desc,
		ring = true,
		centreKey = 'congratsP',
		centreWidth = CONGRATS_PARTS.p.w,
		centreAspect = CONGRATS_PARTS.p.w / CONGRATS_PARTS.p.h,
		ringScale = 1,
		wellText,
	}: Props = $props();

	const context = getContext();

	/** The panel art is deferred; until it lands the old flat panel holds the place. */
	const partsReady = $derived(!!context.stateApp.loadedAssets?.congratsPanel);
	/**
	 * The centre piece only waits on that same stream when it is our own gold P. A bonus's scatter
	 * badge is loaded up front, so the bonus-won screen shows its symbol either way.
	 */
	const centreReady = $derived(centreKey !== 'congratsP' || partsReady);

	// === LAYOUT (fractions of the panel) ===
	// Two arrangements. `plain` is the design's, for the bonus-complete screen it was drawn for.
	// `withDesc` is the bonus-won screen's: that one has a bonus name AND a blurb to fit, which the
	// design's mock has no line for, so the block above the medallion tightens up and the medallion
	// gives way (the caller shrinks it with `ringScale`) rather than the blurb being dropped.
	const HEADINGS = {
		plain: { title: 0.1984, subtitle: 0.2857 },
		withDesc: { title: 0.165, subtitle: 0.245 },
	};
	const DESC_Y = 0.34;
	const DESC_WIDTH = 0.62;
	/** The blurb is scaled down to this height rather than allowed to reach the medallion. */
	const DESC_MAX_HEIGHT = 0.135;
	const WELL_Y = 0.8607;
	/** The well's inner width; a long currency string or a translated label is scaled to fit it. */
	const WELL_WIDTH = 0.66;
	const TITLE_SIZE = 0.0636;
	const SUBTITLE_SIZE = 0.0495;
	const DESC_SIZE = 0.028;
	const WELL_SIZE = 0.106;
	/** How far down the medallion drops when it is scaled to make room for a blurb. */
	const RING_SHIFT = 0.115;

	// === TIMELINE (ms from the panel appearing) ===
	const PANEL = { at: 0, dur: 420 };
	const LIGHTS = { at: 260, dur: 620 };
	const TITLE = { at: 300, dur: 1000 };
	const SUBTITLE = { at: 460, dur: 950 };
	const DESC = { at: 780, dur: 400 };
	const RING = { at: 520, dur: 620 };
	const CENTRE = { at: 950, dur: 900 };
	const WELL = { at: 1080, dur: 420 };

	/** Where the headline starts, in panel heights above its resting place — clear of the frame. */
	const TITLE_FROM = -0.95;
	const SUBTITLE_FROM = -0.55;

	let elapsed = $state(0);
	let seenRunId = -1;

	// Off the application ticker rather than a private rAF, for the same reason as
	// <PanelBorderLights>: a private rAF runs out of phase with the frames <SceneAnimationDriver>
	// actually renders, and the panel would judder against everything else on screen.
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
	/**
	 * A panel fraction as an offset from the panel's CENTRE, which is where this component's origin
	 * sits (the art is drawn anchored 0.5). Differences between two fractions do not go through this
	 * — they are already relative.
	 */
	const from = (fraction: number) => (fraction - 0.5) * size;
	const at = (stage: { at: number; dur: number }) => clamp01((elapsed * 1000 - stage.at) / stage.dur);

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

	const height = $derived(size / CONGRATS_PANEL_ASPECT);

	// === PANEL ===
	const panelIn = $derived(softBack(at(PANEL)));
	const panelScale = $derived(lerp(0.66, 1, panelIn));
	const panelAlpha = $derived(clamp01(at(PANEL) * 3.5));
	/**
	 * A second copy of the panel drawn additively. Additive blending scales with source brightness,
	 * so it blooms the bulbs, the neon rails and the gold and leaves the dark field alone: the whole
	 * frame breathes light for the cost of one sprite, and unlike a per-bulb glow it cannot land in
	 * the wrong place.
	 */
	const panelBloom = $derived(0.09 + 0.085 * Math.sin(elapsed * 3.2) * clamp01(at(LIGHTS)));
	const lightsIn = $derived(clamp01(at(LIGHTS)));
	/**
	 * Once the entrance is over the whole card keeps breathing. Every piece landing and then holding
	 * perfectly still read as a screenshot, however busy the lights underneath were — so the panel,
	 * the headline and the medallion all keep a slow idle, on offset phases so they never pulse as
	 * one block.
	 */
	const IDLE_RATE = 2.1;
	/**
	 * Chase speed, in laps per second — a bulb flashes `speed * cycles` times a second, so these are
	 * 2.5 and 1.2 Hz, up from the 1.5 and 0.6 this started at. Deliberately kept under three: a
	 * hundred and twenty bulbs going at once past that stops reading as a marquee and starts reading
	 * as a strobe.
	 */
	const PANEL_CHASE_SPEED = 0.62;
	const RING_CHASE_SPEED = 0.6;
	const settled = $derived(clamp01(at(WELL) * 2));
	const panelBreathe = $derived(1 + 0.006 * Math.sin(elapsed * IDLE_RATE * 0.7) * settled);

	// === HEADLINE ===
	const headings = $derived(desc ? HEADINGS.withDesc : HEADINGS.plain);
	const titleIn = $derived(gravityDrop(at(TITLE)));
	/** A gentle bob and swell after the drop — "make the congratulations text move a bit". */
	const titleIdle = $derived(Math.sin(elapsed * IDLE_RATE) * settled);
	const titleY = $derived(
		from(lerp(headings.title + TITLE_FROM, headings.title, titleIn) + titleIdle * 0.008),
	);
	/** Stretched on the way down, squashed on the landing — the impact the drop needs to sell it. */
	const titleSquash = $derived(Math.max(0, titleIn - 1) * 2.2);
	const titleStretch = $derived((1 - at(TITLE)) ** 2 * 0.2);
	const titleSwell = $derived(1 + 0.022 * Math.sin(elapsed * IDLE_RATE + 0.7) * settled);

	const subtitleIn = $derived(gravityDrop(at(SUBTITLE)));
	// Counter-phase to the headline, so the two lines drift apart and together rather than as a pair.
	const subtitleY = $derived(
		from(
			lerp(headings.subtitle + SUBTITLE_FROM, headings.subtitle, subtitleIn) -
				titleIdle * 0.004,
		),
	);

	// === MEDALLION ===
	const ringIn = $derived(softBack(at(RING)));
	const ringY = $derived(from(CONGRATS_PARTS.ringCentre.y + (1 - ringScale) * RING_SHIFT));
	/**
	 * Without a ring to swing open first, the centre piece takes the medallion's slot in the
	 * timeline as well as its place — held back to 950ms it would punch in after a beat of nothing.
	 */
	const centreStage = $derived(ring ? CENTRE : { at: RING.at, dur: CENTRE.dur });
	const centreIn = $derived(at(centreStage));
	const centreIdle = $derived(1 + 0.03 * Math.sin(elapsed * 2.4) * clamp01(centreIn * 10 - 9));
	const centreScale = $derived(punchScale(centreIn) * centreIdle);
	/** The medallion's own offsets, about its bulb circle rather than its box. */
	const ringOffsetY = $derived((CONGRATS_PARTS.ring.y - CONGRATS_PARTS.ringCentre.y) * size);
	const centreOffsetY = $derived((CONGRATS_PARTS.p.y - CONGRATS_PARTS.ringCentre.y) * size);

	// === WELL ===
	let wellWidth = $state(0);
	const wellFit = $derived(wellWidth > 0 ? Math.min(1, (size * WELL_WIDTH) / wellWidth) : 1);
	const wellIn = $derived(at(WELL));

	let descHeight = $state(0);

	// Figma 6909:9450 / 6909:9449 / 6541:4136: Lilita One at 3% tracking. It only ships one weight,
	// so the boldness is the face itself rather than a weight — asking for 900 would have the
	// browser synthesise a fake bold on canvas.
	const headingStyle = (fontSize: number, fill: number | FillGradient) => ({
		fontFamily: 'Lilita One',
		fontWeight: '400' as const,
		fontSize,
		fill,
		align: 'center' as const,
		letterSpacing: fontSize * 0.03,
	});

	// Figma: linear-gradient(163deg, #D836FC 0%, #272FDD 100%) on 'YOU WON'. Rendered as a near
	// vertical ramp — the design's angle over a single short line is all but vertical anyway.
	const subtitleFill = new FillGradient({
		type: 'linear',
		start: { x: 0.15, y: 0 },
		end: { x: 0.85, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xe45cff },
			{ offset: 1, color: 0x6a5cff },
		],
		textureSpace: 'local',
	});
	// Figma: linear-gradient(181deg, #E2D981 17.62%, #FBC503 60.04%, #D98503 102.47%) — the same
	// gold the win cards' amount uses.
	const wellFill = new FillGradient({
		type: 'linear',
		start: { x: 0.52, y: 0 },
		end: { x: 0.48, y: 1 },
		colorStops: [
			{ offset: 0.1762, color: 0xe2d981 },
			{ offset: 0.6004, color: 0xfbc503 },
			{ offset: 1, color: 0xd98503 },
		],
		textureSpace: 'local',
	});
</script>

<!-- Every layer stays mounted and is driven by alpha: on this stage paint order is MOUNT order, so
     a layer mounted on demand would jump above the ones already there.
     ONLY THE ART is gated on the deferred parts arriving. The copy is not: gating the whole screen
     meant that on a slow load the player got the fallback panel with nothing written on it, which
     reads as a broken dialog rather than as art still on its way. -->
<Container alpha={partsReady ? 0 : 1}>
	<Sprite key="bonusPanel" anchor={0.5} width={size} height={height} />
</Container>

<!-- `panelBreathe` is on the WHOLE card, text and medallion included, so it pulses as one object
     rather than the frame swelling around pieces that sit still. -->
<Container scale={panelBreathe}>
	<Container scale={panelScale} alpha={partsReady ? 1 : 0}>
		<Sprite key="congratsPanel" anchor={0.5} width={size} height={height} alpha={panelAlpha} />
		<Sprite
			key="congratsPanel"
			anchor={0.5}
			blendMode="add"
			width={size}
			height={height}
			alpha={panelBloom * panelAlpha}
		/>
		<WinCardLights
			bulbs={CONGRATS_PANEL_BULBS}
			{size}
			origin={{ x: 0.5, y: 0.5 }}
			colour={CONGRATS_PANEL_BULB_COLOUR}
			radius={0.031}
			cycles={4}
			speed={PANEL_CHASE_SPEED}
			intensity={partsReady ? lightsIn : 0}
			{elapsed}
		/>
	</Container>

	{#if desc}
		<!-- Scaled down rather than allowed to run into the medallion when a translation is longer
		     than the copy this was laid out for. -->
		{@const descMax = size * DESC_MAX_HEIGHT}
		<Container
			y={from(DESC_Y)}
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
					fontSize: Math.round(size * DESC_SIZE),
					fill: 0xe8dcff,
					align: 'center',
					lineHeight: size * DESC_SIZE * 1.15,
					wordWrap: true,
					wordWrapWidth: size * DESC_WIDTH,
				}}
			/>
		</Container>
	{/if}

	<!-- The medallion's slot. With a ring it swings open and the centre piece rides that swing; with
	     no ring the slot is just a place, and the centre piece punches into it on its own. -->
	<Container
		x={from(CONGRATS_PARTS.ringCentre.x)}
		y={ringY}
		scale={(ring ? lerp(0.3, 1, ringIn) : 1) * ringScale}
		rotation={ring ? (1 - ringIn) * -0.5 : 0}
		alpha={ring ? clamp01(at(RING) * 3.5) : 1}
	>
		{#if ring}
			<Sprite
				key="congratsRing"
				anchor={0.5}
				y={ringOffsetY}
				width={CONGRATS_PARTS.ring.w * size}
				height={CONGRATS_PARTS.ring.h * size}
				alpha={partsReady ? 1 : 0}
			/>
			<WinCardLights
				bulbs={CONGRATS_RING_BULBS}
				{size}
				origin={CONGRATS_PARTS.ringCentre}
				colour={CONGRATS_RING_BULB_COLOUR}
				radius={0.05}
				cycles={2}
				speed={RING_CHASE_SPEED}
				intensity={partsReady ? lightsIn : 0}
				{elapsed}
			/>
		{/if}

		<!-- Punching in from nothing. Offset to the ring's own centre only when there is a ring to
		     sit inside; on its own it takes the middle of the slot. -->
		<Container
			y={ring ? centreOffsetY : 0}
			scale={centreScale}
			alpha={clamp01(centreIn * 6) * (centreReady ? 1 : 0)}
		>
			<Sprite
				key={centreKey}
				anchor={0.5}
				width={centreWidth * size}
				height={(centreWidth * size) / centreAspect}
			/>
		</Container>
	</Container>

	<Container
		y={titleY}
		scale={{
			x: (1 + titleSquash - titleStretch) * titleSwell,
			y: (1 - titleSquash + titleStretch) * titleSwell,
		}}
	>
		<Text
			anchor={0.5}
			text={title}
			style={{
				...headingStyle(Math.round(size * TITLE_SIZE), 0xffffff),
				stroke: { color: 0x2a0033, width: Math.max(1, size * 0.006) },
				dropShadow: { color: 0x000000, alpha: 0.35, blur: 4, distance: size * 0.005, angle: Math.PI / 2 },
			}}
		/>
	</Container>

	{#if subtitle}
		<Container y={subtitleY} alpha={clamp01(at(SUBTITLE) * 3.5)}>
			<Text
				anchor={0.5}
				text={subtitle}
				style={{
					...headingStyle(Math.round(size * SUBTITLE_SIZE), subtitleFill),
					stroke: { color: 0x1b0033, width: Math.max(1, size * 0.005) },
				}}
			/>
		</Container>
	{/if}

	<!-- The amount well is painted into the panel art, so this only has to place the line in it. -->
	<Container y={from(WELL_Y)} scale={wellFit * lerp(0.86, 1, softBack(wellIn))} alpha={clamp01(wellIn * 2)}>
		<Text
			anchor={0.5}
			text={wellText}
			onresize={({ width }) => (wellWidth = width)}
			style={{
				...headingStyle(Math.round(size * WELL_SIZE), wellFill),
				stroke: { color: 0x000000, width: Math.max(1, Math.round(size * WELL_SIZE * 0.02)) },
			}}
		/>
	</Container>
</Container>

<script lang="ts" module>
	// === TIMELINE (ms from the card appearing) ===
	// In the module block so the impact — the beat the whole card is built around — can be read by
	// <Win>, which times the full-screen confetti rain off it.
	const PLATE = { at: 0, dur: 380 };
	const TEXT = { at: 240, dur: 620 };
	const AMOUNT = { at: 220, dur: 420 };
	const BULBS = { at: 200, dur: 500 };

	/** Where the wordmark starts, in card widths above its resting place — off the top of the screen. */
	const TEXT_FROM = -1.15;
	/** Share of the fall spent falling; the rest is the bounce back off the landing. */
	const FALL = 0.7;
	/** How far past its resting place the wordmark drives on impact, in its own heights. */
	const OVERSHOOT = 0.06;
	/** When the wordmark hits, in ms. Everything the impact sets off is timed off this. */
	export const CARD_IMPACT_MS = TEXT.at + TEXT.dur * FALL;

	/** The stars come in once the jolt of the landing has died down. */
	const STARS = { at: CARD_IMPACT_MS + 90, dur: 520 };
</script>

<script lang="ts">
	import { Container, Graphics, Sprite, Text, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import {
		MARQUEE_AMOUNT,
		MARQUEE_BULBS,
		MARQUEE_PLATE,
		MARQUEE_STAR,
		MARQUEE_TEXT,
		type MarqueeTier,
	} from '../game/winCardMarquee';
	import { AMOUNT_GOLD } from '../game/winCardText';
	import WinCardLights from './WinCardLights.svelte';

	// The big-win card: a circus marquee that gets hit.
	//
	// The choreography IS the design (Figma 7013:9117), in this order:
	//
	//   1. the tent plate pops up,
	//   2. the tier wordmark falls in from above the screen and LANDS — the card jolts like ground
	//      taking a dropped stone, the bulbs flash, and the wordmark squashes and springs back,
	//   3. that impact releases the full-screen confetti rain (<WinConfettiRain>, timed off
	//      CARD_IMPACT_MS by <Win>) — the design's static confetti fan around the plate is deliberately
	//      NOT drawn, so the screen has one moving paper vocabulary instead of a frozen one behind it,
	//   4. the two gold stars fly in from off the sides and settle onto the plate's shoulders,
	//   5. the amount plate rises underneath and the number counts up in it.
	//
	// Everything is a pure function of `elapsed`, one clock reset per win, rather than a Tween per
	// element: with this many pieces on overlapping delays, reading the timeline in one place is
	// worth more than the per-property interpolation Tween would give.

	type Props = {
		tier: MarqueeTier;
		winId: number;
		/**
		 * Width of the PLATE in the parent's units. Every part's rect is a fraction of it — see
		 * winCardMarquee.ts — so this one number scales the whole assembly.
		 */
		cardWidth: number;
		amountText: string;
		/**
		 * Whether the card is on screen. It stays MOUNTED between wins — <Win> keeps the last win's
		 * data and fades the container — so without this the clock would keep ticking and keep
		 * re-alphaing eighty bulb sprites through every ordinary spin.
		 */
		active: boolean;
	};

	const { tier, winId, cardWidth, amountText, active }: Props = $props();
	const context = getContext();

	const plateReady = $derived(!!context.stateApp.loadedAssets?.winMarqueePlate);
	/** Asset keys per tier, matching the keys registered in assets.ts. */
	const TEXT_KEY: Record<MarqueeTier, string> = {
		sweet: 'winMarqueeTextSweet',
		wild: 'winMarqueeTextWild',
		epic: 'winMarqueeTextEpic',
		mythic: 'winMarqueeTextMythic',
		legendary: 'winMarqueeTextLegendary',
	};

	let elapsed = $state(0);
	let seenWinId = -1;

	// One clock for the whole card, off the application ticker rather than a private rAF — the same
	// reason <PanelBorderLights> does: a private rAF runs out of phase with the frames
	// <SceneAnimationDriver> actually renders, and the card would judder against everything else.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (active) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	// A new win restarts the choreography. Reading winId is what subscribes this effect.
	$effect(() => {
		if (winId === seenWinId) return;
		seenWinId = winId;
		elapsed = 0;
	});

	const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	/** Progress through a stage, 0-1. */
	const at = (stage: { at: number; dur: number }, offset = 0) =>
		clamp01((elapsed * 1000 - stage.at - offset) / stage.dur);

	/** Overshoot ease. `s` sets how far past the target it goes; 1.70158 is the standard 10%. */
	const backOut = (s: number) => (t: number) => {
		const u = t - 1;
		return 1 + (s + 1) * u ** 3 + s * u ** 2;
	};
	const softBack = backOut(1.6);
	const outCubic = (t: number) => 1 - (1 - t) ** 3;

	/**
	 * A fall, not an ease-in-out. backOut spends nearly all its travel in the first fifth of its
	 * duration, which for something dropping in from off screen means it has already arrived before
	 * the eye finds it — the drop reads as a cut. This accelerates like gravity instead, drives a
	 * little past the target and springs back with one damped wobble.
	 */
	const gravityDrop = (t: number) => {
		if (t <= 0) return 0;
		if (t < FALL) return (1 + OVERSHOOT) * (t / FALL) ** 2;
		const u = (t - FALL) / (1 - FALL);
		return 1 + OVERSHOOT * (1 - u) ** 2 * Math.cos(u * Math.PI * 1.5);
	};

	// === IMPACT ===
	// The landing, as one 0-1 value that starts at 1 the frame the wordmark lands and decays away.
	// The shake, the bulb flash, the confetti and the squash all read from it, so they cannot drift
	// apart if the fall is retimed.
	const SHAKE_MS = 520;
	const SHAKE_FREQ = 21;
	/** Peak jolt, in card widths. Small on purpose: the card is big, and a big number reads as a bug. */
	const SHAKE_X = 0.006;
	const SHAKE_Y = 0.019;
	const sinceImpact = $derived(elapsed * 1000 - CARD_IMPACT_MS);
	const impactDecay = $derived(clamp01(1 - sinceImpact / SHAKE_MS) ** 2 * (sinceImpact > 0 ? 1 : 0));
	const shake = $derived({
		// Mostly vertical, and the horizontal component runs at a different rate so the card does not
		// simply travel along one diagonal.
		x: Math.sin((sinceImpact / 1000) * SHAKE_FREQ * 1.7) * SHAKE_X * impactDecay * cardWidth,
		y: Math.sin((sinceImpact / 1000) * SHAKE_FREQ) * SHAKE_Y * impactDecay * cardWidth,
	});

	// === PLATE ===
	const plateIn = $derived(softBack(at(PLATE)));
	const plateAlpha = $derived(clamp01(at(PLATE) * 3.5));
	/** A squat on impact — the plate takes the weight and gives, which is what sells the landing. */
	const plateSquash = $derived(impactDecay * 0.035 * Math.cos((sinceImpact / 1000) * SHAKE_FREQ));
	const plateScale = $derived({
		x: lerp(0.66, 1, plateIn) * (1 + plateSquash),
		y: lerp(0.66, 1, plateIn) * (1 - plateSquash),
	});
	/**
	 * A second copy of the plate drawn additively. Additive blending scales with source brightness,
	 * so this blooms the bulbs and the gold frame and leaves the dark purple field alone — the whole
	 * card breathes light for the cost of one sprite, and unlike the per-bulb glows it cannot land in
	 * the wrong place. It spikes on impact, then settles to a slow pulse.
	 */
	const plateBloom = $derived(
		(0.09 + 0.06 * Math.sin(elapsed * 2.2)) * clamp01(at(BULBS)) + impactDecay * 0.55,
	);

	// === WORDMARK ===
	const textRect = $derived(MARQUEE_TEXT[tier]);
	const textIn = $derived(gravityDrop(at(TEXT)));
	const textY = $derived(lerp(textRect.y + TEXT_FROM, textRect.y, textIn) * cardWidth);
	/** Squashed by how far it is driven past the landing, stretched by how fast it is still falling. */
	const textSquash = $derived(Math.max(0, textIn - 1) * 2.4 + impactDecay * 0.05);
	const textStretch = $derived((1 - at(TEXT)) ** 2 * 0.22);
	const textScale = $derived({
		x: 1 + textSquash - textStretch,
		y: 1 - textSquash + textStretch,
	});

	// === STARS ===
	// In from off the sides, spinning, landing on the plate's shoulders with a flare.
	const STAR_FROM = 1.6; // card widths out from the centre
	const starIn = $derived(softBack(at(STARS)));
	const starProgress = $derived(at(STARS));
	const starSettled = $derived(clamp01(starProgress * 4 - 3));
	const stars = $derived(
		[-1, 1].map((side) => ({
			side,
			x: lerp(side * STAR_FROM, side * MARQUEE_STAR.x, starIn) * cardWidth,
			y: MARQUEE_STAR.y * cardWidth,
			// Twinkle once landed: the star is one flat piece of art, so a slow breath and a slight
			// counter-rotation is what keeps it from reading as a sticker.
			scale:
				lerp(0.35, 1, starIn) * (1 + Math.sin(elapsed * 3.1 + side) * 0.06 * starSettled),
			rotation: (1 - starProgress) ** 2 * -side * 4.2 + Math.sin(elapsed * 1.4 + side) * 0.06 * starSettled,
			// A flash on arrival, additive over the star itself.
			flare: clamp01(1 - Math.abs(starProgress - 0.82) * 9) * 0.9,
			alpha: clamp01(starProgress * 5),
		})),
	);

	// === AMOUNT ===
	const amountIn = $derived(outCubic(at(AMOUNT)));
	const amountY = $derived(lerp(MARQUEE_AMOUNT.y + 0.08, MARQUEE_AMOUNT.y, amountIn) * cardWidth);
	const amountW = $derived(MARQUEE_AMOUNT.w * cardWidth);
	const amountH = $derived(MARQUEE_AMOUNT.h * cardWidth);
	/** Figma: 64px type on a 120px plate, so the plate's height is what sets the size. */
	const fontSize = $derived(amountH * (64 / 120.14));
	let amountTextWidth = $state(0);
	const amountScale = $derived(
		amountTextWidth > 0 ? Math.min(1, (amountW * 0.86) / amountTextWidth) : 1,
	);

	// Figma 7013:9284 — near-black plate, 2px violet edge, soft violet spill outside it.
	const PLATE_FILL = 0x04000e;
	const PLATE_EDGE = 0xaa34f4;
	const drawAmountPlate = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		const radius = amountH * 0.135;
		const line = Math.max(1.5, cardWidth * 0.0031);
		// Outward glow first, as a few strokes stepping out and fading — cheaper than a filter and it
		// cannot bleed onto the falling confetti behind.
		for (let step = 3; step >= 1; step -= 1) {
			const grow = line * step * 2;
			graphics.roundRect(
				-amountW / 2 - grow,
				-amountH / 2 - grow,
				amountW + grow * 2,
				amountH + grow * 2,
				radius + grow,
			);
			graphics.stroke({ color: PLATE_EDGE, width: line * 1.6, alpha: 0.06 * step });
		}
		graphics.roundRect(-amountW / 2, -amountH / 2, amountW, amountH, radius);
		graphics.fill({ color: PLATE_FILL, alpha: 0.96 });
		graphics.stroke({ color: PLATE_EDGE, width: line, alpha: 0.95 });
	};
</script>

<!-- Every layer stays mounted for the life of the card and is driven by alpha. Mounting one on
     demand would append it to the TOP of the container, which is how the plate ended up painted
     over the amount the first time round. -->
<Container x={shake.x} y={shake.y}>
	<Container alpha={plateReady ? 1 : 0}>
		<Container
			x={MARQUEE_PLATE.x * cardWidth}
			y={MARQUEE_PLATE.y * cardWidth}
			scale={plateScale}
			alpha={plateAlpha}
		>
			<Sprite
				key="winMarqueePlate"
				anchor={0.5}
				width={MARQUEE_PLATE.w * cardWidth}
				height={MARQUEE_PLATE.h * cardWidth}
			/>
			<Sprite
				key="winMarqueePlate"
				anchor={0.5}
				blendMode="add"
				width={MARQUEE_PLATE.w * cardWidth}
				height={MARQUEE_PLATE.h * cardWidth}
				alpha={plateBloom}
			/>
			<WinCardLights
				bulbs={MARQUEE_BULBS}
				size={cardWidth}
				origin={{ x: MARQUEE_PLATE.x, y: MARQUEE_PLATE.y }}
				colour={0xffcf7a}
				radius={0.036}
				cycles={3}
				speed={0.34}
				floor={0.2}
				intensity={clamp01(at(BULBS)) * (1 + impactDecay * 1.6)}
				{elapsed}
			/>
		</Container>

		{#each stars as star (star.side)}
			<Container x={star.x} y={star.y} scale={star.scale} rotation={star.rotation} alpha={star.alpha}>
				<Sprite
					key="winMarqueeStar"
					anchor={0.5}
					width={MARQUEE_STAR.w * cardWidth}
					height={MARQUEE_STAR.h * cardWidth}
				/>
				<Sprite
					key="winMarqueeStar"
					anchor={0.5}
					blendMode="add"
					width={MARQUEE_STAR.w * cardWidth * 1.5}
					height={MARQUEE_STAR.h * cardWidth * 1.5}
					alpha={star.flare}
				/>
			</Container>
		{/each}

		<Container x={textRect.x * cardWidth} y={textY} scale={textScale}>
			<Sprite
				key={TEXT_KEY[tier]}
				anchor={0.5}
				width={textRect.w * cardWidth}
				height={textRect.h * cardWidth}
				alpha={clamp01(at(TEXT) * 4)}
			/>
		</Container>
	</Container>

	<!-- The amount plate is drawn rather than loaded, so the number is readable even on the frame
	     before the card art arrives. -->
	<Container y={amountY} alpha={amountIn}>
		<Graphics draw={drawAmountPlate} />
		<Container scale={amountScale}>
			<Text
				anchor={0.5}
				text={amountText}
				onresize={({ width }) => (amountTextWidth = width)}
				style={{
					fontFamily: 'Lilita One',
					fontWeight: '400',
					fontSize,
					align: 'center',
					fill: AMOUNT_GOLD,
					letterSpacing: fontSize * 0.03,
					stroke: { color: 0x000000, width: Math.max(1, fontSize / 64) },
				}}
			/>
		</Container>
	</Container>
</Container>
